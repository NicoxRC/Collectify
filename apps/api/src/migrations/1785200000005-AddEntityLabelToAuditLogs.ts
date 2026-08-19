import { MigrationInterface, QueryRunner } from 'typeorm';

// Client feedback on Auditoría: entityType + entityId ("Cliente ·
// 3f9a2b1c") told the admin WHICH MODULE an action happened in, but not
// which specific record — meaningless once there are hundreds of clients
// and the change happened a week ago. AuditLogInterceptor now resolves a
// human-readable label (client name + cédula, loan's pagaré number,
// payment amount + date, etc.) at write time and stores it here, rather
// than the frontend trying to re-derive it later — the record it refers
// to may have since changed (or been soft-deleted), so the label needs to
// reflect what it looked like at the moment the action happened.
export class AddEntityLabelToAuditLogs1785200000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN "entity_label" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN "entity_label"
    `);
  }
}
