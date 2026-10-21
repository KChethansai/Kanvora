// ErrorBoundary component: catches unexpected render failures.
import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    // errors are intentionally contained so the app can render a fallback
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[var(--kt-bg)] px-6 text-center"
        >
          <div>
            <h1 className="text-2xl font-bold text-[var(--kt-text)] mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-[var(--kt-muted)] mb-5">
              Refresh the page or return to your workspace.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/main-page')}
              className="rounded bg-[var(--kt-accent)] px-4 py-2 text-sm font-semibold text-[var(--kt-on-accent)]"
            >
              Go to workspace
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
