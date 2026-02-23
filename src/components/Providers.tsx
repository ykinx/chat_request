'use client'

import { ReactNode } from 'react'
import { SocketProvider } from '@/lib/socket'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  )
}
