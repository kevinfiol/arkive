import { Hono } from '@hono/hono';
import {
  deleteCookie,
  getSignedCookie,
  setSignedCookie,
} from '@hono/hono/cookie';
import { serveStatic } from '@hono/hono/deno';
import { secureHeaders } from '@hono/hono/secure-headers';
import { lru } from 'tiny-lru';
import { loadSync } from '@std/dotenv';
import { join } from '@std/path';
import { existsSync } from '@std/fs';
import { v4 } from '@std/uuid';
import { hash, verify } from '@denorg/scrypt';
import { Add, Delete, Home, Initialize, Login } from './templates/index.ts';
import {
  ACCESS_TOKEN_NAME,
  DATA_PATH,
  MIMES,
  MONOLITH_OPTIONS,
  SESSION_MAX_AGE,
  ZERO_BYTES,
} from './constants.ts';
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
const SESSION_SECRET = Deno.env.get('SESSION_SECRET') || 'hunter2';
const ARCHIVE_PATH = join(DATA_PATH, './archive');

// ensure archive path exists
if (!existsSync(ARCHIVE_PATH)) Deno.mkdirSync(ARCHIVE_PATH);

// store sessions in memory
const session = lru(100, SESSION_MAX_AGE);
const app = new Hono();

app.use(secureHeaders());

app.use('/static/*', serveStatic({ root: './', mimes: MIMES }));

app.on(['GET', 'POST'], ['/', '/add', '/delete/*', '/search'], async (c, next) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);
  const isValidToken = token && session.get(token) && v4.validate(token);

  if (isValidToken) {
    return next();
  } else if (token) {
    session.delete(token);
  }

  deleteCookie(c, ACCESS_TOKEN_NAME);

  if (c.req.method === 'GET') {
    const { data: isInit } = database.checkInitialized();
    if (isInit) return c.redirect('/login');

    const query = c.req.query('init');
    const error = query === 'confirm_error'
      ? 'Passwords do not match.'
      : query === 'init_error'
      ? 'Could not initialize user. Check system logs.'
      : '';

    const html = Initialize({ error });
    return c.html(html);
  }

  c.status(401);
  return c.text('Unauthorized');
});

app.post('/init', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const confirm = form.get('confirm') as string;

  if (password !== confirm) {
    return c.redirect('/?init=confirm_error', 302);
  }

  const hashed = hash(password);
  const { error } = database.createUser(hashed);

  if (error) {
    console.error(error);
    return c.redirect('/?init=init_error', 302);
  }

  // store token in memory
  const sessionToken = crypto.randomUUID();
  session.set(sessionToken, true);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    expires: new Date(Date.now() + SESSION_MAX_AGE),
  });

  // set init flag
  database.initialize();

  // set cookie with session token
  return c.redirect('/');
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
        const { error } = database.addPage(page);
        if (error) console.error(error);
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

// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_a_WebSocket_server_in_JavaScript_Deno
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

app.get('/logout', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);

  if (token) {
    deleteCookie(c, ACCESS_TOKEN_NAME);
    session.delete(token);
  }

  return c.redirect('/login');
});

app.get('/login', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);
  const isValidToken = token && session.get(token) && v4.validate(token);
  if (isValidToken) return c.redirect('/');

  const { data: isInit } = database.checkInitialized();
  if (!isInit) return c.redirect('/');

  const html = Login();
  return c.html(html);
});

app.post('/login', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const { data: hashed } = database.getHashedPassword();
  const isValid = verify(password, hashed);

  if (!isValid) {
    const html = Login({ error: 'Invalid password' });
    c.status(500);
    return c.html(html);
  }

  // store token in memory
  const sessionToken = crypto.randomUUID();
  session.set(sessionToken, true);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    expires: new Date(Date.now() + SESSION_MAX_AGE),
  });

  return c.redirect('/');
});

app.get('/search', (c) => {
  const query = c.req.query('query') ?? '';

  const results = database.searchPages(query);
  console.log(results);

  return c.json(results);
});

Deno.serve({ port: SERVER_PORT }, app.fetch);
