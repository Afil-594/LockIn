import { Contract, JsonRpcProvider, Wallet, id } from 'ethers';
import { db } from './db.js';

const ABI = [
  'function recordDpPayment(bytes32 bookingRefHash, bytes32 agreementHash, bytes32 paymentRefHash) external',
  'function recordFinalPayment(bytes32 bookingRefHash, bytes32 agreementHash, bytes32 paymentRefHash) external',
  'function recordedPayments(bytes32 paymentRefHash) view returns (bool)'
];
let active = false;
const contracts = new Map();
let provider;

function ready() {
  return Boolean(process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_WRITER_PRIVATE_KEY && process.env.LOCKIN_CONTRACT_ADDRESS);
}

async function getContract(paymentType) {
  if (!['DP', 'FINAL'].includes(paymentType)) {
    throw new Error('Jenis pembayaran tidak dikenal.');
  }

  if (!provider) {
    provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

    const network = await provider.getNetwork();

    if (network.chainId !== 11155111n) {
      throw new Error('RPC bukan jaringan Ethereum Sepolia.');
    }
  }

  const address = paymentType === 'FINAL'
    ? process.env.SEPOLIA_FINAL_CONTRACT_ADDRESS
    : process.env.LOCKIN_CONTRACT_ADDRESS;

  if (!address) {
    throw new Error(`Alamat kontrak untuk ${paymentType} belum diatur.`);
  }

  if (!contracts.has(paymentType)) {
    const wallet = new Wallet(
      process.env.SEPOLIA_WRITER_PRIVATE_KEY,
      provider
    );

    contracts.set(
      paymentType,
      new Contract(address, ABI, wallet)
    );
  }

  return contracts.get(paymentType);
}

// Outbox: pembayaran dicatat dahulu, lalu job blockchain diproses terpisah.
// Jika RPC/gas bermasalah, pembayaran tidak diubah menjadi gagal.
export async function syncBlockchainJobs() {
  if (!ready() || active) return;
  active = true;
  try {
    const jobs = db.prepare(`
      SELECT j.*, b.agreement_hash, p.provider_order_id, p.payment_type
      FROM blockchain_jobs j
      JOIN bookings b ON b.id = j.booking_id
      JOIN payments p ON p.id = j.payment_id
      WHERE j.status IN ('QUEUED', 'RETRY', 'SUBMITTED') AND j.retry_after <= ?
      ORDER BY j.id ASC LIMIT 3
    `).all(Date.now());
    for (const job of jobs) {
      try {
        const c = await getContract(job.payment_type);
        const bookingRefHash = id(job.booking_id);
        const agreementHash = `0x${job.agreement_hash}`; // SHA256 perjanjian, bukan teks lengkapnya.
        const paymentHash = id(job.provider_order_id);
        if (job.status === 'SUBMITTED' && job.tx_hash) {
          const receipt = await provider.getTransactionReceipt(job.tx_hash);
          if (receipt?.status === 1) {
            db.prepare(`UPDATE blockchain_jobs SET status='CONFIRMED',last_error=NULL WHERE id=?`).run(job.id);
          } else if (receipt?.status === 0) {
            db.prepare(`UPDATE blockchain_jobs SET status='RETRY',last_error='Transaksi reverted',retry_after=? WHERE id=?`).run(Date.now()+60000,job.id);
          }
          continue; // Transaksi yang pending tidak dikirim dua kali.
        }
        const alreadyRecorded = await c.recordedPayments(paymentHash);
        if (alreadyRecorded) {
          db.prepare(`UPDATE blockchain_jobs SET status='CONFIRMED',last_error=NULL WHERE id=?`).run(job.id);
          continue;
        }
        const tx = job.payment_type === 'FINAL'
          ? await c.recordFinalPayment(
              bookingRefHash,
              agreementHash,
              paymentHash
            )
          : await c.recordDpPayment(
              bookingRefHash,
              agreementHash,
              paymentHash
            );
        db.prepare('UPDATE blockchain_jobs SET status=?,tx_hash=?,last_error=NULL WHERE id=?').run('SUBMITTED', tx.hash, job.id);
        // Konfirmasi dilakukan worker pada siklus berikutnya agar proses tidak memblokir lama.
      } catch (error) {
        console.error('Sepolia sync:', error.message);
        db.prepare(`UPDATE blockchain_jobs SET status='RETRY',last_error=?,retry_after=? WHERE id=?`).run(String(error.message).slice(0, 300), Date.now() + 60000, job.id);
      }
    }
  } finally {
    active = false;
  }
}
