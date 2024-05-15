import * as cookie from 'std/http/cookie.ts';
import { load } from 'std/dotenv/mod.ts';
import { existsSync } from 'std/fs/mod.ts';
import { join, resolve } from 'std/path/mod.ts';
import * as uuid from 'std/uuid/mod.ts';
import { Router } from './router.ts';
import { Add, Delete, Home, Initialize, Login } from './templates.ts';
import { serveStatic } from './middleware/static.ts';
import { Database, MAX_COOKIE_AGE } from './db.ts';
import {
  createSlug,
  fetchDocumentTitle,
  getSize,
  parseDirectory,
  hashPhrase,
  validatePhrase,
  sealToken,
  unsealToken
} from './util.ts';



// load .env file
await load({ export: true });

const COOKIE_NAME = 'ARKIVE_ACCESS_TOKEN';
const SERVER_PORT = Deno.env.get('SERVER_PORT') ?? 8000;
const SESSION_SECRET = Deno.env.get('SESSION_SECRET') as string;
const DATA_PATH = resolve('./data');
const STATIC_ROOT = resolve('./static');
const ARCHIVE_PATH = join(DATA_PATH, './archive');
const DB_PATH = join(DATA_PATH, './db');

console.log({SESSION_SECRET, SERVER_PORT});

// create directories
[DATA_PATH, ARCHIVE_PATH, DB_PATH].forEach((path) => {
  if (!existsSync(path)) Deno.mkdirSync(path);
});

const DB = await Database(DB_PATH);
const app = new Router();

const validateSession = async (token: unknown) => {
  let isValid = false;

  if (typeof token !== 'string' || !uuid.validate(token)) {
    return isValid;
  }

  const hash = await sealToken(token, SESSION_SECRET);
  console.log(hash); // returns a new hash everytime, regardless of the constant secret
  // also, the way this works, this validateSession is being called multiple times on page load, need to fix this
  // https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

  try {
    const res = await DB.isValidToken(hash);
    isValid = res.data;
  } catch (e) {
    console.error('Unable to validate session', e);
  }

  return isValid;
};

app.get('*', serveStatic(STATIC_ROOT));

app.get('*', async (req) => {
  const { data: isInit } = await DB.checkInit();

  const cookies = cookie.getCookies(req.headers);
  const token = cookies[COOKIE_NAME];
  const isValidSession = await validateSession(token);

  if (!isInit) {
    // render init page
    return new Response(Initialize(), {
      status: 200,
      headers: new Headers({
        'content-type': 'text/html'
      })
    });
  } else if (!isValidSession) {
    // render login page
    return new Response(Login(), {
      status: 200,
      headers: new Headers({
        'content-type': 'text/html'
      })
    });
  }
});

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
    status = 404;
    contents = '404: File does not exist or is not readable.';
  }

  return new Response(contents, {
    status,
    headers,
  });
});

app.get('/', async () => {
  const info = await Deno.stat(ARCHIVE_PATH);
  const date = info.mtime ?? new Date();
  const modifiedTime = date.toISOString();

  let pages = [];
  let size = '0 B';
  const { data: hasChanged } = await DB.checkModified(modifiedTime);

  if (hasChanged) {
    const directory = await parseDirectory(ARCHIVE_PATH);
    const { data: pageData } = await DB.getPageData(directory.files);

    size = directory.size;
    for (const file of directory.files) {
      pages.push(pageData[file.name]);
    }

    // update cache
    await DB.setCache({ pages, size: directory.size });
  } else {
    const { data: cache } = await DB.getCache();
    pages = cache.pages;
    size = cache.size;
  }

  const html = Home({
    size,
    pages,
    count: pages.length,
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

app.get('/login', async (req) => {
  const cookies = cookie.getCookies(req.headers);
  const token = cookies[COOKIE_NAME];
  const isValidSession = await validateSession(token);

  if (isValidSession) {
    // already logged in
    return new Response('302', {
      status: 302,
      headers: new Headers({ 'location': '/' })
    });
  }

  return new Response(Login(), {
    status: 200,
    headers: new Headers({ 'content-type': 'text/html' })
  });
});

app.get('/logout', async (req) => {
  const headers = new Headers({
    'location': '/login'
  });

  // delete token from store
  const cookies = cookie.getCookies(req.headers);
  const token = cookies[COOKIE_NAME];
  const hashed = await sealToken(token, SESSION_SECRET);

  await DB.removeToken(hashed);
  cookie.deleteCookie(headers, COOKIE_NAME);

  return new Response('302', {
    status: 302,
    headers
  });
});

app.get('/delete/:filename', async (_req, params) => {
  let contents;
  let status;
  const filename = params.filename as string ?? '';
  const page = await DB.getPage(filename);

  if (page.data === undefined) {
    contents = '404';
    status = 404;
  } else {
    const { title } = page.data;
    status = 200;
    contents = Delete({ filename, title });
  }

  return new Response(contents, {
    status: status,
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
    const { data: page } = await DB.getPage(filename);

    if (page === undefined) {
      throw Error('Page with that ID does not exist.');
    }

    const result = await DB.deletePage(filename);
    if (!result.ok) throw result.error;

    await Deno.remove(join(ARCHIVE_PATH, filename));
    headers.set('location', '/');
  } catch (e) {
    status = 500;
    contents = '500';
    console.error(e);
  }

  return new Response(contents, {
    status,
    headers,
  });
});

// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_a_WebSocket_server_in_JavaScript_Deno
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
  const filename = (timestamp.toString()) + '-' + createSlug(title) + '.html';
  const path = join(ARCHIVE_PATH, filename);

  const cmd = new Deno.Command('monolith', {
    args: [`--output=${path}`, ...monolithOpts, url],
  });

  const output = await cmd.output();

  if (!output.success) {
    console.error(output);
    status = 500;
    contents = Add({
      error: 'Unable to save page. Please try again or check the URL.',
    });
  } else {
    const size = await getSize(path);
    const page = { filename, title, url, size, foo: 1 };

    try {
      const result = await DB.addPage(page);

      if (!result.ok) {
        throw result.error;
      }

      headers.set('location', '/');
    } catch (e) {
      console.error(e);
      status = 500;
      contents = Add({
        error: 'Unable to save page. Please try again or check the URL.',
      });
    }
  }

  return new Response(contents, {
    status,
    headers,
  });
});

app.post('/edit', async (req) => {
  let contents = 'OK';
  let status = 200;

  const form = await req.formData();
  const url = form.get('url') as string;
  const title = form.get('title') as string;
  const filename = form.get('filename') as string;

  try {
    await DB.editPage({ filename, title, url });
  } catch (e) {
    contents = '500';
    status = 500;
    console.error(e);
  }

  return new Response(contents, {
    status,
    headers: { 'content-type': 'text/plain' },
  });
});

app.post('/login', async (req) => {
  let contents = '302';
  let status = 302;

  const headers = new Headers({
    'content-type': 'text/html'
  });

  const wrongPassword = 'Wrong Password';
  const form = await req.formData();
  const password = form.get('password') as string;

  try {
    const { data: hashed, error } = await DB.getHashedPassword();
    if (error) throw error;

    const success = await validatePhrase(password, hashed);
    if (!success) throw Error(wrongPassword);

    const token = crypto.randomUUID();
    const hashedToken = await sealToken(token, SESSION_SECRET);
    await DB.setToken(hashedToken);

    cookie.setCookie(headers, {
      name: COOKIE_NAME,
      value: token,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: MAX_COOKIE_AGE
    });

    headers.set('location', '/');
  } catch (e) {
    let errorMessage = wrongPassword;
    if (e.message !== wrongPassword) {
      errorMessage = 'A server error occurred';
      console.error(e);
    }

    contents = Login({ error: errorMessage });
    status = 500;
  }

  return new Response(contents, {
    status,
    headers
  });
});

app.post('/init', async (req) => {
  let contents = '302';
  let status = 302;
  const headers = new Headers({
    'content-type': 'text/html',
  });

  const form = await req.formData();
  const password = form.get('password') as string;
  const confirm = form.get('confirm') as string;

  if (password !== confirm) {
    contents = Initialize({ error: 'Passwords do not match.' });
    status = 500;
  } else {
    try {
      const hashed = await hashPhrase(password);
      await DB.initApp(hashed);

      const token = crypto.randomUUID();
      const hashedToken = await sealToken(token, SESSION_SECRET);
      await DB.setToken(hashedToken);

      cookie.setCookie(headers, {
        name: COOKIE_NAME,
        value: token,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: MAX_COOKIE_AGE
      });

      headers.set('location', '/');
    } catch (e) {
      contents = Initialize({ error: 'An error occurred. Please try again.' });
      status = 500;
      console.error(e);
    }
  }

  return new Response(contents, {
    status,
    headers
  });
});

app.post('/search', async (req) => {
  const body = await req.json();
  console.log({ body });

  return new Response('404', {
    status: 404,
  });
});

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));
