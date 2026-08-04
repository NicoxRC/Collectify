import { MigrationInterface, QueryRunner } from 'typeorm';

// Nullable — unset means no cupo enforced, same "absence of a value means
// the rule doesn't apply" convention used elsewhere in this project (e.g.
// loans.description). See docs/phases/PHASE_10_CLIENT_CAPACITY.md and
// docs/DATABASE.md "Changed after Phase 10" for the confirmed cupo rules.
export class AddCreditLimitToClients1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "credit_limit" decimal(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "credit_limit"`);
  }
}
