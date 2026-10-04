// Cookie sessions remain preferred. The deployed older API returns a Bearer
// token; keep that token only in this closure until logout, expiry or reload.
export function createAdminClient(base, fetchImpl = globalThis.fetch, pageOrigin = globalThis.location?.origin) {
  const endpoint = new URL(base, pageOrigin);
  if (endpoint.protocol !== 'https:' && !(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) && endpoint.protocol === 'http:')) {
    throw new Error('Админ-панель требует HTTPS API.');
  }
  const origin = endpoint.href.replace(/\/$/, '');
  let mode = null, probe = null, token = null;
  async function detect() {
    const response = await fetchImpl(origin + '/api/auth/session', {credentials:'omit', cache:'no-store', redirect:'error'});
    if (response.status === 404) mode = 'bearer';
    else if (response.status === 200 || response.status === 401) mode = 'cookie';
    else throw new Error('Не удалось проверить доступ к админ-панели. Повторите позже.');
  }
  async function ready() {
    if (!mode) await (probe ||= detect().catch(error => { probe = null; throw error; }));
  }
  async function request(path, options = {}) {
    await ready();
    if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) throw new Error('Недопустимый адрес API.');
    const headers = new Headers(options.headers);
    if (mode === 'bearer' && token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetchImpl(origin + path, {...options, headers, credentials:mode === 'bearer' ? 'omit' : 'include', cache:'no-store', redirect:'error'});
    if (response.status === 401) token = null;
    return response;
  }
  async function login(email, password) {
    token = null;
    const response = await request('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})});
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Не удалось войти. Повторите позже.');
    if (mode === 'bearer') {
      if (typeof data?.token !== 'string' || !data.token || data.token.length > 8192) throw new Error('Сервис не подтвердил вход.');
      token = data.token;
    } else if (data?.ok !== true) throw new Error('Сервис не подтвердил вход.');
  }
  async function restoreSession() {
    await ready();
    if (mode === 'bearer') return false;
    const response = await request('/api/auth/session');
    if (response.status === 401) return false;
    if (!response.ok) throw new Error('Не удалось проверить сессию. Повторите позже.');
    return (await response.json().catch(() => null))?.ok === true;
  }
  async function logout() {
    try {
      if (mode === 'cookie') {
        const response = await request('/api/auth/logout', {method:'POST'});
        if (!response.ok) throw new Error('Не удалось завершить сессию. Повторите позже.');
      }
    } finally { token = null; }
  }
  return {request, login, logout, restoreSession, clearSession:() => { token = null; }, isLegacy:() => mode === 'bearer'};
}
