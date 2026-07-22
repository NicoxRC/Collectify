import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { MessageType } from '../messageType.enum';

// Content is fixed per type, not admin-editable — WhatsApp only allows
// business-initiated messages via Meta-approved templates outside the 24h
// window (see CONFIGURACION_WHATSAPP_META.md), so an in-app "edit" feature
// would be misleading. Updating a template's content is a migration, like
// any other data change — see docs/DATABASE.md "Changed after Phase 9".
@Entity('message_templates')
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'enum', enum: MessageType })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
