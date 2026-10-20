let loader = null

// Load Google Identity only when sign-in is configured. The script is owned by
// Google and changes over time, so it cannot be pinned with an SRI hash.
export const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (loader) return loader

  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('Google sign-in could not load'))
    document.head.appendChild(script)
  })

  return loader
}
