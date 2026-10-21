// common styles: shared Tailwind class tokens for the premium black/red SaaS UI.
// common.js - Single source of truth for ALL Tailwind tokens.

// Apple Light Design System Tokens
export const primaryText = 'text-[#f7f7f8]'
export const mutedText = 'text-[#a3a3ad]'
export const accentText = 'text-[var(--kt-accent-text)]'
export const errorText = 'text-[var(--kt-danger)]'
export const pageBg = 'bg-[#050505]'
export const surfaceBg = 'bg-[#111111]'
export const accentBg = 'bg-[#ff4d67]'
export const accentBgHover = 'hover:bg-[#ff6b82]'
export const errorBg = 'bg-[var(--kt-danger-soft)]'
export const errorBgHover = 'hover:bg-[var(--kt-danger-soft)]'
export const errorTextHover = 'hover:text-[var(--kt-danger)]'
export const defaultBorder = 'border border-white/[0.07]'
export const defaultBorderColor = 'border-white/[0.07]'
export const errorBorderColor = 'border-[var(--kt-danger)]'
export const placeholderText = 'placeholder:text-[#777781]'
export const loadingText = 'text-[#ff8aa0]/70'

export const accentBorderFocus = 'focus:border-[#ff4d67]'
export const accentRingFocus = 'focus:ring-2 focus:ring-[#ff4d67]/20'

export const successText = 'text-emerald-300'
export const successBg = 'bg-green-500'
// Ink for fixed saturated status fills: the fill does not follow the theme, so
// the ink must not either. Without it the badge repaints with the theme
// foreground and fails in one theme.
export const successInk = 'text-[var(--kt-on-success)]'
export const warningText = 'text-amber-300'
export const warningBg = 'bg-amber-500'

// Ink for text that sits on a dark scrim, a photograph or a saturated fill.
export const scrimText = 'on-scrim'
export const scrimTextMuted = 'on-scrim-muted'

// Field foreground and placeholder are separate concerns: one semantic ink for
// the entered value, one muted token for the placeholder.
export const fieldText = 'text-[var(--kt-text)] placeholder:text-[var(--kt-muted)]'

// Gradients (mapped to Apple-like muted gradients or standardized accents)
export const gradientPrimary = 'bg-linear-to-br from-[var(--kt-accent)] to-[var(--kt-accent-strong)]'
export const gradientSecondary = 'bg-linear-to-br from-[#1b1b1b] to-[#050505]'

// Dashboard (dark Kanvora palette) Tokens
export const dashboardBgColor = 'bg-[#050505]'
export const dashboardSurfaceColor = 'bg-[#111111]'
export const dashboardSurfaceHover = 'hover:bg-[#242024]'
export const dashboardTextColor = 'text-[#f4f4f5]'
export const dashboardMutedColor = 'text-[#a3a3ad]'
export const dashboardBorderColor = 'border-white/[0.07]'
export const dashboardPrimaryBg = 'bg-[#ff4d67]'
export const dashboardPrimaryBgHover = 'hover:bg-[#ff6b82]'
export const dashboardPrimaryText = 'text-white'
export const dashboardPanelColor = 'bg-[#111111]'
export const dashboardPanelElevated = 'bg-[#1b1b1b]'
export const dashboardInputColor = 'bg-[#0a0a0a]'
export const dashboardFocusRing = 'focus:ring-2 focus:ring-[#ff4d67]/25'
export const dashboardAccentText = 'text-[#ff8aa0]'
export const dashboardDangerText = 'text-[var(--kt-danger)]'
export const dashboardDivider = 'border-white/[0.07]'

// Checkbox
export const commonCheckbox =
  'h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 text-[#ff4d67] focus:ring-[#ff4d67] focus:ring-offset-0 transition-all checked:bg-[#ff4d67]'

// Progress / Badges
export const progressTrack =
  'h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden'
export const progressFill = 'h-full bg-[#ff4d67] transition-all duration-300'
export const badgeText = 'text-[10px] font-medium tracking-tight text-[#a3a3ad]'

// Layout
export const pageBackground = `${surfaceBg} min-h-screen`
export const pageWrapper = 'max-w-6xl mx-auto px-6 py-16'
export const sectionWrapper = 'max-w-6xl mx-auto px-6'

// Home / Hero
export const homeWrapper = `${surfaceBg} min-h-screen`
export const heroSection =
  'flex flex-col md:flex-row items-center gap-12 max-w-6xl mx-auto px-6 py-20'
export const heroHeading = `text-5xl font-bold ${primaryText} leading-tight mb-5 tracking-tight`
export const heroSubheading = `text-lg ${mutedText} mb-8 leading-relaxed`
export const heroEmailRow = 'flex gap-3 flex-col sm:flex-row'
export const heroEmailInput = `${defaultBorder} rounded-xl px-4 py-3 text-sm ${primaryText} ${placeholderText} focus:outline-none ${accentBorderFocus} ${accentRingFocus} transition`
export const heroSignupBtn = `${accentBg} text-white font-semibold px-6 py-3 rounded-xl ${accentBgHover} transition-colors text-sm whitespace-nowrap`
export const heroPrivacyNote = `text-xs ${mutedText} mt-3`
export const heroVideo = 'rounded-2xl shadow-2xl w-full max-w-lg'

// Feature highlights (Home page cards row)
export const featureHighlights =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-6 py-12'
export const featureCard = `${pageBg} rounded-2xl p-7 hover:bg-[#e4e4e7] transition-colors duration-200 cursor-pointer`
export const featureCardIcon = `text-3xl ${accentText} mb-4 block`
export const featureCardTitle = `text-base font-bold ${primaryText} mb-2`
export const featureCardDesc = `text-sm ${mutedText} leading-relaxed`

// Features page grid
export const featuresGrid =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
export const featureItemCard = `${pageBg} rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`
export const featureItemIcon = `text-4xl ${accentText} mb-4 block`
export const featureItemTitle = `text-lg font-bold ${primaryText} mb-2`
export const featureItemDesc = `text-sm ${mutedText} leading-relaxed`

// Auth (Login / Register)
export const loginContainer = `min-h-screen ${pageBg} flex items-center justify-center px-4 py-12`
export const loginBox = `${surfaceBg} rounded-2xl shadow-sm border border-[var(--kt-border)] p-8 w-full max-w-sm flex flex-col gap-3`
export const loginInput = `w-full border border-[var(--kt-field-border)] rounded-xl px-4 py-2.5 text-sm ${primaryText} ${placeholderText} focus:outline-none ${accentBorderFocus} ${accentRingFocus} transition`
export const loginBtn = `w-full ${accentBg} text-white font-semibold py-2.5 rounded-full ${accentBgHover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm`
export const errorClass = `text-xs ${errorText} mt-0.5`

// Notifications page
export const notifPage = 'max-w-2xl mx-auto px-4 py-8'
export const notifHeader = 'flex items-center justify-between mb-4'
export const notifTitle = `text-xl font-bold ${primaryText}`
export const notifList = 'flex flex-col divide-y divide-white/[0.07]'
export const notifItem =
  'flex items-start gap-3 px-4 py-3.5 hover:bg-[#1b1b1b] transition-colors cursor-pointer'
export const notifItemUnread =
  'flex items-start gap-3 px-4 py-3.5 bg-[#ff4d67]/[0.08] hover:bg-[#ff4d67]/[0.14] transition-colors cursor-pointer'
export const notifItemAvatar = `w-8 h-8 rounded-full ${dashboardPanelElevated} flex items-center justify-center shrink-0 mt-0.5`
export const notifItemBody = 'flex-1 min-w-0'
export const notifItemText = `text-xs leading-relaxed ${primaryText}`
export const notifItemTime = 'text-[10px] text-[#a1a1aa] mt-0.5'
export const notifEmptyState =
  'flex flex-col items-center justify-center py-20 text-center'

// User Profile
export const profilePage = `min-h-screen ${pageBg} flex items-start justify-center px-4 py-12`
export const profileCard = `${surfaceBg} rounded-2xl shadow-sm border border-[#e4e4e7] p-8 w-full max-w-lg flex flex-col items-center`
export const profileAvatarWrap = 'flex flex-col items-center mb-2'
export const profileAvatar = ''
export const profileName = `text-xl font-bold ${primaryText} mt-3`
export const profileEmail = `text-sm ${mutedText}`
export const profileSection = 'w-full'
export const profileSectionTitle = `text-sm font-semibold ${primaryText}`
export const profileFormGroup = 'flex flex-col gap-1'
export const profileLabel = `text-xs font-medium ${mutedText}`
export const profileInput = `w-full ${defaultBorder} rounded-xl px-3 py-2.5 text-sm ${primaryText} ${placeholderText} focus:outline-none ${accentBorderFocus} disabled:bg-[#111111] disabled:border-transparent disabled:cursor-default transition`
export const profileSaveBtn = `${accentBg} ${accentBgHover} disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer text-sm`

// General buttons
export const primaryBtn = `${accentBg} text-white font-semibold px-5 py-2 rounded-full ${accentBgHover} transition-colors cursor-pointer text-sm`
export const secondaryBtn = `${defaultBorder} ${primaryText} font-medium px-5 py-2 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer text-sm`
export const dangerBtn = `bg-[#e11d48] text-white font-semibold px-5 py-2 rounded-full hover:bg-[#b91c1c] transition-colors cursor-pointer text-sm`

// Cards / containers
export const cardClass = `${pageBg} rounded-2xl p-7 hover:bg-[#e4e4e7] transition-colors duration-200 cursor-pointer`
export const cardTitle = `text-base font-bold ${primaryText} mb-1`
export const cardDesc = `text-sm ${mutedText} leading-relaxed`

// Form helpers
export const formCard = `${pageBg} rounded-2xl p-10 max-w-4xl mx-auto`
export const formTitle = `text-2xl font-bold ${primaryText} tracking-tight text-center mb-7`
export const formGroup = 'mb-4'
export const labelClass = `text-xs font-medium ${mutedText} mb-1.5 block`
export const inputClass = `w-full ${surfaceBg} ${defaultBorder} rounded-xl px-4 py-2.5 ${primaryText} text-sm ${placeholderText} focus:outline-none ${accentBorderFocus} ${accentRingFocus} transition`
export const submitBtn = `w-full ${accentBg} text-white font-semibold py-2.5 rounded-full ${accentBgHover} transition-colors cursor-pointer mt-2 text-sm`

// Feedback / status
export const loadingClass = `${loadingText} text-sm animate-pulse text-center py-10`
export const emptyState = `text-center py-20 ${mutedText} text-sm`

// Dashboard (dark Kanvora palette)
export const dashboardBg = dashboardBgColor
export const dashboardCard = `${dashboardSurfaceColor} rounded-xl ${dashboardSurfaceHover} transition-colors`
export const dashboardText = dashboardTextColor
export const dashboardMuted = dashboardMutedColor
export const dashboardBorder = `border ${dashboardBorderColor}`
export const dashboardBtn = `flex items-center gap-1.5 px-3 h-8 rounded text-xs ${dashboardTextColor} border ${dashboardBorderColor} ${dashboardSurfaceHover} hover:text-white transition-colors`
export const dashboardPrimaryBtn = `flex items-center gap-2 px-4 h-9 rounded ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} ${dashboardPrimaryText} text-sm font-semibold transition-colors`

// Board workspace
export const projectFallbackBg = dashboardBgColor
export const projectHeader =
  'flex flex-col gap-2 px-4 py-3 bg-[#050505]/68 backdrop-blur-xl shrink-0 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08]'
export const projectHeaderBtn =
  'text-white/70 hover:text-white text-sm transition-colors flex items-center gap-1'
export const projectHeaderTitle = 'text-white font-bold text-base'
export const projectShareBtn =
  'flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium transition-colors'
export const projectCanvas =
  'flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 app-scrollbar'
export const projectListRow = 'flex gap-3 h-full items-start'
export const projectStatusBar =
  'flex items-center justify-between gap-2 px-4 py-2 bg-[#050505]/58 backdrop-blur-xl border-b border-white/[0.08] shrink-0 overflow-x-auto'
export const projectStatusBarLabel =
  'text-[10px] font-bold uppercase text-white/60 whitespace-nowrap'
export const projectStatusPillBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors'
export const projectStatusPillActive = 'ring-2 ring-white/30'
export const listColumnBase =
  'rounded-2xl w-72 shrink-0 flex flex-col max-h-full select-none border shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl'
export const listColumnDefault = 'bg-[#111111]/92 border-white/[0.08]'
export const listHeader =
  'flex items-center justify-between px-3 pt-3 pb-2 cursor-grab active:cursor-grabbing'
export const listTitle = `text-sm font-semibold ${dashboardTextColor} flex-1 cursor-pointer hover:text-white`
export const listTitleInput = `${dashboardSurfaceColor} border border-[#ff4d67] rounded px-2 py-0.5 text-sm text-white focus:outline-none flex-1 mr-1`
export const listIconButton = `${dashboardMutedColor} hover:text-white p-1 rounded ${dashboardSurfaceColor} transition-colors`
export const listMenu = `absolute right-0 top-7 z-20 ${dashboardSurfaceColor} border ${dashboardBorderColor} rounded-lg shadow-lg py-1 w-48`
export const listMenuItem = `w-full text-left px-3 py-2 text-xs ${dashboardTextColor} ${dashboardSurfaceHover}`
export const listMenuDanger = `w-full text-left px-3 py-2 text-xs text-[#ff8aa0] ${dashboardSurfaceHover}`
export const listDropZone =
  'flex flex-col gap-2 px-2 overflow-y-auto flex-1 pb-2 min-h-1 transition-colors rounded-lg'
export const listDropZoneOver = 'bg-[#ffffff08]'
export const addListPanel = 'premium-card rounded-xl w-64 shrink-0 p-3'
export const addListButton =
  'bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-sm text-white rounded-xl w-64 shrink-0 px-3 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors border border-white/[0.08]'
export const projectInput = `w-full bg-[#0a0a0a] border border-[var(--kt-field-border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#777781] focus:outline-none focus:border-[#ff4d67] focus:ring-2 focus:ring-[#ff4d67]/20 transition-colors`
export const projectTextarea = `w-full bg-[#0a0a0a] border border-[var(--kt-field-border)] rounded-lg p-2.5 text-sm text-white placeholder:text-[#777781] focus:outline-none focus:border-[#ff4d67] focus:ring-2 focus:ring-[#ff4d67]/20 resize-none transition-colors`
export const projectPrimarySmallBtn = `${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 ${dashboardPrimaryText} text-xs font-semibold px-3 py-1.5 rounded transition-colors`
export const projectMutedIconBtn = `${dashboardMutedColor} hover:text-white`
export const cardSurface = `premium-card premium-card-hover rounded-xl p-3 cursor-pointer group relative select-none`
export const cardText = `text-sm ${dashboardTextColor} group-hover:text-white transition-colors leading-relaxed`
// Hover actions stay reachable on touch: the target keeps the 24px minimum
// even where the icon itself is smaller.
export const cardDeleteBtn = `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${dashboardMutedColor} hover:text-[#ff8aa0] transition-all p-0.5 rounded shrink-0 flex h-6 w-6 items-center justify-center`
export const cardOverlay = `bg-[#1b1b1b] rounded-lg p-3 shadow-2xl rotate-2 w-64 opacity-90 border border-white/[0.08]`
export const cardMetaText = `text-[10px] ${dashboardMutedColor} mt-1.5 flex items-center gap-1`
export const modalBackdrop =
  'fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-6 px-4 backdrop-blur-md sm:pt-12'
export const modalPanel =
  'modal-panel premium-card animate-enter rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]'
export const modalHeader = `bg-[#111111]/92 border-b border-white/[0.07] px-6 py-4 flex items-start justify-between gap-3`
export const modalTitleInput = `w-full bg-transparent text-white text-lg font-semibold resize-none focus:outline-none focus:ring-2 focus:ring-[var(--kt-accent)] rounded p-1 -ml-1`
export const modalMutedText = `text-xs ${dashboardMutedColor}`
export const modalSectionTitle = `text-sm font-semibold ${dashboardTextColor}`
export const modalTextarea = `w-full ${dashboardSurfaceColor} border ${dashboardBorderColor} rounded-lg px-3 py-2 text-sm ${dashboardTextColor} placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff4d67] resize-none`
export const modalActionBtn = `flex items-center gap-2 px-3 py-1.5 rounded ${dashboardSurfaceColor} ${dashboardSurfaceHover} text-xs ${dashboardTextColor} hover:text-white transition-colors text-left`
export const modalDangerBtn = `flex items-center gap-2 px-3 py-1.5 rounded ${dashboardSurfaceColor} hover:bg-[#ff4d67]/15 text-xs text-[#ff8aa0] transition-colors text-left`
export const modalPrimaryBtn = `${dashboardPrimaryBg} ${dashboardPrimaryBgHover} disabled:opacity-50 ${dashboardPrimaryText} text-sm font-semibold px-4 py-2 rounded transition-colors`
export const modalCancelBtn = `${dashboardMutedColor} hover:text-white text-sm px-4 py-2 rounded ${dashboardSurfaceHover} transition-colors`

export const overlayPanel = `relative w-full max-w-lg h-full ${dashboardPanelColor} shadow-2xl flex flex-col overflow-hidden border-l ${dashboardDivider}`
export const overlayHeader = `flex items-center justify-between px-5 sm:px-6 py-4 border-b ${dashboardDivider} shrink-0`
export const overlayTitle = 'text-base font-bold text-white'
export const overlayCloseBtn = `${dashboardMutedColor} hover:text-white transition-colors rounded p-1 ${dashboardSurfaceHover}`
export const dashboardField = `w-full border ${dashboardBorderColor} ${dashboardPanelElevated} rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#8c9bab] focus:outline-none focus:border-[#ff4d67] ${dashboardFocusRing} transition-colors`
export const dashboardFieldReadonly = `w-full border border-transparent ${dashboardPanelElevated} rounded-xl px-3 py-2.5 text-sm text-[#d7dde4] cursor-default`
export const dashboardSecondaryBtn = `border ${dashboardBorderColor} text-white font-medium px-4 py-2 rounded-lg text-sm ${dashboardSurfaceHover} transition-colors`

// Production UI system extensions. Existing exports above remain stable for
// backwards compatibility with the current codebase.
export const radius = {
  xs: 'rounded',
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl'
}

export const shadow = {
  soft: 'shadow-[0_12px_40px_rgba(15,23,42,0.08)]',
  panel: 'shadow-[0_18px_60px_rgba(0,0,0,0.28)]',
  glow: 'shadow-[0_0_0_1px_rgba(94,234,212,0.12),0_18px_50px_rgba(255,77,103,0.18)]'
}

export const transition = {
  base: 'transition-all duration-200 ease-out',
  fast: 'transition-colors duration-150 ease-out'
}

export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8aa0]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--kt-bg)]'

export const glassSurface =
  'bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]'
export const darkGlassSurface =
  'bg-[#111111]/90 backdrop-blur-xl border border-white/[0.08]'
export const elevatedSurface = `${dashboardPanelElevated} border ${dashboardDivider} ${shadow.panel}`

export const appShell = `min-h-screen premium-app-bg text-[#f4f4f5]`
export const dashboardPage = `flex-1 overflow-y-auto app-scrollbar premium-app-bg text-[#f4f4f5]`
export const dashboardContent =
  'mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8'

export const headingHero =
  'text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl'
export const headingPage =
  'text-2xl font-bold tracking-tight text-white sm:text-3xl'
export const headingSection = 'text-base font-semibold text-white'
export const eyebrow =
  'text-xs font-bold uppercase tracking-[0.18em] text-[#ff4d67]'
export const bodyLarge = 'text-base leading-7 text-[#71717a]'
export const bodySmall = 'text-sm leading-6 text-[#a1a1aa]'

export const buttonPrimary = `inline-flex items-center justify-center gap-2 rounded-lg ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} px-4 py-2 text-sm font-semibold ${dashboardPrimaryText} ${focusRing} ${transition.fast} disabled:opacity-50`
export const buttonSecondary = `inline-flex items-center justify-center gap-2 rounded-lg border ${dashboardBorderColor} bg-[#1b1b1b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#242024] ${focusRing} ${transition.fast}`
export const buttonGhost = `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${dashboardMutedColor} hover:bg-[#1b1b1b] hover:text-white ${focusRing} ${transition.fast}`
export const iconButton = `inline-flex h-9 w-9 items-center justify-center rounded-lg ${dashboardMutedColor} hover:bg-[#1b1b1b] hover:text-white ${focusRing} ${transition.fast}`
export const dangerButton = `inline-flex items-center justify-center gap-2 rounded-lg border border-[#ff4d67]/25 bg-[#ff4d67]/10 px-4 py-2 text-sm font-semibold text-[#ff8aa0] hover:bg-[#ff4d67]/18 ${focusRing} ${transition.fast}`

export const cardBase = `premium-card rounded-xl ${transition.base}`
export const cardInteractive = `${cardBase} premium-card-hover`
export const publicCard = `premium-card premium-card-hover rounded-2xl p-6 ${transition.base}`

export const fieldBase = `w-full rounded-lg border border-[var(--kt-field-border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder:text-[#777781] ${focusRing} focus:border-[#ff4d67] ${transition.fast}`
export const textareaBase = `${fieldBase} resize-none`
export const labelBase = `mb-1.5 block text-xs font-bold uppercase tracking-wide ${dashboardMutedColor}`

export const skeletonBlock =
  'animate-pulse rounded-xl bg-linear-to-r from-[#111111] via-[#262024] to-[#111111] bg-[length:200%_100%]'
export const emptyStatePanel = `rounded-2xl border border-dashed ${dashboardDivider} bg-[#111111]/70 px-6 py-12 text-center backdrop-blur-xl`

export const commandPaletteBackdrop =
  'fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm'
export const commandPalettePanel = `premium-card w-full max-w-2xl overflow-hidden rounded-2xl`

// The toast renders in a portal on the document body, so the semantic tokens
// resolve against the active palette instead of a fixed dark surface.
export const toastStyle = {
  background: 'var(--kt-surface)',
  color: 'var(--kt-text)',
  border: '1px solid var(--kt-border)',
  borderRadius: '12px',
  boxShadow: 'var(--dash-shadow)',
  fontSize: '13px'
}

export const statusLabelStyles = {
  todo: {
    title: 'Todo',
    label: 'todo',
    listTitle: 'Todo',
    taskStatus: 'TO-DO',
    color: '#38bdf8',
    pill: 'bg-sky-500/20 border-sky-400/50 text-sky-200 hover:bg-sky-500/30',
    badge: 'bg-sky-400 text-[#102033]',
    list: 'bg-sky-950/40 border-sky-500/35'
  },
  inProgress: {
    title: 'In Progress',
    label: 'in progress',
    listTitle: 'In Progress',
    taskStatus: 'IN-PROGRESS',
    color: '#fcd34d',
    pill: 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30',
    badge: 'bg-amber-300 text-[#32230d]',
    list: 'bg-amber-950/35 border-amber-500/35'
  },
  done: {
    title: 'Done',
    label: 'done',
    listTitle: 'Done',
    taskStatus: 'DONE',
    color: '#6ee7b7',
    pill: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30',
    badge: 'bg-emerald-300 text-[#0e2a1d]',
    list: 'bg-emerald-950/35 border-emerald-500/35'
  }
}

// Pricing page
export const pricingCard = `${surfaceBg} rounded-2xl border border-[#e4e4e7] p-8 flex flex-col hover:shadow-xl transition-all duration-300 hover:-translate-y-1`
export const pricingCardFeatured = `${accentBg} rounded-2xl p-8 flex flex-col hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white`

// Sidebar (dark)
export const sidebarLink = `flex items-center gap-2.5 px-3 h-9 rounded text-sm font-medium w-full text-left transition-colors ${dashboardTextColor} ${dashboardSurfaceHover} hover:text-white`
export const sidebarLinkActive = `flex items-center gap-2.5 px-3 h-9 rounded text-sm font-medium w-full text-left transition-colors bg-[#e63d581a] ${dashboardPrimaryBg.replace('bg-', 'text-')}`

// Navbar (dark)
export const navbarWrap = `flex items-center h-12 px-2 gap-1 bg-[#050505]/88 backdrop-blur-xl border-b ${dashboardBorderColor} sticky top-0 z-40`
export const navbarBtn = `flex items-center gap-1 px-2.5 h-8 rounded ${dashboardTextColor} ${dashboardSurfaceHover} hover:text-white text-sm font-medium transition-colors`
export const navbarCreateBtn = `premium-button-glow flex items-center gap-1.5 px-3 h-8 rounded-lg ${dashboardPrimaryBg} ${dashboardPrimaryBgHover} ${dashboardPrimaryText} text-sm font-semibold transition-colors`
export const navbarIconBtn = `flex items-center justify-center w-8 h-8 rounded ${dashboardSurfaceHover} ${dashboardMutedColor} hover:text-white transition-colors`

// Workspace / Templates (dark pages with their own sidebar)
export const darkPageWrap = `flex h-screen w-screen overflow-hidden ${dashboardBgColor}`
export const darkSidebar = `w-56 shrink-0 border-r ${dashboardBorderColor} py-4 overflow-y-auto`
export const darkSidebarLink = `text-left px-3 py-1.5 rounded text-sm transition-colors ${dashboardMutedColor} ${dashboardSurfaceHover} hover:text-white`
export const darkSidebarLinkActive = `text-left px-3 py-1.5 rounded text-sm transition-colors bg-[#e63d581a] ${dashboardPrimaryBg.replace('bg-', 'text-')} font-medium`
export const darkMain = 'flex-1 overflow-y-auto px-8 py-6'

// ─── Public / Marketing light + teal theme ───────────────────────────────────
export const pubPageBg = 'bg-[var(--kt-bg)]'
export const pubSurface = 'bg-[var(--kt-surface)]'
export const pubText = 'text-[var(--kt-text)]'
export const pubMuted = 'text-[var(--kt-muted)]'
export const pubAccentColor = 'text-[var(--kt-accent-text)]'
export const pubBorder = 'border-[var(--kt-border)]'
export const pubHeroBg =
  'bg-linear-to-br from-[var(--kt-surface-soft)] via-[var(--kt-bg)] to-[var(--kt-surface)]'
export const pubSectionAlt = 'bg-[var(--kt-surface-soft)]'
export const pubCard =
  'bg-[var(--kt-surface)] border border-[var(--kt-border)] rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group'
export const pubBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kt-accent)] hover:bg-[var(--kt-accent-hover)] px-4 py-2 text-sm font-semibold text-[var(--kt-on-accent)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]'
export const pubBtnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface)] px-4 py-2 text-sm font-semibold text-[var(--kt-text)] hover:bg-[var(--kt-surface-soft)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-accent)]'
export const pubIconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--kt-muted)] hover:bg-[var(--kt-surface-soft)] transition-colors'
export const pubEyebrow =
  'text-xs font-bold uppercase tracking-[0.18em] text-[var(--kt-accent-text)]'
