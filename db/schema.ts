import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  email: text("email").primaryKey(),
  userId: text("user_id"),
  role: text("role").notNull().default("student"),
  active: integer("active").notNull().default(1),
});
export const studies = sqliteTable("studies", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
});
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    hash: text("hash").notNull(),
    data: text("data").notNull(),
  },
  (t) => [index("files_user_hash").on(t.userId, t.hash)],
);
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    recipient: text("recipient").notNull(),
    data: text("data").notNull(),
  },
  (t) => [index("shares_recipient").on(t.recipient)],
);
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});
export const usage = sqliteTable(
  "usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    month: text("month").notNull(),
    created: text("created").notNull(),
    reserved: integer("reserved").notNull(),
    actual: integer("actual"),
    status: text("status").notNull(),
    model: text("model").notNull(),
    input: integer("input").notNull().default(0),
    output: integer("output").notNull().default(0),
  },
  (t) => [index("usage_month_user").on(t.month, t.userId)],
);
