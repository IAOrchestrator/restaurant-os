export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  apiVersion: string;
  jwtSecret: string;
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
    port: Number(process.env.PORT) || 3000,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/restaurant_os',
    apiVersion: '0.1.0',
    jwtSecret: process.env.JWT_SECRET || 'restaurant_os_jwt_secret_key_2026',
  };
}
