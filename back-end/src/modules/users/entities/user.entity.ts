import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CefrLevel } from '../../vocabulary/entities/vocabulary.entity';

export type UserRole = 'learner' | 'admin';
export type AuthProvider = 'local' | 'google';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({
    name: 'target_level',
    type: 'enum',
    enum: CefrLevel,
    enumName: 'cefr_level_enum',
    default: CefrLevel.B1,
  })
  targetLevel: CefrLevel;

  @Column({
    type: 'enum',
    enum: ['learner', 'admin'],
    enumName: 'user_role_enum',
    default: 'learner',
  })
  role: UserRole;

  @Column({
    name: 'auth_provider',
    type: 'enum',
    enum: ['local', 'google'],
    enumName: 'auth_provider_enum',
    default: 'local',
  })
  authProvider: AuthProvider;

  @Column({ name: 'google_id', type: 'varchar', length: 100, nullable: true, unique: true })
  googleId: string | null;

  @Column({ name: 'email_reminder_enabled', type: 'boolean', default: true })
  emailReminderEnabled: boolean;

  @Column({ name: 'token_version', type: 'int', default: 1 })
  tokenVersion: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
