process.env.NODE_ENV = 'test'
process.env.DB_URL = 'mongodb://127.0.0.1:1/kanvora_test'
process.env.SECRET_KEY = 'synthetic-test-key-only'
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASS = ''

const { createApp } = await import('../app.js')
const { routeInventory } = await import('../utils/routeInventory.js')
const routes = routeInventory(createApp())

process.stdout.write(`${JSON.stringify({
  phase: 'B0',
  baselineCommit: '0bea03a',
  definitionCount: routes.length,
  apiDefinitionCount: routes.filter(({ path }) => path !== '/health').length,
  counting: 'One definition per explicit method/path; health is included in definitionCount, excluded from apiDefinitionCount. Chained methods are counted separately.',
  excludes: ['HEAD', 'OPTIONS'],
  routes
}, null, 2)}\n`)
