import { MigrationInterface, QueryRunner } from 'typeorm';

// A "cuota inicial" is a down payment made at/near disbursement — not a
// scheduled repayment the client can be "late" on, so it's exempt from
// mora regardless of how far past due_date it is. Defaults false so every
// existing installment keeps accruing mora exactly as before. See
// docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
export class AddIsInitialToInstallments1784800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "installments" ADD COLUMN "is_initial" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "installments" DROP COLUMN "is_initial"`,
    );
  }
}
