import { Column, Entity, Index, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OperatorService } from './operator-service.entity';
import { Operator } from './operator.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  // UNIQUE en la BD (útil para numeración de tickets)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10 })
  prefix: string;

  @Column({ name: 'next_ticket_number', type: 'int', unsigned: true, default: 1 })
  nextTicketNumber: number;

  // Habilitado/deshabilitado
  @Column({ type: 'tinyint', width: 1, default: 1 })
  active: boolean;

  // Prioridad de atención (para ordenar listados)
  @Column({ name: 'priority_level', type: 'tinyint', default: 3 })
  priorityLevel: number;

  /**
   * @deprecated Mantener solo para compatibilidad temporal. Usar {@link priorityLevel}.
   */
  get priority(): number {
    return this.priorityLevel;
  }

  set priority(value: number) {
    this.priorityLevel = value;
  }

  // Tiempo estimado por ticket (minutos)
  @Column({ name: 'estimated_time', type: 'int', default: 10 })
  estimatedTime: number;

  @Column({ name: 'max_attention_time', type: 'int', nullable: true })
  maxAttentionTime?: number | null;

  @Column({ name: 'system_locked', type: 'tinyint', width: 1, default: 0 })
  systemLocked: boolean;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => OperatorService, (link) => link.service)
  operatorLinks!: OperatorService[];

  @ManyToMany(() => Operator, (operator) => operator.services, { cascade: false })
  operators!: Operator[];
}
