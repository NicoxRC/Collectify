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
import { Installment } from '../../loans/entities/installment.entity';

import { MessageLog } from './messageLog.entity';

// Append-only — snapshots what a client was told at send time, since
// overdue days/interest change daily. Never recalculated after the fact.
@Entity('message_log_items')
export class MessageLogItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  messageLogId!: string;

  @ManyToOne(() => MessageLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_log_id' })
  messageLog!: MessageLog;

  @Column()
  installmentId!: string;

  @ManyToOne(() => Installment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'installment_id' })
  installment!: Installment;

  @Column()
  overdueDaysSnapshot!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  interestSnapshot!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
