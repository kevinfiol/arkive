import { Database } from '@db/sqlite';
import { join } from '@std/path';
import { DATA_PATH, ZERO_BYTES } from './constants.ts';
import type { PageCache } from './types.ts';

const DB_FILENAME = 'arkive.db';

export const db = new Database(join(DATA_PATH, DB_FILENAME));

// use WAL mode
db.exec("pragma journal_mode = WAL");

export function checkModified(isoTimestamp: string) {
  let changed = true;
  let error = undefined;

  try {
    const select = db.prepare(`
      select modified_time
      from metadata
      where rowid = 1;
    `);

    const row = select.get<{ modified_time: string }>();
    changed = row.modified_time !== isoTimestamp;

    if (changed) {
      const update = db.prepare(`
        update metadata
        set modified_time = :modifiedTime
        where rowid = 1;
      `);

      update.run({ modifiedTime: isoTimestamp });
    }
  } catch (e) {
    error = e;
  }

  return { data: changed, error };
}

export function getCache() {
  let data: PageCache = { pages: [], size: ZERO_BYTES };
  let error = undefined;

  try {
    const select = db.prepare(`
      select page_cache
      from metadata
      where rowid = 1;
    `);

    const row = select.get<{ page_cache?: string }>();

    if (row && row.page_cache) {
      data = JSON.parse(row.page_cache) as PageCache;
    }
  } catch (e) {
    error = e;
  }

  return { data, error };
}

export function setCache({ pages, size }: PageCache) {
  let error = undefined;

  try {
    const update = db.prepare(`
      update metadata
      set page_cache = :pageCache
      where rowid = 1;
    `);

    const json = JSON.stringify({ pages, size });
    update.run({ pageCache: json });
  } catch (e) {
    console.error(e);
  }

  return { error };
}