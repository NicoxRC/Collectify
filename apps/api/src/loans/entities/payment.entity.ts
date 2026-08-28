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

import { Installment } from './installment.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  installmentId!: string;

  @ManyToOne(() => Installment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installment_id' })
  installment!: Installment;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amountPaid!: number;

  @Column({ type: 'date' })
  paidAt!: string;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  // Deprecated as of Phase 28 — superseded by the payment_images table
  // (see PaymentImage entity), which supports more than one receipt photo
  // per payment. No longer written for new payments; kept, unchanged in
  // shape, only as a fallback for rows created before that migration (its
  // value was backfilled into payment_images at that point, so this is
  // read as a last resort, not the primary source). See
  // docs/phases/PHASE_28_MULTI_INSTALLMENT_PAYMENT.md.
  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
