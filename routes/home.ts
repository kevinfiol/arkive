import { Hono } from '@hono/hono';
import { Home } from '../templates/index.ts';
import { ARCHIVE_PATH, ZERO_BYTES } from '../constants.ts';
import { parseDirectory, createEmptyPage } from '../util.ts';
import * as database from '../db.ts';
import type { Page } from '../types.ts';
import type { SecureHeadersVariables } from '@hono/hono/secure-headers';

const app = new Hono<{ Variables: SecureHeadersVariables }>();

app.get('/', async (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const info = await Deno.stat(ARCHIVE_PATH);
  const date = info.mtime ?? new Date();
  const modifiedTime = date.toISOString();
  const { data: hasChanged } = database.checkModified(modifiedTime);

  let pages: Page[] = [];
  let size = ZERO_BYTES;

  if (hasChanged) {
    const directory = await parseDirectory(ARCHIVE_PATH);
    const filenames = directory.files.map((file) => file.name);
    const { data: pagesData } = database.getPagesData(filenames);

    for (const file of directory.files) {
      let page;

      if (file.name in pagesData) {
        page = pagesData[file.name];
      } else {
        page = createEmptyPage(file.name, file.size);
        const { error } = database.addPage(page);
        if (error) console.error(error);
      }

      pages.push(page);
    }

    // remove files from db that no longer exist
    const { ok } = database.deleteRemovedPages(filenames);
    if (!ok) {
      console.error('Warning: Failed to delete removed pages from database');
    }

    size = directory.size;
    database.setCache({ pages, size });
  } else {
    const { data: cache } = database.getCache();
    pages = cache.pages;
    size = cache.size;
  }

  const html = Home({
    size,
    pages,
    count: pages.length,
    nonce,
  });

  return c.html(html);
});

// app.get('/archive/*.html', async (c) => {
//   const url = new URL(c.req.url);
//   const fileName = url.pathname.replace(/^\/archive\//, '');
//   const filePath = join(ARCHIVE_PATH, decodeURIComponent(fileName));

//   try {
//     if (!existsSync(filePath, { isFile: true, isReadable: true })) {
//       throw Error('File does not exist: ' + filePath);
//     }

//     const file = await Deno.open(filePath, { read: true });
//     const stream = file.readable;

//     c.header('content-type', 'text/html');
//     return c.body(stream);
//   } catch (e) {
//     console.error(e);
//     c.status(404);
//     return c.text('404: File does not exist or is unreadable');
//   }
// });

export { app as home };