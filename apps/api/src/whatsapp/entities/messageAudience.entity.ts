import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from '../../clients/entities/client.entity';

import { MessageTemplate } from './messageTemplate.entity';

// A curated group of clients attached to a message template (Phase 18) —
// as of the client QA corrections on 2026-08-18, only `overdue` and
// `upcoming_due` actually use one. For those two, the audience is a
// REQUIRED FILTER (originally additive/union — see
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md "Extended after client QA"):
// a client only gets that reminder if they BOTH dynamically qualify that
// day AND are a member of the audience — an empty audience means nobody
// is reminded, even if clients are overdue. `account_summary` has NO
// audience at all anymore (dropped in the same round of corrections) —
// it sends automatically to every client with an active loan. `new_loan`
// never used the audience concept and now also has no cron job of any
// kind — it's sent once, synchronously, at loan creation, with no
// periodic sweep. The schema allows multiple audiences per template, but
// the confirmed UI surface is one primary audience per template — see
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
@Entity('message_audiences')
export class MessageAudience {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  messageTemplateId!: string;

  @ManyToOne(() => MessageTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_template_id' })
  messageTemplate!: MessageTemplate;

  @Column()
  name!: string;

  @ManyToMany(() => Client)
  @JoinTable({
    name: 'message_audience_clients',
    joinColumn: { name: 'message_audience_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'client_id', referencedColumnName: 'id' },
  })
  clients!: Client[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
