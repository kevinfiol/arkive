import { html } from '@hono/hono/html';
import { formatBytes } from '../../util.ts';
import type { Page } from '../../types.ts';

export const PageTile = ({ filename, url, title, size }: Page) => html`
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
`;