import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';

interface Props {
  filename: string;
  title: string;
  url: string;
  nonce: string;
  tags: string[];
}

export const Media = ({ filename, url, title, nonce, tags }: Props) =>
  Layout(
    'Archive: ' + title,
    html`
  <link rel="stylesheet" href="/static/vidstack-theme.min.css">
  <link rel="stylesheet" href="/static/vidstack-video.min.css">
  <main>
    <header>
      <a href="/">← Back To Archive</a>
    </header>
    <section>
      <h1>${title}</h1>

      ${
      url && html`
        <p style="font-family: monospace;"><a href="${url}">${url}</a></p>
      `
    }

      ${
      tags.length > 0 &&
      tags.map((tag) =>
        html`<span style="font-family: monospace;">
                #${tag}
              </span>`
      )
    }
    </section>

    <section>
      <video id="target" playsinline controls style="width: 100%;">
        <source src="/archive/${filename}" type="video/mp4" />
      </video>
    </section>
  </main>
  <!-- <script src="/static/vidstack.min.js"></script> -->
  <script nonce="${nonce}">
    //(async () => {
    //  const player = await VidstackPlayer.create({
    //    target: '#target',
    //    title: "${title}",
    //    layout: new VidstackPlayerLayout(),
    //  });
    //})();
  </script>
`,
  );
