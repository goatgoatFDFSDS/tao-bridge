const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'relayer.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// Track last processed block per chain
db.exec(`
  CREATE TABLE IF NOT EXISTS last_block (
    chain_id   INTEGER PRIMARY KEY,
    block_num  INTEGER NOT NULL DEFAULT 0
  );
`);

// Track processed deposit nonces (source → Bittensor)
db.exec(`
  CREATE TABLE IF NOT EXISTS processed_deposits (
    src_chain_id  INTEGER NOT NULL,
    src_nonce     TEXT    NOT NULL,
    tx_hash       TEXT,
    status        TEXT    NOT NULL DEFAULT 'pending',
    processed_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (src_chain_id, src_nonce)
  );
`);

// Track processed withdraw nonces (Bittensor → source)
db.exec(`
  CREATE TABLE IF NOT EXISTS processed_withdrawals (
    withdraw_nonce TEXT    PRIMARY KEY,
    dest_chain_id  INTEGER NOT NULL,
    tx_hash        TEXT,
    status         TEXT    NOT NULL DEFAULT 'done',
    processed_at   INTEGER DEFAULT (unixepoch())
  );
`);
// Migration: add status column for existing DBs
try { db.exec(`ALTER TABLE processed_withdrawals ADD COLUMN status TEXT NOT NULL DEFAULT 'done'`); } catch {}

// Pending queue: events that failed and need retry
db.exec(`
  CREATE TABLE IF NOT EXISTS pending_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,  -- 'deposit' or 'withdrawal'
    data        TEXT    NOT NULL,  -- JSON
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  INTEGER DEFAULT (unixepoch())
  );
`);

// ─── Last block helpers ───────────────────────────────────────────────────────

function getLastBlock(chainId) {
  const row = db.prepare('SELECT block_num FROM last_block WHERE chain_id = ?').get(chainId);
  return row ? row.block_num : 0;
}

function setLastBlock(chainId, blockNum) {
  db.prepare(`
    INSERT INTO last_block (chain_id, block_num)
    VALUES (?, ?)
    ON CONFLICT(chain_id) DO UPDATE SET block_num = excluded.block_num
  `).run(chainId, blockNum);
}

// ─── Deposit helpers ─────────────────────────────────────────────────────────

function isDepositProcessed(srcChainId, srcNonce) {
  const row = db.prepare(
    'SELECT 1 FROM processed_deposits WHERE src_chain_id = ? AND src_nonce = ?'
  ).get(srcChainId, String(srcNonce));
  return !!row;
}

// Atomically claim a nonce — returns true if this instance claimed it first
function claimDeposit(srcChainId, srcNonce) {
  const result = db.prepare(`
    INSERT OR IGNORE INTO processed_deposits (src_chain_id, src_nonce, status)
    VALUES (?, ?, 'pending')
  `).run(srcChainId, String(srcNonce));
  return result.changes === 1; // true = we claimed it, false = already claimed
}

function markDepositProcessed(srcChainId, srcNonce, txHash) {
  db.prepare(`
    UPDATE processed_deposits SET tx_hash = ?, status = 'done'
    WHERE src_chain_id = ? AND src_nonce = ?
  `).run(txHash, srcChainId, String(srcNonce));
}

function markDepositPending(srcChainId, srcNonce) {
  db.prepare(`
    UPDATE processed_deposits SET status = 'manual'
    WHERE src_chain_id = ? AND src_nonce = ?
  `).run(srcChainId, String(srcNonce));
}

// ─── Withdrawal helpers ───────────────────────────────────────────────────────

function isWithdrawalProcessed(withdrawNonce) {
  const row = db.prepare(
    'SELECT 1 FROM processed_withdrawals WHERE withdraw_nonce = ?'
  ).get(String(withdrawNonce));
  return !!row;
}

function markWithdrawalProcessed(withdrawNonce, destChainId, txHash) {
  db.prepare(`
    INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash, status)
    VALUES (?, ?, ?, 'done')
  `).run(String(withdrawNonce), destChainId, txHash);
}

function markWithdrawalManual(withdrawNonce, destChainId) {
  db.prepare(`
    INSERT OR IGNORE INTO processed_withdrawals (withdraw_nonce, dest_chain_id, tx_hash, status)
    VALUES (?, ?, NULL, 'manual')
  `).run(String(withdrawNonce), destChainId);
}

// ─── Pending queue helpers ────────────────────────────────────────────────────

function addPending(type, data) {
  db.prepare('INSERT INTO pending_queue (type, data) VALUES (?, ?)').run(type, JSON.stringify(data));
}

function getPending(limit = 20) {
  return db.prepare(
    'SELECT * FROM pending_queue WHERE attempts < 5 ORDER BY created_at ASC LIMIT ?'
  ).all(limit).map(row => ({ ...row, data: JSON.parse(row.data) }));
}

function incrementAttempts(id, error) {
  db.prepare('UPDATE pending_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?')
    .run(error, id);
}

function removePending(id) {
  db.prepare('DELETE FROM pending_queue WHERE id = ?').run(id);
}

module.exports = {
  getLastBlock,
  setLastBlock,
  isDepositProcessed,
  claimDeposit,
  markDepositProcessed,
  markDepositPending,
  isWithdrawalProcessed,
  markWithdrawalProcessed,
  markWithdrawalManual,
  addPending,
  getPending,
  incrementAttempts,
  removePending,
};
