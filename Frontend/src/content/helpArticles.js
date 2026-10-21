export const helpCategories = ['All', 'Start here', 'Boards', 'Teams', 'Account', 'Install']

export const helpArticles = [
  {
    id: 'create-workspace',
    category: 'Start here',
    title: 'Create or open a workspace',
    summary: 'Workspaces group boards, members, and permissions.',
    keywords: ['workspace', 'team', 'create', 'switch', 'sidebar'],
    steps: [
      'Open Home in the sidebar to reach the dashboard.',
      'Use Create workspace in the sidebar and enter a name.',
      'Select the workspace from the sidebar to make it active.',
      'Open Members or Settings in the sidebar to manage that workspace.'
    ],
    note: 'Personal boards without a workspace are visible only to their creator and to people who have been granted access to them.',
    routes: [{ label: 'Open dashboard', to: '/main-page' }]
  },
  {
    id: 'create-project',
    category: 'Boards',
    title: 'Create a board',
    summary: 'A board holds the lists and cards for one project or workflow.',
    keywords: ['project', 'board', 'create', 'workspace', 'background'],
    steps: [
      'Open the dashboard and choose Create project.',
      'Enter a clear title and choose an optional JPG or PNG background.',
      'Select the workspace that should own the board, then save.',
      'Open the new board from the dashboard or the sidebar.'
    ],
    note: 'Your current workspace role decides whether you can create or edit boards in that workspace.',
    routes: [
      { label: 'Open dashboard', to: '/main-page' },
      { label: 'Open projects', to: '/workspaces/projects' }
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
    routes: [{ label: 'Open projects', to: '/workspaces/projects' }]
  },
  {
    id: 'reorder-and-move',
    category: 'Boards',
    title: 'Reorder lists and move cards',
    summary: 'Drag to reorder lists and cards; the server stores the new order.',
    keywords: ['drag', 'drop', 'reorder', 'move', 'order', 'save'],
    steps: [
      'Drag a list by its header to change its position.',
      'Drag a card within a list to reorder it.',
      'Drag a card onto another list to move it there.',
      'If a move does not stick, refresh the board to load the last saved order.'
    ],
    note: 'There is no separate save button. Order changes are sent to the server as you drop them.',
    routes: [{ label: 'Open projects', to: '/workspaces/projects' }]
  },
  {
    id: 'archive-restore-delete',
    category: 'Boards',
    title: 'Archived boards and deleted work',
    summary: 'Archived boards are hidden from active lists; this build has no archive control.',
    keywords: ['archive', 'restore', 'delete', 'remove', 'recover', 'owner'],
    steps: [
      'Archived boards do not appear in the active project list.',
      'This build does not include an archive or restore button in the board interface.',
      'To delete a board you can manage, use the delete action on the dashboard project card and confirm it.',
      'If a board is missing, confirm the active workspace and whether the board is archived.'
    ],
    note: 'Restoring an archived board requires board management permission; there is no in-app restore control yet. Deleting a board removes its lists and cards.',
    routes: [{ label: 'Open projects', to: '/workspaces/projects' }]
  },
  {
    id: 'invite-members',
    category: 'Teams',
    title: 'Invite and manage members',
    summary: 'Workspace invitations are sent by email and require acceptance.',
    keywords: ['invite', 'member', 'team', 'role', 'permission', 'accept'],
    steps: [
      'Select the workspace, then open Members in the sidebar.',
      'Choose Invite members and enter the person’s email.',
      'Send the invitation. The recipient must accept it from the email link within 7 days.',
      'Change a member’s role or remove them from the same Members view.'
    ],
    note: 'The invite form does not ask for a role; invited people join as Members. Workspace invitation links are delivered by email and are not shown in the app. A removed member loses access to workspace boards immediately.',
    routes: [{ label: 'Open members', to: '/workspaces/members' }]
  },
  {
    id: 'roles-and-access',
    category: 'Teams',
    title: 'Understand roles and access',
    summary: 'Access follows current workspace membership, not a copied board member list.',
    keywords: ['role', 'owner', 'admin', 'manager', 'member', 'viewer', 'access', 'permission'],
    steps: [
      'Open Members in the sidebar to see each person’s role.',
      'Owners manage the workspace, its permissions, and deletion, and cannot be removed.',
      'Admins can manage the workspace when their permissions allow it; Managers and Members can create and edit boards by default.',
      'Viewers have read-only access. Use the role menu to change a member or remove them.'
    ],
    note: 'The member menu offers Manager, Member, and Viewer for existing members. If a person cannot open a board, confirm that they are still a member of its workspace and that the board is not archived.',
    routes: [
      { label: 'Open members', to: '/workspaces/members' },
      { label: 'Open workspace settings', to: '/workspaces/settings' }
    ]
  },
  {
    id: 'comments-and-notifications',
    category: 'Teams',
    title: 'Comments and notifications',
    summary: 'Discuss work on a card and review updates from the notification list.',
    keywords: ['comment', 'mention', 'notification', 'bell', 'unread'],
    steps: [
      'Open a card and use the comments section.',
      'Mention a teammate with @ and their username.',
      'Open the bell in the navbar, or go to Notifications, to review updates.',
      'Mark notifications as read or delete them from the notification list.'
    ],
    note: 'Notifications are scoped to boards you can currently access. Removing access also removes future notifications.',
    routes: [{ label: 'Open notifications', to: '/main-page/notifications' }]
  },
  {
    id: 'templates',
    category: 'Boards',
    title: 'Browse and use templates',
    summary: 'Using a template creates a new board with a standard three-list starting point.',
    keywords: ['template', 'marketplace', 'publish', 'start', 'example'],
    steps: [
      'Open Templates from the sidebar or the navigation.',
      'Search or browse the template list.',
      'Open a template to review its details.',
      'Use the template to create a board, choosing a workspace or keeping it personal, then rename its lists and add your own cards.'
    ],
    note: 'Using a template does not copy cards, comments, members, or attachments. The new board starts with To Do, In Progress, and Done lists and the template’s title and description. Published templates are public; your own templates are also visible to you.',
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
    routes: [{ label: 'Open projects', to: '/workspaces/projects' }]
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
      'Changing your password signs out your other sessions.'
    ],
    note: 'A verification link can be used once and expires after 24 hours. If it expires, request a new one from the verification page. Google sign-in requires a verified Google email.',
    routes: [
      { label: 'Go to sign in', to: '/login' },
      { label: 'Recover account', to: '/forgot-password' }
    ]
  },
  {
    id: 'theme-and-display',
    category: 'Account',
    title: 'Change the theme',
    summary: 'Switch between light, dark, and system theme from the command menu.',
    keywords: ['theme', 'dark', 'light', 'system', 'appearance', 'display', 'command'],
    steps: [
      'Press Ctrl+K or Cmd+K to open the command menu.',
      'Choose Light, Dark, or System at the bottom of the menu.',
      'The choice is stored in this browser.'
    ],
    note: 'System applies your operating system’s current light or dark preference when the page loads. Changing the OS theme while Kanvora is open requires a reload; the app does not update live.',
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
      'Check whether the board is archived; archived boards are hidden and have no in-app restore control yet.',
      'Confirm you are online and still a member of the workspace.',
      'Refresh the page to load the last saved state before trying again.'
    ],
    note: 'If the problem continues, sign out and back in so the app checks your current session and membership.',
    routes: [{ label: 'Open projects', to: '/workspaces/projects' }]
  }
]

export const getHelpArticle = (id) => helpArticles.find((article) => article.id === id) || null
