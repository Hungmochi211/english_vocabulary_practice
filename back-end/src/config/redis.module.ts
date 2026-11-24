import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisClient, REDIS_CLIENT } from './redis.config';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => createRedisClient(),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') {
      await this.redis.quit().catch(() => {
        this.redis.disconnect();
      });
    }
  }
}
