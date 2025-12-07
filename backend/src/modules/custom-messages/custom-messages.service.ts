import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomMessage } from '../../entities/custom-message.entity';
import {
  CreateCustomMessageDto,
  UpdateCustomMessageDto,
} from './dto/create-custom-message.dto';

@Injectable()
export class CustomMessagesService {
  constructor(
    @InjectRepository(CustomMessage)
    private readonly messagesRepo: Repository<CustomMessage>,
  ) {}

  findAll(): Promise<CustomMessage[]> {
    return this.messagesRepo.find({
      order: {
        priority: 'DESC',
        startDate: 'ASC',
        title: 'ASC',
      } as any,
    });
  }

  findActive(referenceDate: Date = new Date()): Promise<CustomMessage[]> {
    const dayCode = this.getWeekdayCode(referenceDate);

    return this.messagesRepo
      .createQueryBuilder('message')
      .where('message.active = :active', { active: true })
      .andWhere('(message.startDate IS NULL OR message.startDate <= :now)', { now: referenceDate })
      .andWhere('(message.endDate IS NULL OR message.endDate >= :now)', { now: referenceDate })
      .andWhere(
        '(message.activeDays IS NULL OR message.activeDays = "" OR FIND_IN_SET(:dayCode, message.activeDays) > 0)',
        { dayCode },
      )
      .orderBy('message.priority', 'DESC')
      .addOrderBy('message.startDate', 'ASC')
      .addOrderBy('message.title', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<CustomMessage> {
    const message = await this.messagesRepo.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    return message;
  }

  async create(payload: CreateCustomMessageDto): Promise<CustomMessage> {
    const message = this.messagesRepo.create(this.normalizeDates(payload));
    return this.messagesRepo.save(message);
  }

  async update(id: number, payload: UpdateCustomMessageDto): Promise<CustomMessage> {
    const message = await this.findOne(id);
    const updated = this.messagesRepo.merge(message, this.normalizeDates(payload));
    return this.messagesRepo.save(updated);
  }

  async remove(id: number): Promise<void> {
    const message = await this.findOne(id);
    await this.messagesRepo.remove(message);
  }

  private normalizeDates<T extends { startDate?: string | Date | null; endDate?: string | Date | null }>(
    payload: T,
  ): T {
    const normalize = (value?: string | Date | null) => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const normalizedStart = normalize(payload.startDate);
    const normalizedEnd = normalize(payload.endDate);

    return {
      ...payload,
      ...(normalizedStart !== undefined ? { startDate: normalizedStart } : {}),
      ...(normalizedEnd !== undefined ? { endDate: normalizedEnd } : {}),
    };
  }

  private getWeekdayCode(referenceDate: Date): string {
    const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const idx = referenceDate.getDay();
    return codes[idx] ?? 'sun';
  }
}
