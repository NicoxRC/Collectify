import { MigrationInterface, QueryRunner } from 'typeorm';

// See docs/phases/PHASE_15_USURY_RATE.md "Resolved" — enforcement is a
// warning at creation/refinance time, not a hard block, so both fields
// are informational: usury_ceiling_exceeded_at_creation is a one-time
// snapshot (not recomputed on read), usury_justification is an optional
// admin note.
export class AddUsuryFieldsToLoans1784900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "usury_ceiling_exceeded_at_creation" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "usury_justification" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "usury_justification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "usury_ceiling_exceeded_at_creation"`,
    );
  }
}
