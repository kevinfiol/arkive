/// <reference lib="deno.unstable" />
import { load } from 'std/dotenv/mod.ts';
import { existsSync } from 'std/fs/mod.ts';
import { resolve, join } from 'std/path/mod.ts';
import { Router } from './router.ts';
import { Home, Add, Delete } from './templates.ts';
import { createSlug, fetchDocumentTitle } from './util.ts';
import { serveStatic } from './middleware/serveStatic.ts';

export type FileTuple = [string, string];

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

// let lastModified: Date | undefined = undefined;

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
    headers
  });
});

app.get('/', async () => {
  // const info = await Deno.stat(ARCHIVE_PATH);
  // const modifiedTime = info.mtime ?? (new Date());

  // if (lastModified === undefined || lastModified < modifiedTime) {
  //   lastModified = modifiedTime;
  // }

  const files: FileTuple[] = [];
  const entries = KV.list<string>({ prefix: ['articles'] });
  for await (const entry of entries) {
    files.push([entry.key[1] as string, entry.value]);
  }

  const html = Home({ files });

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' }
  });
});

app.get('/add', () => {
  const html = Add();

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' }
  });
});

app.get('/delete/:filename', async (_req, params) => {
  const filename = params.filename as string ?? '';
  const entry = await KV.get<string>(['articles', filename]);
  const title = entry.value as string;

  const html = Delete({ title, filename });
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' }
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
    headers
  });
});

app.post('/add', async (req) => {
  const contents = '302';
  const status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
    'location': '/'
  });

  const form = await req.formData();
  const url = form.get('url') as string;
  let title = form.get('title') as string;

  if (title.trim() === '') {
    const docTitle = await fetchDocumentTitle(url);
    // if (docTitle.error)  // TODO: handle error
    title = docTitle.data;
  }

  if (!existsSync(ARCHIVE_PATH)) {
    Deno.mkdirSync(ARCHIVE_PATH)
  }

  const filename = createSlug(title) + '-' + (Date.now().toString()) + '.html';
  const path = join(ARCHIVE_PATH, filename);

  const cmd = new Deno.Command('monolith', { args: [`--output=${path}`, url] });
  await cmd.output();

  // save to db
  await KV.set(['articles', filename], title);

  return new Response(contents, {
    status,
    headers
  });
});

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));