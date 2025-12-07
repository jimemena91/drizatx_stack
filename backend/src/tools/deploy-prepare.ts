// backend/src/tools/deploy-prepare.ts
import 'reflect-metadata';
import dataSource from '../data-source';

async function main() {
  console.log('[predeploy] Iniciando…');
  console.log('[predeploy] DATABASE_URL:', process.env.DATABASE_URL ? '(definida)' : '(no definida)');
  console.log('[predeploy] DB host:', process.env.DATABASE_HOST || '(con DATABASE_URL)');

  console.log('[predeploy] Conectando a la base de datos…');
  await dataSource.initialize();
  console.log('[predeploy] Conexión OK');

  console.log('[predeploy] Aplicando migraciones…');
  const migrations = await dataSource.runMigrations();
  console.log(`[predeploy] Migraciones aplicadas: ${migrations.length}`);

  console.log('[predeploy] Ejecutando seed inicial…');
  const { runSeed } = await import('./seed');
  await runSeed(dataSource);

  console.log('[predeploy] Finalizado OK');
  await dataSource.destroy();
}

main().catch(async (err) => {
  console.error('[predeploy] ERROR:', err);
  try {
    await dataSource.destroy();
  } catch {}
  process.exit(1);
});
