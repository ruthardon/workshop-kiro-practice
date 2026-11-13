-- ClaimShield (SQLite): esquema equivalente a db/init.sql
-- Montos en centavos enteros (columnas *_cents); fechas como texto ISO 8601.
CREATE TABLE policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_number TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL,
  national_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  deductible_cents INTEGER NOT NULL,
  coverage_limit_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id INTEGER NOT NULL REFERENCES policies(id),
  description TEXT NOT NULL,
  incident_date TEXT NOT NULL,
  claimed_amount_cents INTEGER NOT NULL,
  indemnity_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'APPROVED', 'REJECTED', 'CLOSED')),
  closed_at TEXT NULL,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE claim_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id),
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_claims_policy ON claims(policy_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_audits_claim ON claim_audits(claim_id);
