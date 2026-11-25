import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  AdminReplyTicketDto,
  AdminTicketQueryDto,
  CreateSupportTicketDto,
  SendSupportMessageDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('messages')
  async listMessages(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.listLearnerMessages(user.id);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendLearnerMessage(user.id, dto);
  }

  @Get('tickets')
  async listTickets(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.listLearnerTickets(user.id);
  }

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.createTicket(user.id, dto);
  }
}

@ApiTags('AdminSupport')
@ApiBearerAuth()
@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('threads')
  async listThreads() {
    return this.supportService.listThreads();
  }

  @Get('threads/:userId/messages')
  async getThreadMessages(@Param('userId', ParseIntPipe) userId: number) {
    return this.supportService.getThreadMessages(userId);
  }

  @Post('threads/:userId/messages')
  @HttpCode(HttpStatus.CREATED)
  async replyToThread(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SendSupportMessageDto,
    @Req() req: Request,
  ) {
    return this.supportService.replyToThread(admin.id, userId, dto, req.ip);
  }

  @Get('tickets')
  async listTickets(@Query() query: AdminTicketQueryDto) {
    return this.supportService.listTicketsPaginated(query);
  }

  @Patch('tickets/:ticketId/reply')
  async replyToTicket(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: AdminReplyTicketDto,
    @Req() req: Request,
  ) {
    return this.supportService.replyToTicket(admin.id, ticketId, dto, req.ip);
  }
}
