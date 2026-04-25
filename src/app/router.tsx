import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { HomePage } from '@/pages/HomePage'
import { RoomPage } from '@/pages/RoomPage'

export const appRouter = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/room/:roomId',
    element: (
      <RequireAuth>
        <RoomPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

