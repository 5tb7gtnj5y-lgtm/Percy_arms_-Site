CREATE TABLE `menu_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_pence` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`adult_meal_price` integer DEFAULT 0 NOT NULL,
	`child_meal_price` integer DEFAULT 0 NOT NULL,
	`order_email` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`service` text NOT NULL,
	`meal_date` text NOT NULL,
	`time_slot` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`line_items` text NOT NULL,
	`total_pence` integer DEFAULT 0 NOT NULL,
	`order_email` text DEFAULT '' NOT NULL,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_reference_unique` ON `orders` (`reference`);