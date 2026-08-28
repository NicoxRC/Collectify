import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Phase 28 — lets a payment carry more than one receipt photo. Backfills
// every existing payments.image_url into its own payment_images row so no
// historical photo is lost; payments.image_url itself is kept (deprecated,
// not dropped — see Payment entity's own comment) rather than removed in
// this same migration, per this project's convention of not dropping a
// column with real data in the same phase that supersedes it.
export class CreatePaymentImagesTable1785600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_images',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'payment_id',
            type: 'uuid',
          },
          {
            name: 'image_url',
            type: 'varchar',
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
      'payment_images',
      new TableForeignKey({
        columnNames: ['payment_id'],
        referencedTableName: 'payments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_payment_images_payment_id" ON "payment_images" ("payment_id")`,
    );

    // Backfill — one payment_images row per existing non-null
    // payments.image_url, using the payment's own created_at so the
    // backfilled row's timestamp reflects when the photo actually arrived,
    // not when this migration ran.
    await queryRunner.query(`
      INSERT INTO "payment_images" ("id", "payment_id", "image_url", "created_at")
      SELECT gen_random_uuid(), "id", "image_url", "created_at"
      FROM "payments"
      WHERE "image_url" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_images');
  }
}
