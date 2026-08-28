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

import { Client, DocumentType } from '../../clients/entities/client.entity';
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

  @Column({ type: 'varchar', nullable: true })
  refinancedFromLoanId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // The "cuota inicial" — a down payment the client already made outside
  // the credit system to cover the part of the purchase this loan doesn't
  // finance. Purely informational: not one of this loan's installments,
  // has no due date, accrues no interest, and never affects the
  // amortization schedule. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md
  // (corrected after client QA — this was originally, incorrectly,
  // modeled as flagging one of the generated installments).
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  initialPayment!: number | null;

  // Set once the "new loan" WhatsApp message actually succeeds — either
  // from the synchronous send at creation/refinance time, or from the
  // Phase 18 retry cron picking up a loan whose synchronous send failed.
  // Lets that cron find "loans still needing their message" directly,
  // instead of the fragile message-content string-matching
  // LoanDetailPage.tsx used before. See
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  @Column({ type: 'timestamptz', nullable: true })
  newLoanMessageSentAt!: Date | null;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'refinanced_from_loan_id' })
  refinancedFromLoan!: Loan | null;

  // --- Co-debtor (codeudor), Phase 21 — belongs here, not on Client: the
  // business confirmed whether a loan has one varies per loan. At most one
  // per loan (confirmed) — plain nullable columns, no separate table. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md.
  @Column({ type: 'varchar', nullable: true })
  coDebtorFullName!: string | null;

  @Column({ type: 'enum', enum: DocumentType, nullable: true })
  coDebtorDocumentType!: DocumentType | null;

  @Column({ type: 'varchar', nullable: true })
  coDebtorDocumentNumber!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coDebtorPhoneNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  coDebtorAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coDebtorRelationship!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coDebtorIdDocumentUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
