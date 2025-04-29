import { html } from '@hono/hono/html';
import { formatBytes } from '../../util.ts';
import type { Page } from '../../types.ts';

export const PageTile = ({ id, filename, url, title, size, tags }: Page) =>
  html`
  <article class="article">
    <header>
      <a href="/archive/${filename}" class="title">${title}</a>
    </header>
    <div class="info">
      <small><a href="${url}" class="url">${url}</a></small>
    </div>
    <div class="info tags" style="display: ${
    tags.length > 0 ? 'flex' : 'none'
  };">
      <small style="display: flex; gap: 5px;">
        ${
    tags.map((tag) =>
      html`<span style="cursor: pointer;">
            <a
              data-tag="${tag}"
              onclick="window.filterByTag(this)"
            >#${tag}</a>
          </span>`
    )
  }
      </small>
    </div>
    <div class="info">
      <small>${formatBytes(size)}</small>
      <small>
        <a
          data-pageid="${id}"
          data-filename="${filename}"
          data-title="${title}"
          data-url="${url}"
          data-tags="${tags.join(', ').trim()}"
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
