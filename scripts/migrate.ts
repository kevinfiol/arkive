import { walk } from '@std/fs';
import { join } from '@std/path';
import { db } from '../db.ts';

// match files that start with at least one number and underscore, e.g. 001_create, or 1_create are fine
const FILE_REGEX = /^[0-9]{1,}_/;

try {
  db.exec('select rowid from migrations');
} catch (_e) {
  db.exec(`
    create table migrations (
      id integer primary key,
      created_at timestamp default CURRENT_TIMESTAMP,
      name text
    );
  `);
}

let migrationsRun = 0;
const migrations = [];

for await (const file of walk('./migrations')) {
  if (!file.isFile || !file.name.match(FILE_REGEX)) continue;
  if (!file.name.endsWith('.ts') && !file.name.endsWith('.js')) continue;

  const [id, ...rest] = file.name.split('_');
  const name = rest.join('_').split('.')[0];

  migrations.push({
    id: Number(id),
    name,
    path: 'file://' + join(Deno.cwd(), file.path),
  });
}

const latest = migrations[migrations.length - 1];
if (latest.id !== migrations.length) {
  throw Error('Inconsistent migration numbering.');
}

const current = getCurrent();
const needed = migrations.slice(current ? current.id : 0);

for (const migration of needed) {
  const fn = await import(migration.path)
    .then((mod) => mod.default);

  const updateMigrations = db.prepare(`
    insert into migrations (id, name)
    values (:id, :name)
  `);

  const transaction = db.transaction(() => {
    fn(db);
    updateMigrations.run({ id: migration.id, name: migration.name });
  });

  transaction();
  migrationsRun += 1;
}

console.log(`Migrations run: ${migrationsRun}`);

function getCurrent() {
  const select = db.prepare(`
    select id
    from migrations
    order by id desc
    limit 1
  `);

  return select.get<{ id: number; name: string; created_at: string }>();
}
