export type Bind = string | number | null;

// One artifact row as stored: the record's columns plus first_seen, removed_on and missing_since.
// Carried rows stay raw rather than parsed back into Aircraft, so a column added after they were
// closed copies across as NULL instead of failing a parse on a shape they never had.
export type ArtifactRow = Record<string, Bind>;

const text = (row: ArtifactRow, column: string): string | null => {
  const value = row[column];
  return typeof value === 'string' ? value : null;
};

// A different non-null serial under the same source_id is a different airframe. Null on either
// side proves nothing: a register that stops printing a serial must not close its own row.
const isReuse = (stored: ArtifactRow, incoming: ArtifactRow): boolean => {
  const before = text(stored, 'serial_number');
  const after = text(incoming, 'serial_number');
  return before !== null && after !== null && before !== after;
};

const sourceId = (row: ArtifactRow): string => text(row, 'source_id') ?? '';

const byRecency = (a: ArtifactRow, b: ArtifactRow): number =>
  (text(a, 'removed_on') ?? '').localeCompare(text(b, 'removed_on') ?? '') ||
  (text(a, 'first_seen') ?? '').localeCompare(text(b, 'first_seen') ?? '');

const live = (record: ArtifactRow, firstSeen: string): ArtifactRow => ({
  ...record,
  first_seen: firstSeen,
  removed_on: null,
  missing_since: null,
});

const closed = (row: ArtifactRow, removedOn: string): ArtifactRow => ({
  ...row,
  removed_on: removedOn,
  missing_since: null,
});

interface Split {
  liveById: Map<string, ArtifactRow>;
  closedById: Map<string, ArtifactRow[]>;
}

const split = (rows: ArtifactRow[]): Split => {
  const liveById = new Map<string, ArtifactRow>();
  const closedById = new Map<string, ArtifactRow[]>();
  for (const row of rows) {
    const id = sourceId(row);
    if (row['removed_on'] === null) liveById.set(id, row);
    else closedById.set(id, [...(closedById.get(id) ?? []), row]);
  }
  return { liveById, closedById };
};

interface Outcome {
  open: ArtifactRow[];
  closedNow: ArtifactRow[];
  reopened: Set<ArtifactRow>;
}

// What one present record does to the history: continue its live row, reopen the latest closed one,
// or start a new row, closing the live one first when the serial says it is a different airframe.
const place = (
  record: ArtifactRow,
  liveRow: ArtifactRow | undefined,
  closedRows: ArtifactRow[],
  today: string,
  outcome: Outcome
): void => {
  if (liveRow) {
    if (isReuse(liveRow, record)) {
      outcome.closedNow.push(closed(liveRow, today));
      outcome.open.push(live(record, today));
    } else outcome.open.push(live(record, text(liveRow, 'first_seen') ?? today));
    return;
  }
  const latest = [...closedRows].sort(byRecency).at(-1);
  if (latest && !isReuse(latest, record)) {
    outcome.reopened.add(latest);
    outcome.open.push(live(record, text(latest, 'first_seen') ?? today));
  } else outcome.open.push(live(record, today));
};

/**
 * Folds one fetched run into the stored history and returns every row to write.
 * `incoming` is the run's records keyed by source_id, without history columns; `today` is a UTC date.
 * A live row absent from the run stays live with `missing_since` stamped, and closes on the second
 * consecutive miss at the date of the first. A return after close reopens the row with its original
 * `first_seen`, unless the serial changed, which opens a new row beside the closed one.
 */
export const mergeHistory = (
  stored: ArtifactRow[] | null,
  incoming: Map<string, ArtifactRow>,
  today: string
): ArtifactRow[] => {
  const prior = stored ?? [];
  const { liveById, closedById } = split(prior);
  const outcome: Outcome = { open: [], closedNow: [], reopened: new Set() };

  for (const [id, record] of incoming)
    place(record, liveById.get(id), closedById.get(id) ?? [], today, outcome);

  for (const [id, row] of liveById) {
    if (incoming.has(id)) continue;
    const since = text(row, 'missing_since');
    if (since === null) outcome.open.push({ ...row, missing_since: today });
    else outcome.closedNow.push(closed(row, since));
  }

  const kept = prior.filter((row) => row['removed_on'] !== null && !outcome.reopened.has(row));
  return [...outcome.open, ...kept, ...outcome.closedNow];
};

const rowKey = (row: ArtifactRow): string => `${sourceId(row)}\0${text(row, 'first_seen') ?? ''}`;

/**
 * Throws when a closed row from `stored` is in neither the closed nor the live rows of `merged`.
 * A closed row may legitimately leave the closed set only by reopening, which keeps its first_seen.
 */
export const assertHistoryPreserved = (
  source: string,
  stored: ArtifactRow[] | null,
  merged: ArtifactRow[]
): void => {
  const present = new Set(merged.map(rowKey));
  const lost = (stored ?? []).filter(
    (row) => row['removed_on'] !== null && !present.has(rowKey(row))
  );
  if (lost.length > 0)
    throw new Error(
      `Refusing to write "${source}": ${lost.length} closed history row(s) would be dropped (first: ${rowKey(lost[0]).replace('\0', ' / ')})`
    );
};
