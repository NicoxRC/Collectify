import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateClientsTable1783655858015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'clients',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'first_name',
            type: 'varchar',
          },
          {
            name: 'last_name',
            type: 'varchar',
          },
          {
            name: 'document_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'phone_number',
            type: 'varchar',
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
      'clients',
      new TableIndex({
        name: 'IDX_clients_document_number',
        columnNames: ['document_number'],
      }),
    );
    await queryRunner.createIndex(
      'clients',
      new TableIndex({
        name: 'IDX_clients_phone_number',
        columnNames: ['phone_number'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('clients', 'IDX_clients_phone_number');
    await queryRunner.dropIndex('clients', 'IDX_clients_document_number');
    await queryRunner.dropTable('clients');
  }
}
