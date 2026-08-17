import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../database/decimal.transformer';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Index({ unique: true })
  @Column()
  documentNumber!: string;

  @Index()
  @Column()
  phoneNumber!: string;

  // Nullable — unset means no cupo enforced (see ClientsService.
  // getCreditUsage). "Cupo usado" is capital + accrued interest (the same
  // outstandingBalance already computed per loan for LoanSummary), not
  // stored — see docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  creditLimit!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
