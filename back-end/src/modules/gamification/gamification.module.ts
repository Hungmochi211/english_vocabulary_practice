import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserStreak } from './entities/user-streak.entity';
import { DailyStudyLog } from './entities/daily-study-log.entity';
import { StreakService } from './streak.service';
import { StatsController, AdminStatsController } from './stats.controller';
import { StreakReminderCron, STREAK_REMINDER_QUEUE } from './streak-reminder.cron';
import { EmailQueueProcessor } from './email-queue.processor';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserStreak, DailyStudyLog]),
    BullModule.registerQueue({ name: STREAK_REMINDER_QUEUE }),
    LearningModule,
  ],
  controllers: [StatsController, AdminStatsController],
  providers: [StreakService, StreakReminderCron, EmailQueueProcessor],
  exports: [StreakService, StreakReminderCron],
})
export class GamificationModule {}
