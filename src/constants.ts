import { NONCE } from '@hono/hono/secure-headers';
import { join } from '@std/path';

export const MAX_HOMEPAGE_PAGES = 50;

export const ACCESS_TOKEN_NAME = 'ARKIVE_SESSION_COOKIE';

export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export const ZERO_BYTES = 0;

export const DATA_PATH = './data';

export const ARCHIVE_PATH = join(DATA_PATH, './archive');

export const JOB_STATUS = {
  processing: '1',
  completed: '2',
  failed: '3',
  pending: '4',
} as const;

export const CLI = {
  MONOLITH: 'webpage',
  YT_DLP: 'youtube',
} as const;

export const MONOLITH_TIME_LIMIT = 1000 * 60 * 5; // 5 minutes
export const YT_DLP_TIME_LIMIT = 1000 * 60 * 10; // 10 minutes

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

export const YT_DLP_OPTIONS = {
  'embed-subs': { flag: '--embed-subs', label: 'Embed subtitles in the video' },
  'write-subs': { flag: '--write-subs', label: 'Write subtitle file' },
  'embed-thumbnail': {
    flag: '--embed-thumbnail',
    label: 'Embed thumbnail in the video as cover art',
  },
  'embed-chapters': {
    flag: '--embed-chapters',
    label: 'Add chapter markers to the video file',
  },
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
  scriptSrc: [NONCE, "'self'", 'data:'],
  scriptSrcAttr: ["'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'data:'],
  styleSrcAttr: ["'self'", "'unsafe-inline'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", 'data:', 'https://i.ytimg.com'],
  manifestSrc: ["'self'"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
  workerSrc: ["'self'"],
};
