import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('custom_messages')
export class CustomMessage {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 30, default: 'info' })
  type: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  active: boolean;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ name: 'start_date', type: 'datetime', nullable: true })
  startDate?: Date | null;

  @Column({ name: 'end_date', type: 'datetime', nullable: true })
  endDate?: Date | null;

  @Column({ name: 'media_url', type: 'longtext', nullable: true })
  mediaUrl?: string | null;

  @Column({ name: 'media_type', type: 'varchar', length: 50, nullable: true })
  mediaType?: string | null;

  @Column({ name: 'display_duration_seconds', type: 'int', nullable: true })
  displayDurationSeconds?: number | null;

  @Column({ name: 'active_days', type: 'simple-array', nullable: true })
  activeDays?: string[] | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
