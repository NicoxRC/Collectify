import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from './user.entity';

// Matches the sidebar's top-level menu items (Sidebar.tsx NAV_ITEMS),
// confirmed with the human for Phase 20 — see
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md "Before starting this phase".
// Dashboard and Perfil are deliberately excluded: neither is ever
// restricted (Dashboard has no roles today; Perfil is a personal page, not
// a MENÚ item).
export enum AppModule {
  Clients = 'clients',
  Loans = 'loans',
  Messages = 'messages',
  MessageTemplates = 'message_templates',
  InterestConceptTypes = 'interest_concept_types',
  AuditLog = 'audit_log',
  UsuryRates = 'usury_rates',
  Users = 'users',
}

// Row presence = granted; absence = not granted — simpler than a boolean
// column, and matches the guard's semantics exactly (see
// ModulePermissionsGuard). Only ever created for collector accounts: an
// admin has full system access unconditionally (confirmed, see
// docs/GLOSSARY.md "Roles" — "Owner (Admin): Full system access"), so the
// guard never even reads these rows for an admin. Confirmed with the human
// (Phase 20): permissions are per individual user, not per role with
// exceptions — this table has no role column at all.
@Entity('user_module_permissions')
@Index(['userId', 'module'], { unique: true })
export class UserModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: AppModule })
  module!: AppModule;

  @CreateDateColumn()
  createdAt!: Date;
}
