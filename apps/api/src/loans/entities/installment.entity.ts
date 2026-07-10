import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../database/decimal.transformer';

import { Loan } from './loan.entity';

export enum InstallmentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

@Entity('installments')
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  loanId!: string;

  @ManyToOne(() => Loan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loan_id' })
  loan!: Loan;

  @Column()
  installmentNumber!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Index()
  @Column({ type: 'date' })
  dueDate!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: InstallmentStatus,
    default: InstallmentStatus.Pending,
  })
  status!: InstallmentStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
