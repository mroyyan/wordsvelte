/** A message is a string, or `{ one, other }` for counts (the number is passed as `n`). `{name}` placeholders are filled from the parameters. */
export type Message = string | { one: string; other: string }

export const en = {
  // shared
  'common.home': 'Home',
  'common.search': 'Search',
  'common.openMenu': 'Open menu',
  'common.closeMenu': 'Close menu',
  'common.clear': 'Clear',
  'common.advertisement': 'Advertisement',
  'common.menuNavigation': 'Navigation menu',
  'common.mainMenu': 'Main menu',
  'pager.previous': 'Previous',
  'pager.next': 'Next',
  'date.justNow': 'Just now',
  'seo.pageNumber': 'Page {n}',

  // home
  'home.featuredAria': 'Featured stories',
  'home.latest': 'Latest news',
  'home.views': '{n} views',
  'home.noWidgets': 'No widgets configured. Add widgets in the admin under Appearance, then Widgets.',

  // single article / static page
  'post.author': 'Author:',
  'post.topics': 'Topics',
  'post.related': 'Related articles',
  'post.comments': { one: '{n} comment', other: '{n} comments' },
  'post.noComments': 'No comments yet. Be the first!',
  'post.reply': 'Reply',
  'post.replyingTo': 'Replying to {name}',
  'post.cancelReply': 'Cancel reply',
  'post.leaveComment': 'Leave a comment',
  'post.commentPlaceholder': 'Write your comment here...',
  'post.nameRequired': 'Full name *',
  'post.nameOptional': 'Full name (optional)',
  'post.emailRequired': 'Email address *',
  'post.emailOptional': 'Email address (optional)',
  'post.remember': 'Save my name and email for my next comment.',
  'post.sending': 'Sending...',
  'post.submitComment': 'Post comment',
  'post.commentSent': 'Your comment was sent!',
  'post.commentFailed': 'Could not send',
  'post.copy': 'Copy',
  'post.copied': 'Copied!',

  // category and tag pages
  'archive.titleCategory': '{name} news',
  'archive.descriptionCategory': 'The latest news about {name}.',
  'archive.titleTag': 'News about {name}',
  'archive.descriptionTag': 'The latest news tagged {name}.',
  'archive.tag': 'Tag: {name}',
  'archive.count': { one: '{n} article', other: '{n} articles' },
  'archive.emptyCategory': 'There are no articles in this category.',
  'archive.emptyTag': 'There are no articles for this tag.',
  'archive.sortLatest': 'Latest',
  'archive.sortPopular': 'Most popular',
  'archive.sortRandom': 'Random',
  'archive.popular': 'Popular news',

  // search page and dialog
  'search.title': 'Search',
  'search.titleQuery': 'Search: {q}',
  'search.placeholder': 'Search articles...',
  'search.button': 'Search',
  'search.resultsFor': 'Results for "{q}" ({n} found)',
  'search.none': 'There are no results for this search.',
  'search.dialogTitle': 'Search articles',
  'search.minChars': 'Type at least {n} characters to search the news.',
  'search.failed': 'The search failed. Try again in a moment.',
  'search.noResults': 'No results for “{q}”.',
  'search.resultsAria': 'Search results',
  'search.viewAll': 'See all {n} results for “{q}”',

  // error page
  'error.notFoundTitle': 'Page not found',
  'error.generalTitle': 'Something went wrong',
  'error.notFoundText': 'The address you opened does not exist, or the page has moved.',
  'error.generalText': 'Sorry, something went wrong on our side. Please try again in a moment.',
  'error.backHome': 'Back to the home page',
  'error.searchNews': 'Search the news',
} as const satisfies Record<string, Message>

export type MessageKey = keyof typeof en
