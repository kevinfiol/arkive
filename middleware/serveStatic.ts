import { resolve } from 'std/path/mod.ts';
import { walkSync } from 'std/fs/mod.ts';

const FILES = new Map<string, string>();
const MIMES: Record<string, string> = {
  'js': 'text/javascript',
  'css': 'text/css',
  'ico': 'image/vnd.microsoft.icon',
};

export const serveStatic = (root: string) => {
  // create cache of static files
  for (const file of walkSync(resolve(root))) {
    if (file.isFile) {
      FILES.set('/' + file.name.normalize(), file.path);
    }
  }

  return async (req: Request) => {
    const url = new URL(req.url);
    const filepath = FILES.get(url.pathname);

    if (filepath !== undefined) {
      const [ext] = filepath.split('.').slice(-1);
      const contentType = MIMES[ext] ?? 'text/plain';
      const file = await Deno.open(filepath, { read: true });
      const readableStream = file.readable;

      return new Response(readableStream, {
        status: 200,
        headers: {
          'content-type': contentType,
        },
      });
    }
  };
};