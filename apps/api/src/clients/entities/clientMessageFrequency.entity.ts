import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from './client.entity';

// Phase 27 — replaces the overdue/upcoming_due "curated audience" concept
// (Phase 18) entirely. That reversal restores the pre-Phase-18 default:
// every dynamically-qualifying client (has an overdue installment / one
// approaching due) is messaged on every cron run, with no group to
// populate first. A row here instead THROTTLES HOW OFTEN a specific
// client is messaged — it never controls WHETHER they're eligible. A
// client with no row here is never throttled.
//
// minimumDaysBetweenMessages is set freely by the admin per client via
// PUT /clients/:id/message-frequency (e.g. ~7 days for a "preferential"
// client per the client's own framing) — deliberately no hardcoded
// default value, confirmed with the human rather than guessed. See
// docs/phases/PHASE_27_MESSAGE_FREQUENCY.md.
//
// One row per client (unique index on clientId), unlike MessageAudience's
// "multiple allowed, service always uses the most-recently-created one"
// pattern — that flexibility was never actually needed there either, and
// a whitelist entry is inherently a 1:1 relationship with its client, so
// a DB-level unique constraint plus a find-or-create upsert in
// ClientsService is simpler and removes any "which one is canonical"
// ambiguity.
//
// Scope: applies to the `overdue`/`upcoming_due` reminder crons only —
// confirmed out of scope for `account_summary` and the synchronous
// `new_loan` send. See MessageFrequencyThrottleService in the whatsapp
// module, the only reader of this table.
@Entity('client_message_frequencies')
export class ClientMessageFrequency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'int' })
  minimumDaysBetweenMessages!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
