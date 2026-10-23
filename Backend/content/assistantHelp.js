// Kanvora Assistant help content for the server-side fallback.
//
// The in-app help mode uses the richer article set in the frontend. This map
// exists so an API consumer without a Gemini key still receives an accurate,
// pre-approved answer instead of an error or an invented one. Every entry is a
// short version of a verified workflow from the product help.
export const helpModeNotice = 'AI answers are not configured on this server. This is the built-in Kanvora help.'

export const suggestedQuestions = [
  'How do I create a workspace?',
  'How do I invite a teammate?',
  'How do I add a list or a card?',
  'How do roles and permissions work?',
  'Where do I change my profile?',
  'What are templates?'
]

export const helpTopics = [
  {
    id: 'workspace',
    keywords: ['workspace', 'create', 'switch', 'team', 'organise', 'organize'],
    answer: 'Open Home in the sidebar to reach the dashboard. Use Create workspace in the sidebar and enter a name, then select it to make it active. Members and Settings in the sidebar manage that workspace.',
    routes: ['/main-page', '/workspaces/members']
  },
  {
    id: 'invite',
    keywords: ['invite', 'teammate', 'member', 'add', 'join', 'email'],
    answer: 'Open the workspace and choose Members. Enter the email address of the person you want to add, choose their role, and send the invitation. They accept it from their notifications.',
    routes: ['/workspaces/members']
  },
  {
    id: 'board',
    keywords: ['project', 'board', 'list', 'card', 'create', 'add'],
    answer: 'From the dashboard choose Create project, name it and pick a workspace. Open the board, choose Add another list to create a stage, then Add a card inside a list. Open a card to add a description, due date, labels, checklist or assignee.',
    routes: ['/main-page', '/workspaces/projects']
  },
  {
    id: 'permissions',
    keywords: ['role', 'permission', 'admin', 'manager', 'member', 'viewer', 'access'],
    answer: 'Workspace roles are Owner, Admin, Manager, Member and Viewer. Owners and Admins can manage the workspace, Managers and Members can edit boards, and Viewers have read-only access. Your workspace role decides what you can change in that workspace.',
    routes: ['/workspaces/members', '/workspaces/settings']
  },
  {
    id: 'profile',
    keywords: ['profile', 'account', 'name', 'password', 'bio', 'settings'],
    answer: 'Open Settings from the sidebar and choose Profile. You can change your name, username and bio, and change your password from the same page. Your email address is managed by your account and cannot be changed there.',
    routes: ['/workspaces/settings/profile']
  },
  {
    id: 'templates',
    keywords: ['template', 'favourite', 'favorite', 'reuse', 'publish'],
    answer: 'Templates are reusable starting points. Open Templates from the sidebar to browse them, mark favourites, and use a template to create a new board. You can publish a board you own as a template from its template controls.',
    routes: ['/templates']
  },
  {
    id: 'notifications',
    keywords: ['notification', 'unread', 'badge', 'invite', 'bell'],
    answer: 'The bell in the header opens notifications. Unread items are highlighted and each one has a Mark read action. Invitations can be accepted or declined from the notification itself.',
    routes: ['/main-page/notifications']
  },
  {
    id: 'search',
    keywords: ['search', 'find', 'filter', 'card', 'project'],
    answer: 'Use the search field in the header to find boards and cards you can access. Board filters narrow the cards shown in a board without changing any data.',
    routes: ['/main-page']
  }
]

export const helpFallback = 'I can explain Kanvora workflows such as workspaces, members, boards, lists, cards, roles, notifications, templates and settings. Try asking about one of those, or open Help for the full articles.'

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// Deterministic keyword matching: a topic needs at least one keyword hit, and
// the best score wins. No model, no network, no invented product facts.
export const matchHelpTopic = (question) => {
  const text = normalize(question)
  if (!text) return null
  let best = null
  for (const topic of helpTopics) {
    const score = topic.keywords.reduce((total, keyword) => (text.includes(keyword) ? total + 1 : total), 0)
    if (score > 0 && (!best || score > best.score)) best = { topic, score }
  }
  return best?.topic ?? null
}

export const helpAnswer = (question) => {
  const topic = matchHelpTopic(question)
  return {
    reply: topic ? `${topic.answer}\n\n${helpModeNotice}` : `${helpFallback}\n\n${helpModeNotice}`,
    topic: topic?.id ?? null,
    routes: topic?.routes ?? ['/help']
  }
}
