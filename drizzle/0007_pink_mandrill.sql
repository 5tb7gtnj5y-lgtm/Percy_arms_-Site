CREATE TABLE IF NOT EXISTS `menu_specials` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
