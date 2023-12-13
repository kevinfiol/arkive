import { load } from 'std/dotenv/mod.ts';
import { existsSync } from 'std/fs/mod.ts';
import { join, resolve } from 'std/path/mod.ts';
import { Router } from './router.ts';
import { Add, Delete, Home } from './templates.ts';
import { createSlug, fetchDocumentTitle, getSize } from './util.ts';
import { serveStatic } from './middleware/serveStatic.ts';
import { Database } from './db.ts';

export const MONOLITH_OPTIONS = {
  'no-audio': { flag: '-a', label: 'No Audio' },
  'no-css': { flag: '-c', label: 'No CSS' },
  'no-frames': { flag: '-f', label: 'No Frames/iframes' },
  'no-custom-fonts': { flag: '-F', label: 'No Custom Fonts' },
  'no-images': { flag: '-i', label: 'No Images' },
  'isolate': { flag: '-I', label: 'Isolate Page' },
  'no-javascript': { flag: '-j', label: 'No JavaScript' },
  'no-metadata': { flag: '-M', label: 'No Metadata' },
  'unwrap-noscript': { flag: '-n', label: 'Unwrap noscript tags' },
  'no-video': { flag: '-v', label: 'No Video' },
};

// load .env file
await load({ export: true });

const SERVER_PORT = Deno.env.get('SERVER_PORT') ?? 8000;
const DATA_PATH = resolve('./data');
const STATIC_ROOT = resolve('./static');
const ARCHIVE_PATH = join(DATA_PATH, './archive');
const DB_PATH = join(DATA_PATH, './db');

// create directories
[DATA_PATH, ARCHIVE_PATH, DB_PATH].forEach((path) => {
  if (!existsSync(path)) Deno.mkdirSync(path);
});

const DB = await Database(DB_PATH);
const app = new Router();

app.get('*', serveStatic(STATIC_ROOT));

app.get('/archive/*.html', async (req) => {
  let contents: ReadableStream | string = '';
  let status = 200;
  const headers = new Headers();

  const url = new URL(req.url);
  const filename = url.pathname.replace(/^\/archive\//, '');
  const filepath = join(ARCHIVE_PATH, filename);

  if (existsSync(filepath, { isFile: true, isReadable: true })) {
    const file = await Deno.open(filepath, { read: true });
    contents = file.readable;
    headers.set('content-type', 'text/html');
  } else {
    contents = '404: File does not exist or is not readable.';
    status = 404;
  }

  return new Response(contents, {
    status,
    headers,
  });
});

app.get('/', async () => {
  const size = await getSize(ARCHIVE_PATH);
  const pages = await DB.getPages();
  const count = await DB.getCount();

  const html = Home({
    size,
    pages: pages.data,
    count: count.data,
  });

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
});

app.get('/add', () => {
  const html = Add();

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
});

app.get('/delete/:id', async (_req, params) => {
  let contents;
  let status;
  const id = params.id as string ?? '';
  const page = await DB.getPage(id);

  if (page.data === undefined) {
    contents = '404';
    status = 404;
  } else {
    const { title } = page.data;
    contents = Delete({ id, title });
    status = 200;
  }

  return new Response(contents, {
    status: status,
    headers: { 'content-type': 'text/html' },
  });
});

app.post('/delete/:id', async (_req, params) => {
  let contents = '302';
  let status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
  });

  const id = params.id as string ?? '';

  try {
    const page = await DB.getPage(id);

    if (page.data === undefined) {
      throw Error('Page with that ID does not exist.');
    }

    const { filename } = page.data;
    const result = await DB.deletePage(id);

    if (!result.ok) {
      throw result.error;
    }

    await Deno.remove(join(ARCHIVE_PATH, filename));
    headers.set('location', '/');
  } catch (e) {
    contents = '500';
    status = 500;
    console.error(e);
  }

  return new Response(contents, {
    status,
    headers,
  });
});

app.post('/add', async (req) => {
  let contents = '302';
  let status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
  });

  const monolithOpts = [];
  const form = await req.formData();
  const url = form.get('url') as string;
  let title = form.get('title') as string;

  for (const entry of form.entries()) {
    // collect opt flags
    const key = entry[0] as keyof typeof MONOLITH_OPTIONS;

    if (key in MONOLITH_OPTIONS && entry[1] === 'on') {
      const flag = MONOLITH_OPTIONS[key].flag;
      monolithOpts.push(flag);
    }
  }

  if (title.trim() === '') {
    const docTitle = await fetchDocumentTitle(url);
    title = docTitle.data;
  }

  const timestamp = Date.now();
  const filename = createSlug(title) + '-' + (timestamp.toString()) + '.html';
  const path = join(ARCHIVE_PATH, filename);

  const cmd = new Deno.Command('monolith', {
    args: [`--output=${path}`, ...monolithOpts, url],
  });

  const output = await cmd.output();

  if (!output.success) {
    console.error(output);
    contents = Add({
      error: 'Unable to save page. Please try again or check the URL.',
    });
    status = 500;
  } else {
    const size = await getSize(path);
    const id = crypto.randomUUID();
    const page = { id, filename, title, url, size };

    try {
      const result = await DB.addPage(page);

      if (!result.ok) {
        throw result.error;
      }

      headers.set('location', '/');
    } catch (e) {
      console.error(e);
      contents = Add({
        error: 'Unable to save page. Please try again or check the URL.',
      });
      status = 500;
    }
  }

  return new Response(contents, {
    status,
    headers,
  });
});

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));
