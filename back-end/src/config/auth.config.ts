export interface AuthConfig {
  jwtAccessSecret: string;
  jwtAccessExpiresIn: number;
  jwtRefreshExpiresDays: number;
  googleClientId: string;
  maxAttemptsPerIp: number;
  maxAttemptsPerAccount: number;
  lockoutSeconds: number;
  strictUnlockMode: boolean;
}

export function getAuthConfig(): AuthConfig {
  return {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET || 'dev_local_jwt_access_secret_key_change_in_prod',
    jwtAccessExpiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN || 900),
    jwtRefreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
    googleClientId:
      process.env.GOOGLE_CLIENT_ID || 'dev_google_client_id.apps.googleusercontent.com',
    maxAttemptsPerIp: Number(process.env.AUTH_MAX_ATTEMPTS_PER_IP || 20),
    maxAttemptsPerAccount: Number(process.env.AUTH_MAX_ATTEMPTS_PER_ACCOUNT || 5),
    lockoutSeconds: Number(process.env.AUTH_LOCKOUT_SECONDS || 900),
    strictUnlockMode: (process.env.STRICT_UNLOCK_MODE ?? 'true').toLowerCase() !== 'false',
  };
}
