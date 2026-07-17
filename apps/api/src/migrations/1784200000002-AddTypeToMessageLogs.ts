import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds `type` to message_logs, mirroring message_templates.type — so
// message history can be filtered by which flow produced it. Existing rows
// predate the other message types (Phase 5 only had the overdue reminder),
// so they're backfilled to 'overdue'. See docs/phases/PHASE_9_MESSAGE_TYPES.md.
export class AddTypeToMessageLogs1784200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "message_logs_type_enum" AS ENUM ('new_loan', 'upcoming_due', 'overdue', 'account_summary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD COLUMN "type" "message_logs_type_enum" NOT NULL DEFAULT 'overdue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ALTER COLUMN "type" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "message_logs" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "message_logs_type_enum"`);
  }
}
