import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMessageLogsTable1783658056868 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'message_logs',
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
            name: 'phone_number',
            type: 'varchar',
          },
          {
            name: 'message_content',
            type: 'text',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['sent', 'failed'],
            enumName: 'message_logs_status_enum',
          },
          {
            name: 'sent_at',
            type: 'timestamptz',
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
      'message_logs',
      new TableIndex({
        name: 'IDX_message_logs_client_id',
        columnNames: ['client_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'message_logs',
      new TableForeignKey({
        name: 'FK_message_logs_client_id',
        columnNames: ['client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'message_logs',
      'FK_message_logs_client_id',
    );
    await queryRunner.dropIndex('message_logs', 'IDX_message_logs_client_id');
    await queryRunner.dropTable('message_logs');
  }
}
