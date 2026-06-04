import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { PrintService } from './print.service'

type CreatePrintJobDto = {
  source?: string
  sourceReference?: string | null
  ticketId?: string | number | null
  serviceId?: string | number | null
  ticketNumber: string
  serviceName: string
  clientName?: string | null
  payloadJson?: Record<string, unknown> | null
}

type MarkFailedDto = {
  errorMessage?: string | null
}

@Controller('print-jobs')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

 @Post()
  async createJob(@Body() body: CreatePrintJobDto) {
    const job = await this.printService.createJob(body)
    return {
      success: true,
      job,
    }
  }

  @Post('claim')
  async claimJob() {
    const job = await this.printService.claimNextJob()
    return {
      success: true,
      job,
    }
  }

  @Post(':id/printed')
  async markPrinted(@Param('id') id: string) {
    const job = await this.printService.markAsPrinted(id)
    return {
      success: true,
      job,
    }
  }

  @Post(':id/failed')
  async markFailed(@Param('id') id: string, @Body() body: MarkFailedDto) {
    const job = await this.printService.markAsFailed(id, body?.errorMessage ?? null)
    return {
      success: true,
      job,
    }
  }

  @Post(':id/requeue')
  async requeue(@Param('id') id: string) {
    const job = await this.printService.requeueJob(id)
    return {
      success: true,
      job,
    }
  }

  @Post('recover-stale')
  async recoverStale(@Query('timeoutMinutes') timeoutMinutes?: string) {
    const recovered = await this.printService.recoverStaleJobs(
      timeoutMinutes ? Number(timeoutMinutes) : 5,
    )

    return {
      success: true,
      recovered,
    }
  }

  @Get('pending')
  async pending(@Query('limit') limit?: string) {
    const jobs = await this.printService.listPending(limit ? Number(limit) : 20)
    return {
      success: true,
      count: jobs.length,
      jobs,
    }
  }

  @Get('health')
  health() {
    return {
      success: true,
      module: 'print',
    }
  }
}
