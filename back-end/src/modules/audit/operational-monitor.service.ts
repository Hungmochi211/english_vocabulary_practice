import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';

export interface OperationalThresholds {
  loginFailuresIn5m: number;
  rateLimitLocksIn5m: number;
  queueBacklogMaxJobs: number;
  reminderScanMaxMs: number;
  reminderDelayMaxMinutes: number;
}

export function getOperationalThresholds(): OperationalThresholds {
  return {
    loginFailuresIn5m: Number(process.env.ALERT_LOGIN_FAILURES_5M || 20),
    rateLimitLocksIn5m: Number(process.env.ALERT_RATE_LIMIT_LOCKS_5M || 5),
    queueBacklogMaxJobs: Number(process.env.ALERT_QUEUE_BACKLOG_MAX || 500),
    reminderScanMaxMs: Number(process.env.ALERT_REMINDER_SCAN_MAX_MS || 30000),
    reminderDelayMaxMinutes: Number(process.env.ALERT_REMINDER_DELAY_MAX_MIN || 5),
  };
}

@Injectable()
export class OperationalMonitorService {
  private readonly logger = new Logger(OperationalMonitorService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async trackAuthFailureEvent(kind: 'login_failed' | 'rate_limit_locked'): Promise<boolean> {
    const thresholds = getOperationalThresholds();
    const key = `ops:5m:${kind}`;
    const limit =
      kind === 'login_failed'
        ? thresholds.loginFailuresIn5m
        : thresholds.rateLimitLocksIn5m;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 300);
      }
      if (count >= limit) {
        this.logger.warn(
          JSON.stringify({
            event: 'OPERATIONAL_ALERT',
            category: kind,
            countIn5m: count,
            threshold: limit,
            timestamp: new Date().toISOString(),
          }),
        );
        return true;
      }
    } catch {
      // Do not interrupt request path if monitoring counter fails
    }
    return false;
  }

  evaluateQueueBacklog(waitingPlusDelayed: number, sustainedMinutes: number): boolean {
    const thresholds = getOperationalThresholds();
    const alerted = waitingPlusDelayed > thresholds.queueBacklogMaxJobs && sustainedMinutes > 5;
    if (alerted) {
      this.logger.warn(
        JSON.stringify({
          event: 'OPERATIONAL_ALERT',
          category: 'bullmq_backlog',
          waitingPlusDelayed,
          sustainedMinutes,
          threshold: thresholds.queueBacklogMaxJobs,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    return alerted;
  }

  evaluateReminderScan(durationMs: number, delayMinutes: number): boolean {
    const thresholds = getOperationalThresholds();
    const alerted =
      durationMs > thresholds.reminderScanMaxMs ||
      delayMinutes > thresholds.reminderDelayMaxMinutes;
    if (alerted) {
      this.logger.warn(
        JSON.stringify({
          event: 'OPERATIONAL_ALERT',
          category: 'reminder_scan_sla',
          durationMs,
          delayMinutes,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    return alerted;
  }
}
