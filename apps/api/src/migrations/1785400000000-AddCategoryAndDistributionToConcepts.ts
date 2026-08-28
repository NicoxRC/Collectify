import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 23 — additive only, no backfill of invented moratory concepts (the
// admin creates his own, exactly like corriente ones — confirmed with the
// human). Every existing interest_concept_types row defaults to 'corriente',
// matching what it already implicitly was; loan_installment_concepts rows
// generated before this migration have no category, but they're all
// corriente in practice too — the DEFAULT keeps them valid without a
// backfill statement. See docs/phases/PHASE_23_DYNAMIC_CHARGES.md.
export class AddCategoryAndDistributionToConcepts1785400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "interest_concept_types_category_enum" AS ENUM('corriente', 'moratorio')`,
    );
    await queryRunner.query(
      `CREATE TYPE "interest_concept_types_fixed_amount_distribution_enum" AS ENUM('split_across_installments', 'first_installment_only')`,
    );
    await queryRunner.query(`
      ALTER TABLE "interest_concept_types"
        ADD COLUMN "category" "interest_concept_types_category_enum" NOT NULL DEFAULT 'corriente',
        ADD COLUMN "fixed_amount_distribution" "interest_concept_types_fixed_amount_distribution_enum"
    `);

    await queryRunner.query(
      `CREATE TYPE "loan_installment_concepts_category_enum" AS ENUM('corriente', 'moratorio')`,
    );
    await queryRunner.query(`
      ALTER TABLE "loan_installment_concepts"
        ADD COLUMN "category" "loan_installment_concepts_category_enum" NOT NULL DEFAULT 'corriente'
    `);
    await queryRunner.query(
      `ALTER TABLE "loan_installment_concepts" ALTER COLUMN "category" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_installment_concepts" DROP COLUMN "category"`,
    );
    await queryRunner.query(
      `DROP TYPE "loan_installment_concepts_category_enum"`,
    );

    await queryRunner.query(`
      ALTER TABLE "interest_concept_types"
        DROP COLUMN "fixed_amount_distribution",
        DROP COLUMN "category"
    `);
    await queryRunner.query(
      `DROP TYPE "interest_concept_types_fixed_amount_distribution_enum"`,
    );
    await queryRunner.query(`DROP TYPE "interest_concept_types_category_enum"`);
  }
}
