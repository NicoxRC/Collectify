import { MigrationInterface, QueryRunner } from 'typeorm';

// Message templates are no longer admin-editable: WhatsApp only allows
// business-initiated messages via Meta-approved templates outside the 24h
// window, so exposing free-form editing here was misleading — see
// docs/DATABASE.md "Changed after Phase 9". From now on, updating a
// template's content is a migration, like this one, which is also how the
// canonical copy for each of the 4 types is (re)seeded below.
export class MakeMessageTemplatesStatic1784300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep exactly one row per type before the unique constraint is added —
    // prefer the currently active one, then the most recently created.
    await queryRunner.query(`
      DELETE FROM "message_templates"
      WHERE "id" NOT IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (
            PARTITION BY "type"
            ORDER BY "is_active" DESC, "created_at" DESC, "id" DESC
          ) AS rn
          FROM "message_templates"
        ) ranked
        WHERE rn = 1
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "message_templates" DROP COLUMN "is_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" ADD CONSTRAINT "UQ_message_templates_type" UNIQUE ("type")`,
    );

    // Seed (or refresh) the canonical content per type — placeholders match
    // whatsapp/messageRenderer.ts exactly.
    const templates: Array<{ type: string; name: string; content: string }> = [
      {
        type: 'overdue',
        name: 'Recordatorio de cuotas vencidas',
        content:
          'Hola {{clientFullName}}, tienes cuotas vencidas:\n{{installmentsList}}\nEl valor a pagar hoy es {{grandTotal}}',
      },
      {
        type: 'new_loan',
        name: 'Confirmación de nuevo pagaré',
        content:
          'Hola {{clientFullName}}, tu pagaré #{{promissoryNoteNumber}} por concepto de {{loanDescription}} fue registrado el {{disbursedAt}}. Son {{totalInstallments}} cuotas, {{installmentsSummary}}.',
      },
      {
        type: 'upcoming_due',
        name: 'Aviso de cuotas próximas a vencer',
        content:
          'Hola {{clientFullName}}, recuerda que tienes cuotas próximas a vencer:\n{{installmentsList}}',
      },
      {
        type: 'account_summary',
        name: 'Estado de cuenta',
        content:
          'Hola {{clientFullName}}, este es tu estado de cuenta:\n{{installmentsList}}\nTotal pendiente: {{grandTotal}}',
      },
    ];

    for (const template of templates) {
      await queryRunner.query(
        `INSERT INTO "message_templates" ("name", "type", "content")
         VALUES ($1, $2, $3)
         ON CONFLICT ("type")
         DO UPDATE SET "name" = EXCLUDED."name", "content" = EXCLUDED."content", "updated_at" = now()`,
        [template.name, template.type, template.content],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_templates" DROP CONSTRAINT "UQ_message_templates_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_templates" ADD COLUMN "is_active" boolean NOT NULL DEFAULT false`,
    );
  }
}
