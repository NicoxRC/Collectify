import { MigrationInterface, QueryRunner } from 'typeorm';

// DB-backed schedule per message type, replacing the env-var-only source
// the two existing jobs used — see docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
// Nullable: falls back to a per-type code default when unset.
export class AddCronExpressionToMessageTemplates1785000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_templates" ADD COLUMN "cron_expression" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_templates" DROP COLUMN "cron_expression"`,
    );
  }
}
