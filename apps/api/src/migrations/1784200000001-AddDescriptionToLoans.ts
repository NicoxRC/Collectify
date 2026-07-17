import { MigrationInterface, QueryRunner } from 'typeorm';

// Optional free-text concept/reason for a loan (e.g. "Compra de Apple
// MacBook Air M5..."), used by the new "new_loan" WhatsApp message added in
// Phase 9. Same precedent as payments.observation — see docs/DATABASE.md.
export class AddDescriptionToLoans1784200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "description"`);
  }
}
