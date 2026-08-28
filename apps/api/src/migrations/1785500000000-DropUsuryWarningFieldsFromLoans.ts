import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 24 — the warning-only usury model (Phase 15) these two columns
// supported is gone: a loan cannot be created at all without the current
// month's rate on file, and interest-bearing concepts are auto-filled at
// exactly that rate, so a loan can no longer exceed the ceiling by
// construction. Dropped rather than retired, per the human's explicit
// choice (confirmed this session) over keeping unused historical columns.
// See docs/phases/PHASE_24_USURY_MANDATORY.md.
export class DropUsuryWarningFieldsFromLoans1785500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "usury_justification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "usury_ceiling_exceeded_at_creation"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "usury_ceiling_exceeded_at_creation" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "usury_justification" text`,
    );
  }
}
