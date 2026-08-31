import {
  MigrationInterface,
  QueryRunner,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Phase 26 — replaces the flat co_debtor_* columns (Phase 21,
// 1785200000002-AddCoDebtorFieldsToLoans) with a real relationship to an
// existing Client: a co-debtor is, functionally, another client of the
// business, and should be searchable/reusable as one instead of re-typed
// by hand on every loan. Confirmed directly with the human (2026-08-30):
// the app hasn't shipped yet, so no loan anywhere has real co-debtor data
// under the old model — this drops the old columns outright rather than
// running a backfill migration that would risk creating duplicate/junk
// Client records from data that was never real to begin with.
//
// co_debtor_relationship is the one old field kept, but moved to its own
// standalone column here rather than folded into the Client relation — it
// describes this specific loan's relationship to the debtor (e.g.
// "Hermano del deudor"), not a property of the co-debtor client
// themselves, so it has no natural home on `clients`.
export class ReplaceCoDebtorFieldsWithClientLink1785700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "co_debtor_client_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN "co_debtor_relationship" varchar`,
    );

    await queryRunner.createIndex(
      'loans',
      new TableIndex({
        name: 'IDX_loans_co_debtor_client_id',
        columnNames: ['co_debtor_client_id'],
      }),
    );

    // RESTRICT, matching FK_loans_client_id — clients are only ever
    // soft-deleted in this app (see docs/DATABASE.md), so this never
    // blocks the normal "deactivate a client" flow; it only guards against
    // an actual hard delete leaving a loan's co-debtor reference dangling.
    await queryRunner.createForeignKey(
      'loans',
      new TableForeignKey({
        name: 'FK_loans_co_debtor_client_id',
        columnNames: ['co_debtor_client_id'],
        referencedTableName: 'clients',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('loans', 'FK_loans_co_debtor_client_id');
    await queryRunner.dropIndex('loans', 'IDX_loans_co_debtor_client_id');

    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "co_debtor_relationship"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "co_debtor_client_id"`,
    );

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
}
