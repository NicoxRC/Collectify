import { MigrationInterface, QueryRunner } from 'typeorm';

// Corrects Phase 13's "cuota inicial" model after client QA: it was
// originally implemented as flagging one of the loan's generated
// installments (is_initial), but a cuota inicial is not one of the
// credit's installments at all — it's a down payment the client already
// made outside the credit system, purely informational, that never
// affects the amortization schedule. Replaced with a nullable amount on
// the loan itself. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
export class ReplaceIsInitialWithInitialPayment1785200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "initial_payment" decimal(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "installments" DROP COLUMN "is_initial"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "installments" ADD COLUMN "is_initial" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "initial_payment"`,
    );
  }
}
