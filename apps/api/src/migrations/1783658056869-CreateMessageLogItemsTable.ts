import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMessageLogItemsTable1783658056869 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'message_log_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'message_log_id',
            type: 'uuid',
          },
          {
            name: 'installment_id',
            type: 'uuid',
          },
          {
            name: 'overdue_days_snapshot',
            type: 'int',
          },
          {
            name: 'interest_snapshot',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'message_log_items',
      new TableIndex({
        name: 'IDX_message_log_items_message_log_id',
        columnNames: ['message_log_id'],
      }),
    );
    await queryRunner.createIndex(
      'message_log_items',
      new TableIndex({
        name: 'IDX_message_log_items_installment_id',
        columnNames: ['installment_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'message_log_items',
      new TableForeignKey({
        name: 'FK_message_log_items_message_log_id',
        columnNames: ['message_log_id'],
        referencedTableName: 'message_logs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'message_log_items',
      new TableForeignKey({
        name: 'FK_message_log_items_installment_id',
        columnNames: ['installment_id'],
        referencedTableName: 'installments',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'message_log_items',
      'FK_message_log_items_installment_id',
    );
    await queryRunner.dropForeignKey(
      'message_log_items',
      'FK_message_log_items_message_log_id',
    );
    await queryRunner.dropIndex(
      'message_log_items',
      'IDX_message_log_items_installment_id',
    );
    await queryRunner.dropIndex(
      'message_log_items',
      'IDX_message_log_items_message_log_id',
    );
    await queryRunner.dropTable('message_log_items');
  }
}
