// React entrypoint: mounts the app and global providers into the DOM.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './utils/pwa.js'
import { productionConfigError } from './config/api.js'

const root = createRoot(document.getElementById('root'))

if (productionConfigError) {
  // A production bundle without a backend origin must fail clearly instead of
  // appearing to work while every request goes to the local machine.
  console.error(productionConfigError)
  root.render(
    <StrictMode>
      <main className="min-h-screen flex items-center justify-center bg-[var(--kt-bg)] px-6 text-center">
        <div className="max-w-lg rounded-2xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-8">
          <h1 className="text-xl font-bold text-[var(--kt-text)]">
            Kanvora is not configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--kt-muted)]">
            {productionConfigError}
          </p>
        </div>
      </main>
    </StrictMode>
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
  registerServiceWorker()
}
