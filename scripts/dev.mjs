/** `npm run dev`: the API (server/index.mjs) and Vite together; Vite proxies data to the API. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run Node directly so paths such as C:\Program Files\nodejs are not split by cmd.exe.
const run = args => spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true });
// `npm run dev:recorded` replays a recorded real session instead of the demo market.
const api = run(['server/index.mjs', ...process.argv.slice(2)]);
const web = run([fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))]);
const stop = () => { api.kill(); web.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', code => { if (code) { console.error(`API exited (${code})`); web.kill(); process.exit(code); } });
web.on('exit', code => { api.kill(); process.exit(code ?? 0); });
