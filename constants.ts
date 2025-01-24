import { NONCE } from '@hono/hono/secure-headers';
import { join } from '@std/path';

export const ACCESS_TOKEN_NAME = 'ARKIVE_SESSION_COOKIE';

export const SESSION_MAX_AGE = 7 * 8.64 * Math.pow(10, 7); // 7 days

export const ZERO_BYTES = 0;

export const DATA_PATH = './data';

export const ARCHIVE_PATH = join(DATA_PATH, './archive');

export const JOB_STATUS = { processing: '1', completed: '2', failed: '3' };

export const MONOLITH_OPTIONS = {
  'no-audio': { flag: '-a', label: 'No Audio' },
  'no-css': { flag: '-c', label: 'No CSS' },
  'no-frames': { flag: '-f', label: 'No Frames/iframes' },
  'no-custom-fonts': { flag: '-F', label: 'No Custom Fonts' },
  'no-images': { flag: '-i', label: 'No Images' },
  'isolate': { flag: '-I', label: 'Isolate Page' },
  'no-javascript': { flag: '-j', label: 'No JavaScript' },
  'no-metadata': { flag: '-M', label: 'No Metadata' },
  'unwrap-noscript': { flag: '-n', label: 'Unwrap noscript tags' },
  'no-video': { flag: '-v', label: 'No Video' },
};

export const MIMES: Record<string, string> = {
  'js': 'text/javascript',
  'css': 'text/css',
  'ico': 'image/vnd.microsoft.icon',
  'svg': 'image/svg+xml',
  'html': 'text/html',
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#browser_compatibility
export const CONTENT_SECURITY_POLICY = {
  defaultSrc: [NONCE, "'self'"],
  scriptSrc: [NONCE, "'self'"],
  scriptSrcAttr: ["'unsafe-inline'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", 'data:'],
  manifestSrc: ["'self'"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
  workerSrc: ["'self'"],
};
