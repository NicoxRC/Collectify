import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Phase 22 — see docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md. Append-only, one
// row per inbound WhatsApp event received (button tap or free text),
// whether or not it matched a known client. No updated_at/deleted_at, same
// convention as message_logs.
export class CreateWhatsappInboundMessagesTable1785300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "whatsapp_inbound_messages_type_enum" AS ENUM('button', 'text', 'other')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_inbound_messages',
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
            isNullable: true,
          },
          {
            name: 'from_phone_number',
            type: 'varchar',
          },
          {
            name: 'type',
            type: 'whatsapp_inbound_messages_type_enum',
          },
          {
            name: 'button_payload',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'body_text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'raw_payload',
            type: 'jsonb',
          },
          {
            name: 'received_at',
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

    await queryRunner.createForeignKey(
      'whatsapp_inbound_messages',
      new TableForeignKey({
        columnNames: ['client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'whatsapp_inbound_messages',
      new TableIndex({
        name: 'IDX_whatsapp_inbound_messages_client_id',
        columnNames: ['client_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('whatsapp_inbound_messages');
    await queryRunner.query(`DROP TYPE "whatsapp_inbound_messages_type_enum"`);
  }
}
