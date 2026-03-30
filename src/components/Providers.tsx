'use client'

import { ReactNode } from 'react'
import { SocketProvider } from '@/lib/socket'
import GlobalNotificationHandler from '@/components/GlobalNotificationHandler'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SocketProvider>
      <GlobalNotificationHandler />
      {children}
    </SocketProvider>
  )
}
