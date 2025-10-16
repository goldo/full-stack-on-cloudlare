import { createBetterAuth } from "@/auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth: ReturnType<typeof createBetterAuth> = createBetterAuth(
  drizzleAdapter(
    {},
    {
      provider: "sqlite",
    }
  ),
  ""
);
