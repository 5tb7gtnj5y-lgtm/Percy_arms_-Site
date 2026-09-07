import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  service: text("service").notNull(),
  mealDate: text("meal_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  meat: text("meat").notNull(),
  quantity: integer("quantity").notNull(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const communityEvents = sqliteTable("community_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  description: text("description").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderSettings = sqliteTable("order_settings", {
  id: integer("id").primaryKey(),
  adultMealPrice: integer("adult_meal_price").notNull().default(0),
  childMealPrice: integer("child_meal_price").notNull().default(0),
  orderEmail: text("order_email").notNull().default(""),
  orderingOpen: integer("ordering_open", { mode: "boolean" }).notNull().default(true),
  chickenAvailable: integer("chicken_available", { mode: "boolean" }).notNull().default(true),
  beefAvailable: integer("beef_available", { mode: "boolean" }).notNull().default(true),
  porkAvailable: integer("pork_available", { mode: "boolean" }).notNull().default(true),
  serviceMessage: text("service_message").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const menuExtras = sqliteTable("menu_extras", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pricePence: integer("price_pence").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  service: text("service").notNull(),
  mealDate: text("meal_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes").notNull().default(""),
  lineItems: text("line_items").notNull(),
  totalPence: integer("total_pence").notNull().default(0),
  orderEmail: text("order_email").notNull().default(""),
  emailStatus: text("email_status").notNull().default("pending"),
  status: text("status").notNull().default("new"),
  statusUpdatedAt: text("status_updated_at"),
  allergenAcknowledged: integer("allergen_acknowledged", { mode: "boolean" })
    .notNull()
    .default(false),
  seenAt: text("seen_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
