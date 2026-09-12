import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLastSeen, normalizeUsername, usernameLabel } from '../src/utils/presentation';

test('username normalization owns presentation prefix exactly once', () => {
  assert.equal(normalizeUsername('@@Red2003 '), 'red2003');
  assert.equal(usernameLabel('@@Red2003'), '@red2003');
  assert.equal(usernameLabel('red2003'), '@red2003');
});

test('last seen formatting never exposes raw ISO timestamps', () => {
  const now = new Date('2026-09-12T20:00:00+05:30');
  assert.equal(formatLastSeen('2026-09-12T19:55:00+05:30', false, now), 'Last seen 5 minutes ago');
  assert.match(formatLastSeen('2026-09-12T08:40:00+05:30', false, now) || '', /^Last seen today at /);
  assert.match(formatLastSeen('2026-09-11T21:15:00+05:30', false, now) || '', /^Last seen yesterday at /);
  assert.equal(formatLastSeen('2026-09-10T19:30:00+05:30', true, now), 'Online');
});
