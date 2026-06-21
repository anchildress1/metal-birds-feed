import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import type { Aircraft } from './schema.js';

const bySourceId = (a: Aircraft, b: Aircraft): number => {
  if (a.source_id < b.source_id) return -1;
  if (a.source_id > b.source_id) return 1;
  return 0;
};

// Content fingerprint over the sorted records, independent of SQLite's byte layout (which is not
// guaranteed stable run to run). Drives skip-if-unchanged.
export const hashRecords = (records: Map<string, Aircraft>): string => {
  const hash = createHash('sha256');
  for (const record of [...records.values()].sort(bySourceId)) {
    hash.update(`${record.source_id}\0${JSON.stringify(record)}\n`);
  }
  return hash.digest('hex');
};

// One SQLite database per source: a row per aircraft indexed for point lookup by icao_hex /
// registration, with the full canonical record preserved as JSON. Built in memory and returned as
// bytes for a direct R2 PUT — no filesystem.
export const buildSqlite = (records: Map<string, Aircraft>): Uint8Array => {
  const db = new Database(':memory:');
  try {
    db.run(
      'CREATE TABLE aircraft (source_id TEXT PRIMARY KEY, icao_hex TEXT, registration TEXT, record TEXT NOT NULL) STRICT'
    );
    db.run('CREATE INDEX idx_icao_hex ON aircraft (icao_hex)');
    db.run('CREATE INDEX idx_registration ON aircraft (registration)');
    const insert = db.prepare(
      'INSERT INTO aircraft (source_id, icao_hex, registration, record) VALUES (?, ?, ?, ?)'
    );
    const insertAll = db.transaction((rows: Aircraft[]) => {
      for (const r of rows) insert.run(r.source_id, r.icao_hex, r.registration, JSON.stringify(r));
    });
    insertAll([...records.values()].sort(bySourceId));
    return db.serialize();
  } finally {
    db.close();
  }
};
