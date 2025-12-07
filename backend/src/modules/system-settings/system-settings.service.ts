import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../entities/system-setting.entity';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  findAll() {
    return this.settingsRepo.find({ order: { key: 'ASC' } as any });
  }

  find(key: string): Promise<SystemSetting | null> {
    return this.settingsRepo.findOne({ where: { key } });
  }

  async get(key: string): Promise<SystemSetting> {
    const s = await this.settingsRepo.findOne({ where: { key } });
    if (!s) throw new NotFoundException(`Setting '${key}' no encontrado`);
    return s;
  }

  // upsert simple por 'key'
  async set(key: string, value: string, description?: string | null) {
    const existing = await this.settingsRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      if (description !== undefined) existing.description = description;
      return this.settingsRepo.save(existing);
    }
    const created = this.settingsRepo.create({ key, value, description: description ?? null });
    return this.settingsRepo.save(created);
  }

  create(data: Partial<SystemSetting>) {
    const entity = this.settingsRepo.create(data);
    return this.settingsRepo.save(entity);
  }

  async update(id: number, data: Partial<SystemSetting>) {
    await this.ensureExists(id);
    await this.settingsRepo.update({ id }, data);
    return this.settingsRepo.findOne({ where: { id } });
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.settingsRepo.delete(id);
  }

  private async ensureExists(id: number) {
    const s = await this.settingsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Setting no encontrado');
  }
}
