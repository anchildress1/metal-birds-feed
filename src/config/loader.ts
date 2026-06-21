import { readFileSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  SCALAR_TRANSFORMS,
  ARRAY_TRANSFORMS,
  COMPOUND_TRANSFORMS,
  type SourceConfig,
} from '../types/config.js';

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

const FieldMappingSchema = z
  .object({
    field: z.string().optional(),
    fields: z.array(z.string().min(1)).min(1).optional(),
    constant: z.string().nullable().optional(),
    transform: z.enum(SCALAR_TRANSFORMS).optional(),
    array_transform: z.enum(ARRAY_TRANSFORMS).optional(),
    compound_transform: z.enum(COMPOUND_TRANSFORMS).optional(),
    lookup: z.record(z.string(), z.string()).optional(),
    default: z.string().nullable().optional(),
  })
  .refine((v) => v.field !== undefined || v.fields !== undefined || v.constant !== undefined, {
    message: 'FieldMapping must have field, fields, or constant',
  })
  .refine((v) => (v.compound_transform === undefined) === (v.fields === undefined), {
    message: 'compound_transform requires fields, and fields requires compound_transform',
  });

const SourceConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  country: z.string().min(1),
  encoding: z.enum(['utf8', 'latin1']),
  download: z
    .object({
      url: z.url(),
      format: z.enum(['zip', 'file']).default('zip'),
      method: z.enum(['GET', 'POST']).default('GET'),
      body: z.unknown().optional(),
      entries: z.record(z.string(), z.string()),
      headers: z.record(z.string(), z.string()).optional(),
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
    .refine((d) => (d.discover_url === undefined) === (d.discover_pattern === undefined), {
      message: 'download.discover_url and download.discover_pattern must be set together',
    })
    .refine((d) => d.method === 'POST' || d.body === undefined, {
      message: 'download.body is only valid with method POST',
    }),
  primary: z.string().min(1),
  delimiter: z.string().min(1),
  trim_all: z.boolean().default(false),
  format: z.enum(['csv', 'ods', 'xlsx', 'xls', 'json']).default('csv'),
  record_path: z.string().optional(),
  sheet: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
  skip_rows: z.number().int().nonnegative().optional(),
  columns: z.record(z.string(), z.array(z.string().min(1)).min(1)).optional(),
  allowed_missing_source_id_rows: z
    .object({
      max: z.number().int().nonnegative(),
      field: z.string().min(1),
      pattern: z.string().min(1).refine(isValidRegex, {
        message: 'pattern must be a valid regular expression',
      }),
    })
    .optional(),
  joins: z
    .array(
      z.object({
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
  mapping: z.record(z.string(), FieldMappingSchema),
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
  const raw = yaml.load(readFileSync(abs, 'utf8'));
  const result = SourceConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid source config ${relPath}: ${result.error.message}`);
  }
  return result.data;
}
