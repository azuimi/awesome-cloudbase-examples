# CloudBase 云托管 Node.js 发布实验

参考文档：https://docs.cloudbase.net/run/quick-start/dockerize-node

## 功能

- `/`：前端实验页面，与 API 使用同一个云托管版本和域名
- `/api/version`：返回当前版本、时间和请求标识
- `/healthz`：返回固定的健康检查结果
- `/api/test-error`：仅在带实验标记的 POST 请求下返回可追踪的 500
- `/myip`：查询服务的公网出口信息

服务默认版本为 `v1`，可以通过 `APP_VERSION` 环境变量覆盖。所有接口仅返回明确允许的字段，不会回显请求头或运行环境变量。

## 本地运行

```sh
PORT=8080 npm start
```

访问 http://127.0.0.1:8080/。

## 测试

```sh
npm test
```

## 手工部署

在此目录下运行：

```sh
tcb cloudrun deploy --service-name example-node --port 80 --env-id your-env-id
```
