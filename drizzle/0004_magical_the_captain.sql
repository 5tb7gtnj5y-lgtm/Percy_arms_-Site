ALTER TABLE `order_settings` ADD `ordering_open` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `order_settings` ADD `service_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `status_updated_at` text;