/// <reference lib="deno.unstable" />
import { load } from 'std/dotenv/mod.ts';
import { existsSync } from 'std/fs/mod.ts';
import { join, resolve } from 'std/path/mod.ts';
import { Router } from './router.ts';
import { Add, Delete, Home } from './templates.ts';
import { createSlug, fetchDocumentTitle, getDirectorySize } from './util.ts';
import { serveStatic } from './middleware/serveStatic.ts';

export type FileTuple = [string, string];

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
const STATIC_ROOT = './static';
const ARCHIVE_PATH = resolve('./_archive');
const DB_PATH = resolve('./db');

// create KV db folder if it doesn't exist
if (!existsSync(DB_PATH)) {
  Deno.mkdirSync(DB_PATH);
}

const KV = await Deno.openKv(join(DB_PATH, 'store'));
const app = new Router();

app.get('*', serveStatic(STATIC_ROOT));

app.get('/archive/*.html', async (req) => {
  let contents: ReadableStream | string = '';
  let status = 200;
  const headers = new Headers();

  const url = new URL(req.url);
  const filename = url.pathname.replace(/^\/archive\//, '');
  const filepath = resolve(`./_archive/${filename}`);

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
  const size = await getDirectorySize(ARCHIVE_PATH);
  const files: FileTuple[] = [];
  const entries = KV.list<string>({ prefix: ['articles'] });

  for await (const entry of entries) {
    files.push([entry.key[1] as string, entry.value]);
  }

  const html = Home({ files, size });

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

app.get('/delete/:filename', async (_req, params) => {
  const filename = params.filename as string ?? '';
  const entry = await KV.get<string>(['articles', filename]);
  const title = entry.value as string;

  const html = Delete({ title, filename });
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
});

app.post('/delete/:filename', async (_req, params) => {
  let contents = '302';
  let status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
  });

  const filename = params.filename as string ?? '';

  try {
    await KV.delete(['articles', filename]);
    await Deno.remove(resolve(`./_archive/${filename}`));
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
  const contents = '302';
  const status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
    'location': '/',
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

  if (!existsSync(ARCHIVE_PATH)) {
    Deno.mkdirSync(ARCHIVE_PATH);
  }

  const filename = createSlug(title) + '-' + (Date.now().toString()) + '.html';
  const path = join(ARCHIVE_PATH, filename);

  const cmd = new Deno.Command('monolith', {
    args: [`--output=${path}`, ...monolithOpts, url],
    stdout: 'piped',
  });

  await cmd.output();

  // https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
  // const child = cmd.spawn();
  // const stream = new WritableStream();
  // stream.
  // child.stdout.pipeTo(stream);

  // save to db
  await KV.set(['articles', filename], title);

  return new Response(contents, {
    status,
    headers,
  });
});

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));
