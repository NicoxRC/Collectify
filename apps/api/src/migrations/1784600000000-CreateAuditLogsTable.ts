import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Append-only audit trail — see docs/phases/PHASE_11_AUDIT_LOG.md. No
// updated_at/deleted_at, same convention as message_logs.
export class CreateAuditLogsTable1784600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'actor_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
          },
          {
            name: 'entity_type',
            type: 'varchar',
          },
          {
            name: 'entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Mirrors the indexing rationale already documented for message_logs
    // in docs/DATABASE.md: (entity_type, entity_id) backs "show me the
    // history for this specific record", (actor_user_id, created_at) backs
    // "show me what this user did, most recent first" — both filters the
    // audit log screen (docs/phasesClient/PHASE_11_AUDIT_LOG.md) supports.
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_entity_type_entity_id',
        columnNames: ['entity_type', 'entity_id'],
      }),
    );
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_actor_user_id_created_at',
        columnNames: ['actor_user_id', 'created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'audit_logs',
      new TableForeignKey({
        name: 'FK_audit_logs_actor_user_id',
        columnNames: ['actor_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'audit_logs',
      'FK_audit_logs_actor_user_id',
    );
    await queryRunner.dropIndex(
      'audit_logs',
      'IDX_audit_logs_actor_user_id_created_at',
    );
    await queryRunner.dropIndex(
      'audit_logs',
      'IDX_audit_logs_entity_type_entity_id',
    );
    await queryRunner.dropTable('audit_logs');
  }
}
