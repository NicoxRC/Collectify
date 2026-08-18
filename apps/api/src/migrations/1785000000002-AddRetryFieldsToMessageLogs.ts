import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

// Manual retry tracking (Phase 18) — retried_at on the original (failed)
// row, retry_of_message_log_id on the new row created for the retry
// attempt. Both nullable: most rows are never retried. See
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
export class AddRetryFieldsToMessageLogs1785000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD COLUMN "retried_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" ADD COLUMN "retry_of_message_log_id" uuid`,
    );

    await queryRunner.createForeignKey(
      'message_logs',
      new TableForeignKey({
        name: 'FK_message_logs_retry_of_message_log_id',
        columnNames: ['retry_of_message_log_id'],
        referencedTableName: 'message_logs',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'message_logs',
      'FK_message_logs_retry_of_message_log_id',
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP COLUMN "retry_of_message_log_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_logs" DROP COLUMN "retried_at"`,
    );
  }
}
