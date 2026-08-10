"use strict";

// CloudBase HTTP 云函数启动器：平台将请求转到 PORT，业务仍由 index.main 统一处理。
const http = require("node:http");
const { main } = require("./index");

const server = http.createServer(async (request, response) => {
  const parts = [];
  for await (const part of request) parts.push(part);
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const event = {
    httpMethod: request.method || "GET",
    path: url.pathname,
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    headers: request.headers,
    body: Buffer.concat(parts).toString("utf8"),
    isBase64Encoded: false,
    requestContext: { http: { method: request.method || "GET", path: url.pathname } },
  };
  const result = await main(event);
  response.writeHead(result.statusCode || 200, result.headers || {});
  response.end(result.body || "");
});

server.listen(Number(process.env.PORT || 9000), "0.0.0.0");
