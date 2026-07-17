import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds `type` to message_templates — as of Phase 9 there is one
// admin-editable template per message flow (new_loan, upcoming_due,
// overdue, account_summary), not a single global template. Existing rows
// predate this and were all used for the overdue reminder (the only flow
// that existed in Phase 5), so they're backfilled to 'overdue'.
// See docs/phases/PHASE_9_MESSAGE_TYPES.md.
export class AddTypeToMessageTemplates1784200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "message_templates_type_enum" AS ENUM ('new_loan', 'upcoming_due', 'overdue', 'account_summary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" ADD COLUMN "type" "message_templates_type_enum" NOT NULL DEFAULT 'overdue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" ALTER COLUMN "type" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_templates" DROP COLUMN "type"`,
    );
    await queryRunner.query(`DROP TYPE "message_templates_type_enum"`);
  }
}
