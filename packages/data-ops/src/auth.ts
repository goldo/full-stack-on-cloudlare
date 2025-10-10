import {
  account,
  session,
  user,
  verification,
} from "@/drizzle-out/auth-schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db/database";

type Auth = ReturnType<typeof betterAuth>;

let auth: Auth;

export function createBetterAuth(
  database: NonNullable<Parameters<typeof betterAuth>[0]>["database"],
  google?: { clientId: string; clientSecret: string }
): Auth {
  return betterAuth({
    database,
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: google?.clientId ?? "",
        clientSecret: google?.clientSecret ?? "",
      },
    },
  });
}

export function getAuth(google: {
  clientId: string;
  clientSecret: string;
}): Auth {
  if (auth) return auth;

  auth = createBetterAuth(
    drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    google
  );
  return auth;
}
