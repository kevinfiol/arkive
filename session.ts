import { lru } from 'tiny-lru';
import { SESSION_MAX_AGE } from './constants.ts';

export const SESSION_SECRET = Deno.env.get('SESSION_SECRET') || 'hunter2';
export const session = lru(100, SESSION_MAX_AGE);