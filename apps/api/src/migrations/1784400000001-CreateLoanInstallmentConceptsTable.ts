import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateLoanInstallmentConceptsTable1784400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "loan_installment_concepts_calculation_type_enum" AS ENUM('percentage', 'fixed_amount')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'loan_installment_concepts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'installment_id',
            type: 'uuid',
          },
          {
            name: 'interest_concept_type_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'name_snapshot',
            type: 'varchar',
          },
          {
            name: 'calculation_type',
            type: 'loan_installment_concepts_calculation_type_enum',
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'computed_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'loan_installment_concepts',
      new TableForeignKey({
        columnNames: ['installment_id'],
        referencedTableName: 'installments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'loan_installment_concepts',
      new TableForeignKey({
        columnNames: ['interest_concept_type_id'],
        referencedTableName: 'interest_concept_types',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_loan_installment_concepts_installment_id" ON "loan_installment_concepts" ("installment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('loan_installment_concepts');
    await queryRunner.query(
      `DROP TYPE "loan_installment_concepts_calculation_type_enum"`,
    );
  }
}
