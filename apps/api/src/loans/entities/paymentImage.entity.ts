import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Payment } from './payment.entity';

// Phase 28 — a payment can carry more than one receipt photo ("hay
// personas que mandan más de un comprobante por cuota", confirmed with the
// human). Append-only, one row per photo — no update/delete columns,
// mirroring loan_installment_concepts' precedent for a per-parent-row
// snapshot table. Replaces payments.image_url going forward (kept,
// deprecated, not dropped — see Payment entity's own comment).
@Entity('payment_images')
export class PaymentImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  paymentId!: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  // The api never touches image bytes — same externally-hosted-URL-only
  // convention as payments.image_url. See docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md.
  @Column({ type: 'varchar' })
  imageUrl!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
