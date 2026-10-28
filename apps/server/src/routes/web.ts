import fastifyStatic from "@fastify/static";
import type { App } from "../context.ts";

const PLACEHOLDER = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Dramatis Personae</title></head>
<body style="font-family: system-ui, sans-serif; margin: 3rem;">
<h1>Dramatis Personae</h1>
<p>The server is running. This copy doesn't include the app's pages yet.</p>
</body>
</html>
`;

/** The built web app, or a placeholder page when there is none. */
export async function webRoutes(app: App, webRoot: string | undefined): Promise<void> {
  if (webRoot) {
    await app.register(fastifyStatic, { root: webRoot, wildcard: false });
  } else {
    app.get("/", { schema: { hide: true } }, (_request, reply) =>
      reply.type("text/html; charset=utf-8").send(PLACEHOLDER),
    );
  }
}
