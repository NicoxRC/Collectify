import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateLoansTable1783656163787 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'loans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'client_id',
            type: 'uuid',
          },
          {
            name: 'promissory_note_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'principal_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'interest_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'disbursed_at',
            type: 'date',
          },
          {
            name: 'installment_frequency',
            type: 'enum',
            enum: ['monthly', 'biweekly'],
            enumName: 'loans_installment_frequency_enum',
          },
          {
            name: 'total_installments',
            type: 'int',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'paid', 'refinanced'],
            enumName: 'loans_status_enum',
            default: "'active'",
          },
          {
            name: 'refinanced_from_loan_id',
            type: 'uuid',
            isNullable: true,
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

    await queryRunner.createIndex(
      'loans',
      new TableIndex({
        name: 'IDX_loans_promissory_note_number',
        columnNames: ['promissory_note_number'],
      }),
    );
    await queryRunner.createIndex(
      'loans',
      new TableIndex({
        name: 'IDX_loans_client_id',
        columnNames: ['client_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'loans',
      new TableForeignKey({
        name: 'FK_loans_client_id',
        columnNames: ['client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'loans',
      new TableForeignKey({
        name: 'FK_loans_refinanced_from_loan_id',
        columnNames: ['refinanced_from_loan_id'],
        referencedTableName: 'loans',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'loans',
      'FK_loans_refinanced_from_loan_id',
    );
    await queryRunner.dropForeignKey('loans', 'FK_loans_client_id');
    await queryRunner.dropIndex('loans', 'IDX_loans_client_id');
    await queryRunner.dropIndex('loans', 'IDX_loans_promissory_note_number');
    await queryRunner.dropTable('loans');
  }
}
