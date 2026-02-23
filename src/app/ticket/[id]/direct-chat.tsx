'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function DirectChat({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [ticketId, setTicketId] = useState<string>('')
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [ticket, setTicket] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      }
    }
    fetchUser()
  }, [router])

  // Get ticket and messages
  useEffect(() => {
    if (ticketId && user) {
      fetchTicketData()
    }
  }, [ticketId, user])

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchTicketData = async () => {
    try {
      // Fetch ticket
      const ticketResponse = await fetch(`/api/tickets/${ticketId}`)
      if (!ticketResponse.ok) {
        router.push('/admin')
        return
      }
      
      const ticketData = await ticketResponse.json()
      setTicket(ticketData.ticket)
      
      // Set messages
      setMessages(ticketData.ticket.messages || [])
    } catch (error) {
      console.error('Error fetching ticket:', error)
      router.push('/admin')
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          message: newMessage
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!ticketId || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ticket Not Found</h2>
          <p className="text-gray-600 mb-4">The conversation you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
              <p className="text-sm text-gray-500">Ticket ID: {ticketId}</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Messages Area */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Conversation</h2>
          </div>
          
          <div className="h-96 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === user.id 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">
                          {message.sender?.name || 'Unknown'}
                        </span>
                        <span className={`text-xs ml-2 ${
                          message.sender_id === user.id ? 'text-indigo-200' : 'text-gray-500'
                        }`}>
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white rounded-lg shadow">
          <form onSubmit={handleSendMessage} className="p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}