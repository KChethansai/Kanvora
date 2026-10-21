// A production bundle must never point at the local machine: it would look
// functional while every request fails. The build reports the misconfiguration
// instead of starting.
import { afterEach, describe, expect, it, vi } from 'vitest'

const loadApiConfig = async (env) => {
  vi.resetModules()
  // `import.meta.env.PROD` is a plain object in Vitest, so it is set directly:
  // vi.stubEnv coerces boolean-like values and would flip it to true.
  import.meta.env.PROD = true
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value)
  }
  return import('../config/api.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  import.meta.env.PROD = false
})

describe('production API configuration', () => {
  it('refuses a production build without VITE_API_URL', async () => {
    const { productionConfigError, API_BASE_URL } = await loadApiConfig({ VITE_API_URL: '' })

    expect(productionConfigError).toMatch(/VITE_API_URL/)
    expect(API_BASE_URL).toBe('http://localhost:5000')
  })

  it('refuses a production build that points at localhost', async () => {
    const { productionConfigError } = await loadApiConfig({
      VITE_API_URL: 'http://localhost:5000'
    })

    expect(productionConfigError).toMatch(/VITE_API_URL/)
  })

  it('refuses a production build that points at 127.0.0.1', async () => {
    const { productionConfigError } = await loadApiConfig({
      VITE_API_URL: 'https://127.0.0.1:5000'
    })

    expect(productionConfigError).toMatch(/VITE_API_URL/)
  })

  it('accepts a configured production origin and uses it', async () => {
    const { productionConfigError, API_BASE_URL } = await loadApiConfig({
      VITE_API_URL: 'https://api.kanvora.example/'
    })

    expect(productionConfigError).toBeNull()
    expect(API_BASE_URL).toBe('https://api.kanvora.example')
  })

  it('keeps the development fallback when the build is not a production build', async () => {
    vi.resetModules()
    import.meta.env.PROD = false
    vi.stubEnv('VITE_API_URL', '')
    const { productionConfigError, API_BASE_URL } = await import('../config/api.js')

    expect(productionConfigError).toBeNull()
    expect(API_BASE_URL).toBe('http://localhost:5000')
  })
})
