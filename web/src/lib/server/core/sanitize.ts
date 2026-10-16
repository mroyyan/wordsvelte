import sanitize from 'sanitize-html'

// Pure-JS allow-list sanitizer (no DOM), so it runs identically in Node, tests and Cloudflare Workers.
const OPTIONS: sanitize.IOptions = {
  allowedTags: [...sanitize.defaults.allowedTags, 'img', 'del', 'ins'],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    ol: ['start', 'type'],
    '*': ['class', 'style', 'lang', 'dir'],
  },
  // Utility classes (e.g. Tailwind `fixed inset-0`) could overlay the page, so only editor-generated classes survive.
  allowedClasses: {
    '*': ['text-align-*', 'image', 'image_resized', 'image-style-*', 'table', 'media'],
  },
  allowedStyles: {
    '*': {
      width: [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
      height: [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
      'text-align': [/^(?:left|right|center|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // <script>/<style>/<textarea> contents are discarded entirely (sanitize-html default nonTextTags).
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.target) attribs.rel = 'noopener noreferrer'
      return { tagName, attribs }
    },
  },
}

/** Strip scripts, event handlers, dangerous URLs, styles-as-tags, iframes, forms and svg from user/editor supplied HTML. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitize(String(html), OPTIONS)
}
