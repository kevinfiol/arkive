import { Hono } from '@hono/hono';
import { PageTile } from '../templates/index.ts';
import * as database from '../db.ts'

const app = new Hono();

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

app.get('/search', (c) => {
  const query = c.req.query('query') ?? '';
  let html = '';

  if (!query.trim().length) {
    const { data, error } = database.getCache();
    if (!error) {
      const pages = data.pages;
      const pageTiles = pages.map((page) => PageTile(page));
      html += pageTiles.join('');
    } else {
      console.error('Failed to retrieve cache during blank search');
    }
  } else {
    const { data: results, error } = database.searchPages(query);

    if (results.length > 0 && !error) {
      const filenames = results.map((result) => result.filename);
      const { data: pagesData } = database.getPagesData(filenames);

      for (const filename of filenames) {
        const page = pagesData[filename];
        html += PageTile(page);
      }
    }
  }

  return c.text(html);
});

export { app as api };