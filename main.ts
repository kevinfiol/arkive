import { Hono } from 'hono';
import { serveStatic } from 'hono/middleware';
import { loadSync } from '@std/dotenv';
import { join, resolve } from '@std/path';
import { existsSync } from '@std/fs';
import { DATA_PATH, MIMES } from './constants.ts';

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

app.get('/', (c) => {
  return c.text('sup');
});

Deno.serve({ port: SERVER_PORT }, app.fetch);