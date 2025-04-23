import { html } from '@hono/hono/html';
import type { Partial } from './index.ts';

export const Layout = (title: string, content: Partial) =>
  html`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="personal web archive" >
    <link rel="stylesheet" href="/static/main.css">
    <title>
      ${title || 'Archive'}
    </title>
  </head>
  <body>
    ${content}
  </body>
  </html>
`;
