import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(projectRoot, 'scripts/kotak-dpapi.ps1');
const marker = 'OrderFlowKotakDPAPI:1\n';
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
export const tokenFile = root => path.join(root, '.env.kotak-token.dpapi');

function crypt(mode, input) {
  if (process.platform !== 'win32') throw new Error('This protected token requires Windows.');
  try {
    return execFileSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Mode', mode], {
      input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, maxBuffer: 65536,
    }).trim();
  } catch {
    // Do not attach the child-process error, stdout or stderr: it could contain a secret.
    throw new Error('Windows could not unlock the Kotak token. Use the Windows account that saved it.');
  }
}

function same(a, b) {
  const first = Buffer.from(a), second = Buffer.from(b);
  try { return first.length === second.length && timingSafeEqual(first, second); }
  finally { first.fill(0); second.fill(0); }
}

export function readKotakToken(root = projectRoot) {
  if (!fs.existsSync(tokenFile(root))) throw new Error('Save your Kotak token with Save Kotak Token.cmd first.');
  const stored = fs.readFileSync(tokenFile(root), 'utf8');
  if (!stored.startsWith(marker)) throw new Error('The protected Kotak token file is not recognized. Save it again.');
  const token = crypt('Unprotect', stored.slice(marker.length).trim());
  if (!token || /\s/.test(token)) throw new Error('The protected token is empty or invalid. Save it again.');
  return token;
}

function atomicWrite(file, text) {
  const temporary = `${file}.new-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function storeKotakToken(token, root = projectRoot) {
  token = token.trim();
  if (!token || /\s/.test(token)) throw new Error('The token must be one non-empty value.');
  const protectedValue = crypt('Protect', token);
  if (!same(token, crypt('Unprotect', protectedValue))) throw new Error('Encryption verification failed; settings were not changed.');
  atomicWrite(tokenFile(root), `${marker}${protectedValue}\n`);
  if (!same(token, readKotakToken(root))) throw new Error('The saved encrypted token could not be verified.');
}

export function removePlaintextToken(root = projectRoot) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const parsed = parseEnv(before);
  // Refuse unusual multiline secrets instead of leaving fragments behind.
  if (parsed.NEO_CONSUMER_KEY && /[\r\n]/.test(parsed.NEO_CONSUMER_KEY)) throw new Error('The local token setting spans multiple lines; remove it privately after checking the encrypted copy.');
  const after = before.split(/\r?\n/).filter(line =>
    !/^\s*(?:export\s+)?NEO_CONSUMER_KEY\s*=/.test(line) &&
    !/^# (Paste the Access Token|immediately after the equals|Keep this value private)/.test(line)
  ).join('\n').trimEnd() + '\n';
  const note = '# Kotak token is encrypted in .env.kotak-token.dpapi. Use Save Kotak Token.cmd to replace it.\n';
  atomicWrite(file, after.includes(note.trim()) ? after : `${after}\n${note}`);
  if (parseEnv(fs.readFileSync(file, 'utf8')).NEO_CONSUMER_KEY) throw new Error('The plaintext token could not be removed.');
}

export function migrateKotakToken(root = projectRoot) {
  const file = path.join(root, '.env');
  const token = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')).NEO_CONSUMER_KEY?.trim() : null;
  if (token) storeKotakToken(token, root);
  else readKotakToken(root);
  removePlaintextToken(root);
}

export function promptKotakToken(root = projectRoot) {
  if (process.platform !== 'win32') throw new Error('This protected token requires Windows.');
  const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-File', script, '-Mode', 'Prompt', '-OutputFile', tokenFile(root)], { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Token entry was cancelled or could not be saved.');
  readKotakToken(root);
  removePlaintextToken(root);
}
