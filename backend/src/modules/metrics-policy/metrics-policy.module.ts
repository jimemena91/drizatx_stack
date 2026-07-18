import { Module } from '@nestjs/common';
import { MetricsPolicyService } from './metrics-policy.service';

@Module({
  providers: [MetricsPolicyService],
  exports: [MetricsPolicyService],
})
export class MetricsPolicyModule {}
