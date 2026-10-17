CREATE TABLE `post_views` (
	`post_id` integer NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`post_id`, `day`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_post_views_day` ON `post_views` (`day`);