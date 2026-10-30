import { describe, expect, it } from 'vitest';
import { sessionIdFromAccessToken } from './supabase-admin.js';

/** Build an unsigned JWT-shaped token whose payload carries `claims`. */
function fakeJwt(claims: Record<string, unknown>): string {
  const enc = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(claims)}.signature`;
}

describe('sessionIdFromAccessToken', () => {
  it('recovers the session_id claim GoTrue only exposes inside the JWT', () => {
    const id = '6f9d0f7a-9c3b-4d3e-8f1a-2b5c6d7e8f90';
    expect(sessionIdFromAccessToken(fakeJwt({ sub: 'u', session_id: id }))).toBe(id);
  });

  it('is empty for a token without the claim, a malformed token and junk', () => {
    expect(sessionIdFromAccessToken(fakeJwt({ sub: 'u' }))).toBe('');
    expect(sessionIdFromAccessToken('not-a-jwt')).toBe('');
    expect(sessionIdFromAccessToken('a.!!!not-base64json!!!.c')).toBe('');
    expect(sessionIdFromAccessToken('')).toBe('');
  });

  it('ignores a session_id claim of the wrong type', () => {
    expect(sessionIdFromAccessToken(fakeJwt({ session_id: 42 }))).toBe('');
    expect(sessionIdFromAccessToken(fakeJwt({ session_id: null }))).toBe('');
  });
});
