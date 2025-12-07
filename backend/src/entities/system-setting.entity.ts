import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  // 'key' es palabra reservada en MySQL → definimos name explícito
  @Index({ unique: true })
  @Column({ name: 'key', type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
