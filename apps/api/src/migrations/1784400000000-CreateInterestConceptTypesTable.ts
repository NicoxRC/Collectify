import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateInterestConceptTypesTable1784400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "interest_concept_types_default_calculation_type_enum" AS ENUM('percentage', 'fixed_amount')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'interest_concept_types',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'default_calculation_type',
            type: 'interest_concept_types_default_calculation_type_enum',
          },
          {
            name: 'default_value',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('interest_concept_types');
    await queryRunner.query(
      `DROP TYPE "interest_concept_types_default_calculation_type_enum"`,
    );
  }
}
