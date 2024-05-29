import { Hono } from '@hono/hono';
import { serveStatic } from '@hono/hono/deno';
import { loadSync } from '@std/dotenv';
import { join, resolve } from '@std/path';
import { existsSync } from '@std/fs';
import { DATA_PATH, MIMES } from './constants.ts';
import { parseDirectory } from './util.ts';
import * as database from './db.ts';
import { Home } from './templates.ts';
import { Add } from './templates.ts';

// load .env file
loadSync({ export: true });

const SERVER_PORT = Number(Deno.env.get('SERVER_PORT')) ?? 8080;
const ARCHIVE_PATH = join(DATA_PATH, './archive');

// create directories
[DATA_PATH, ARCHIVE_PATH].forEach((path) => {
  if (!existsSync(path)) Deno.mkdirSync(path);
});

const app = new Hono();

app.use('/static/*', serveStatic({ root: './', mimes: MIMES }));

app.get('/archive/*.html', async (c) => {
  const url = new URL(c.req.url);
  const fileName = url.pathname.replace(/^\/archive\//, '');
  const filePath = join(ARCHIVE_PATH, fileName);

  try {
    if (!existsSync(filePath, { isFile: true, isReadable: true })) {
      throw Error('File does not exist: ' + filePath);
    }

    const file = await Deno.open(filePath, { read: true });
    const stream = file.readable;

    c.header('content-type', 'text/html');
    return c.body(stream);
  } catch (_e) {
    c.status(404);
    return c.text('404: File does not exist or is unreadable');
  }
});

app.get('/', async (c) => {
  // const info = await Deno.stat(ARCHIVE_PATH);
  // const date = info.mtime ?? new Date();
  // const modifiedTime = date.toISOString();

  // const { data: hasChanged } = database.checkModified(modifiedTime);

  const pages = [];
  const directory = await parseDirectory(ARCHIVE_PATH);
  const size = directory.size;

  for (const file of directory.files) {
    pages.push({
      title: file.name,
      url: '',
      filename: file.name,
      size: file.size
    });
  }

  const html = Home({
    size,
    pages,
    count: pages.length
  });

  return c.html(html);
});

app.get('/add', (c) => {
  const html = Add();
  return c.html(html);
});

app.get('/delete/:filename', async (c) => {
  const filename = c.req.param('filename');
  
  return c.html('delete time');
});

Deno.serve({ port: SERVER_PORT }, app.fetch);