import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 21 (KYC) — confirmed with the business that whether a loan has a
// co-debtor varies per loan, not per client, so these columns live on
// `loans`, not `clients`. At most one co-debtor per loan (confirmed) —
// plain nullable columns, no separate table needed. Reuses
// clients_document_type_enum (created in
// 1785200000000-AddExtendedProfileFieldsToClients, which must run first)
// rather than defining a second identical enum type, since a co-debtor is
// identified the same way a client is.
export class AddCoDebtorFieldsToLoans1785200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loans"
        ADD COLUMN "co_debtor_full_name" varchar,
        ADD COLUMN "co_debtor_document_type" "clients_document_type_enum",
        ADD COLUMN "co_debtor_document_number" varchar,
        ADD COLUMN "co_debtor_phone_number" varchar,
        ADD COLUMN "co_debtor_address" text,
        ADD COLUMN "co_debtor_relationship" varchar,
        ADD COLUMN "co_debtor_id_document_url" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loans"
        DROP COLUMN "co_debtor_id_document_url",
        DROP COLUMN "co_debtor_relationship",
        DROP COLUMN "co_debtor_address",
        DROP COLUMN "co_debtor_phone_number",
        DROP COLUMN "co_debtor_document_number",
        DROP COLUMN "co_debtor_document_type",
        DROP COLUMN "co_debtor_full_name"
    `);
  }
}
