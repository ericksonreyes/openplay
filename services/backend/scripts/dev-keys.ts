/** Generates a local RS256 key pair for .env (local development only). */
import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose';

async function main(): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
  const pub = (await exportSPKI(publicKey)).replace(/\n/g, '\\n');
  const priv = (await exportPKCS8(privateKey)).replace(/\n/g, '\\n');
  console.log('Add these lines to services/backend/.env:\n');
  console.log(`JWT_PUBLIC_KEY="${pub}"`);
  console.log(`JWT_PRIVATE_KEY="${priv}"`);
}

void main();
