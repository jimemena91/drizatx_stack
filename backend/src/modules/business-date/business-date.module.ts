import { Global, Module } from '@nestjs/common';

import { BusinessDateService } from './business-date.service';

@Global()
@Module({
  providers: [BusinessDateService],
  exports: [BusinessDateService],
})
export class BusinessDateModule {}
