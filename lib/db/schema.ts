import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
  pgEnum,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member"]);
export const assistantStatusEnum = pgEnum("assistant_status", [
  "active",
  "inactive",
  "archived",
]);
export const logLevelEnum = pgEnum("log_level", [
  "info",
  "warning",
  "error",
  "debug",
]);

export const orgs = pgTable(
  "orgs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("orgs_slug_idx").on(table.slug),
  })
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgMemberships = pgTable(
  "org_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    orgId: uuid("org_id")
      .references(() => orgs.id, { onDelete: "cascade" })
      .notNull(),
    role: userRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("org_memberships_user_id_idx").on(table.userId),
    orgIdIdx: index("org_memberships_org_id_idx").on(table.orgId),
    userOrgIdx: index("org_memberships_user_org_idx").on(
      table.userId,
      table.orgId
    ),
  })
);

export const assistants = pgTable(
  "assistants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    systemPrompt: text("system_prompt"),
    status: assistantStatusEnum("status").default("active").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    createdBy: text("created_by")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("assistants_org_id_idx").on(table.orgId),
    statusIdx: index("assistants_status_idx").on(table.status),
  })
);

export const kb = pgTable(
  "kb",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    content: text("content"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdBy: text("created_by")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("kb_org_id_idx").on(table.orgId),
  })
);

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdBy: text("created_by")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("tools_org_id_idx").on(table.orgId),
    typeIdx: index("tools_type_idx").on(table.type),
  })
);

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id, { onDelete: "cascade" })
      .notNull(),
    assistantId: uuid("assistant_id").references(() => assistants.id, {
      onDelete: "set null",
    }),
    level: logLevelEnum("level").default("info").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("logs_org_id_idx").on(table.orgId),
    assistantIdIdx: index("logs_assistant_id_idx").on(table.assistantId),
    createdAtIdx: index("logs_created_at_idx").on(table.createdAt),
    levelIdx: index("logs_level_idx").on(table.level),
  })
);

export const orgsRelations = relations(orgs, ({ many }) => ({
  memberships: many(orgMemberships),
  assistants: many(assistants),
  kb: many(kb),
  tools: many(tools),
  logs: many(logs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  memberships: many(orgMemberships),
  createdAssistants: many(assistants),
  createdKb: many(kb),
  createdTools: many(tools),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, {
    fields: [orgMemberships.userId],
    references: [users.id],
  }),
  org: one(orgs, {
    fields: [orgMemberships.orgId],
    references: [orgs.id],
  }),
}));

export const assistantsRelations = relations(assistants, ({ one, many }) => ({
  org: one(orgs, {
    fields: [assistants.orgId],
    references: [orgs.id],
  }),
  creator: one(users, {
    fields: [assistants.createdBy],
    references: [users.id],
  }),
  logs: many(logs),
}));

export const kbRelations = relations(kb, ({ one }) => ({
  org: one(orgs, {
    fields: [kb.orgId],
    references: [orgs.id],
  }),
  creator: one(users, {
    fields: [kb.createdBy],
    references: [users.id],
  }),
}));

export const toolsRelations = relations(tools, ({ one }) => ({
  org: one(orgs, {
    fields: [tools.orgId],
    references: [orgs.id],
  }),
  creator: one(users, {
    fields: [tools.createdBy],
    references: [users.id],
  }),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  org: one(orgs, {
    fields: [logs.orgId],
    references: [orgs.id],
  }),
  assistant: one(assistants, {
    fields: [logs.assistantId],
    references: [assistants.id],
  }),
}));
