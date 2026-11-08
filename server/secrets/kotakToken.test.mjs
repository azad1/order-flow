import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { migrateKotakToken, readKotakToken, storeKotakToken, tokenFile } from './kotakToken.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'order-flow-dpapi-test-'));
  t.after(() => {
    for (const name of fs.readdirSync(root)) fs.unlinkSync(path.join(root, name));
    fs.rmdirSync(root);
  });
  return root;
}

test('Windows protection persists and replaces a token without saving plaintext', { skip: process.platform !== 'win32' }, t => {
  const root = fixture(t);
  for (const token of [randomUUID(), randomUUID()]) {
    storeKotakToken(token, root);
    assert.ok(readKotakToken(root) === token, 'Protected token should round-trip');
    assert.ok(!fs.readFileSync(tokenFile(root), 'utf8').includes(token), 'Stored file must not contain plaintext');
  }
});

test('Windows rejects modified ciphertext with a sanitized error', { skip: process.platform !== 'win32' }, t => {
  const root = fixture(t);
  const token = randomUUID();
  storeKotakToken(token, root);
  const [header, encoded] = fs.readFileSync(tokenFile(root), 'utf8').split('\n');
  const bytes = Buffer.from(encoded, 'base64');
  bytes[Math.floor(bytes.length / 2)] ^= 1;
  fs.writeFileSync(tokenFile(root), `${header}\n${bytes.toString('base64')}\n`);
  assert.throws(() => readKotakToken(root), error => {
    assert.ok(!error.message.includes(token), 'Error must not expose the token');
    return /could not unlock/.test(error.message);
  });
});

test('Migration verifies encryption, removes duplicate plaintext settings and preserves other settings', { skip: process.platform !== 'win32' }, t => {
  const root = fixture(t);
  const token = randomUUID();
  fs.writeFileSync(path.join(root, '.env'), `MF_PROVIDER=archive\r\nPORT=8787\r\n# Preserve this note\r\nNEO_CONSUMER_KEY=old-dummy-value\r\nexport NEO_CONSUMER_KEY="${token}"\r\n`);
  migrateKotakToken(root);
  const after = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.ok(!Object.hasOwn(parseEnv(after), 'NEO_CONSUMER_KEY'));
  assert.ok(!after.includes(token) && !after.includes('old-dummy-value'));
  assert.equal(parseEnv(after).MF_PROVIDER, 'archive');
  assert.equal(parseEnv(after).PORT, '8787');
  assert.ok(after.includes('# Preserve this note'));
  assert.ok(readKotakToken(root) === token);
  migrateKotakToken(root);
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), after, 'Repeating migration should not change settings');
});

test('An invalid token cannot destroy existing settings or an encrypted token', { skip: process.platform !== 'win32' }, t => {
  const root = fixture(t);
  storeKotakToken(randomUUID(), root);
  const encryptedBefore = fs.readFileSync(tokenFile(root), 'utf8');
  const envBefore = 'MF_PROVIDER=archive\nNEO_CONSUMER_KEY="invalid dummy value"\n';
  fs.writeFileSync(path.join(root, '.env'), envBefore);
  assert.throws(() => migrateKotakToken(root), /one non-empty value/);
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), envBefore);
  assert.equal(fs.readFileSync(tokenFile(root), 'utf8'), encryptedBefore);
});
