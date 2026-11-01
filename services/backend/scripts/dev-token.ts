/**
 * Mints a local JWT for manual API testing.
 *   npm run token:dev -- --sub <uuid> --roles platform.admin --permissions platform.tenants.manage
 * Reads signing material from process env. Local development only.
 */
import { importPKCS8, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { loadEnv } from '../src/config/env';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const list = (name: string): string[] => (arg(name) ?? '').split(',').filter(Boolean);

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.jwtMode === 'none') {
    console.error('No JWT signing material configured — run npm run keys:generate first.');
    process.exit(1);
  }

  const builder = new SignJWT({
    roles: list('roles'),
    permissions: list('permissions'),
    ...(arg('tenant') ? { tenant_id: arg('tenant') } : {}),
  })
    .setProtectedHeader({ alg: env.jwtMode === 'rs256' ? 'RS256' : 'HS256' })
    .setSubject(arg('sub') ?? uuidv7())
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${env.jwtTtlSeconds}s`);

  const token =
    env.jwtMode === 'rs256'
      ? await builder.sign(await importPKCS8(env.jwtPrivateKey!, 'RS256'))
      : await builder.sign(new TextEncoder().encode(env.jwtSecret!));

  console.log(token);
}

void main();
