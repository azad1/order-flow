import { migrateKotakToken, promptKotakToken, readKotakToken } from '../server/secrets/kotakToken.mjs';
try {
  const action = process.argv[2];
  if (action === '--migrate') migrateKotakToken();
  else if (action === '--set') promptKotakToken();
  else if (action !== '--check') throw new Error('Choose --set, --migrate or --check.');
  readKotakToken();
  console.log('Encrypted token verified for this Windows account. The token was not displayed.');
  if (action !== '--check') console.log('The plaintext token setting has been removed from .env.');
  console.log('This checks storage only. Kotak must still accept the token before live data can connect.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
