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

// No soft-delete here (unlike Client/Loan/Installment): a reference is
// removed outright via the "quitar" action in ClientForm, there's no
// "reactivate a reference" concept. Surviving a client's own soft-delete
// is automatic, not something this entity has to implement — soft-delete
// only sets Client.deletedAt, it never removes the row the FK points to.
export enum ClientReferenceType {
  Personal = 'personal',
  Comercial = 'comercial',
}

@Entity('client_references')
export class ClientReference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'enum', enum: ClientReferenceType })
  type!: ClientReferenceType;

  @Column()
  fullName!: string;

  @Column()
  phoneNumber!: string;

  // Free text (e.g. "hermano", "vecino", "proveedor") — confirmed with the
  // human as sufficient, no fixed catalog. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md.
  @Column()
  relationship!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
