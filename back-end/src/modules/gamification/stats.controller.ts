import { Controller, Get, UseGuards } from '@nestjs/common';
import { StreakService } from './streak.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly streakService: StreakService) {}

  @Get('overview')
  async getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.streakService.getOverviewStats(user.id);
  }
}

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
