import { m } from './umhi.js';
import htm from './htm.min.js';

const html = htm.bind(m);

export const PageTile = ({ filename, url, title, size }) => html`
  <article class="article foobar">
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
          onclick=${window.openEditDialog}
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

function formatBytes(bytes) {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes < kb) {
    return bytes + ' B';
  } else if (bytes < mb) {
    return (bytes / kb).toFixed(2) + ' KB';
  } else if (bytes < gb) {
    return (bytes / mb).toFixed(2) + ' MB';
  } else {
    return (bytes / gb).toFixed(2) + ' GB';
  }
}