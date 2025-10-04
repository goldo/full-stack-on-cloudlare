import { App } from "@/worker/hono/app";
import { initDatabase } from "@repo/data-ops/database";

export default {
  fetch(request, env, ctx) {
    initDatabase(env.DB);
    return App.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<ServiceBindings>;
