import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Phase 27 — replaces the overdue/upcoming_due curated-audience concept
// (message_audiences/message_audience_clients, Phase 18) with a whitelist
// that throttles message FREQUENCY per client instead of gating
// eligibility. Those Phase 18 tables are deliberately NOT dropped here —
// they may still hold historical meaning, and dropping schema is its own
// confirmed decision, not a side effect of this migration. See
// docs/phases/PHASE_27_MESSAGE_FREQUENCY.md and docs/DATABASE.md.
export class CreateClientMessageFrequenciesTable1785800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'client_message_frequencies',
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
            isUnique: true,
          },
          {
            name: 'minimum_days_between_messages',
            type: 'int',
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
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'client_message_frequencies',
      new TableForeignKey({
        columnNames: ['client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('client_message_frequencies');
  }
}
