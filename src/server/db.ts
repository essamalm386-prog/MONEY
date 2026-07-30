/**
 * Accès base de données — SQLite embarqué (local & en ligne).
 *
 * Utilise `better-sqlite3` (synchrone, éprouvé). Le mode WAL est activé pour
 * la robustesse (résistance aux coupures) et la concurrence lecture/écriture.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agencies (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  contact  TEXT,
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chantiers (
  id        TEXT PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  address   TEXT,
  client    TEXT,
  startDate TEXT,
  endDate   TEXT,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workers (
  id         TEXT PRIMARY KEY,
  firstName  TEXT NOT NULL,
  lastName   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('EMPLOYE','INTERIMAIRE')),
  category   TEXT,
  trade      TEXT,
  agencyId   TEXT REFERENCES agencies(id),
  hourlyRate REAL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS costs (
  workerId        TEXT NOT NULL REFERENCES workers(id),
  chantierId      TEXT NOT NULL REFERENCES chantiers(id),
  hourlyRate      REAL,
  mealAllowance   REAL,
  travelAllowance REAL,
  PRIMARY KEY (workerId, chantierId)
);

CREATE TABLE IF NOT EXISTS assignments (
  id               TEXT PRIMARY KEY,
  workerId         TEXT NOT NULL REFERENCES workers(id),
  chantierId       TEXT NOT NULL REFERENCES chantiers(id),
  startDate        TEXT NOT NULL,
  endDate          TEXT,
  assignedBy       TEXT NOT NULL,
  replacesWorkerId TEXT,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
  note             TEXT,
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  sync             TEXT NOT NULL DEFAULT 'SYNCED',
  deleted          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_assign_chantier ON assignments(chantierId);
CREATE INDEX IF NOT EXISTS idx_assign_worker   ON assignments(workerId);
CREATE INDEX IF NOT EXISTS idx_assign_dates    ON assignments(startDate, endDate);

CREATE TABLE IF NOT EXISTS entries (
  id               TEXT PRIMARY KEY,
  workerId         TEXT NOT NULL REFERENCES workers(id),
  chantierId       TEXT NOT NULL REFERENCES chantiers(id),
  date             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('TRAVAIL','ABSENCE','INTEMPERIE','ACCIDENT')),
  minutes          INTEGER NOT NULL DEFAULT 0,
  startTime        TEXT,
  endTime          TEXT,
  breakMinutes     INTEGER,
  absenceReason    TEXT,
  accidentSeverity TEXT,
  note             TEXT,
  recordedBy       TEXT NOT NULL,
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  sync             TEXT NOT NULL DEFAULT 'SYNCED',
  deleted          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_date      ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_worker    ON entries(workerId);
CREATE INDEX IF NOT EXISTS idx_entries_chantier  ON entries(chantierId);
CREATE INDEX IF NOT EXISTS idx_entries_updatedAt ON entries(updatedAt);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entry_natural
  ON entries(workerId, chantierId, date, kind) WHERE deleted = 0;
`;

/**
 * Migrations idempotentes pour les bases existantes : ajoute les colonnes
 * manquantes sans perdre de données (les nouvelles tables sont créées par le
 * schéma via CREATE TABLE IF NOT EXISTS).
 */
function migrate(db: DB): void {
  const cols = db.prepare("PRAGMA table_info(workers)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "category")) {
    db.exec("ALTER TABLE workers ADD COLUMN category TEXT");
  }
}

/** Ouvre (ou crée) la base et applique le schéma. */
export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
