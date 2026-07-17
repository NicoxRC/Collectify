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

import { Client } from '../../clients/entities/client.entity';
import { decimalTransformer } from '../../database/decimal.transformer';

export enum InstallmentFrequency {
  Monthly = 'monthly',
  Biweekly = 'biweekly',
}

export enum LoanStatus {
  Active = 'active',
  Paid = 'paid',
  Refinanced = 'refinanced',
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Index({ unique: true })
  @Column()
  promissoryNoteNumber!: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  principalAmount!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  interestRate!: number;

  @Column({ type: 'date' })
  disbursedAt!: string;

  @Column({ type: 'enum', enum: InstallmentFrequency })
  installmentFrequency!: InstallmentFrequency;

  @Column()
  totalInstallments!: number;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.Active })
  status!: LoanStatus;

  @Column({ nullable: true })
  refinancedFromLoanId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'refinanced_from_loan_id' })
  refinancedFromLoan!: Loan | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
