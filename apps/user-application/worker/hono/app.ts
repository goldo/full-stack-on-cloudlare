import { createContext } from "@/worker/trpc/context";
import { appRouter } from "@/worker/trpc/router";
import { getAuth } from "@repo/data-ops/auth";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

export type AppContext = {
  Bindings: Env;
  Variables: {
    userId: string;
  };
};

export const App = new Hono<AppContext>();

const getAuthInstance = (env: Env) => {
  return getAuth({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  });
};

const authMiddleware = createMiddleware(async (c, next) => {
  const auth = getAuthInstance(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", session.user.id);
  await next();
});

App.all("/trpc/*", authMiddleware, (c) => {
  const userId = c.get("userId");
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createContext({
        req: c.req.raw,
        env: c.env,
        workerCtx: c.executionCtx,
        userId,
      }),
  });
});

App.get("/click-socket", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const headers = new Headers(c.req.raw.headers);
  headers.set("account-id", userId);
  const proxiedRequest = new Request(c.req.raw, { headers });
  return c.env.BACKEND_SERVICE.fetch(proxiedRequest);
});

App.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = getAuthInstance(c.env);
  return auth.handler(c.req.raw);
});
