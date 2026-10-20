export const registerServiceWorker = () => {
  try {
    localStorage.removeItem('offline-mutations')
  } catch {
    // Storage may be blocked; offline writes are disabled regardless.
  }
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep boot resilient when a browser or host blocks service workers.
    })
  })
}

export const queueOfflineMutation = async () => {
  throw new Error('Writes require an online connection; offline mutation queues are disabled.')
}
