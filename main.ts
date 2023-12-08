import { load } from 'std/dotenv/mod.ts';
import { existsSync } from 'std/fs/mod.ts';
import { resolve, join } from 'std/path/mod.ts';
import { Router } from './router.ts';
import { Home, Add } from './templates.ts';
import { createSlug, fetchDocumentTitle } from './util.ts';
import { serveStatic } from './middleware/serveStatic.ts';

await load({ export: true });

const SERVER_PORT = Deno.env.get('SERVER_PORT') ?? 8000;
const STATIC_ROOT = './static';
const ARCHIVE_PATH = resolve('./_archive');

const app = new Router();

app.get('*', serveStatic(STATIC_ROOT));

app.get('/', () => {
  const html = Home();

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
    // get document title from url
    const docTitle = await fetchDocumentTitle(url);
    // if (docTitle.error)  // TODO: handle error
    title = docTitle.data;
  }

  if (!existsSync(ARCHIVE_PATH)) {
    Deno.mkdirSync(ARCHIVE_PATH)
  }

  const slug = createSlug(title) + '-' + (Date.now().toString());
  const path = join(ARCHIVE_PATH, `${slug}.html`);

  const cmd = new Deno.Command('monolith', { args: [`--output=${path}`, url] });
  await cmd.output();

  return new Response(contents, {
    status,
    headers
  });
});

Deno.serve({ port: Number(SERVER_PORT) }, app.handler.bind(app));