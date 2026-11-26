import { request as httpsRequest } from 'node:https';
import { pipeline } from 'node:stream';

const renderOrigin = 'https://api.roseen.ru';
const routes = {
  GET: /^\/api\/(?:health|auth\/session|requests(?:\/[1-9]\d*)?|files\/[1-9]\d*)$/,
  POST: /^\/api\/(?:auth\/(?:login|logout)|requests)$/,
  PATCH: /^\/api\/requests\/[1-9]\d*$/,
};
const requestHeaders = ['authorization', 'content-type', 'content-length'];
const responseHeaders = ['content-type', 'content-length', 'content-disposition', 'retry-after'];
const sessionCookie = '__Host-roseen_session=';

// Render remains the source of truth for service data. The caller enables the
// bridge only for the production Vercel deployment with no local API config.
export function createServiceProxy(request = httpsRequest) {
  return (req, res, next) => {
    if (!routes[req.method]?.test(req.path)) return next();
    const target = new URL(renderOrigin);
    target.pathname = req.path;
    if (req.method === 'GET' && req.path === '/api/requests') {
      const query = new URLSearchParams(req.originalUrl.split('?')[1]);
      for (const key of ['before', 'limit']) {
        const value = query.get(key);
        if (/^\d{1,16}$/.test(value)) target.searchParams.set(key, value);
      }
    }

    const headers = {};
    for (const name of requestHeaders) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const cookie = req.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith(sessionCookie));
    if (cookie) headers.cookie = cookie;

    function unavailable(status = 503) {
      if (!res.headersSent && !res.destroyed) {
        res.status(status).json({ error: 'Сервис временно недоступен. Повторите позже.' });
      }
    }

    const upstream = request(target, { method: req.method, headers }, response => {
      const status = response.statusCode;
      if ((status >= 300 && status < 400) || status >= 500) {
        response.resume();
        unavailable(status >= 500 ? status : 502);
        return;
      }
      for (const name of responseHeaders) {
        if (response.headers[name]) res.setHeader(name, response.headers[name]);
      }
      const cookies = response.headers['set-cookie']?.filter(value => value.startsWith(sessionCookie));
      if (cookies?.length) res.setHeader('Set-Cookie', cookies);
      res.status(status);
      pipeline(response, res, () => {});
    });
    upstream.setTimeout(25_000, () => upstream.destroy(new Error('Service timeout')));
    upstream.on('error', () => unavailable());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
}
