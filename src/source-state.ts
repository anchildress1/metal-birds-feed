import { reportSourceState } from './state-report.js';

await reportSourceState(process.argv[2] ?? '');
