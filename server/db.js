'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/designs.db';

// Ensure the data directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS designs (
    id                   TEXT PRIMARY KEY,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name        TEXT NOT NULL,
    customer_email       TEXT NOT NULL,
    params               TEXT NOT NULL,          -- JSON string of bike parameters
    pdf_base64           TEXT,                   -- PDF generated client-side, stored as base64
    status               TEXT NOT NULL DEFAULT 'pending',
                                                 -- pending | checkout_created | paid | delivered | failed
    wc_order_id          TEXT,
    wc_checkout_url      TEXT,
    download_token       TEXT,
    download_expires_at  DATETIME,
    delivered_at         DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_designs_email        ON designs (customer_email);
  CREATE INDEX IF NOT EXISTS idx_designs_status       ON designs (status);
  CREATE INDEX IF NOT EXISTS idx_designs_download_tok ON designs (download_token);
  CREATE INDEX IF NOT EXISTS idx_designs_wc_id        ON designs (wc_order_id);
`);

module.exports = db;
