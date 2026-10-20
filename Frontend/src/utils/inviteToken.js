export const inviteFromLocation = (location) => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const search = new URLSearchParams(location.search)
  return hash.get('invite') || search.get('invite')
}
