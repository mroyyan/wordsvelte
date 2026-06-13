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
