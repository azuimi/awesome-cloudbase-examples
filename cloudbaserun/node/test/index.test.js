import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createAppServer } from '../index.js';

let baseUrl;
let server;

before(async () => {
  server = createAppServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test('根路径返回实验页面', async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(body, /CloudBase Release Lab/);
  assert.match(body, /触发测试错误/);
});

test('版本接口返回版本和请求标识', async () => {
  const response = await fetch(`${baseUrl}/api/version`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.version, 'v1');
  assert.equal(typeof body.requestId, 'string');
  assert.equal(response.headers.get('x-request-id'), body.requestId);
});

test('健康检查返回固定的非敏感字段', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();

  assert.deepEqual(Object.keys(body).sort(), ['ok', 'requestId', 'version']);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test('故障接口需要明确的实验标记', async () => {
  const response = await fetch(`${baseUrl}/api/test-error`, {
    method: 'POST'
  });

  assert.equal(response.status, 404);
});

test('带实验标记时返回可追踪的受控 500', async () => {
  const response = await fetch(`${baseUrl}/api/test-error`, {
    method: 'POST',
    headers: {
      'X-Lab-Action': 'intentional-error'
    }
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'Intentional test error');
  assert.equal(body.version, 'v1');
  assert.equal(response.headers.get('x-request-id'), body.requestId);
});
