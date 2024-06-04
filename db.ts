import { Database } from '@db/sqlite';
import { join } from '@std/path';
import { DATA_PATH, ZERO_BYTES } from './constants.ts';
import type { Page, PageCache } from './types.ts';

const DB_FILENAME = 'arkive.db';

export const db = new Database(join(DATA_PATH, DB_FILENAME));

// use WAL mode
db.exec('pragma journal_mode = WAL');

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
    changed = row?.modified_time !== isoTimestamp;

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
    error = e;
    console.error(e);
  }

  return { error };
}

export function getPage(filename: string) {
  let page: Page | undefined = undefined;
  let error = undefined;

  try {
    const select = db.prepare(`
      select *
      from page
      where filename = :filename
    `);

    page = select.get<Page>({ filename });
  } catch (e) {
    error = e;
  }

  return { data: page, error };
}

export function addPage(page: Page) {
  let ok = true;
  let error = undefined;

  try {
    const insert = db.prepare(`
      insert into page (title, url, filename, size)
      values (:title, :url, :filename, :size)
    `);

    const changes = insert.run({ ...page });
    if (changes !== 1) throw Error('Unable to add page');
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function deletePage(filename: string) {
  let ok = true;
  let error = undefined;

  try {
    const deletion = db.prepare(`
      delete from page
      where filename = :filename
    `);

    const res = deletion.run({ filename });
    console.log({ res });
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function getPagesData(files: Array<{ name: string; size: number }>) {
  const data: { [filename: string]: Page } = {};
  let error = undefined;

  try {
    const filenames = files.map((file) => file.name);
    const paramStr = Array(filenames.length).fill('?').join(',');
    const select = db.prepare(`
      select *
      from page
      where filename in (${paramStr})
    `);

    const rows = select.all<Page>(...filenames);
    for (const row of rows) data[row.filename] = row;
  } catch (e) {
    error = e;
    console.error(e);
  }

  return { data, error };
}
