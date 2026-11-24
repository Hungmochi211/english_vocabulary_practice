import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 50, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 100, nullable: true })
  targetId: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: 'SUCCESS' | 'FAILED';

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
