import { readFileSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { CANONICAL_PATHS } from '../schema.js';
import {
  SCALAR_TRANSFORMS,
  ARRAY_TRANSFORMS,
  COMPOUND_TRANSFORMS,
  type SourceConfig,
} from '../types/config.js';

// CLDR, via the runtime's own tables, is the authority on which two-letter subtags are assigned —
// a hand-kept list would drift and silently reject a legitimate register. `fallback: 'none'`
// returns undefined for an unassigned subtag instead of echoing the input back.
const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

const isIso639_1 = (code: string): boolean => {
  try {
    return LANGUAGE_NAMES.of(code) !== undefined;
  } catch {
    return false;
  }
};

const isValidRegex = (pattern: string): boolean => {
  try {
    // Pattern source is `sources/<id>.yaml`, a repo-controlled config — not runtime input.
    // The constructed RegExp is discarded immediately; this is a syntax-validity probe only.
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

// record_count.pattern is read positionally (`.exec(text)?.[1]`), so a pattern with zero capture
// groups would silently produce `undefined` and surface as a misleading "matched no count" runtime
// error instead of a config-time one. Matching against '' with a trailing empty alternative forces
// every group in the pattern to appear (as undefined) in the result array without requiring the
// pattern itself to match anything, so the array length reports the true group count.
const hasOneCaptureGroup = (pattern: string): boolean => {
  try {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const match = new RegExp(`(?:${pattern})|`).exec('');
    return (match?.length ?? 0) - 1 === 1;
  } catch {
    return true; // invalid regex is already reported by the isValidRegex refine
  }
};

// strictObject throughout: source YAML is hand-written, so an unknown key is a typo that strip
// mode would silently discard — the engine would then read `undefined` forever with no error.
const FieldMappingSchema = z
  .strictObject({
    field: z.string().optional(),
    fields: z.array(z.string().min(1)).min(1).optional(),
    constant: z.string().nullable().optional(),
    transform: z.enum(SCALAR_TRANSFORMS).optional(),
    array_transform: z.enum(ARRAY_TRANSFORMS).optional(),
    compound_transform: z.enum(COMPOUND_TRANSFORMS).optional(),
    lookup: z.record(z.string(), z.string().nullable()).optional(),
    null_values: z.array(z.string().min(1)).min(1).optional(),
    default: z.string().nullable().optional(),
  })
  // The mapping kinds are mutually exclusive; the engine resolves constant before field before
  // fields, so a combined mapping would silently ignore the losers instead of erroring.
  .refine((v) => [v.field, v.fields, v.constant].filter((x) => x !== undefined).length === 1, {
    message: 'FieldMapping requires exactly one of field, fields, or constant',
  })
  .refine((v) => (v.compound_transform === undefined) === (v.fields === undefined), {
    message: 'compound_transform requires fields, and fields requires compound_transform',
  })
  .refine(
    (v) =>
      v.constant === undefined ||
      (v.transform === undefined &&
        v.array_transform === undefined &&
        v.lookup === undefined &&
        v.default === undefined),
    { message: 'constant cannot be combined with transform, array_transform, lookup, or default' }
  )
  .refine((v) => v.transform === undefined || v.field !== undefined, {
    message: 'transform requires field',
  })
  .refine((v) => v.array_transform === undefined || v.field !== undefined, {
    message: 'array_transform requires field',
  })
  .refine((v) => v.transform === undefined || v.array_transform === undefined, {
    message: 'transform and array_transform are mutually exclusive',
  });

const SourceConfigSchema = z
  .strictObject({
    id: z.string().min(1),
    label: z.string().min(1),
    country: z.string().min(1),
    // Required, not defaulted: silently assuming a language decides whether a source is billed to
    // Gemini and whether its curated values get reworded. That must be a stated choice per source.
    // Shape alone is not enough — `em` is a well-formed typo for `en` that loads cleanly, misses
    // the exact `language === 'en'` gate, and quietly ships curated English labels to a translator
    // to be reworded over. The membership check is what makes that typo a load-time failure.
    language: z
      .string()
      .regex(/^[a-z]{2}$/, 'language must be a lowercase two-letter code')
      .refine(isIso639_1, { message: 'language must be an assigned ISO 639-1 code' }),
    encoding: z.enum(['utf8', 'latin1']),
    download: z
      .strictObject({
        url: z.url(),
        format: z.enum(['zip', 'file']).default('zip'),
        method: z.enum(['GET', 'POST']).default('GET'),
        body: z.unknown().optional(),
        entries: z.record(z.string(), z.string()),
        headers: z.record(z.string(), z.string()).optional(),
        prime_url: z.url().optional(),
        discover_url: z.url().optional(),
        discover_pattern: z
          .string()
          .min(1)
          .refine(isValidRegex, { message: 'discover_pattern must be a valid regular expression' })
          .optional(),
      })
      .refine((d) => Object.keys(d.entries).length >= 1, {
        message: 'download.entries must have at least one alias',
      })
      .refine((d) => d.format !== 'file' || Object.keys(d.entries).length === 1, {
        message: 'download.entries must contain exactly one alias when format is "file"',
      })
      // The downloader's path→alias lookup can hold one alias per path; a duplicate would make
      // the shadowed alias falsely report "ZIP entry not found" at run time.
      .refine((d) => new Set(Object.values(d.entries)).size === Object.keys(d.entries).length, {
        message: 'download.entries paths must be unique — one alias per archive entry',
      })
      .refine((d) => (d.discover_url === undefined) === (d.discover_pattern === undefined), {
        message: 'download.discover_url and download.discover_pattern must be set together',
      })
      // A manually replayed Cookie header has no browser jar enforcing Domain scope. Keep every
      // request that receives primed cookies on the origin that issued them.
      .refine(
        (d) => {
          if (d.prime_url === undefined) return true;
          const primeOrigin = new URL(d.prime_url).origin;
          return [d.url, ...(d.discover_url ? [d.discover_url] : [])].every(
            (url) => new URL(url).origin === primeOrigin
          );
        },
        { message: 'download.prime_url must share an origin with url and discover_url' }
      )
      .refine((d) => d.method === 'POST' || d.body === undefined, {
        message: 'download.body is only valid with method POST',
      }),
    primary: z.string().min(1),
    delimiter: z.string().min(1),
    trim_all: z.boolean().default(false),
    format: z.enum(['csv', 'ods', 'xlsx', 'xls', 'json', 'pdf', 'html']).default('csv'),
    record_path: z.string().optional(),
    pdf: z
      .strictObject({
        field_axis: z.enum(['x', 'y']),
        column_pos: z.array(z.number()).min(1),
        anchor_pattern: z.string().min(1).refine(isValidRegex, {
          message: 'pdf.anchor_pattern must be a valid regular expression',
        }),
        allowed_anchorless_pages: z.number().int().nonnegative().optional(),
      })
      .optional(),
    record_count: z
      .strictObject({
        pattern: z
          .string()
          .min(1)
          .refine(isValidRegex, {
            message: 'record_count.pattern must be a valid regular expression',
          })
          .refine(hasOneCaptureGroup, {
            message: 'record_count.pattern must have exactly one capture group',
          }),
      })
      .optional(),
    sheet: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
    skip_rows: z.number().int().nonnegative().optional(),
    columns: z.record(z.string(), z.array(z.string().min(1)).min(1)).optional(),
    allowed_ragged_rows: z.record(z.string(), z.number().int().nonnegative()).optional(),
    latest_snapshot_by: z.string().min(1).optional(),
    allowed_missing_source_id_rows: z
      .strictObject({
        max: z.number().int().nonnegative(),
        field: z.string().min(1),
        pattern: z.string().min(1).refine(isValidRegex, {
          message: 'pattern must be a valid regular expression',
        }),
      })
      .optional(),
    joins: z
      .array(
        z.strictObject({
          name: z.string().min(1),
          file: z.string().min(1),
          key: z.string().min(1),
          on: z.string().min(1),
        })
      )
      .default([]),
    source_id: z.string().min(1),
    source_id_transform: z.enum(SCALAR_TRANSFORMS).optional(),
    registration: z.string().min(1),
    cadence_days: z.number().int().positive().optional(),
    merge_duplicates: z
      .strictObject({
        fields: z.array(z.string().min(1)).min(1),
        separator: z.string().min(1).optional(),
        set_on_merge: z.record(z.string().min(1), z.string().nullable()).optional(),
      })
      // Both key sets are written into the canonical record by the merge, so a path the schema
      // doesn't define is stripped by re-validation and disappears silently — the merge still
      // "succeeds" while the intended field stays unset. Reject it at load instead.
      .superRefine((m, ctx) => {
        const stamped = Object.keys(m.set_on_merge ?? {});
        for (const path of [...m.fields, ...stamped])
          if (!CANONICAL_PATHS.has(path))
            ctx.addIssue({
              code: 'custom',
              message: `merge_duplicates path "${path}" is not a canonical schema path`,
            });
        // Stamping runs after concatenation, so a path in both lists has its concatenated upstream
        // values overwritten by the fixed stamp — every merged party silently lost, run reporting
        // success. The two intents are contradictory; make the config state one of them.
        for (const path of m.fields.filter((f) => stamped.includes(f)))
          ctx.addIssue({
            code: 'custom',
            message: `merge_duplicates path "${path}" is in both fields and set_on_merge; the stamp would overwrite the concatenated values`,
          });
      })
      .optional(),
    // A key the schema doesn't define is written into the record and stripped by re-validation, so
    // the mapping "succeeds" while the intended field stays unset. That is worst for the
    // `<field>_source_text` companions: `engine.ts` falls back to mirroring the primary field when
    // the key is absent, so a typo in AESA's `airworthiness_class_source_text` would store the
    // English transform output as the untranslated original — silently defeating the provenance the
    // licence requires. Reject at load.
    mapping: z.record(z.string(), FieldMappingSchema).superRefine((m, ctx) => {
      for (const path of Object.keys(m))
        if (!CANONICAL_PATHS.has(path))
          ctx.addIssue({
            code: 'custom',
            message: `mapping key "${path}" is not a canonical schema path`,
          });
    }),
  })
  .refine((c) => c.format !== 'pdf' || c.pdf !== undefined, {
    message: 'format "pdf" requires a pdf config block',
  })
  // Row assembly is last-wins per name, so a duplicated declared column silently shadows the
  // earlier one at run time.
  .refine(
    (c) => Object.values(c.columns ?? {}).every((cols) => new Set(cols).size === cols.length),
    {
      message: 'columns arrays must not contain duplicate names',
    }
  )
  .refine(
    (c) => c.pdf === undefined || c.pdf.column_pos.length === (c.columns?.[c.primary]?.length ?? 0),
    {
      message: 'pdf.column_pos length must match columns[primary] length',
    }
  )
  // primary/joins[].file resolve into the downloaded-files Map by alias (engine.ts's
  // `files.get(config.primary)`), which is keyed by download.entries' own keys — a mismatched
  // alias here only surfaces as a runtime "not found in downloaded files" error after a full
  // download, instead of a config-time one.
  .refine(
    (c) => {
      const aliases = new Set(Object.keys(c.download.entries));
      return aliases.has(c.primary) && c.joins.every((j) => aliases.has(j.file));
    },
    { message: 'primary and joins[].file must match a download.entries alias' }
  )
  // columns and allowed_ragged_rows are both keyed by parsed-file alias (?.[config.primary],
  // ?.[join.file]) — an unmatched key is never read, so it silently degrades to the default
  // (header-inferred parsing / a zero ragged budget) instead of erroring.
  .refine(
    (c) => {
      const aliases = new Set([c.primary, ...c.joins.map((j) => j.file)]);
      const keys = [...Object.keys(c.columns ?? {}), ...Object.keys(c.allowed_ragged_rows ?? {})];
      return keys.every((k) => aliases.has(k));
    },
    { message: 'columns and allowed_ragged_rows keys must match primary or a joins[].file value' }
  )
  // Joins are always parsed as CSV, but the primary only is when format says so — a ragged budget
  // on a non-CSV primary is a no-op with zero ragged-row protection.
  .refine((c) => c.allowed_ragged_rows?.[c.primary] === undefined || c.format === 'csv', {
    message: 'allowed_ragged_rows[primary] only applies to format "csv"',
  })
  // buildJoinMaps builds `new Map([join.name, index])` entries — a duplicated name silently
  // collapses to whichever join was resolved last, and mergeJoins then merges that one join's
  // data under both declared names with no error at any point.
  .refine((c) => new Set(c.joins.map((j) => j.name)).size === c.joins.length, {
    message: 'joins[].name values must be unique',
  });

const ROOT = resolve(import.meta.dirname, '..', '..');

function safePath(rel: string): string {
  if (rel.includes('..')) throw new Error(`Path traversal rejected: ${rel}`);
  const abs = isAbsolute(rel) ? rel : resolve(ROOT, rel);
  // relative() returns '../...' when abs escapes ROOT — startsWith would miss prefix collisions
  const relFromRoot = relative(ROOT, abs);
  if (relFromRoot.startsWith('..') || isAbsolute(relFromRoot)) {
    throw new Error(`Path outside sandbox: ${abs}`);
  }
  return abs;
}

export function loadSourceConfig(relPath: string): SourceConfig {
  const abs = safePath(relPath);
  const raw = load(readFileSync(abs, 'utf8'));
  const result = SourceConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid source config ${relPath}: ${result.error.message}`);
  }
  return result.data;
}
