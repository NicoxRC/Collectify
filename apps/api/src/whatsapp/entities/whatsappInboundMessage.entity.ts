import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Client } from '../../clients/entities/client.entity';

export enum WhatsappInboundMessageType {
  Button = 'button',
  Text = 'text',
  Other = 'other',
}

// Append-only — one row per inbound WhatsApp event received (button tap or
// free text), from a recognized client or not. Never dropped, per
// docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md. No updated_at/deleted_at, same
// convention as MessageLog.
@Entity('whatsapp_inbound_messages')
export class WhatsappInboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable — an inbound message from a phone number that doesn't match
  // any client is still logged, not dropped. SET NULL (not RESTRICT) since
  // this is historical record of an event, not a reference that should
  // block a client's own soft-delete.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null;

  @Column()
  fromPhoneNumber!: string;

  @Column({ type: 'enum', enum: WhatsappInboundMessageType })
  type!: WhatsappInboundMessageType;

  @Column({ type: 'varchar', nullable: true })
  buttonPayload!: string | null;

  @Column({ type: 'text', nullable: true })
  bodyText!: string | null;

  // The full webhook event Meta sent, for debugging/replay — see
  // docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md.
  @Column({ type: 'jsonb' })
  rawPayload!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  receivedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
