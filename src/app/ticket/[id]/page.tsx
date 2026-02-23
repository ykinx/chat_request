'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TicketChatPage from './TicketChatPage'

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [ticketId, setTicketId] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Get ticket ID
  useEffect(() => {
    const unwrapParams = async () => {
      const unwrappedParams = await params
      setTicketId(unwrappedParams.id)
    }
    unwrapParams()
  }, [params])

  // Get user session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        } else {
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  if (loading || !ticketId || !user) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <TicketChatPage 
      ticketId={ticketId} 
      userRole={user.role} 
      user={user} 
    />
  )
}
