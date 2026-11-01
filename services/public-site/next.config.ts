import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL ?? 'http://openplay-backend:8000',
  },
};

export default nextConfig;
