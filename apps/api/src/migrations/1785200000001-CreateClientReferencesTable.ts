import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Phase 21 (KYC) — a dynamic add/remove list per client (personal and
// comercial references), not a fixed number of columns. No soft-delete
// column: a reference is removed outright, and surviving the client's own
// soft-delete is automatic since that only sets clients.deleted_at, never
// removes the row this table's FK points to. See
// docs/phases/PHASE_21_CLIENT_PROFILE.md.
export class CreateClientReferencesTable1785200000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "client_references_type_enum" AS ENUM('personal', 'comercial')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'client_references',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'client_id',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'client_references_type_enum',
          },
          {
            name: 'full_name',
            type: 'varchar',
          },
          {
            name: 'phone_number',
            type: 'varchar',
          },
          {
            name: 'relationship',
            type: 'varchar',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'client_references',
      new TableForeignKey({
        columnNames: ['client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_client_references_client_id" ON "client_references" ("client_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('client_references');
    await queryRunner.query(`DROP TYPE "client_references_type_enum"`);
  }
}
