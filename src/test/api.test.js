import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../services/api';

const jsonResponse = (status, body = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends the stored session token as Bearer', async () => {
    localStorage.setItem('gpt_auth', JSON.stringify({ token: 'session-tok', user: { role: 'PUBLIC', email: 'a@b.c' } }));
    fetch.mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await apiFetch('/auth/profile');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-tok');
  });

  it('an explicit Authorization header wins over the stored token', async () => {
    localStorage.setItem('gpt_auth', JSON.stringify({ token: 'session-tok', user: { role: 'PUBLIC', email: 'a@b.c' } }));
    fetch.mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await apiFetch('/auth/mfa/setup', { headers: { Authorization: 'Bearer scoped-tok' } });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer scoped-tok');
  });

  it('401 on an authenticated endpoint clears auth and fires auth:expired', async () => {
    localStorage.setItem('gpt_auth', JSON.stringify({ token: 'session-tok', user: { role: 'PUBLIC', email: 'a@b.c' } }));
    fetch.mockResolvedValueOnce(jsonResponse(401, { message: 'Session has been revoked' }));
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    await expect(apiFetch('/users')).rejects.toThrow('Authentication expired');
    expect(localStorage.getItem('gpt_auth')).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('auth:expired', spy);
  });

  it('401 on login does NOT fire auth:expired (it is a credential failure)', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(401, { message: 'Invalid email or password' }));
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow('Invalid email or password');
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', spy);
  });
});
