import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageFiles = [
  'AboutKanvora.jsx',
  'CustomerStories.jsx',
  'Design.jsx',
  'Engineering.jsx',
  'Features.jsx',
  'Footer.jsx',
  'Header.jsx',
  'Home.jsx',
  'Inbox.jsx',
  'Planner.jsx',
  'Resources.jsx',
  'Solutions.jsx',
  'TeamManagement.jsx'
]

const readPage = (file) =>
  readFileSync(`src/components/${file}`, 'utf8')

const sources = pageFiles.map((file) => [file, readPage(file)])

const appRoutes = new Set([
  '/',
  '/features',
  '/solutions',
  '/resources',
  '/engineering',
  '/design',
  '/team-management',
  '/about',
  '/customer-stories',
  '/help',
  '/guide',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/workspaces',
  '/workspaces/projects',
  '/workspaces/members',
  '/workspaces/settings',
  '/workspaces/settings/profile',
  '/workspaces/settings/activity',
  '/workspaces/settings/cards',
  '/templates',
  '/inbox',
  '/planner',
  '/main-page',
  '/main-page/notifications',
  '/main-page/profile'
])

const forbidden = [
  {
    pattern: /ctfassets\.net|squarespace-cdn\.com|gstatic\.com|framerusercontent\.com/,
    label: 'borrowed external image or video asset'
  },
  {
    pattern: /SwagUp|Palace Law|Scan2CAD|Desk Plants|Instinct Dog|Coinbase|John Deere|Grand Hyatt|Visa|Zoom/,
    label: 'real-company logo, quote, or testimonial'
  },
  {
    pattern: /Joel Spolsky|Michael Pryor/,
    label: 'borrowed founder story'
  },
  {
    pattern: /2,000,000|2M\+|50M\+|Fortune 500|\b2011\b/,
    label: 'unsubstantiated company metric or founding date'
  },
  {
    pattern: /SOC ?2|ISO 27001/,
    label: 'unsupported security certification'
  },
  {
    pattern: /Power-Ups|Auto-magically|Butler/,
    label: 'unsupported integration or automation product'
  },
  {
    pattern: /Join (over|thousands)/,
    label: 'unsubstantiated customer count'
  },
  {
    pattern: /Capture every vital detail|Sync your calendar/,
    label: 'unsupported capture or calendar sync claim'
  }
]

describe('marketing page truthfulness', () => {
  it('contains no borrowed assets, real-company attribution, or unsupported metrics', () => {
    for (const [file, source] of sources) {
      for (const rule of forbidden) {
        expect(rule.pattern.test(source), `${file}: ${rule.label}`).toBe(false)
      }
    }
  })

  it('states the limitation on Inbox, Planner, and customer stories pages', () => {
    expect(readPage('Inbox.jsx')).toMatch(/not connected to\s+external email/i)
    expect(readPage('Planner.jsx')).toMatch(/does not connect to\s+Google Calendar/i)
    expect(readPage('CustomerStories.jsx')).toMatch(/not customer testimonials/i)
    expect(readPage('Features.jsx')).toMatch(/does not sync Google Calendar/i)
  })

  it('only links to routes that exist in App.jsx', () => {
    const routePatterns = [
      /navigate\('(\/[^']*)'\)/g,
      /\bpath: '(\/[^']*)'/g,
      /\bto: '(\/[^']*)'/g
    ]

    for (const [file, source] of sources) {
      for (const pattern of routePatterns) {
        for (const match of source.matchAll(pattern)) {
          const route = match[1]
          expect(appRoutes.has(route), `${file} links to ${route}`).toBe(true)
        }
      }
    }
  })
})
