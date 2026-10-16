INSERT OR IGNORE INTO `settings` (`key`, `value`) VALUES
	('site_name', 'WordSvelte'),
	('site_description', 'Just another WordSvelte site'),
	('timezone', 'Asia/Jakarta'),
	('date_format', 'd F Y'),
	('language', 'id'),
	('posts_per_page', '20'),
	('sticky_sidebar', 'false'),
	('search_engine_visible', 'true'),
	('comments_enabled', 'true'),
	('comments_auto_approve', 'false'),
	('comments_require_name_email', 'true'),
	('comments_close_after_days', '30'),
	('media_organize_by_month', 'true'),
	('theme', 'default');
--> statement-breakpoint
INSERT INTO `widgets` (`widget_type`, `title`, `sidebar_area`, `sort_order`, `status`) VALUES
	('popular_posts', 'Berita Populer', 'sidebar-1', 1, 'active'),
	('recent_posts', 'Berita Terbaru', 'sidebar-1', 2, 'active'),
	('categories', 'Kategori', 'sidebar-1', 3, 'active'),
	('tag_cloud', 'Tag', 'sidebar-1', 4, 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `menus` (`name`, `slug`, `location`, `status`) VALUES ('Main Menu', 'main-menu', 'header', 'active');
--> statement-breakpoint
INSERT INTO `menu_items` (`menu_id`, `item_type`, `label`, `url`, `sort_order`, `status`)
	SELECT `id`, 'custom', 'Beranda', '/', 1, 'active' FROM `menus` WHERE `slug` = 'main-menu';
