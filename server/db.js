// SQLite storage (Node's built-in driver). All queries use prepared statements with bound parameters.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('free','pro','studio')),
    trial_ends_at   TEXT,
    daily_rate      INTEGER,
    location        TEXT,
    failed_logins   INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_disciplines (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discipline  TEXT NOT NULL,
    PRIMARY KEY (user_id, discipline)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS companies (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    domain      TEXT NOT NULL,
    sector      TEXT NOT NULL,
    size        TEXT NOT NULL,
    city        TEXT NOT NULL,
    tech_stack  TEXT
  );

  CREATE TABLE IF NOT EXISTS decision_makers (
    id            INTEGER PRIMARY KEY,
    company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    role          TEXT NOT NULL,
    email         TEXT,
    phone         TEXT,
    linkedin_url  TEXT,
    UNIQUE (company_id, role)
  );

  CREATE TABLE IF NOT EXISTS listings (
    id              INTEGER PRIMARY KEY,
    batch_date      TEXT NOT NULL,
    source          TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    title           TEXT NOT NULL,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    discipline      TEXT NOT NULL,
    description     TEXT NOT NULL,
    location        TEXT NOT NULL,
    budget_hint     TEXT,
    fit_score       INTEGER NOT NULL,
    urgency         TEXT NOT NULL CHECK (urgency IN ('high','medium','low')),
    reasons         TEXT NOT NULL,
    decision_maker_id INTEGER REFERENCES decision_makers(id),
    posted_at       TEXT NOT NULL,
    UNIQUE (batch_date, source_url)
  );
  CREATE INDEX IF NOT EXISTS listings_batch ON listings(batch_date, discipline);

  CREATE TABLE IF NOT EXISTS leads (
    id                  INTEGER PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id          INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    delivered_on        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','replied','won','lost')),
    rating              TEXT CHECK (rating IN ('up','down')),
    notes               TEXT,
    won_amount          INTEGER,
    contacted_at        TEXT,
    replied_at          TEXT,
    won_at              TEXT,
    lost_at             TEXT,
    followup1_done_at   TEXT,
    followup2_done_at   TEXT,
    updated_at          TEXT NOT NULL,
    UNIQUE (user_id, listing_id)
  );
  CREATE INDEX IF NOT EXISTS leads_user ON leads(user_id, delivered_on);

  CREATE TABLE IF NOT EXISTS deliveries (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_on  TEXT NOT NULL,
    delivered     INTEGER NOT NULL,
    created_at    TEXT NOT NULL,
    UNIQUE (user_id, delivered_on)
  );

  CREATE TABLE IF NOT EXISTS batches (
    batch_date  TEXT PRIMARY KEY,
    scraped     INTEGER NOT NULL,
    qualified   INTEGER NOT NULL,
    enriched    INTEGER NOT NULL,
    stages      TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    channel     TEXT NOT NULL CHECK (channel IN ('email','linkedin','call')),
    discipline  TEXT,
    subject     TEXT,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS templates_user ON templates(user_id);

  -- Companies submitting a job offer to receive a freelance shortlist (reviewed by the team).
  CREATE TABLE IF NOT EXISTS mission_requests (
    id            INTEGER PRIMARY KEY,
    offer_url     TEXT,
    description   TEXT,
    company       TEXT NOT NULL,
    contact_name  TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT,
    status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','shortlisted','closed')),
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activities (
    id          INTEGER PRIMARY KEY,
    lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    detail      TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS activities_lead ON activities(lead_id);
`);

/** Run `fn` inside a transaction; rolls back on any error. */
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const nowIso = () => new Date().toISOString();
