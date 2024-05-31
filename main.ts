import { Hono } from '@hono/hono';
import { serveStatic } from '@hono/hono/deno';
import { loadSync } from '@std/dotenv';
import { join, resolve } from '@std/path';
import { existsSync } from '@std/fs';
import { DATA_PATH, MIMES, MONOLITH_OPTIONS } from './constants.ts';
import { fetchDocumentTitle, createFilename, parseDirectory, getSize } from './util.ts';
import * as database from './db.ts';
import { Home } from './templates.ts';
import { Add } from './templates.ts';
import type { Page } from './types.ts';

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
  const info = await Deno.stat(ARCHIVE_PATH);
  const date = info.mtime ?? new Date();
  const modifiedTime = date.toISOString();
  // const { data: hasChanged } = database.checkModified(modifiedTime);

  let pages: Page[] = [];

  // if (hasChanged) {
  //   const directory = await parseDirectory(ARCHIVE_PATH);
  //   const { data: pagesData } = database.getPagesData(directory.files);
  //   const size = directory.size;
  // } else {

  // }

  const directory = await parseDirectory(ARCHIVE_PATH);
  database.getPagesData(directory.files);

  for (const file of directory.files) {
    pages.push({
      title: file.name,
      url: '',
      filename: file.name,
      size: file.size
    });
  }

  const html = Home({
    size: 0,
    pages,
    count: pages.length
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
    args: [`--output=${path}`, ...monolithOpts, url]
  });

  const output = await cmd.output();

  if (!output.success) {
    const html = Add({
      error: 'Unable to save page. Please try again or check the URL.'
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

    c.header('location', '/');
    c.status(302);
    return c.text('302');
  } catch (e) {
    const html = Add({
      error: 'Unable to save page. Please try again or check the URL.'
    });

    console.error(e);
    c.status(500);
    return c.html(html);
  }
});

// app.get('/delete/:filename', async (c) => {
//   const filename = c.req.param('filename');
  
//   return c.html('delete time');
// });

Deno.serve({ port: SERVER_PORT }, app.fetch);