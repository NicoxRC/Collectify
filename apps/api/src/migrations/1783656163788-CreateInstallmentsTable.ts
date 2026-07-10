import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateInstallmentsTable1783656163788 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'installments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'loan_id',
            type: 'uuid',
          },
          {
            name: 'installment_number',
            type: 'int',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'due_date',
            type: 'date',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'paid'],
            enumName: 'installments_status_enum',
            default: "'pending'",
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
      'installments',
      new TableIndex({
        name: 'IDX_installments_loan_id',
        columnNames: ['loan_id'],
      }),
    );
    await queryRunner.createIndex(
      'installments',
      new TableIndex({
        name: 'IDX_installments_due_date',
        columnNames: ['due_date'],
      }),
    );
    await queryRunner.createIndex(
      'installments',
      new TableIndex({
        name: 'IDX_installments_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createForeignKey(
      'installments',
      new TableForeignKey({
        name: 'FK_installments_loan_id',
        columnNames: ['loan_id'],
        referencedTableName: 'loans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('installments', 'FK_installments_loan_id');
    await queryRunner.dropIndex('installments', 'IDX_installments_status');
    await queryRunner.dropIndex('installments', 'IDX_installments_due_date');
    await queryRunner.dropIndex('installments', 'IDX_installments_loan_id');
    await queryRunner.dropTable('installments');
  }
}
