-- Standalone Cloudflare recovery: create any missing core ordering tables.
-- Existing tables, orders and settings are preserved. Matches db/schema.ts.
-- This cannot upgrade a partially migrated table: inspect that table before
-- applying its missing ALTER statements. No runtime schema changes are used.
-- This console repair is not a historical Drizzle migration. Reconcile the
-- migration ledger before enabling automatic migrations on this database.

CREATE TABLE IF NOT EXISTS order_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  adult_meal_price INTEGER NOT NULL DEFAULT 0,
  child_meal_price INTEGER NOT NULL DEFAULT 0,
  order_email TEXT NOT NULL DEFAULT '',
  ordering_open INTEGER NOT NULL DEFAULT 1,
  chicken_available INTEGER NOT NULL DEFAULT 1,
  beef_available INTEGER NOT NULL DEFAULT 1,
  pork_available INTEGER NOT NULL DEFAULT 1,
  service_message TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_extras (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  price_pence INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  reference TEXT NOT NULL,
  service TEXT NOT NULL,
  meal_date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  line_items TEXT NOT NULL,
  total_pence INTEGER NOT NULL DEFAULT 0,
  order_email TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'new',
  status_updated_at TEXT,
  allergen_acknowledged INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_unique ON orders(reference);

SELECT name FROM sqlite_master
WHERE type = 'table' AND name IN ('order_settings', 'menu_extras', 'orders')
ORDER BY name;
