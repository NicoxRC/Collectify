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

// A curated group of clients attached to a message template (Phase 18).
// ADDITIVE for the 3 types with a dynamic qualifying condition (overdue,
// upcoming_due, new_loan): audience members are always included alongside
// whoever qualifies dynamically that day, even with nothing to report
// themselves (see the allowEmpty option on the reminder services). For
// account_summary, which has no dynamic condition, the audience IS the
// entire recipient list. The schema allows multiple audiences per template,
// but the confirmed UI surface is one primary audience per template — see
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
