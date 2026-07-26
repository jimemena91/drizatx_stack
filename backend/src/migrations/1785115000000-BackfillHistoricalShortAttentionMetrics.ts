import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillHistoricalShortAttentionMetrics1785115000000
  implements MigrationInterface
{
  name = 'BackfillHistoricalShortAttentionMetrics1785115000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tickets
      SET
        counts_for_metrics = 0,
        metrics_exclusion_reason = 'SHORT_ATTENTION'
      WHERE status = 'COMPLETED'
        AND started_at IS NOT NULL
        AND completed_at IS NOT NULL
        AND completed_at >= started_at
        AND TIMESTAMPDIFF(SECOND, started_at, completed_at)
            BETWEEN 0 AND 59
        AND counts_for_metrics = 1
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /*
     * Reparación de datos deliberadamente no reversible.
     *
     * No es seguro volver a incluir estas atenciones porque el rollback
     * no podría distinguir los registros históricos reparados de otras
     * clasificaciones válidas realizadas por la política de métricas.
     */
  }
}
