import { join } from '@std/path';
import { v4 } from '@std/uuid';
import { Database } from '@db/sqlite';
import { DATA_PATH, SESSION_MAX_AGE } from '../constants.ts';
import type { Session } from '../types.ts';

const DB_PATH = join(DATA_PATH, 'session.db');
export const db = new Database(DB_PATH);

db.exec('pragma journal_mode = WAL;');
db.exec('pragma foreign_keys = true;');
db.exec('pragma temp_store = memory;');

db.exec(`
  create table if not exists session (
    token text primary key,
    expires_at integer not null
  ) strict;
`);

export function deleteSession(token: string) {
  let ok = true;
  let error = undefined;

  try {
    const deletion = db.prepare(`
      delete from session
      where token = :token
    `);

    const changes = deletion.run({ token });
    if (changes < 1) console.log('Token does not exist in sessions: ' + token);
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function setSession(token: string) {
  let ok = true;
  let error = undefined;

  try {
    const insert = db.prepare(`
      insert into session (token, expires_at)
      values (:token, unixepoch('now') + :max_age)
      on conflict(token) do update set
        expires_at = unixepoch('now') + :max_age
    `);

    const changes = insert.run({ token, max_age: SESSION_MAX_AGE });
    if (changes !== 1) throw Error('Unable to set or update session: ' + token);
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function getSession(token: string) {
  let session = undefined;
  let error = undefined;

  try {
    const select = db.prepare(`
      select
        *,
        unixepoch('now') as now
      from session
      where token = :token
    `);

    session = select.get<Session>({ token });

    if (session && session.now > session.expires_at) {
      // session expired; remove from sessions
      const deletion = deleteSession(token);

      if (deletion.error) {
        return { data: undefined, error: deletion.error };
      }

      return {
        data: undefined,
        error: Error('Session token has expired ' + token),
      };
    }
  } catch (e) {
    error = e;
  }

  return { data: session, error };
}

export function validateSession(token?: string | null | false) {
  let isValid = false;
  let error = undefined;

  if (token) {
    try {
      const session = getSession(token);
      if (session.error) throw session.error;
      else if (session.data) isValid = v4.validate(token);
    } catch (e) {
      error = e;
    }
  }

  return { data: isValid, error };
}

export function pruneSessions() {
  let pruned = 0;
  let error = undefined;

  try {
    const deletion = db.prepare(`
      delete from session
      where unixepoch('now') > expires_at
    `);

    pruned = deletion.run();
  } catch (e) {
    error = e;
  }

  return { data: pruned, error };
}
