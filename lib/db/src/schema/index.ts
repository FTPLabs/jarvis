import { pgTable, text, serial, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memoryEntriesTable = pgTable("memory_entries", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  category: text("category").notNull().default("note"),
  tags: text("tags").notNull().default("[]"),
  importance: integer("importance").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMemoryEntrySchema = createInsertSchema(memoryEntriesTable).omit({ id: true, createdAt: true });
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type MemoryEntry = typeof memoryEntriesTable.$inferSelect;

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, completedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("command"),
  message: text("message").notNull(),
  detail: text("detail"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export type ActivityEntry = typeof activityLogTable.$inferSelect;

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appsTable = pgTable("apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  icon: text("icon"),
  category: text("category").notNull().default("general"),
  voiceAliases: text("voice_aliases").notNull().default("[]"),
});

export type AppEntry = typeof appsTable.$inferSelect;

export const licenseTable = pgTable("license", {
  id: serial("id").primaryKey(),
  hwid: text("hwid").notNull(),
  licenseKey: text("license_key"),
  licenseType: text("license_type"),
  email: text("email"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
});

export type License = typeof licenseTable.$inferSelect;
