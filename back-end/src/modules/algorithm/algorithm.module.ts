import { Module } from '@nestjs/common';
import { DistractorService } from './distractor.service';
import { StratifiedSamplingService } from './stratified-sampling.service';
import { Sm2LeitnerService } from './sm2-leitner.service';

@Module({
  providers: [DistractorService, StratifiedSamplingService, Sm2LeitnerService],
  exports: [DistractorService, StratifiedSamplingService, Sm2LeitnerService],
})
export class AlgorithmModule {}
