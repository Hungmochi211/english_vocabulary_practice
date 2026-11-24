import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSm2Review } from './entities/user-sm2-review.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { AlgorithmModule } from '../algorithm/algorithm.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserSm2Review]), AlgorithmModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
