// Manual: bun run scripts/gemini-poc.ts (needs GEMINI_API_KEY in .env). Not part of CI.
import { requireEnv } from '../src/env.js';
import { translateBatch } from '../src/localize/gemini-client.js';

const SAMPLES = [
  { id: 'a', field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' },
  { id: 'b', field: 'cancellation_reason', text: 'REQ 04042017 PERECIMENTO' },
  { id: 'c', field: 'cancellation_reason', text: 'AERONAVE EXPORTADA' }, // duplicate: proves dedup
];

const distinct = [...new Map(SAMPLES.map((s) => [s.text, s])).values()];

console.log(`${SAMPLES.length} requested -> ${distinct.length} distinct -> translating...\n`);

const { translated, errors } = await translateBatch(distinct, {
  apiKey: requireEnv('GEMINI_API_KEY'),
});

for (const { id, text } of distinct) console.log(`[${id}] "${text}" -> "${translated.get(id)}"`);
if (errors.length > 0) console.log(`${errors.length} chunk(s) failed:`, errors);
