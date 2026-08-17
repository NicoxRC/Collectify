import { MigrationInterface, QueryRunner } from 'typeorm';

// Nullable — a payment can be registered without a photo, same
// "absence means not provided" convention as `payments.observation`. The
// api only ever stores this URL; it never handles the upload itself. See
// docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md.
export class AddImageUrlToPayments1784700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "image_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "image_url"`);
  }
}
