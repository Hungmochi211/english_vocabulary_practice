import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { ReviewsDueQueryDto, StartReviewSessionDto } from './dto/review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('due')
  async getDue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewsDueQueryDto,
  ) {
    return this.reviewService.getDueReviews(user.id, query.limit ?? 20);
  }

  @Post('session/start')
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: StartReviewSessionDto,
  ) {
    return this.reviewService.startReviewSession(user.id, dto?.limit ?? 20);
  }
}
