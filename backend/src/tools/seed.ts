// backend/src/tools/seed.ts
import { DataSource } from 'typeorm';

type Row = Record<string, any>;

export async function runSeed(ds: DataSource) {
  // 1) system_settings mínimos
  const settingsToEnsure: Array<{ key: string; value: string; description?: string }> = [
    {
      key: 'queue.alternate_priority_every',
      value: '3',
      description:
      'Cantidad de atenciones consecutivas antes de priorizar al ticket más urgente (1-6).',
    },
    { key: 'displayTitle', value: 'DrizaTx', description: 'Título por defecto de pantallas públicas' },
  ];

  for (const s of settingsToEnsure) {
    const already = (await ds.query('SELECT `key` FROM system_settings WHERE `key` = ?', [s.key])) as Row[];
    if (already.length === 0) {
      await ds.query(
        'INSERT INTO system_settings (`key`, `value`, `description`, `created_at`, `updated_at`) VALUES (?,?,?,NOW(),NOW())',
        [s.key, s.value, s.description ?? null],
      );
      console.log(`[seed] system_settings agregado: ${s.key}=${s.value}`);
    } else {
      console.log(`[seed] system_settings ya existe: ${s.key}`);
    }
  }

  // 2) Servicio “Atención prioritaria”
  const name = 'Atención prioritaria';
  const service = (await ds.query('SELECT id FROM services WHERE name = ?', [name])) as Array<{ id: number }>;

  if (service.length === 0) {
    await ds.query(
      `INSERT INTO services (name, prefix, active, priority_level, estimated_time, next_ticket_number, system_locked, created_at, updated_at)
       VALUES (?, ?, 1, 6, 10, 1, 1, NOW(), NOW())`,
      [name, 'AP6'],
    );
    console.log('[seed] Servicio “Atención prioritaria” creado');

    const [{ id }] = (await ds.query('SELECT id FROM services WHERE name = ?', [name])) as Array<{ id: number }>;
    await ds.query(
      `INSERT INTO service_counters (service_id, counter_date, last_seq)
       VALUES (?, CURRENT_DATE(), 0)
       ON DUPLICATE KEY UPDATE last_seq = last_seq`,
      [id],
    );
  } else {
    await ds.query('UPDATE services SET system_locked = 1, priority_level = 6 WHERE name = ?', [name]);
    console.log('[seed] Servicio “Atención prioritaria” ya existía → actualizado (system_locked=1, priority_level=6)');
  }

  console.log('[seed] OK');
}
