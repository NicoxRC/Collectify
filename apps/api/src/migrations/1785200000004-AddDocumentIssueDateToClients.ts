import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 21 follow-up — client feedback after reviewing the built form:
// documentIssuePlace ("Lugar de expedición") already existed, but the
// issue *date* didn't. Nullable, same as every other Phase 21 KYC field —
// see 1785200000000-AddExtendedProfileFieldsToClients for the original
// batch this belongs with.
export class AddDocumentIssueDateToClients1785200000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "document_issue_date" date
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN "document_issue_date"
    `);
  }
}
