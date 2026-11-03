// Fail fast on missing critical env vars instead of crashing later on first DB/JWT call.
export function validateEnv(config: Record<string, unknown>) {
  const missing: string[] = [];
  if (!config.DATABASE_URL) missing.push('DATABASE_URL');
  if (config.NODE_ENV === 'production' && !config.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')} (see .env.example)`);
  }
  return config;
}
