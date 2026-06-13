INSERT OR IGNORE INTO users (email, username, password_hash, display_name, role) VALUES ('admin@kubus.id', 'admin', '07bc706237efe27969d0112d741fc71e:4ec4a3fdd5d6ce98694d480b98a270e0a2bc11e6cb5bc97ee5daa79c504c5f4e', 'Admin', 'admin');

-- General
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Kubus News');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_description', 'Portal Berita Terkini');
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_email', 'admin@kubus.id');
INSERT OR IGNORE INTO settings (key, value) VALUES ('timezone', 'Asia/Jakarta');
INSERT OR IGNORE INTO settings (key, value) VALUES ('date_format', 'd F Y');
INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'id');

-- Reading / Content
INSERT OR IGNORE INTO settings (key, value) VALUES ('posts_per_page', '20');
INSERT OR IGNORE INTO settings (key, value) VALUES ('search_engine_visible', 'true');

-- Discussion / Comments
INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_auto_approve', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_require_name_email', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_close_after_days', '30');

-- Media
INSERT OR IGNORE INTO settings (key, value) VALUES ('media_organize_by_month', 'true');

-- Social
INSERT OR IGNORE INTO settings (key, value) VALUES ('social_facebook', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('social_twitter', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('social_instagram', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('social_youtube', '');

-- SEO
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_meta_description', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_og_image', '');

-- Default Widgets
INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('popular_posts', 'Berita Populer', 'sidebar-1', 1, 'active');
INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('recent_posts', 'Berita Terbaru', 'sidebar-1', 2, 'active');
INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('categories', 'Kategori', 'sidebar-1', 3, 'active');
INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('tag_cloud', 'Tag', 'sidebar-1', 4, 'active');

-- Default Header Menu
INSERT OR IGNORE INTO menus (name, slug, location, status) VALUES ('Main Menu', 'main-menu', 'header', 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Beranda', '/', 1, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Regional', '#', 2, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 2, 'custom', 'Kediri Raya', '/kategori/kediri-raya', 1, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 2, 'custom', 'Jawa Timur', '/kategori/jawa-timur', 2, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Nasional', '/kategori/nasional', 3, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Dunia', '/kategori/dunia', 4, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Olah Raga', '/kategori/olahraga', 5, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Gaya Hidup', '/kategori/gaya-hidup', 6, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Religi', '/kategori/religi', 7, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Lainnya', '#', 8, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Event', '/kategori/event', 1, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Hiburan', '/kategori/hiburan', 2, 'active');
INSERT OR IGNORE INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Opini', '/kategori/opini', 3, 'active');
