export interface AppEnv {
  port: number;
  databaseUrl: string;
  jwtMode: 'rs256' | 'hs256' | 'none';
  jwtIssuer: string;
  jwtAudience: string;
  redisUrl: string;
  jwtTtlSeconds: number;
  jwtPrivateKey?: string;
  jwtPublicKey?: string;
  jwtSecret?: string;
  corsOrigins: string[];
  seedDemo: boolean;
  platformAdminPassword?: string;
  ollamaHost?: string;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const pem = (value?: string): string | undefined =>
  value?.replace(/\\n/g, '\n');

export function loadEnv(): AppEnv {
  const databaseUrl = required('DATABASE_URL');
  const port = Number(process.env.PORT ?? 8000);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const jwtPrivateKey = pem(process.env.JWT_PRIVATE_KEY);
  const jwtPublicKey = pem(process.env.JWT_PUBLIC_KEY);
  const jwtSecret = process.env.JWT_SECRET || undefined;
  const jwtMode =
    jwtPrivateKey && jwtPublicKey ? 'rs256' : jwtSecret ? 'hs256' : 'none';

  const corsOrigins = (process.env.CORS_ORIGINS ??
    'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port,
    databaseUrl,
    jwtMode,
    jwtIssuer: process.env.JWT_ISSUER ?? 'openplay-identity-access',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'openplay-api',
    redisUrl: process.env.REDIS_URL ?? '',
    jwtTtlSeconds: Number(process.env.JWT_TTL ?? 900),
    jwtPrivateKey,
    jwtPublicKey,
    jwtSecret,
    corsOrigins,
    seedDemo: process.env.SEED_DEMO === 'true',
    platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD,
    ollamaHost: process.env.OLLAMA_HOST,
  };
}
