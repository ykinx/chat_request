'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/socket'

interface Ticket {
  id: string
  title: string
  status: string
  user: {
    name: string
    email: string
  }
  created_at: string
}

interface TicketChatPageProps {
  ticketId: string
  userRole: 'admin' | 'it' | 'user'
  user: any
}

// Skeleton Components
function SidebarSkeleton() {
  return (
    <div className="w-80 bg-white border-r flex flex-col animate-pulse">
      <div className="p-4 border-b">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-5 bg-gray-200 rounded-full w-12"></div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatHeaderSkeleton() {
  return (
    <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm animate-pulse">
      <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
      <div className="flex-1">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Received message skeleton */}
      <div className="flex justify-start animate-pulse">
        <div className="max-w-[70%] space-y-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="bg-gray-200 rounded-2xl rounded-tl-md px-4 py-3 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-48"></div>
            <div className="h-4 bg-gray-300 rounded w-32"></div>
          </div>
        </div>
      </div>
      {/* Sent message skeleton */}
      <div className="flex justify-end animate-pulse">
        <div className="max-w-[70%]">
          <div className="bg-blue-200 rounded-2xl rounded-tr-md px-4 py-3 space-y-2">
            <div className="h-4 bg-blue-300 rounded w-40"></div>
            <div className="h-4 bg-blue-300 rounded w-24"></div>
          </div>
        </div>
      </div>
      {/* Received message skeleton */}
      <div className="flex justify-start animate-pulse">
        <div className="max-w-[70%] space-y-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="bg-gray-200 rounded-2xl rounded-tl-md px-4 py-3">
            <div className="h-4 bg-gray-300 rounded w-56"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InputSkeleton() {
  return (
    <div className="bg-white border-t px-4 py-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-11 bg-gray-200 rounded-full"></div>
        <div className="h-11 w-11 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  )
}

export default function TicketChatPage({ ticketId, userRole, user }: TicketChatPageProps) {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get ticket and messages
  useEffect(() => {
    if (ticketId && user) {
      fetchTicketData()
      fetchAllTickets()
    }
  }, [ticketId, user])

  // Socket.IO: Join ticket room and listen for new messages
  useEffect(() => {
    if (socket && ticketId && isConnected) {
      socket.emit('join-ticket', ticketId)

      socket.on('new-message', (message: any) => {
        setMessages(prev => {
          if (prev.some(msg => msg.id === message.id)) return prev
          const allMessages = [...prev, message]
          allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return allMessages
        })
      })

      return () => {
        socket.emit('leave-ticket', ticketId)
        socket.off('new-message')
      }
    }
  }, [socket, ticketId, isConnected])

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchAllTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    }
  }

  const fetchTicketData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${ticketId}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
        } else if (response.status === 403) {
          router.push('/dashboard')
        } else if (response.status === 404) {
          setTicket(null)
        }
        return
      }
      
      const data = await response.json()
      setTicket(data.ticket)
      
      if (data.ticket.messages && data.ticket.messages.length > 0) {
        const sortedMessages = [...data.ticket.messages].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        setMessages(sortedMessages)
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error fetching ticket:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending || !ticketId) return

    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticket_id: ticketId, message: newMessage }),
      })

      if (response.ok) {
        setNewMessage('')
      } else if (response.status === 401) {
        router.push('/login')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to send message')
      }
    } catch (error) {
      alert('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const isOwnMessage = (senderId: any) => {
    const senderIdStr = typeof senderId === 'object' && senderId?._id 
      ? senderId._id.toString() 
      : senderId?.toString()
    return senderIdStr === user?.id?.toString()
  }

  const handleBack = () => {
    if (userRole === 'admin') {
      router.push('/admin')
    } else if (userRole === 'it') {
      router.push('/it')
    } else {
      router.push('/dashboard')
    }
  }

  const handleTicketClick = (id: string) => {
    if (id !== ticketId) {
      router.push(`/ticket/${id}`)
    }
  }

  // Loading State with Skeleton
  if (loading) {
    return (
      <div className="h-screen flex bg-gray-100 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeaderSkeleton />
          <MessagesSkeleton />
          <InputSkeleton />
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-6 rounded-lg shadow-lg animate-slide-up">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 animate-pulse"></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Ticket Not Found</h2>
          <p className="text-gray-500 text-sm mb-4">This conversation doesn't exist.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-all duration-200 hover:shadow-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleCreateTicket = () => {
    router.push('/dashboard')
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-gray-100 overflow-hidden">
      {/* Sidebar for Admin/IT - Ticket List */}
      {(userRole === 'admin' || userRole === 'it') && (
        <div 
          className={`bg-white border-r flex flex-col transition-all duration-300 ease-in-out absolute lg:relative z-20 h-full ${
            isSidebarOpen ? 'w-full lg:w-80 translate-x-0' : 'w-0 lg:w-0 -translate-x-full lg:translate-x-0 opacity-0 lg:opacity-0'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b bg-linear-to-r from-white to-gray-50">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-3 transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">All Tickets</h2>
          </div>

          {/* Tickets List with smooth hover animations */}
          <div className="flex-1 overflow-y-auto">
            {tickets.map((t, index) => (
              <div
                key={t.id}
                onClick={() => handleTicketClick(t.id)}
                className={`p-4 border-b cursor-pointer transition-all duration-200 ease-out hover:shadow-md ${
                  t.id === ticketId 
                    ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm' 
                    : 'bg-white hover:bg-gray-50 hover:translate-x-1'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-gray-900 truncate transition-colors duration-200">{t.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full transition-all duration-200 ${
                    t.status === 'open' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 transition-colors duration-200">{t.user?.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area with smooth transitions - Full width for users */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
        {/* Header with glass effect */}
        <div className="bg-white/95 backdrop-blur-sm border-b px-3 lg:px-4 py-3 flex items-center gap-2 lg:gap-3 shadow-sm sticky top-0 z-10">
          {(userRole === 'admin' || userRole === 'it') && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-600 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
          {/* Back button for regular users */}
          {userRole === 'user' && (
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              title="Back to Dashboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-gray-900 font-medium text-sm lg:text-base truncate transition-all duration-200">{ticket.title}</h1>
            <p className="text-gray-500 text-xs flex items-center gap-2">
              <span className="transition-all duration-200">{ticket.status === 'open' ? 'Open' : 'Closed'}</span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-green-600 animate-fade-in">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Messages Area with smooth scroll and message animations */}
        <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.length === 0 ? (
              <div className="flex justify-center py-8 animate-fade-in">
                <div className="bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg shadow-sm">
                  No messages yet. Start the conversation!
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const isMine = isOwnMessage(message.sender_id)
                  const isLast = index === messages.length - 1
                  return (
                    <div 
                      key={message.id} 
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      style={{
                        animation: `slideIn${isMine ? 'Right' : 'Left'} 0.3s ease-out ${isLast ? 0 : index * 50}ms both`
                      }}
                    >
                      <div 
                        className={`max-w-[80%] sm:max-w-[70%] px-4 py-2 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
                          isMine
                            ? 'bg-blue-500 text-white rounded-br-md' 
                            : 'bg-white text-gray-800 border rounded-bl-md'
                        }`}
                      >
                        {!isMine && (
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            {message.sender?.name || 'Unknown'}
                          </p>
                        )}
                        <p className="text-sm wrap-break-word leading-relaxed">{message.message}</p>
                        <p className={`text-[10px] text-right mt-1 ${
                          isMine ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input Area with focus animation */}
        <div className="bg-white border-t px-3 lg:px-4 py-3 shadow-lg">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 lg:gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-full px-4 lg:px-5 py-2.5 lg:py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 focus:shadow-md"
                disabled={sending || ticket.status === 'closed'}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending || ticket.status === 'closed'}
                className="bg-blue-500 text-white p-2.5 lg:p-3 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 shrink-0"
              >
                {sending ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slide-up {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}
