import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';
import { PageTile } from './partial/page-tile.ts';
import { formatBytes } from '../util.ts';
import type { Page } from '../types.ts';

interface Props {
  pages: Array<Page>;
  size: number;
  count: number;
  nonce: string;
}

export const Home = ({ pages, size, count, nonce }: Props) => Layout('Archive', html`
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
    </section>
    <section class="articles">
      ${pages.map(PageTile)}
    </section>
  </main>
  <script type="module" nonce="${nonce}" src="/static/home.js"></script>
`);