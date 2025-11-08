import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please create a .env.local file."
  );
}

let connectionString = process.env.DATABASE_URL;

// Check if connection string already has sslmode parameter
const hasSslMode = connectionString.includes("sslmode=");
const isProduction = process.env.NODE_ENV === "production";

// Configure SSL based on connection string
let sslConfig: boolean | "require" | { rejectUnauthorized: boolean } | undefined;

if (hasSslMode) {
  // Extract sslmode from connection string
  const sslModeMatch = connectionString.match(/sslmode=([^&]+)/);
  const sslMode = sslModeMatch ? sslModeMatch[1] : "prefer";
  
  // If sslmode is disable, don't use SSL
  if (sslMode === "disable") {
    sslConfig = false;
  } else if (sslMode === "require") {
    sslConfig = "require";
  } else {
    // For prefer, allow, or other modes, let postgres handle it
    sslConfig = undefined;
  }
} else {
  // No sslmode in connection string
  if (isProduction) {
    // Production defaults to require SSL
    sslConfig = "require";
  } else {
    // Local development - try to connect without SSL first
    // If it fails, user can add ?sslmode=disable to connection string
    sslConfig = false;
  }
}

const client = postgres(connectionString, {
  max: 1,
  ...(sslConfig !== undefined && { ssl: sslConfig }),
});

export const db = drizzle(client, { schema });

export * from "./schema";
export {
  users,
  sessions,
  accounts,
  verifications,
  orgMemberships,
} from "./schema";
