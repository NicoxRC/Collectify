import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Historical rows, never mutated — see docs/phases/PHASE_15_USURY_RATE.md
// "Resolved". Append-only, same convention as audit_logs/message_logs — no
// updated_at/deleted_at.
export class CreateUsuryRatesTable1784900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'usury_rates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'effective_month',
            type: 'date',
          },
          {
            name: 'rate_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
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
      'usury_rates',
      new TableIndex({
        name: 'IDX_usury_rates_effective_month',
        columnNames: ['effective_month'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'usury_rates',
      new TableForeignKey({
        name: 'FK_usury_rates_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('usury_rates', 'FK_usury_rates_created_by');
    await queryRunner.dropIndex(
      'usury_rates',
      'IDX_usury_rates_effective_month',
    );
    await queryRunner.dropTable('usury_rates');
  }
}
