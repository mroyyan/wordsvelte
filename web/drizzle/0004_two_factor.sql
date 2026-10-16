CREATE TABLE `recovery_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_codes_user` ON `recovery_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factor_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_2fa_codes_user_purpose` ON `two_factor_codes` (`user_id`,`purpose`);--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_last_step` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `email_2fa_enabled` integer DEFAULT false NOT NULL;