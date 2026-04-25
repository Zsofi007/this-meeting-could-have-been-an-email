export function getUsernameLabel(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metaUsername = typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : null
  if (metaUsername) return metaUsername
  const metaName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
  if (metaName) return metaName
  if (user.email) return user.email.split('@')[0] ?? 'User'
  return 'User'
}

