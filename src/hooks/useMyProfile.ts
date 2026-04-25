import { useCallback, useEffect, useState } from 'react'
import { getMyUsername } from '@/services/userService'

export function useMyProfile() {
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setUsername(await getMyUsername())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { username, loading, refetch }
}

