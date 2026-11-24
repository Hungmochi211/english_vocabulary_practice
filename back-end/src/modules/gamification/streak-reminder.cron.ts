import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  getTodayUtc7Date,
  addDaysUtc7,
  getUtc7HourMinute,
} from '../../common/utils/timezone.util';

export const STREAK_REMINDER_QUEUE = 'streak-reminder';

export interface StreakReminderJobData {
  userId: number;
  email: string;
  fullName: string;
  currentStreak: number;
  studyDate: string;
}

@Injectable()
export class StreakReminderCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(StreakReminderCron.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(STREAK_REMINDER_QUEUE) private readonly reminderQueue: Queue,
    private readonly auditService: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    // Cơ chế catch-up idempotent nếu server khởi động lại sau 20:00 cùng ngày UTC+7 (FR-013, CHK058)
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    const { hour } = getUtc7HourMinute();
    if (hour >= 20 && hour <= 23) {
      this.scanAndEnqueueReminders().catch((err) => {
        this.logger.error('Catch-up streak reminder scan failed', err instanceof Error ? err.message : String(err));
      });
    }
  }

  @Cron('0 20 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleDaily20hScan(): Promise<void> {
    await this.scanAndEnqueueReminders();
  }

  async scanAndEnqueueReminders(
    overrideTodayUtc7?: string,
  ): Promise<{ scannedCount: number; enqueuedUserIds: number[]; durationMs: number }> {
    const start = performance.now();
    const today = overrideTodayUtc7 ?? getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);

    const batchSize = 500;
    let lastUserId = 0;
    let scannedCount = 0;
    const enqueuedUserIds: number[] = [];

    while (true) {
      const candidates: Array<{
        userId: number;
        email: string;
        fullName: string;
        currentStreak: number;
      }> = await this.dataSource.query(
        `
        SELECT
          u.id AS "userId",
          u.email,
          u.full_name AS "fullName",
          s.current_streak AS "currentStreak"
        FROM user_streaks s
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN daily_study_logs d
          ON d.user_id = u.id AND d.study_date = $1::date
        WHERE u.id > $2
          AND u.is_active = TRUE
          AND u.email_reminder_enabled = TRUE
          AND s.current_streak >= 1
          AND s.last_study_date = $3::date
          AND (d.id IS NULL OR (d.streak_qualified = FALSE AND d.reminder_sent = FALSE))
        ORDER BY u.id ASC
        LIMIT $4;
        `,
        [today, lastUserId, yesterday, batchSize],
      );

      if (candidates.length === 0) break;
      scannedCount += candidates.length;
      lastUserId = candidates[candidates.length - 1].userId;

      // Batch atomic claim-before-enqueue để chống gửi trùng 100% và đạt < 30s cho 10.000 hồ sơ (SC-007, CHK057)
      const userIds = candidates.map((c) => c.userId);
      const claimedRows: Array<{ user_id: number }> = await this.dataSource.query(
        `
        INSERT INTO daily_study_logs (user_id, study_date, reminder_sent, reminder_status, reminder_sent_at)
        SELECT uid, $2::date, TRUE, 'queued', NOW()
        FROM UNNEST($1::int[]) AS uid
        ON CONFLICT (user_id, study_date)
        DO UPDATE SET
          reminder_sent = TRUE,
          reminder_status = 'queued',
          reminder_sent_at = NOW(),
          updated_at = NOW()
        WHERE daily_study_logs.reminder_sent = FALSE
        RETURNING user_id;
        `,
        [userIds, today],
      );

      const claimedSet = new Set(claimedRows.map((r) => Number(r.user_id)));
      const jobsToAdd: Array<{
        name: string;
        data: StreakReminderJobData;
        opts: { jobId: string; attempts: number; backoff: { type: string; delay: number } };
      }> = [];

      for (const c of candidates) {
        if (!claimedSet.has(c.userId)) continue;
        enqueuedUserIds.push(c.userId);
        jobsToAdd.push({
          name: 'send-streak-warning',
          data: {
            userId: c.userId,
            email: c.email,
            fullName: c.fullName,
            currentStreak: c.currentStreak,
            studyDate: today,
          },
          opts: {
            jobId: `streak-reminder_${c.userId}_${today}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        });
      }

      if (jobsToAdd.length > 0) {
        await this.reminderQueue.addBulk(jobsToAdd);
      }
    }

    const durationMs = Math.round(performance.now() - start);
    if (durationMs > 30000) {
      this.logger.warn(
        `[ALERT_REMINDER_SCAN_SLOW] Streak reminder scan exceeded 30s threshold: ${durationMs}ms`,
      );
    }

    await this.auditService.log({
      actorUserId: null,
      action: 'STREAK_REMINDER_JOB',
      targetType: 'cron',
      targetId: today,
      status: 'SUCCESS',
      metadata: {
        scannedCount,
        enqueuedCount: enqueuedUserIds.length,
        durationMs,
      },
    });

    return {
      scannedCount,
      enqueuedUserIds,
      durationMs,
    };
  }
}
