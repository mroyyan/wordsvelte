import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '$lib/server/core/sanitize'

const EXECUTABLE = /<script|<iframe|<object|<embed|<svg|<math|<style|<link|<meta|<base|<form|<input|<button|<textarea|\son\w+\s*=|javascript:|vbscript:|data:text|expression\(|<!--/i

describe('sanitizeHtml: vectors that must never survive', () => {
  it.each([
    ['plain script', '<script>alert(1)</script>'],
    ['script with attributes', '<script src="https://evil.example/x.js"></script>'],
    ['uppercase / mixed case', '<ScRiPt>alert(1)</sCrIpT>'],
    ['nested to evade single-pass stripping', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['unclosed script', '<script>alert(1)'],
    ['onerror on img', '<img src=x onerror=alert(1)>'],
    ['onerror with quotes and spaces', '<img src="x" onerror = "alert(1)">'],
    ['onload on svg', '<svg onload=alert(1)>'],
    ['onclick on p', '<p onclick="alert(1)">x</p>'],
    ['onmouseover on a', '<a href="/" onmouseover="alert(1)">x</a>'],
    ['onfocus autofocus', '<input autofocus onfocus=alert(1)>'],
    ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['javascript: with whitespace/newline', '<a href="java\nscript:alert(1)">x</a>'],
    ['javascript: with tab', '<a href="jav&#x09;ascript:alert(1)">x</a>'],
    ['javascript: entity-encoded', '<a href="&#106;avascript:alert(1)">x</a>'],
    ['javascript: mixed case', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['javascript: leading space', '<a href=" javascript:alert(1)">x</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">x</a>'],
    ['data: html href', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
    ['data: image src', '<img src="data:text/html,<script>alert(1)</script>">'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['object/embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['svg with script', '<svg><script>alert(1)</script></svg>'],
    ['math', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>'],
    ['style tag', '<style>body{display:none}</style>'],
    ['style import', '<style>@import url(https://evil.example/x.css);</style>'],
    ['link stylesheet', '<link rel="stylesheet" href="https://evil.example/x.css">'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['base hijack', '<base href="https://evil.example/">'],
    ['form + formaction', '<form action="https://evil.example"><button formaction="javascript:alert(1)">go</button></form>'],
    ['input/textarea phishing', '<input name="password"><textarea>x</textarea>'],
    ['html comment tricks', '<!--><script>alert(1)</script>-->'],
    ['style attr expression', '<p style="width:expression(alert(1))">x</p>'],
    ['style attr url()', '<p style="background:url(javascript:alert(1))">x</p>'],
    ['style attr position overlay', '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white">x</div>'],
    ['body onload', '<body onload=alert(1)>'],
    ['srcset js', '<img srcset="javascript:alert(1) 1x">'],
    ['video/audio onerror', '<video><source onerror=alert(1)></video><audio src=x onerror=alert(1)>'],
    ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
    ['img with backtick attr', '<img src=`x` onerror=alert(1)>'],
    ['null bytes', '<scr\0ipt>alert(1)</scr\0ipt>'],
    ['protocol-relative script host', '<a href="//evil.example/x">x</a><img src="//evil.example/x.png">'],
  ])('%s', (_name, dirty) => {
    const out = sanitizeHtml(dirty)
    expect(out).not.toMatch(EXECUTABLE)
    // any call to alert()/msgbox() left inside a tag (attribute) would be executable
    expect(out).not.toMatch(/<[^>]*(?:alert\(|msgbox)/i)
    expect(out).not.toMatch(/position\s*:\s*fixed|\/\/evil\.example/i)
  })

  it('cannot be re-opened: sanitising the output again is a no-op (idempotent)', () => {
    const dirty = '<p>a</p><img src=x onerror=alert(1)><a href="javascript:1">l</a><script>1</script><b>b</b>'
    const once = sanitizeHtml(dirty)
    expect(sanitizeHtml(once)).toBe(once)
  })

  it('handles non-string / empty input without throwing', () => {
    expect(sanitizeHtml(undefined)).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(12345 as any)).toBe('12345')
  })
})

describe('sanitizeHtml: legitimate article content survives', () => {
  it('keeps common formatting', () => {
    const html = '<h2>Title</h2><p>Some <strong>bold</strong>, <em>italic</em> and <u>underlined</u> text.</p><ul><li>one</li><li>two</li></ul><ol start="3"><li>x</li></ol><blockquote>quote</blockquote><pre><code>code()</code></pre><hr><br>'
    const out = sanitizeHtml(html)
    for (const frag of ['<h2>Title</h2>', '<strong>bold</strong>', '<em>italic</em>', '<u>underlined</u>', '<ul>', '<li>one</li>', '<ol start="3">', '<blockquote>quote</blockquote>', '<pre><code>code()</code></pre>']) {
      expect(out).toContain(frag)
    }
  })

  it('keeps safe links and adds rel to target=_blank links', () => {
    const out = sanitizeHtml('<a href="https://example.com/a?b=1&c=2" target="_blank" title="t">x</a><a href="/relative">r</a><a href="mailto:a@b.co">m</a><a href="tel:+62123">t</a>')
    expect(out).toContain('href="https://example.com/a?b=1&amp;c=2"')
    expect(out).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/)
    expect(out).toContain('href="/relative"')
    expect(out).toContain('href="mailto:a@b.co"')
    expect(out).toContain('href="tel:+62123"')
  })

  it('keeps images (http/https/relative) with alt text, drops data: URLs', () => {
    const out = sanitizeHtml('<img src="https://cdn.example.com/a.jpg" alt="A"><img src="/api/media/2024/01/x.png" alt="B" width="100"><img src="data:image/png;base64,AAAA">')
    expect(out).toContain('src="https://cdn.example.com/a.jpg"')
    expect(out).toContain('alt="A"')
    expect(out).toContain('src="/api/media/2024/01/x.png"')
    expect(out).not.toContain('data:')
  })

  it('keeps CKEditor image/table structure and harmless sizing', () => {
    const html = '<figure class="image image_resized" style="width:50%;"><img src="/api/media/a.png" alt="a"><figcaption>cap</figcaption></figure>' +
      '<figure class="table"><table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></figure>' +
      '<p class="text-align-center" style="text-align:center;">c</p>'
    const out = sanitizeHtml(html)
    expect(out).toContain('class="image image_resized"')
    expect(out).toContain('width:50%')
    expect(out).toContain('<figcaption>cap</figcaption>')
    expect(out).toContain('<th colspan="2">h</th>')
    expect(out).toContain('<td>1</td>')
    expect(out).toContain('text-align:center')
  })

  it('strips arbitrary classes (no Tailwind overlay tricks) but keeps editor classes', () => {
    const out = sanitizeHtml('<p class="fixed inset-0 z-50 bg-white text-align-center">x</p>')
    expect(out).not.toMatch(/fixed|inset-0|z-50|bg-white/)
    expect(out).toContain('text-align-center')
  })

  it('keeps unicode and escapes text-level special characters', () => {
    const out = sanitizeHtml('<p>Berita 日本語 émoji 🎉 & 1 < 2</p>')
    expect(out).toContain('日本語')
    expect(out).toContain('🎉')
    expect(out).toContain('&amp;')
    expect(out).toContain('&lt;')
  })

  it('discards the BODY of script/style, not just the tags', () => {
    const out = sanitizeHtml('<p>keep</p><script>var secret = 1</script><style>.x{color:red}</style>')
    expect(out).toBe('<p>keep</p>')
  })
})
