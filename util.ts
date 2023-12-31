import { walk } from 'std/fs/mod.ts';
import { resolve } from 'std/path/mod.ts';

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

  return formatBytes(size);
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
      files.push({ name: file.name, size: formatBytes(stats.size) });
    }
  }

  return { files, size: formatBytes(size) };
}

function formatBytes(bytes: number): string {
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
