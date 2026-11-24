import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  AdminPaginationQueryDto,
  AdminUpdateStatusDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMyProfile(user.id);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMyProfile(user.id, dto);
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  async listUsers(@Query() query: AdminPaginationQueryDto) {
    return this.usersService.listUsersPaginated(query);
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AdminUpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.usersService.updateUserStatus(admin.id, userId, dto, req.ip);
  }

  @Get('audit-logs')
  async listAuditLogs(@Query() query: AdminPaginationQueryDto) {
    return this.usersService.listAuditLogsPaginated(query);
  }
}
