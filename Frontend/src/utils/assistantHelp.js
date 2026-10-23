// Deterministic assistant help, derived from the same articles the Help page
// renders. Keyless mode never invents product facts, never claims to have read
// the user's data, and only offers destinations that exist in the app.
import { helpArticles } from '../content/helpArticles'

// The assistant may only navigate to these authenticated destinations. The
// server enforces the same allowlist for any route it returns.
export const ASSISTANT_ROUTES = [
  '/main-page',
  '/main-page/notifications',
  '/main-page/profile',
  '/workspaces/projects',
  '/workspaces/members',
  '/workspaces/settings',
  '/workspaces/settings/profile',
  '/templates',
  '/inbox',
  '/planner',
  '/help'
]

export const helpModeNotice = 'AI answers are not configured, so these are Kanvora\'s built-in help steps.'

export const suggestedQuestions = [
  'How do I create a workspace?',
  'How do I invite a teammate?',
  'How do I add a list or a card?',
  'How do roles and permissions work?',
  'Where do I change my profile?',
  'What are templates?'
]

// Topics the Help page does not have a dedicated article for. These steps come
// from the verified profile screen and are kept to the same shape as an article
// so matching and formatting stay in one place.
const supplementalArticles = [
  {
    id: 'profile',
    keywords: ['profile', 'account', 'username', 'bio', 'password', 'settings'],
    title: 'Change your profile',
    summary: 'Your profile holds your name, username, bio and password.',
    steps: [
      'Open Settings from the sidebar and choose Profile.',
      'Choose Edit to change your name, username or bio, then save.',
      'Choose Change password to set a new password.'
    ],
    note: 'Your email address is managed by your account and cannot be changed from this profile.',
    routes: [{ label: 'Open profile', to: '/workspaces/settings/profile' }]
  }
]

const articles = [...helpArticles, ...supplementalArticles]

const AI_ONLY = [
  /summari[sz]e .*(project|board)/,
  /(which|what) (tasks|cards) (are )?due/,
  /how many (tasks|cards)/,
  /what.*(is|are) (due|overdue)/
]

const normalise = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const allowedRoutes = (routes = []) => routes.filter((route) => ASSISTANT_ROUTES.includes(route.to))

export const formatArticle = (article) => {
  const steps = article.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  const note = article.note ? `\n\nNote: ${article.note}` : ''
  return `${article.summary}\n\n${steps}${note}`
}

// One point per keyword hit, two for a title word: the specific article wins
// over a broad one. A question with no hit at all is answered honestly instead
// of being mapped to a random article.
export const matchHelpArticle = (question) => {
  const text = normalise(question)
  if (!text) return null
  let best = null
  for (const article of articles) {
    const keywordScore = (article.keywords || []).reduce(
      (total, keyword) => (text.includes(normalise(keyword)) ? total + 1 : total), 0
    )
    const titleScore = normalise(article.title).split(' ').reduce(
      (total, word) => (word.length > 3 && text.includes(word) ? total + 2 : total), 0
    )
    const score = keywordScore + titleScore
    if (score > 0 && (!best || score > best.score)) best = { article, score }
  }
  // A single generic hit (for example "card") is not enough to answer as if the
  // question were understood.
  return best && best.score >= 2 ? best.article : null
}

export const fallbackReply = 'I can explain how Kanvora works: workspaces, members and roles, boards, lists and cards, notifications, templates, attachments, account security and settings. Ask about one of those, or open Help for the full articles.'

export const answerQuestion = (question) => {
  const text = normalise(question)
  if (!text) {
    return { reply: `Ask me how to use Kanvora.\n\n${helpModeNotice}`, routes: [] }
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text)) {
    return {
      reply: `Hello. I can explain Kanvora workflows such as creating a workspace, inviting teammates, boards and cards, roles, notifications and templates.\n\n${helpModeNotice}`,
      routes: []
    }
  }
  if (/what can you do|who are you|what are you/.test(text)) {
    return {
      reply: `I am the Kanvora Assistant. I explain how the product works and where to find things. I am read-only: I cannot create, edit, delete, move or invite anything.\n\n${helpModeNotice}`,
      routes: ['/help']
    }
  }
  if (AI_ONLY.some((pattern) => pattern.test(text))) {
    // Never fabricate a summary or a due-date list without the provider.
    return {
      reply: 'A project summary or a due-date list needs AI answers to be configured, because it would have to read your authorised project data. I will not guess at project contents. You can see due dates on a board or in Planner.',
      routes: ['/planner', '/workspaces/projects']
    }
  }
  const article = matchHelpArticle(text)
  if (!article) {
    return { reply: `${fallbackReply}\n\n${helpModeNotice}`, routes: ['/help'] }
  }
  return {
    reply: `${formatArticle(article)}\n\n${helpModeNotice}`,
    routes: allowedRoutes(article.routes)
  }
}
