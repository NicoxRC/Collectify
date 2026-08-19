import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Phase 20 — see docs/phases/PHASE_20_MODULE_PERMISSIONS.md. Row presence =
// granted; there's no boolean column. Only ever populated for collector
// accounts — an admin has full access unconditionally and never has rows
// here (see UserModulePermission entity doc comment).
export class CreateUserModulePermissionsTable1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_module_permissions_module_enum" AS ENUM('clients', 'loans', 'messages', 'message_templates', 'interest_concept_types', 'audit_log', 'usury_rates', 'users')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_module_permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'module',
            type: 'user_module_permissions_module_enum',
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

    await queryRunner.createForeignKey(
      'user_module_permissions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_module_permissions_user_id_module" ON "user_module_permissions" ("user_id", "module")`,
    );

    // Data migration, not just schema — before this table existed, every
    // collector already implicitly had Clientes/Préstamos/Mensajes (the 3
    // modules that were never behind @Roles(UserRole.Admin)) and nothing
    // else. Seeding those rows now means this migration ships with zero
    // behavior change for any existing account; an admin adjusts access
    // from here going forward through the new UI. Modules that were
    // already admin-only (message_templates, interest_concept_types,
    // audit_log, usury_rates, users) are deliberately NOT seeded — no
    // collector had them before, so none should silently gain them here.
    await queryRunner.query(`
      INSERT INTO "user_module_permissions" ("user_id", "module")
      SELECT "id", "module"
      FROM "users", unnest(ARRAY['clients', 'loans', 'messages']::user_module_permissions_module_enum[]) AS "module"
      WHERE "role" = 'collector'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_module_permissions');
    await queryRunner.query(`DROP TYPE "user_module_permissions_module_enum"`);
  }
}
