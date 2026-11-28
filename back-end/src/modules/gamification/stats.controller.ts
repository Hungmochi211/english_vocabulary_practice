import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StreakService } from './streak.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Stats')
@ApiBearerAuth()
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly streakService: StreakService) {}

  @Get('overview')
  async getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.streakService.getOverviewStats(user.id);
  }

  @Get('leaderboard')
  async getWeeklyLeaderboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.streakService.getWeeklyLeaderboard(user.id, query.limit ?? 20);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminStatsController {
  constructor(private readonly streakService: StreakService) {}

  @Get('stats')
  async getAdminStats() {
    return this.streakService.getAdminStats();
  }
}
