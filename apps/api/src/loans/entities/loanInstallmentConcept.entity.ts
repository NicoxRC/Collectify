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
import {
  ConceptCalculationType,
  InterestConceptType,
} from '../../interestConceptTypes/entities/interestConceptType.entity';

import { Installment } from './installment.entity';

// One row per interest/fee concept applied to a specific installment.
// Snapshots name/calculationType/value at generation time (confirmed with
// the human: an installment must not change if its InterestConceptType is
// later edited/deactivated — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md).
// interestConceptTypeId is kept only as a soft reference for reporting
// ("total gastos de cobranza cobrados este mes"); everything needed to
// display or recompute this concept lives on this row already.
@Entity('loan_installment_concepts')
export class LoanInstallmentConcept {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  installmentId!: string;

  @ManyToOne(() => Installment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installment_id' })
  installment!: Installment;

  @Column({ type: 'varchar', nullable: true })
  interestConceptTypeId!: string | null;

  @ManyToOne(() => InterestConceptType, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'interest_concept_type_id' })
  interestConceptType!: InterestConceptType | null;

  @Column()
  nameSnapshot!: string;

  @Column({ type: 'enum', enum: ConceptCalculationType })
  calculationType!: ConceptCalculationType;

  // The % (for percentage concepts) or flat currency figure (for
  // fixed_amount concepts) actually used for this installment.
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  value!: number;

  // The resulting currency amount this concept contributed to this
  // installment — computed once at generation time against the balance at
  // that point, then stored (the schedule doesn't change with the passage
  // of time the way mora does).
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  computedAmount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
