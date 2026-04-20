import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { PrintJob } from './print.entity'

export type CreatePrintJobInput = {
  source?: string
  sourceReference?: string | null
  ticketId?: string | number | null
  serviceId?: string | number | null
  ticketNumber: string
  serviceName: string
  clientName?: string | null
  payloadJson?: Record<string, unknown> | null
}

@Injectable()
export class PrintService {
  constructor(
    @InjectRepository(PrintJob)
    private readonly printJobRepository: Repository<PrintJob>,
    private readonly dataSource: DataSource,
  ) {}

  async listPending(limit = 20): Promise<PrintJob[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20

    return await this.printJobRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: safeLimit,
    })
  }

  async claimNextJob(): Promise<PrintJob | null> {
    return await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PrintJob)

      const job = await repo.findOne({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      })

      if (!job) return null

      job.status = 'processing'
      job.lockedAt = new Date()

      return await repo.save(job)
    })
  }

  async markAsPrinted(id: string): Promise<PrintJob | null> {
    const job = await this.printJobRepository.findOne({
      where: { id },
    })

    if (!job) return null

    job.status = 'printed'
    job.printedAt = new Date()
    job.lastError = null
    job.lockedAt = null

    return await this.printJobRepository.save(job)
  }

  async markAsFailed(id: string, errorMessage?: string | null): Promise<PrintJob | null> {
    const job = await this.printJobRepository.findOne({
      where: { id },
    })

    if (!job) return null

    job.status = 'failed'
    job.attempts = Number(job.attempts ?? 0) + 1
    job.lastAttemptAt = new Date()
    job.lastError = errorMessage?.trim() ? errorMessage.trim() : 'Error de impresión'
    job.lockedAt = null

    return await this.printJobRepository.save(job)
  }

  async requeueJob(id: string): Promise<PrintJob | null> {
    const job = await this.printJobRepository.findOne({
      where: { id },
    })

    if (!job) return null

    job.status = 'pending'
    job.lockedAt = null
    job.printedAt = null

    return await this.printJobRepository.save(job)
  }

  async recoverStaleJobs(timeoutMinutes = 5): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)

    const result = await this.printJobRepository
      .createQueryBuilder()
      .update(PrintJob)
      .set({
        status: 'pending',
        lockedAt: null,
      })
      .where('status = :status', { status: 'processing' })
      .andWhere('locked_at IS NOT NULL')
      .andWhere('locked_at < :cutoff', { cutoff })
      .execute()

    return result.affected ?? 0
  }

  async createJob(input: CreatePrintJobInput): Promise<PrintJob> {
    const job = this.printJobRepository.create({
      source: input.source ?? 'terminal',
      sourceReference: input.sourceReference ?? null,
      ticketId: input.ticketId != null ? String(input.ticketId) : null,
      serviceId: input.serviceId != null ? String(input.serviceId) : null,
      ticketNumber: input.ticketNumber,
      serviceName: input.serviceName,
      clientName: input.clientName ?? null,
      payloadJson: input.payloadJson ?? null,
      status: 'pending',
      attempts: 0,
      lastError: null,
      lockedAt: null,
      printedAt: null,
      lastAttemptAt: null,
    })

    return await this.printJobRepository.save(job)
  }
}
