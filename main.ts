import { Hono } from '@hono/hono';
import { serveStatic } from '@hono/hono/deno';
import { secureHeaders } from '@hono/hono/secure-headers';
import { lru } from 'tiny-lru';
import { loadSync } from '@std/dotenv';
import { join } from '@std/path';
import { existsSync } from '@std/fs';
import { Add, Delete, Home, Initialize, Login } from './templates/index.ts';
import { DATA_PATH, MIMES, MONOLITH_OPTIONS, ZERO_BYTES, ACCESS_TOKEN_NAME, SESSION_MAX_AGE } from './constants.ts';
import * as database from './db.ts';
import {
  createEmptyPage,
  createFilename,
  fetchDocumentTitle,
  getSize,
  parseDirectory,
} from './util.ts';

import type { Page } from './types.ts';

// load .env file
loadSync({ export: true });

const SERVER_PORT = Number(Deno.env.get('SERVER_PORT')) ?? 8080;
const ARCHIVE_PATH = join(DATA_PATH, './archive');

// create directories
[DATA_PATH, ARCHIVE_PATH].forEach((path) => {
  if (!existsSync(path)) Deno.mkdirSync(path);
});

const session = lru(100, SESSION_MAX_AGE)
const app = new Hono();

app.use(secureHeaders());

app.use('/static/*', serveStatic({ root: './', mimes: MIMES }));

app.on(['GET', 'POST'], ['/', '/add', '/delete/*'], async (c, next) => {
  const token = c.req.header(ACCESS_TOKEN_NAME);
  const isAuth = session.get(token);
  if (isAuth) return next();
  await Promise.resolve();

  if (c.req.method === 'GET') {
    const html = Initialize();
    return c.html(html);
  }

  c.status(401);
  return c.text('Unauthorized');
});

app.get('/archive/*.html', async (c) => {
  const url = new URL(c.req.url);
  const fileName = url.pathname.replace(/^\/archive\//, '');
  const filePath = join(ARCHIVE_PATH, decodeURIComponent(fileName));

  try {
    if (!existsSync(filePath, { isFile: true, isReadable: true })) {
      throw Error('File does not exist: ' + filePath);
    }

    const file = await Deno.open(filePath, { read: true });
    const stream = file.readable;

    c.header('content-type', 'text/html');
    return c.body(stream);
  } catch (e) {
    console.error(e);
    c.status(404);
    return c.text('404: File does not exist or is unreadable');
  }
});

app.get('/', async (c) => {
  const info = await Deno.stat(ARCHIVE_PATH);
  const date = info.mtime ?? new Date();
  const modifiedTime = date.toISOString();
  const { data: hasChanged } = database.checkModified(modifiedTime);

  let pages: Page[] = [];
  let size = ZERO_BYTES;

  if (hasChanged) {
    const directory = await parseDirectory(ARCHIVE_PATH);
    const { data: pagesData } = database.getPagesData(directory.files);

    for (const file of directory.files) {
      let page;

      if (file.name in pagesData) {
        page = pagesData[file.name];
      } else {
        page = createEmptyPage(file.name, file.size);
        database.addPage(page);
      }

      pages.push(page);
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
  });

  return c.html(html);
});

app.get('/add', (c) => {
  const html = Add();
  return c.html(html);
});

app.post('/add', async (c) => {
  const monolithOpts = [];
  const form = await c.req.formData();

  const url = form.get('url') as string;
  let title = form.get('title') as string;

  for (const entry of form.entries()) {
    // collect monolith opt flags
    const key = entry[0] as keyof typeof MONOLITH_OPTIONS;
    if (key in MONOLITH_OPTIONS && entry[1] === 'on') {
      // if valid option and item is checked
      const flag = MONOLITH_OPTIONS[key].flag;
      monolithOpts.push(flag);
    }
  }

  if (title.trim() === '') {
    // if user did not set title, fetch from document url
    const docTitle = await fetchDocumentTitle(url);
    title = docTitle.data;
  }

  const timestamp = Date.now();
  const filename = createFilename(timestamp, title);
  const path = join(ARCHIVE_PATH, filename);

  const cmd = new Deno.Command('monolith', {
    args: [`--output=${path}`, ...monolithOpts, url],
  });

  const output = await cmd.output();

  if (!output.success) {
    const html = Add({
      error: 'Unable to save page. Please try again or check the URL.',
    });

    console.error(output);
    c.status(500);
    return c.html(html);
  }

  const size = await getSize(path);
  const page: Page = { filename, title, url, size };

  try {
    const result = database.addPage(page);
    if (!result.ok) throw result.error;
    return c.redirect('/');
  } catch (e) {
    const html = Add({
      error: 'Unable to save page. Please try again or check the URL.',
    });

    console.error(e);
    c.status(500);
    return c.html(html);
  }
});

app.get('/delete/:filename', (c) => {
  const filename = c.req.param('filename');
  const { data: page, error } = database.getPage(filename);

  if (!page || error) {
    c.status(404);
    return c.text('404');
  } else {
    const { title } = page;
    const html = Delete({ filename, title });
    return c.html(html);
  }
});

app.post('/delete/:filename', async (c) => {
  const filename = c.req.param('filename');
  const page = database.getPage(filename);

  try {
    if (!page.data || page.error) {
      throw Error('Page with that ID does not exist');
    }

    const deletion = database.deletePage(page.data.filename);
    if (!deletion.ok) throw deletion.error;

    await Deno.remove(join(ARCHIVE_PATH, page.data.filename));
    return c.redirect('/');
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.text('500');
  }
});

app.post('/edit', async (c) => {
  const form = await c.req.formData();
  const url = form.get('url') as string;
  const title = form.get('title') as string;
  const filename = form.get('filename') as string;

  try {
    database.editPage(filename, title, url);
    c.status(200);
    return c.text('200');
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.text('500');
  }
});

Deno.serve({ port: SERVER_PORT }, app.fetch);
