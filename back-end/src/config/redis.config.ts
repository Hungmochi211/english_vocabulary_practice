import Redis from 'ioredis';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6380),
    maxRetriesPerRequest: null,
  };
}

export function createRedisClient(): Redis {
  const opts = getRedisConnectionOptions();
  return new Redis({
    host: opts.host,
    port: opts.port,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: false,
  });
}

export const REDIS_CLIENT = 'REDIS_CLIENT';
