import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PrintJob } from './print.entity'
import { PrintService } from './print.service'
import { PrintController } from './print.controller'

@Module({
  imports: [TypeOrmModule.forFeature([PrintJob])],
  controllers: [PrintController],
  providers: [PrintService],
  exports: [PrintService, TypeOrmModule],
})
export class PrintModule {}

