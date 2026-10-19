import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const appVersion = process.env.APP_VERSION || 'v1';
const indexHtml = readFileSync(new URL('./public/index.html', import.meta.url));

function writeJson(res, statusCode, payload, requestId) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId
  });
  res.end(body);
}

function writeHtml(res, requestId) {
  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': indexHtml.length,
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'none'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'"
    ].join('; '),
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Request-Id': requestId
  });
  res.end(indexHtml);
}

function logRequest({ durationMs, method, pathname, requestId, statusCode }) {
  console.log(JSON.stringify({
    durationMs,
    event: 'http_request',
    level: statusCode >= 500 ? 'error' : 'info',
    method,
    pathname,
    requestId,
    statusCode,
    timestamp: new Date().toISOString(),
    version: appVersion
  }));
}

async function readPublicIp() {
  const response = await fetch('https://ipinfo.io/json', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`ipinfo returned ${response.status}`);
  }

  const data = await response.json();

  // 仅返回明确允许的公网信息，避免把上游响应或运行环境整体透传给客户端。
  return {
    city: typeof data.city === 'string' ? data.city : null,
    country: typeof data.country === 'string' ? data.country : null,
    ip: typeof data.ip === 'string' ? data.ip : null,
    region: typeof data.region === 'string' ? data.region : null
  };
}

export function createAppServer() {
  return createServer(async (req, res) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    const method = req.method || 'GET';
    const { pathname } = new URL(req.url || '/', 'http://localhost');
    let statusCode = 500;

    try {
      if (method === 'GET' && pathname === '/') {
        statusCode = 200;
        writeHtml(res, requestId);
        return;
      }

      if (method === 'GET' && pathname === '/api/version') {
        statusCode = 200;
        writeJson(res, statusCode, {
          ok: true,
          requestId,
          timestamp: new Date().toISOString(),
          version: appVersion
        }, requestId);
        return;
      }

      if (method === 'GET' && pathname === '/healthz') {
        statusCode = 200;
        writeJson(res, statusCode, {
          ok: true,
          requestId,
          version: appVersion
        }, requestId);
        return;
      }

      if (
        method === 'POST'
        && pathname === '/api/test-error'
        && req.headers['x-lab-action'] === 'intentional-error'
      ) {
        statusCode = 500;
        console.error(JSON.stringify({
          event: 'intentional_test_error',
          level: 'error',
          requestId,
          timestamp: new Date().toISOString(),
          version: appVersion
        }));
        writeJson(res, statusCode, {
          error: 'Intentional test error',
          ok: false,
          requestId,
          version: appVersion
        }, requestId);
        return;
      }

      if (method === 'GET' && pathname === '/myip') {
        const publicIp = await readPublicIp();
        statusCode = 200;
        writeJson(res, statusCode, {
          ok: true,
          requestId,
          ...publicIp
        }, requestId);
        return;
      }

      statusCode = 404;
      writeJson(res, statusCode, {
        error: 'Not Found',
        ok: false,
        requestId
      }, requestId);
    } catch (error) {
      statusCode = 500;
      console.error(JSON.stringify({
        event: 'request_failure',
        level: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        pathname,
        requestId,
        timestamp: new Date().toISOString(),
        version: appVersion
      }));
      writeJson(res, statusCode, {
        error: 'Internal Server Error',
        ok: false,
        requestId
      }, requestId);
    } finally {
      logRequest({
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        method,
        pathname,
        requestId,
        statusCode
      });
    }
  });
}

const isMainModule = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  const port = Number(process.env.PORT || 80);
  const server = createAppServer();

  server.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({
      event: 'server_started',
      level: 'info',
      port,
      timestamp: new Date().toISOString(),
      version: appVersion
    }));
  });
}
