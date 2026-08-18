import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 21 (KYC) — every column here is nullable except
// data_processing_consent, which defaults to false so it never blocks this
// migration on existing rows. Whether it's *required* going forward is
// enforced in ClientsService.create(), not at the database level — see
// docs/phases/PHASE_21_CLIENT_PROFILE.md decision 6 for why (Excel-imported
// clients are deliberately exempt).
export class AddExtendedProfileFieldsToClients1785200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "clients_document_type_enum" AS ENUM('cedula_ciudadania', 'cedula_extranjeria', 'pasaporte')`,
    );

    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "document_type" "clients_document_type_enum",
        ADD COLUMN "date_of_birth" date,
        ADD COLUMN "document_issue_place" varchar,
        ADD COLUMN "email" varchar,
        ADD COLUMN "alternate_phone_number" varchar,
        ADD COLUMN "home_address" text,
        ADD COLUMN "work_address" text,
        ADD COLUMN "neighborhood" varchar,
        ADD COLUMN "city" varchar,
        ADD COLUMN "occupation" varchar,
        ADD COLUMN "employer_name" varchar,
        ADD COLUMN "monthly_income" decimal(12,2),
        ADD COLUMN "id_document_front_url" varchar,
        ADD COLUMN "id_document_back_url" varchar,
        ADD COLUMN "selfie_image_url" varchar,
        ADD COLUMN "data_processing_consent" boolean NOT NULL DEFAULT false,
        ADD COLUMN "consent_given_at" timestamptz,
        ADD COLUMN "consent_document_url" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN "consent_document_url",
        DROP COLUMN "consent_given_at",
        DROP COLUMN "data_processing_consent",
        DROP COLUMN "selfie_image_url",
        DROP COLUMN "id_document_back_url",
        DROP COLUMN "id_document_front_url",
        DROP COLUMN "monthly_income",
        DROP COLUMN "employer_name",
        DROP COLUMN "occupation",
        DROP COLUMN "city",
        DROP COLUMN "neighborhood",
        DROP COLUMN "work_address",
        DROP COLUMN "home_address",
        DROP COLUMN "alternate_phone_number",
        DROP COLUMN "email",
        DROP COLUMN "document_issue_place",
        DROP COLUMN "date_of_birth",
        DROP COLUMN "document_type"
    `);
    await queryRunner.query(`DROP TYPE "clients_document_type_enum"`);
  }
}
