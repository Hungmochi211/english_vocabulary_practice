import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';
import { getAuthConfig } from '../../config/auth.config';

@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private failClosed(): never {
    throw new ServiceUnavailableException({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
      details: null,
    });
  }

  async assertNotLocked(ip: string, normalizedEmail: string): Promise<void> {
    const cfg = getAuthConfig();
    const ipKey = `login_fail:ip:${ip}`;
    const acctKey = `login_fail:acct:${normalizedEmail}`;

    let ipCount = 0;
    let acctCount = 0;
    try {
      const [ipVal, acctVal] = await this.redis.mget(ipKey, acctKey);
      ipCount = ipVal ? Number(ipVal) : 0;
      acctCount = acctVal ? Number(acctVal) : 0;
    } catch {
      this.failClosed();
    }

    if (ipCount >= cfg.maxAttemptsPerIp || acctCount >= cfg.maxAttemptsPerAccount) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Bạn đã thử đăng nhập quá nhiều lần, vui lòng thử lại sau ít phút',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailedAttempt(ip: string, normalizedEmail: string): Promise<void> {
    const cfg = getAuthConfig();
    const ipKey = `login_fail:ip:${ip}`;
    const acctKey = `login_fail:acct:${normalizedEmail}`;

    try {
      const pipeline = this.redis.multi();
      pipeline.incr(ipKey);
      pipeline.expire(ipKey, cfg.lockoutSeconds, 'NX');
      pipeline.incr(acctKey);
      pipeline.expire(acctKey, cfg.lockoutSeconds, 'NX');
      await pipeline.exec();
    } catch {
      this.failClosed();
    }
  }

  async resetAccountFailures(normalizedEmail: string): Promise<void> {
    try {
      await this.redis.del(`login_fail:acct:${normalizedEmail}`);
    } catch {
      // Non-fatal on success reset
    }
  }
}
