import { writeDiscoveredSources } from './pipeline.js';

// CLI-only shell for the refresh workflow's discover job, so its matrix split uses the same
// config loader and Gemini rule as a local fleet refresh.
await writeDiscoveredSources();
