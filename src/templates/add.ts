import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';
import { MonolithOptions } from './partial/monolith-options.ts';
import { YtDlpOptions } from './partial/ytdlp-options.ts';
import { CLI } from '../constants.ts';

interface Props {
  url: string;
  title: string;
  nonce: string;
  mode: string;
}

const MAX_TITLE_LENGTH = 100;

export const Add = (
  { url = '', title = '', mode = CLI.MONOLITH, nonce }: Props,
) =>
  Layout('Save New Page', html`
  <main>
    <header>
      <a href="/">← Back To Archive</a>
      <p>Enter a page or video URL to archive it. Use the checkboxes configure the archiver.</p>
    </header>
    <section>
      <form class="add-form">
        <input
          type="radio"
          name="mode"
          id="tab1"
          class="tab-input"
          value="${CLI.MONOLITH}"
          ${mode === CLI.MONOLITH ? 'checked' : ''}
        />
        <label class="tab" for="tab1">Webpage</label>
        <input
          type="radio"
          name="mode"
          id="tab2"
          class="tab-input"
          value="${CLI.YT_DLP}"
          ${mode === CLI.YT_DLP ? 'checked' : ''}
        />
        <label class="tab" for="tab2">YouTube</label>

        <div class="input-group">
          <input
            type="text"
            name="url"
            placeholder="URL"
            maxlength="200"
            value="${url}"
            required
          >
        </div>

        <div class="tab-container-1">
          <div class="input-group">
            <input
              type="text"
              name="title"
              placeholder="Title (Optional)"
              maxlength="${MAX_TITLE_LENGTH}"
              value="${title.slice(0, MAX_TITLE_LENGTH)}"
            >
          </div>

          ${MonolithOptions()}
        </div>

        <div class="tab-container-2">
          ${YtDlpOptions()}
        </div>

        <div class="input-group">
          <input
            type="text"
            name="tags"
            placeholder="Tags separated by commas (Optional)"
            list="tags"
            maxlength="400"
          >
        </div>

        <button type="submit">Save</button>
        <figure class="alert" style="display: none">
          <div class="spinner"></div>
          <div class="add-status"></div>
        </figure>
      </form>
    </section>
  </main>
  <script type="module" nonce="${nonce}" src="/static/add.js"></script>
`);
