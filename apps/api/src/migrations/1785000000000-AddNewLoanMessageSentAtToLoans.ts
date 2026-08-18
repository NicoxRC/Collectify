import { MigrationInterface, QueryRunner } from 'typeorm';

// Lets the Phase 18 new_loan retry cron find "loans still needing their
// message" directly, instead of string-matching message content. See
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
export class AddNewLoanMessageSentAtToLoans1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "new_loan_message_sent_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "new_loan_message_sent_at"`,
    );
  }
}
