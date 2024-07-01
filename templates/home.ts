import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';
import { formatBytes } from '../util.ts';
import type { Page } from '../types.ts';

export const Home = ({ pages, size, count }: { pages: Array<Page>, size: number, count: number }) => Layout('Archive', html`
  <main>
    <header>
      <div class="header-info">
        <span>Disk Usage: ${formatBytes(size)}</span>
        <span>Showing ${count < 50 ? count : '50'} of ${count} saved pages</span>
      </div>
    </header>
    <section class="controls">
      <a href="/add">Save New Page</a>
      <a href="/logout">Logout</a>
      <div class="input-group">
        <input type="text" placeholder="Type to Search..." id="search-bar" />
      </div>
    </section>
    <section class="articles">
      <dialog id="edit-dialog">
        <div>
          <form id="edit-form" method="dialog">
            <input type="text" placeholder="Title" name="title" required />
            <input type="text" placeholder="URL" name="url" required />
            <div class="input-group">
              <button id="submit-dialog">Save</button>
              <button id="close-dialog">Cancel</button>
            </div>
            <figure class="error -hidden" id="edit-error">
            </figure>
          </form>
        </div>
      </dialog>

      ${pages.map(({ filename, url, title, size }) => html`
        <article class="article">
          <header>
            <a href="/archive/${filename}" class="title">${title}</a>
          </header>
          <div class="info">
            <small><a href="${url}" class="url">${url}</a></small>
          </div>
          <div class="info">
            <small>${formatBytes(size)}</small>
            <small>
              <a
                data-filename="${filename}"
                data-title="${title}"
                data-url="${url}"
                class="link-btn edit-button"
                role="button"
                onclick="window.openEditDialog(this)"
              >
                edit
              </a>
            </small>
            <small>
              <a href="/delete/${filename}">
                delete
              </a>
            </small>
          </div>
        </article>
      `)}
    </section>
  </main>
  <script defer src="/static/home.js"></script>
`);