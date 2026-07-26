import { createHash } from 'node:crypto';
import { z } from 'zod';

export type TranslationCache = Record<string, string>;

export const TranslationCacheSchema = z.record(z.string().regex(/^[0-9a-f]{64}$/), z.string());

export const hashTranslatable = (field: string, text: string): string =>
  createHash('sha256').update(`${field}\0${text}`).digest('hex');
