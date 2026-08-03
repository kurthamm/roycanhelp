import { createHmac, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const sign = (payload, secret) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function makeSession(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + THIRTY_DAYS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token, secret) {
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url')).exp > Date.now(); }
  catch { return false; }
}

export function checkPassword(supplied, actual) {
  const a = Buffer.from(String(supplied)), b = Buffer.from(String(actual));
  return a.length === b.length && timingSafeEqual(a, b);
}
