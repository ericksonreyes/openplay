export interface AppEnv {
  port: number;
  databaseUrl: string;
  jwtMode: 'rs256' | 'hs256' | 'none';
  corsOrigins: string[];
  seedDemo: boolean;
  ollamaHost?: string;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export function loadEnv(): AppEnv {
  const databaseUrl = required('DATABASE_URL');
  const port = Number(process.env.PORT ?? 8000);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const jwtMode = process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY
    ? 'rs256'
    : process.env.JWT_SECRET
      ? 'hs256'
      : 'none';

  const corsOrigins = (process.env.CORS_ORIGINS ??
    'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port,
    databaseUrl,
    jwtMode,
    corsOrigins,
    seedDemo: process.env.SEED_DEMO === 'true',
    ollamaHost: process.env.OLLAMA_HOST,
  };
}
