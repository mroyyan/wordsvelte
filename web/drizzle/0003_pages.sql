CREATE TABLE `pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`published_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_pages_status` ON `pages` (`status`);--> statement-breakpoint
ALTER TABLE `menu_items` ADD `page_id` integer REFERENCES pages(id) ON DELETE set null;