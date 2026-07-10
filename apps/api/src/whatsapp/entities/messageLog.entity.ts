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

export enum MessageLogStatus {
  Sent = 'sent',
  Failed = 'failed',
}

// Append-only — one row per reminder actually sent to a client, per
// docs/DATABASE.md. No updated_at/deleted_at: history is never edited.
@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column()
  phoneNumber!: string;

  @Column({ type: 'text' })
  messageContent!: string;

  @Column({ type: 'enum', enum: MessageLogStatus })
  status!: MessageLogStatus;

  @Column({ type: 'timestamptz' })
  sentAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
