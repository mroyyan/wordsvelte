# Theme Development Guide


Create a `.zip` file with this structure:

```
my-theme.zip
├── manifest.json        # Required — theme metadata
├── templates/
│   ├── layout.hbs       # Required — page shell (header, footer, nav)
│   ├── index.hbs        # Required — homepage content
│   ├── single.hbs       # Optional — single post page
│   └── archive.hbs      # Optional — category/tag archive
└── assets/
    └── style.css        # Optional — injected as <style> tag
```

---

## manifest.json

```json
{
  "name": "My Theme",
  "slug": "my-theme",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A brief description of your theme",
  "layouts": ["single", "archive"],
  "supports": ["widgets", "menus"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name |
| `slug` | Yes | Unique ID, used for folder name. Auto-generated from zip filename if missing |
| `version` | No | Shown in admin |
| `author` | No | Shown in admin |
| `description` | No | Shown in admin card |
| `layouts` | No | List of supported page templates |
| `supports` | No | Features used (just informational) |

---

## template.hbs — Page Shell

Wraps every page. Contains `{{{body}}}` where page content is injected.

**Available variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `site_name` | string | From settings |
| `meta_description` | string | Default meta description |
| `settings` | object | All settings key-value pairs |
| `today` | string | Formatted date (id-ID locale) |
| `current_year` | number | 2026 etc |
| `header_menu_items` | array | Menu tree for navigation (each item has `label`, `url`, `children`) |
| `sidebar_widgets` | array | Active widgets in sidebar-1 area |
| `categories` | array | All categories |
| `tags` | array | All tags |
| `posts` | array | List of posts |
| `post` | object/null | Single post (for single.hbs) |
| `query` | string | Search query |
| `results` | array | Search results |
| `body` | string | **Rendered page content — place this in layout** |

### Menu item structure

```json
{
  "label": "Beranda",
  "url": "/",
  "children": [
    { "label": "Sub Item", "url": "/sub" }
  ]
}
```

---

## index.hbs — Homepage

Rendered content goes inside `{{{body}}}` in layout.

---

## Custom Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `eq` | `{{#if (eq a b)}}` | Strict equality check |
| `add` | `{{add index 1}}` | Addition (for 1-based numbering) |
| `slice` | `{{#each (slice arr start end)}}` | Array slice |
| `sortByViewCount` | `{{#each (sortByViewCount posts 5)}}` | Sort posts by views, limit N |
| `sortByDate` | `{{#each (sortByDate posts 5)}}` | Sort posts by published date, limit N |
| `truncate` | `{{truncate str 150}}` | Truncate string with ellipsis |
| `formatDate` | `{{formatDate dateString}}` | Format to Indonesian locale |

---

## Example: Minimal index.hbs

```hbs
{{#if posts.length}}
  <div class="grid lg:grid-cols-3 gap-8">
    <div class="lg:col-span-2">
      {{#each posts}}
        <article>
          <h2><a href="/{{slug}}">{{title}}</a></h2>
          <p>{{excerpt}}</p>
        </article>
      {{/each}}
    </div>
    <aside>
      {{#each sidebar_widgets}}
        {{#if (eq widgetType "html")}}{{{content}}}{{/if}}
      {{/each}}
    </aside>
  </div>
{{/if}}
```

---

## Zip & Upload

1. Structure files as shown above
2. Zip them (select files, not parent folder, unless zip contains a root folder — both handled)
3. Upload via **Admin → Appearance → Themes → Upload Theme**

Upload validates:
- Must contain `manifest.json` in zip root
- Must contain `templates/layout.hbs`
- Theme slug must not already exist
- Only `.zip` files accepted
