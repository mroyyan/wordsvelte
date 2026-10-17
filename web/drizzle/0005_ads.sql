CREATE TABLE `ads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`placement` text NOT NULL,
	`type` text DEFAULT 'banner' NOT NULL,
	`image_url` text,
	`link_url` text,
	`alt_text` text,
	`code` text,
	`devices` text DEFAULT 'all' NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ads_placement_status` ON `ads` (`placement`,`status`);