import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../database/decimal.transformer';

export enum ConceptCalculationType {
  Percentage = 'percentage',
  FixedAmount = 'fixed_amount',
}

// Admin-managed catalog of interest/fee concepts (e.g. "Interés
// remuneratorio", "Gastos de cobranza"). Confirmed with the human this must
// stay open-ended — the admin creates new concept types whenever needed,
// not a fixed/hardcoded list. See docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
@Entity('interest_concept_types')
export class InterestConceptType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: ConceptCalculationType })
  defaultCalculationType!: ConceptCalculationType;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  defaultValue!: number | null;

  // Deactivating removes a type from the picker for new loans without
  // touching LoanInstallmentConcept rows already created from it — those
  // snapshot their own name/value at generation time (confirmed with the
  // human: existing loans must not change if the catalog entry changes).
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
