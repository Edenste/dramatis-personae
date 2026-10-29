/**
 * `pnpm dev`: the server on the dev data folder, plus the web app with hot
 * reload. Vite proxies /api and /ws to the server, adding its token, and only
 * for requests from the dev page itself (devOriginAllowed).
 */
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, type ProxyOptions } from "vite";
import { startServer } from "@dramatis-personae/server";
import { devOriginAllowed } from "./dev-proxy.ts";

const HOST = "127.0.0.1";
const PORT = 5173;
const devOrigin = `http://${HOST}:${PORT}`;
const webDir = fileURLToPath(new URL("../apps/web", import.meta.url));

const server = await startServer({
  argv: ["--dev"],
  port: 0,
  host: HOST,
  version: "0.0.0-dev",
});

const allowed = (request: IncomingMessage) => devOriginAllowed(request.headers.origin, devOrigin);

function proxyTo(target: string, ws: boolean): ProxyOptions {
  return {
    target,
    ws,
    changeOrigin: true,
    bypass: (request) => (allowed(request) ? undefined : false),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyRequest) => {
        proxyRequest.setHeader("authorization", `Bearer ${server.token}`);
        proxyRequest.setHeader("origin", server.url);
      });
      proxy.on("proxyReqWs", (proxyRequest, request, socket) => {
        if (!allowed(request)) {
          socket.destroy();
          return;
        }
        proxyRequest.setHeader("authorization", `Bearer ${server.token}`);
        proxyRequest.setHeader("origin", server.url);
      });
    },
  };
}

const vite = await createServer({
  configFile: `${webDir}/vite.config.ts`,
  root: webDir,
  server: {
    host: HOST,
    port: PORT,
    strictPort: true,
    proxy: {
      "/api": proxyTo(server.url, false),
      "/ws": proxyTo(server.url.replace(/^http/, "ws"), true),
    },
  },
});
await vite.listen();
console.log(`Dramatis Personae (dev): ${devOrigin}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void Promise.all([vite.close(), server.close()]).then(() => process.exit(0));
  });
}
