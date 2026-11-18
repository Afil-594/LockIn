
/**
 * LockIn — Audit pembayaran DP dan FINAL.
 * Pemeriksaan bersifat read-only.
 * Jalankan dari folder backend:
 * node audit-lockin.mjs
 */

import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import {
  Contract,
  id,
  Interface,
  isAddress,
  JsonRpcProvider
} from "ethers";

let passed = 0;
let failed = 0;
let warnings = 0;

const pass = message => {
  passed++;
  console.log(`  [OK] ${message}`);
};

const fail = message => {
  failed++;
  console.log(`  [GAGAL] ${message}`);
};

const warn = message => {
  warnings++;
  console.log(`  [PERLU DICEK] ${message}`);
};

// Konfigurasi dua smart contract.
const contracts = {
  DP: {
    address: process.env.LOCKIN_CONTRACT_ADDRESS,
    eventName: "DpPaymentRecorded"
  },
  FINAL: {
    address: process.env.SEPOLIA_FINAL_CONTRACT_ADDRESS,
    eventName: "FinalPaymentRecorded"
  }
};

// Struktur event sesuai smart contract.
const events = {
  DP: new Interface([
    "event DpPaymentRecorded(bytes32 indexed bookingRefHash, bytes32 indexed paymentRefHash, bytes32 agreementHash, uint256 recordedAt)"
  ]),
  FINAL: new Interface([
    "event FinalPaymentRecorded(bytes32 indexed bookingRefHash, bytes32 indexed paymentRefHash, bytes32 agreementHash, uint256 recordedAt)"
  ])
};

const databasePath = path.resolve(
  process.cwd(),
  "data",
  "lockin.sqlite"
);

let db;
let provider;

const writerCache = new Map();

// Memeriksa transaksi yang berstatus CONFIRMED.
async function auditConfirmedJob(job, payment, booking) {
  const kind = payment.payment_type;
  const config = contracts[kind];

  if (!job.tx_hash) {
    warn(
      `${kind}: CONFIRMED tanpa tx_hash. ` +
      "Verifikasi transaksi historis diperlukan."
    );
    return;
  }

  if (
    !provider ||
    !config?.address ||
    !isAddress(config.address)
  ) {
    warn(
      `${kind}: RPC atau alamat kontrak tidak tersedia.`
    );
    return;
  }

  try {
    const receipt = await provider.getTransactionReceipt(
      job.tx_hash
    );

    if (!receipt) {
      warn(
        `${kind}: receipt belum ditemukan (${job.tx_hash})`
      );
      return;
    }

    // Pemeriksaan status transaksi.
    if (receipt.status !== 1) {
      fail(`${kind}: receipt transaksi tidak berhasil`);
      return;
    }

    pass(`${kind}: receipt Sepolia berhasil`);

    // Pemeriksaan alamat smart contract.
    if (
      receipt.to?.toLowerCase() !==
      config.address.toLowerCase()
    ) {
      fail(`${kind}: alamat kontrak tujuan tidak cocok`);
      return;
    }

    pass(`${kind}: tujuan kontrak sesuai`);

    // Pemeriksaan wallet authorizedWriter.
    let authorizedWriter = writerCache.get(kind);

    if (!authorizedWriter) {
      const contract = new Contract(
        config.address,
        [
          "function authorizedWriter() view returns (address)"
        ],
        provider
      );

      authorizedWriter =
        await contract.authorizedWriter();

      writerCache.set(kind, authorizedWriter);
    }

    if (
      receipt.from.toLowerCase() ===
      authorizedWriter.toLowerCase()
    ) {
      pass(`${kind}: pengirim sesuai authorizedWriter`);
    } else {
      fail(`${kind}: pengirim bukan authorizedWriter`);
    }

    // Mengambil event dari transaction receipt.
    const matchingEvents = [];

    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() !==
        config.address.toLowerCase()
      ) {
        continue;
      }

      try {
        const parsed = events[kind].parseLog(log);

        if (parsed?.name === config.eventName) {
          matchingEvents.push(parsed.args);
        }
      } catch {
        // Log lain tidak termasuk event ini.
      }
    }

    if (matchingEvents.length !== 1) {
      fail(
        `${kind}: diharapkan 1 event ` +
        `${config.eventName}, ditemukan ` +
        matchingEvents.length
      );
      return;
    }

    pass(
      `${kind}: event ${config.eventName} ditemukan`
    );

    const event = matchingEvents[0];

    // Verifikasi hash referensi booking.
    if (
      event.bookingRefHash.toLowerCase() ===
      id(booking.id).toLowerCase()
    ) {
      pass(`${kind}: bookingRefHash cocok`);
    } else {
      fail(`${kind}: bookingRefHash berbeda`);
    }

    // Verifikasi hash referensi pembayaran.
    if (
      event.paymentRefHash.toLowerCase() ===
      id(payment.provider_order_id).toLowerCase()
    ) {
      pass(`${kind}: paymentRefHash cocok`);
    } else {
      fail(`${kind}: paymentRefHash berbeda`);
    }

    // Verifikasi hash kesepakatan digital.
    if (
      event.agreementHash.toLowerCase() ===
      `0x${booking.agreement_hash}`.toLowerCase()
    ) {
      pass(
        `${kind}: agreementHash cocok dengan database`
      );
    } else {
      fail(
        `${kind}: agreementHash berbeda dari database`
      );
    }
  } catch (error) {
    warn(
      `${kind}: pemeriksaan RPC bermasalah ` +
      `(${error.shortMessage || error.message})`
    );
  }
}

// Proses audit utama.
try {
  db = new Database(databasePath, {
    readonly: true,
    fileMustExist: true
  });

  db.pragma("query_only = ON");

  console.log(
    "\n=== AUDIT LOCKIN: DP + PELUNASAN (READ ONLY) ==="
  );

  // 1. Validasi tabel database.
  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `).all().map(row => row.name);

  const required = [
    "bookings",
    "payments",
    "ledger_entries",
    "blockchain_jobs"
  ];

  for (const name of required) {
    if (tables.includes(name)) {
      pass(`Tabel ${name} ada`);
    } else {
      fail(`Tabel ${name} tidak ada`);
    }
  }

  if (!required.every(name => tables.includes(name))) {
    throw new Error(
      "Audit dihentikan karena tabel utama belum lengkap"
    );
  }

  // 2. Validasi kolom jenis pembayaran.
  const paymentColumns = db.pragma(
    "table_info(payments)"
  );

  if (
    !paymentColumns.some(
      column => column.name === "payment_type"
    )
  ) {
    throw new Error(
      "Kolom payments.payment_type belum tersedia."
    );
  }

  pass("Kolom payments.payment_type tersedia");

  // 3. Validasi koneksi Ethereum Sepolia.
  if (process.env.SEPOLIA_RPC_URL) {
    try {
      provider = new JsonRpcProvider(
        process.env.SEPOLIA_RPC_URL
      );

      const network = await provider.getNetwork();

      if (network.chainId !== 11155111n) {
        fail(
          `RPC memakai chainId ${network.chainId}, ` +
          "bukan Sepolia"
        );

        provider.destroy();
        provider = null;
      } else {
        pass("RPC terhubung ke Ethereum Sepolia");
      }
    } catch (error) {
      warn(
        "Koneksi Sepolia bermasalah " +
        `(${error.shortMessage || error.message})`
      );

      provider?.destroy();
      provider = null;
    }
  } else {
    warn("SEPOLIA_RPC_URL tidak tersedia");
  }

  // 4. Mengambil seluruh booking.
  const bookings = db.prepare(`
    SELECT *
    FROM bookings
    ORDER BY id
  `).all();

  if (bookings.length) {
    pass(`Ditemukan ${bookings.length} booking`);
  } else {
    warn("Belum ada booking");
  }

  const findPayments = db.prepare(`
    SELECT *
    FROM payments
    WHERE booking_id = ?
    ORDER BY id
  `);

  const findLedger = db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(amount), 0) AS amount,
      SUM(
        CASE
          WHEN entry_type <> 'SIMULATED_HELD'
          THEN 1
          ELSE 0
        END
      ) AS wrong_type
    FROM ledger_entries
    WHERE payment_id = ?
  `);

  const findJob = db.prepare(`
    SELECT *
    FROM blockchain_jobs
    WHERE payment_id = ?
  `);

  const findHeld = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS amount
    FROM ledger_entries
    WHERE booking_id = ?
      AND entry_type = 'SIMULATED_HELD'
  `);

  // 5. Audit masing-masing booking.
  for (const booking of bookings) {
    console.log(
      `\nBOOKING ${booking.id} | ` +
      `${booking.status} | ` +
      `Total Rp${booking.total_amount}`
    );

    if (
      /^[0-9a-f]{64}$/i.test(booking.agreement_hash)
    ) {
      pass("Format agreement_hash valid");
    } else {
      fail("Format agreement_hash tidak valid");
    }

    const payments = findPayments.all(booking.id);

    if (!payments.length) {
      warn("Booking belum memiliki pembayaran");
    }

    const paidDp = payments.filter(
      p =>
        p.payment_type === "DP" &&
        p.status === "PAID"
    );

    const paidFinal = payments.filter(
      p =>
        p.payment_type === "FINAL" &&
        p.status === "PAID"
    );

    // Satu pembayaran berhasil per jenis.
    if (
      paidDp.length <= 1 &&
      paidFinal.length <= 1
    ) {
      pass(
        "Tidak ditemukan pembayaran sukses " +
        "berulang untuk jenis yang sama"
      );
    } else {
      fail(
        `Pembayaran sukses berulang: ` +
        `DP=${paidDp.length}, FINAL=${paidFinal.length}`
      );
    }

    // Status booking harus sesuai pembayaran.
    const expectedBookingStatus = paidFinal.length
      ? "FULLY_PAID"
      : paidDp.length
      ? "DP_PAID"
      : "APPROVED_AWAITING_DP";

    if (
      booking.status === expectedBookingStatus
    ) {
      pass(
        `Status booking sesuai: ${booking.status}`
      );
    } else {
      fail(
        `Status booking ${booking.status}, ` +
        `seharusnya ${expectedBookingStatus}`
      );
    }

    if (!paidDp.length && paidFinal.length) {
      fail(
        "Ada pelunasan PAID tanpa DP PAID"
      );
    }

    // Jumlah ledger harus sama dengan pembayaran PAID.
    const expectedHeld = payments
      .filter(p => p.status === "PAID")
      .reduce(
        (total, p) => total + p.amount,
        0
      );

    const actualHeld =
      findHeld.get(booking.id).amount;

    if (actualHeld === expectedHeld) {
      pass(
        `Total ledger sesuai: Rp${actualHeld}`
      );
    } else {
      fail(
        `Total ledger Rp${actualHeld}, ` +
        `jumlah PAID Rp${expectedHeld}`
      );
    }

    if (
      booking.status === "FULLY_PAID" &&
      expectedHeld !== booking.total_amount
    ) {
      fail(
        "Booking FULLY_PAID tetapi total pembayaran " +
        "tidak sama dengan harga paket"
      );
    }

    // 6. Audit setiap pembayaran DP dan FINAL.
    for (const payment of payments) {
      const kind = payment.payment_type;

      console.log(
        `  ${kind} | ${payment.provider_order_id} | ` +
        `${payment.status} | Rp${payment.amount}`
      );

      if (!["DP", "FINAL"].includes(kind)) {
        fail(
          `Jenis pembayaran tidak dikenal: ${kind}`
        );
        continue;
      }

      const expectedAmount =
        kind === "DP"
          ? booking.dp_amount
          : booking.total_amount -
            booking.dp_amount;

      if (payment.amount === expectedAmount) {
        pass(`${kind}: nominal sesuai`);
      } else {
        fail(
          `${kind}: nominal Rp${payment.amount}, ` +
          `seharusnya Rp${expectedAmount}`
        );
      }

      const ledger = findLedger.get(payment.id);
      const job = findJob.get(payment.id);

      if (payment.status === "PAID") {
        if (
          ledger.count === 1 &&
          ledger.amount === payment.amount &&
          ledger.wrong_type === 0
        ) {
          pass(
            `${kind}: tepat satu ledger ` +
            "SIMULATED_HELD sesuai nominal"
          );
        } else {
          fail(
            `${kind}: ledger tidak sesuai ` +
            `(baris=${ledger.count}, ` +
            `jumlah=${ledger.amount})`
          );
        }

        if (job) {
          pass(
            `${kind}: blockchain job ada ` +
            `(${job.status})`
          );
        } else {
          fail(
            `${kind}: pembayaran PAID ` +
            "tanpa blockchain job"
          );
        }
      } else {
        if (ledger.count === 0) {
          pass(
            `${kind}: pembayaran belum PAID tanpa ledger`
          );
        } else {
          fail(
            `${kind}: pembayaran belum PAID memiliki ledger`
          );
        }

        if (!job) {
          pass(
            `${kind}: pembayaran belum PAID tanpa blockchain job`
          );
        } else {
          fail(
            `${kind}: pembayaran belum PAID memiliki blockchain job`
          );
        }
      }

      // 7. Audit transaksi blockchain.
      if (job?.status === "CONFIRMED") {
        await auditConfirmedJob(
          job,
          payment,
          booking
        );
      } else if (job?.status === "RETRY") {
        warn(
          `${kind}: job RETRY ` +
          `(${job.last_error || "tanpa pesan error"})`
        );
      } else if (
        job?.status === "QUEUED" ||
        job?.status === "SUBMITTED"
      ) {
        warn(
          `${kind}: job masih ${job.status}`
        );
      } else if (
        job &&
        job.status !== "CONFIRMED"
      ) {
        warn(
          `${kind}: status blockchain job ` +
          `tidak dikenal (${job.status})`
        );
      }
    }
  }
} catch (error) {
  fail(
    `Audit tidak dapat diselesaikan: ${error.message}`
  );
} finally {
  db?.close();
  provider?.destroy();

  console.log(
    `\nHASIL: ${passed} OK | ` +
    `${failed} GAGAL | ` +
    `${warnings} PERLU DICEK`
  );

  console.log(
    "Audit baca-saja; hash cocok tidak membuktikan " +
    "persetujuan asli kedua pihak."
  );

  if (failed) {
    process.exitCode = 1;
  }
}
