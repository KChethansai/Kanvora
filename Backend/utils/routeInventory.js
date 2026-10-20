// Mount metadata avoids reverse-engineering Express 4's lossy mount regexps.
export const routeInventory = (app) => {
  if (!Array.isArray(app?._router?.stack)) {
    throw new TypeError('Expected an Express 4 application with mounted routes')
  }

  const mounts = app.locals.routeMounts
  const walk = (stack, prefix, source) => stack.flatMap((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .filter((method) => layer.route.methods[method] && method !== 'head' && method !== 'options')
        .map((method) => method.toUpperCase())
        .sort()
      if (!methods.length) return []
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path]
      return paths.flatMap((routePath) => {
        if (typeof routePath !== 'string') {
          throw new TypeError('Route inventory requires string route paths')
        }
        return methods.map((method) => ({
          method,
          path: `${prefix}${routePath === '/' ? '' : routePath}` || '/',
          mountPath: prefix || '/',
          routePath,
          source
        }))
      })
    }
    if (layer.handle?.stack) {
      const mount = mounts?.get(layer)
      if (!mount) throw new Error('Missing route inventory mount provenance')
      return walk(layer.handle.stack, `${prefix}${mount.path}`, mount.source)
    }
    return []
  })

  return walk(app._router.stack, '', 'Backend/app.js')
}
