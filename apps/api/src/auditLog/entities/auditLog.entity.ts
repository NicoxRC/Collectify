import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

// Append-only — no updatedAt/deletedAt, same convention as message_logs/
// message_log_items (see docs/DATABASE.md): a trail that can itself be
// edited or deleted defeats its purpose. See
// docs/phases/PHASE_11_AUDIT_LOG.md.
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['actorUserId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable — not every action has an authenticated actor (e.g. a future
  // cron-triggered action). onDelete: SET NULL — a deleted user's past
  // actions stay in the trail with no resolvable actor, rather than being
  // deleted along with the user, which would defeat the point of an audit
  // trail.
  @Column({ type: 'varchar', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser!: User | null;

  // '<entityType>.<verb>', e.g. 'client.create', 'loan.refinance',
  // 'payment.register', 'user.deactivate'. Free text, not an enum — new
  // actions are added by decorating a new endpoint with @Audit(), not by a
  // schema migration.
  @Column()
  action!: string;

  @Column()
  entityType!: string;

  // Nullable: known immediately for update/delete/reactivate-style actions
  // (the route's own :id), resolved from the response for create actions —
  // see AuditLogInterceptor.resolveEntityId. Not every action necessarily
  // resolves to one (kept nullable rather than forcing a placeholder).
  //
  // Explicit `type: 'uuid'` is required here (unlike actorUserId below,
  // which TypeORM infers correctly because it's shadowed by the
  // `actorUser` relation's @JoinColumn on the same db column) — TypeScript
  // emits `Object` as the design:type metadata for a plain `string | null`
  // property with no backing relation, which TypeORM then rejects outright
  // ("Data type Object ... is not supported by postgres"). Matches
  // `entity_id`'s column type in migration 1784600000000-CreateAuditLogsTable.
  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  // Relevant request/response data for this action — shape varies per
  // action. Known-sensitive fields (passwords) are redacted before this is
  // written, never stored in the clear. See AuditLogInterceptor.redact.
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  // Human-readable snapshot of which specific record this action touched
  // — "Juana Pérez (CC 1234567890)", "Pagaré #743", "Pago de $150.000 el
  // 2026-08-18" — resolved once at write time by
  // AuditLogInterceptor.resolveEntityLabel and frozen here. Deliberately
  // NOT re-derived on read from the live client/loan/payment row: that
  // record may have since changed (a renamed client) or been
  // soft-deleted, and the audit trail should describe what happened at
  // the time, not what's true today. Null when no label could be
  // resolved (e.g. an entityType with no labeling rule yet).
  @Column({ type: 'varchar', nullable: true })
  entityLabel!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
