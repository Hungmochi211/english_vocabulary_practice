import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { DataSource } from 'typeorm';
import {
  STREAK_REMINDER_QUEUE,
  StreakReminderJobData,
} from './streak-reminder.cron';

@Processor(STREAK_REMINDER_QUEUE)
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly dataSource: DataSource) {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async sendReminderEmail(data: StreakReminderJobData): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_USER || 'no-reply@vocab-practice.local',
      to: data.email,
      subject: `Đừng để mất chuỗi ${data.currentStreak} ngày học từ vựng hôm nay!`,
      text: `Chào ${data.fullName},\n\nBạn đang có chuỗi ${data.currentStreak} ngày học liên tục. Hãy vào hoàn thành 1 bài học hoặc ôn tập SM-2 trước 23:59 hôm nay để giữ chuỗi nhé!`,
    });
  }

  async process(job: Job<StreakReminderJobData>): Promise<void> {
    const { userId, studyDate } = job.data;
    const attemptNumber = (job.attemptsMade ?? 0) + 1;

    await this.dataSource.query(
      `
      UPDATE daily_study_logs
      SET reminder_attempts = $1, updated_at = NOW()
      WHERE user_id = $2 AND study_date = $3::date;
      `,
      [attemptNumber, userId, studyDate],
    );

    await this.sendReminderEmail(job.data);

    await this.dataSource.query(
      `
      UPDATE daily_study_logs
      SET reminder_status = 'delivered', reminder_sent_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND study_date = $2::date;
      `,
      [userId, studyDate],
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<StreakReminderJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 3;
    if ((job.attemptsMade ?? 0) >= maxAttempts) {
      this.logger.warn(
        `[ALERT_EMAIL_JOB_FAILED] Job ${job.id} exhausted ${maxAttempts} retries: ${err.message}`,
      );
      await this.dataSource
        .query(
          `
          UPDATE daily_study_logs
          SET reminder_status = 'failed', updated_at = NOW()
          WHERE user_id = $1 AND study_date = $2::date;
          `,
          [job.data.userId, job.data.studyDate],
        )
        .catch(() => {});
    }
  }
}
