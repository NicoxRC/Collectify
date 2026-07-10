import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the 'cancelled' installment status — used when a loan is refinanced
// to mark its remaining pending installments as excluded from active
// collection while keeping them as historical record. See "Refinancing" in
// docs/DATABASE.md.
export class AddCancelledInstallmentStatus1783705000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "installments_status_enum" ADD VALUE 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres has no direct "DROP VALUE" for enums — rebuild the type
    // without 'cancelled'. Any row still using it must be reverted first.
    await queryRunner.query(
      `ALTER TABLE "installments" ALTER COLUMN "status" TYPE varchar`,
    );
    await queryRunner.query(`DROP TYPE "installments_status_enum"`);
    await queryRunner.query(
      `CREATE TYPE "installments_status_enum" AS ENUM ('pending', 'paid')`,
    );
    await queryRunner.query(
      `ALTER TABLE "installments" ALTER COLUMN "status" TYPE "installments_status_enum" USING "status"::"installments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "installments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }
}
