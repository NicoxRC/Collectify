import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../database/decimal.transformer';
import { User } from '../../users/entities/user.entity';

// Historical rows, never mutated — confirmed with the human (see
// docs/phases/PHASE_15_USURY_RATE.md "Resolved"): a new month's rate is
// always a new row, so past months' certified rates stay queryable exactly
// as they were when they applied. Append-only, same convention as
// audit_logs/message_logs — no updatedAt/deletedAt.
@Entity('usury_rates')
export class UsuryRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // First day of the certified month (e.g. '2026-08-01'). Unique — the
  // service layer also rejects a duplicate month before insert, but the
  // constraint is the actual guarantee that history is never overwritten.
  @Index({ unique: true })
  @Column({ type: 'date' })
  effectiveMonth!: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  ratePercentage!: number;

  // Nullable + SET NULL, same reasoning as audit_logs.actorUserId: keep the
  // historical rate row (and the record that someone entered it) even after
  // the acting user is deleted.
  @Column({ type: 'varchar', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @CreateDateColumn()
  createdAt!: Date;
}
