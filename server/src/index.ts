import { createApp } from './app.js';
import { listSources } from './sources/index.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`CompShopper API listening on http://localhost:${port}`);
  for (const s of listSources()) {
    console.log(`  - ${s.label.padEnd(24)} ${s.enabled ? 'enabled' : 'disabled'}${s.reason ? ` (${s.reason})` : ''}`);
  }
});
