import { MigrationInterface, QueryRunner } from 'typeorm';

// Nullable: installments created before Phase 14 (amount was a single
// hand-entered total with no capital/interest split) never had this
// calculated. Nothing is in production yet (confirmed with the human), so
// no backfill is needed — this only matters going forward.
export class AddPrincipalPortionToInstallments1784400000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "installments" ADD COLUMN "principal_portion" decimal(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "installments" DROP COLUMN "principal_portion"`,
    );
  }
}
