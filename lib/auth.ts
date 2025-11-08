import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, accounts, verifications } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
