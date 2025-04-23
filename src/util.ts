import { walk } from '@std/fs';
import { resolve } from '@std/path';
import type { Page } from './types.ts';

export function createSlug(text = '') {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const slug = lines[i].toString().toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text

    if (slug.length > 0) return slug;
  }

  return '';
}

export function createFilename(timestamp: number, title: string) {
  return (timestamp.toString()) + '-' + createSlug(title) + '.html';
}

export async function fetchDocumentTitle(url: string) {
  let data = '', error = undefined;

  // add protocol if it doesn't exist
  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw Error(res.statusText);

    const text = await res.text();
    const match = text.match(/<title>\s*(.*?)\s*<\/title>/);

    if (!match || typeof match[1] !== 'string') {
      // default to url if the document doesn't have a title
      data = url;
    } else {
      data = match[1];
    }
  } catch (e) {
    console.log('Unable to fetch title for: ', url);
    console.error(e);
    error = e;
  }

  return { data, error };
}

export async function getSize(path: string) {
  let size = 0;
  const absPath = resolve(path);
  const info = await Deno.stat(absPath);

  if (info.isFile) {
    size = info.size;
  } else if (info.isDirectory) {
    for await (const file of walk(absPath)) {
      if (file.isFile) {
        const stats = await Deno.stat(file.path);
        size += stats.size;
      }
    }
  }

  return size;
}

export function escapeHtml(html: string) {
  return html.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&apos;')
    .replaceAll('"', '&quot;');
}

export async function parseDirectory(path: string) {
  let size = 0;
  const files = [];
  const absPath = resolve(path);

  for await (const file of walk(absPath)) {
    const ext = file.name.split('.').pop();

    if (file.isFile && ext === 'html') {
      const stats = await Deno.stat(file.path);
      size += stats.size;
      files.push({ name: file.name, size: stats.size });
    }
  }

  return { files, size };
}

export function formatBytes(bytes: number): string {
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

export function createEmptyPage(filename: string, size: number): Page {
  return {
    title: filename,
    url: '',
    filename,
    size,
  };
}

export async function appendMetadata(filePath = '', page: Page) {
  const metadata = JSON.stringify(page);
  const contents = `<!--#%${metadata}#%-->`;
  await Deno.writeTextFile(filePath, contents, { append: true });
}

// modified version of lukeed/throttles
// The MIT License (MIT)
// Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
export function createQueue(limit = 1) {
  // deno-lint-ignore no-explicit-any
  let $: any, wip = 0;
  // deno-lint-ignore no-explicit-any
  const queue: any[] = [];

  return $ = {
    // deno-lint-ignore no-explicit-any
    add(fn: any) {
      queue.push(fn) > 1 || $.run();
    },

    done() {
      wip -= 1;
      $.run();
    },

    run() {
      if (wip < limit && queue.length > 0) {
        queue.shift()();
        wip += 1;
      }
    },
  };
}
