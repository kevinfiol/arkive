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

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);

    const text = await res.text();
    const match = text.match(/<title>\s*(.*?)\s*<\/title>/);

    if (!match || typeof match[1] !== 'string') {
      throw new Error('Unable to parse title!');
    }

    data = match[1];
  } catch (e) {
    console.log('Unable to fetch title for: ', url);
    console.error(e);
  }

  return { data, error };
};