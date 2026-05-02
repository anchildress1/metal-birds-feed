import { readFileSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { SourceConfig } from '../types/config.js';

const SCALAR_TRANSFORMS = [
  'trim',
  'trim_or_null',
  'lowercase',
  'uppercase',
  'int_or_null',
  'float_or_null',
  'date_yyyymmdd_or_null',
  'mph_to_ktas_or_null',
  'faa_cert_class',
] as const;

const ARRAY_TRANSFORMS = ['faa_cert_ops'] as const;

const FieldMappingSchema = z
  .object({
    field: z.string().optional(),
    constant: z.string().nullable().optional(),
    transform: z.enum(SCALAR_TRANSFORMS).optional(),
    array_transform: z.enum(ARRAY_TRANSFORMS).optional(),
    lookup: z.record(z.string(), z.string()).optional(),
    default: z.string().nullable().optional(),
  })
  .refine((v) => v.field !== undefined || v.constant !== undefined, {
    message: 'FieldMapping must have either field or constant',
  });

const SourceConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  country: z.string().min(1),
  encoding: z.enum(['utf8', 'latin1']),
  download: z.object({
    url: z.string().url(),
    format: z.literal('zip'),
    entries: z.record(z.string(), z.string()),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  primary: z.string().min(1),
  delimiter: z.string().min(1),
  trim_all: z.boolean().default(false),
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
  registration: z.string().min(1),
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
