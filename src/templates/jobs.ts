import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';

interface Props {
  nonce: string;
}

export const Jobs = ({ nonce }: Props) =>
  Layout(
    'Active Jobs',
    html`
  <main>
    <header>
      <a href="/">← Back To Archive</a>
    </header>

    <div id="JOBS_ROOT">
      <noscript>JavaScript required to track running jobs</noscript>
    </div>
  </main>
  <script src="/static/lib/umai.min.js"></script>
  <script src="/static/lib/htm.min.js"></script>
  <script type="module" nonce="${nonce}" src="/static/jobs.js"></script>
`,
  );
