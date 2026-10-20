export const helpCategories = ['All', 'Start here', 'Boards', 'Teams', 'Account', 'Install']

export const helpArticles = [
  {
    id: 'create-workspace',
    category: 'Start here',
    title: 'Create or open a workspace',
    summary: 'Workspaces group boards, members, and permissions.',
    keywords: ['workspace', 'team', 'create', 'switch', 'sidebar'],
    steps: [
      'Open the dashboard from Home in the sidebar.',
      'Use Create workspace in the sidebar and enter a name.',
      'Select the workspace from the sidebar to make it active.',
      'Open Workspaces to manage boards and members for that workspace.'
    ],
    note: 'Personal boards without a workspace are visible only to their creator.',
    routes: [{ label: 'Open dashboard', to: '/main-page' }]
  },
  {
    id: 'create-project',
    category: 'Boards',
    title: 'Create a board',
    summary: 'A board holds the lists and cards for one project or workflow.',
    keywords: ['project', 'board', 'create', 'workspace', 'personal'],
    steps: [
      'Open the dashboard or Workspaces.',
      'Choose Create project.',
      'Enter a clear title and choose a background.',
      'Select the workspace that should own the board, then save.'
    ],
    note: 'Your current workspace role decides whether you can create or edit boards in that workspace.',
    routes: [
      { label: 'Open dashboard', to: '/main-page' },
      { label: 'Open workspaces', to: '/workspaces' }
    ]
  },
  {
    id: 'lists-and-cards',
    category: 'Boards',
    title: 'Add lists and cards',
    summary: 'Lists are stages; cards are the work items inside them.',
    keywords: ['list', 'card', 'task', 'add', 'create', 'stage'],
    steps: [
      'Open a board.',
      'Choose Add another list and name the stage.',
      'Choose Add a card inside a list and enter a title.',
      'Open the card to add a description, due date, labels, checklist, or assignee.'
    ],
    note: 'Cards can be moved between lists on the same board. Moving a card to another board is not supported.',
    routes: [{ label: 'Open workspaces', to: '/workspaces' }]
  },
  {
    id: 'reorder-and-move',
    category: 'Boards',
    title: 'Reorder lists and move cards',
    summary: 'Drag to reorder, then wait for the save indicator before leaving.',
    keywords: ['drag', 'drop', 'reorder', 'move', 'order', 'save'],
    steps: [
      'Drag a list by its header to change its position.',
      'Drag a card within a list to reorder it.',
      'Drag a card onto another list to move it there.',
      'Wait for the board to finish saving before closing the tab.'
    ],
    note: 'Order changes are saved by the server. If a move fails, refresh the board to get the saved order.',
    routes: [{ label: 'Open workspaces', to: '/workspaces' }]
  },
  {
    id: 'archive-restore-delete',
    category: 'Boards',
    title: 'Archive, restore, or delete a board',
    summary: 'Archiving hides a board without destroying its lists and cards.',
    keywords: ['archive', 'restore', 'delete', 'remove', 'recover', 'owner'],
    steps: [
      'Open the board menu from the board header.',
      'Choose Archive to hide the board from active lists.',
      'Open archived boards to restore one when you need it again.',
      'Choose Delete only when you want to remove the board from active views.'
    ],
    note: 'Archiving and restoring require board management permission. Archived boards are read-only until restored.',
    routes: [{ label: 'Open workspaces', to: '/workspaces' }]
  },
  {
    id: 'invite-members',
    category: 'Teams',
    title: 'Invite and manage members',
    summary: 'Invitations are tied to the invited email and require acceptance.',
    keywords: ['invite', 'member', 'team', 'role', 'permission', 'accept'],
    steps: [
      'Select the workspace, then open Members in the sidebar.',
      'Enter the person’s email and choose a role.',
      'Send the invitation. The recipient must accept it from their email.',
      'Change or remove a member from the same Members view.'
    ],
    note: 'Invitation links are delivered by email and are not shown in the app. A removed member loses access to workspace boards immediately.',
    routes: [{ label: 'Open members', to: '/workspaces/members' }]
  },
  {
    id: 'roles-and-access',
    category: 'Teams',
    title: 'Understand roles and access',
    summary: 'Access follows current workspace membership, not a copied board member list.',
    keywords: ['role', 'owner', 'admin', 'manager', 'member', 'viewer', 'access', 'permission'],
    steps: [
      'Open Workspace settings to review roles.',
      'Owners can manage the workspace and all boards.',
      'Admins and managers can manage boards according to workspace settings.',
      'Members can edit where allowed; viewers have read-only access.'
    ],
    note: 'If a person cannot open a board, confirm that they are still a member of its workspace and that the board is not archived.',
    routes: [{ label: 'Open workspace settings', to: '/workspaces/settings' }]
  },
  {
    id: 'comments-and-notifications',
    category: 'Teams',
    title: 'Comments and notifications',
    summary: 'Discuss work on a card and track mentions from the bell menu.',
    keywords: ['comment', 'mention', 'notification', 'inbox', 'bell', 'unread'],
    steps: [
      'Open a card and use the comments section.',
      'Mention a teammate with @ and their name.',
      'Open the bell menu to review unread notifications.',
      'Open Inbox for the full notification view.'
    ],
    note: 'Notifications are scoped to boards you can currently access. Removing access also removes future notifications.',
    routes: [{ label: 'Open inbox', to: '/inbox' }]
  },
  {
    id: 'templates',
    category: 'Boards',
    title: 'Browse and use templates',
    summary: 'Templates give you a starting structure for a new board.',
    keywords: ['template', 'marketplace', 'publish', 'start', 'example'],
    steps: [
      'Open Templates from the navigation.',
      'Search or browse the template list.',
      'Open a template to review its lists and cards.',
      'Use the template to start a board, then rename lists and cards for your work.'
    ],
    note: 'Only published templates appear in the public template list.',
    routes: [{ label: 'Open templates', to: '/templates' }]
  },
  {
    id: 'attachments',
    category: 'Boards',
    title: 'Upload card attachments',
    summary: 'Attach JPEG or PNG images to a card you can edit.',
    keywords: ['attachment', 'image', 'upload', 'file', 'png', 'jpeg', 'private'],
    steps: [
      'Open a card you can edit.',
      'Choose the attachment upload control.',
      'Select a JPEG or PNG image and wait for the upload to finish.',
      'Open the attachment from the card while signed in.'
    ],
    note: 'Card attachments are private: Kanvora checks board access before delivering them.',
    routes: [{ label: 'Open workspaces', to: '/workspaces' }]
  },
  {
    id: 'account-security',
    category: 'Account',
    title: 'Verify your email and recover your password',
    summary: 'Verification claims the account; recovery links expire after one hour.',
    keywords: ['verify', 'email', 'password', 'reset', 'forgot', 'login', 'google', 'session'],
    steps: [
      'Open the verification email and choose a new password to claim the account.',
      'Use Can’t log in? on the sign-in page if you need a recovery link.',
      'Open the recovery link within one hour and choose a new password.',
      'Changing your password signs out other sessions.'
    ],
    note: 'A verification link can be used once. If it expires, request a new one from the verification page. Google sign-in requires a verified Google email.',
    routes: [
      { label: 'Go to sign in', to: '/login' },
      { label: 'Recover account', to: '/forgot-password' }
    ]
  },
  {
    id: 'theme-and-display',
    category: 'Account',
    title: 'Change the theme',
    summary: 'Switch between light, dark, and system theme.',
    keywords: ['theme', 'dark', 'light', 'system', 'appearance', 'display'],
    steps: [
      'Open the profile menu in the header.',
      'Choose Light, Dark, or System.',
      'The choice is stored in this browser.'
    ],
    note: 'System follows your operating system preference and updates when that preference changes.',
    routes: [{ label: 'Open dashboard', to: '/main-page' }]
  },
  {
    id: 'install-app',
    category: 'Install',
    title: 'Install Kanvora on your device',
    summary: 'Install the web app for a standalone window and quicker access.',
    keywords: ['install', 'pwa', 'app', 'offline', 'home screen', 'desktop'],
    steps: [
      'Open Kanvora in a supported browser.',
      'Use the browser’s Install app or Add to Home Screen action.',
      'Launch Kanvora from the installed icon.',
      'Check for an app update by reloading after a release.'
    ],
    note: 'Kanvora does not queue board changes while offline. Connect to the internet before adding, moving, or editing cards.',
    routes: [{ label: 'Open dashboard', to: '/main-page' }]
  },
  {
    id: 'troubleshooting',
    category: 'Start here',
    title: 'Troubleshoot a missing board or failed save',
    summary: 'Check workspace, archive state, and connection before retrying.',
    keywords: ['missing', 'not found', 'failed', 'save', 'error', 'refresh', 'offline'],
    steps: [
      'Confirm the correct workspace is active in the sidebar.',
      'Check whether the board is archived and restore it if needed.',
      'Confirm you are online and still a member of the workspace.',
      'Refresh the page to load the last saved state before trying again.'
    ],
    note: 'If the problem continues, sign out and back in so the app checks your current session and membership.',
    routes: [{ label: 'Open workspaces', to: '/workspaces' }]
  }
]

export const getHelpArticle = (id) => helpArticles.find((article) => article.id === id) || null
