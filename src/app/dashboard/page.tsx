'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UserDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTicket, setNewTicket] = useState({
    description: ''
  })

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const [errorMessage, setErrorMessage] = useState('')

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTicket.description.trim()) return

    setCreating(true)
    setErrorMessage('')
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTicket),
      })

      if (response.ok) {
        const data = await response.json()
        setTickets([data.ticket, ...tickets])
        setNewTicket({ description: '' })
        // Navigate to the new ticket chat
        router.push(`/tickets/${data.ticket.id}`)
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to create ticket')
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      setErrorMessage('An error occurred while creating the ticket')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Skeleton loading for sidebar
  const SidebarSkeleton = () => (
    <div className="w-full lg:w-80 bg-white border-r flex flex-col animate-pulse lg:block">
      <div className="p-4 border-b">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-24 bg-gray-200 rounded mb-3"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  )

  // Skeleton loading for ticket list
  const TicketListSkeleton = () => (
    <div className="flex-1 p-4 lg:p-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 mb-3 shadow-sm">
          <div className="flex justify-between mb-2">
            <div className="h-5 bg-gray-200 rounded w-1/3"></div>
            <div className="h-5 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="h-screen flex flex-col lg:flex-row bg-gray-100">
        <SidebarSkeleton />
        <TicketListSkeleton />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-gray-100 overflow-hidden">
      {/* Sidebar - Create Ticket */}
      <div className="w-full lg:w-80 bg-white border-r flex flex-col shadow-sm lg:h-full">
        {/* Header */}
        <div className="p-4 border-b bg-linear-to-r from-blue-50 to-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create Ticket</h2>
              <p className="text-xs text-gray-500 mt-1">Describe your issue to get help</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Create Ticket Form */}
        <div className="p-4 flex-1 overflow-y-auto">
          <form onSubmit={handleCreateTicket}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Message
              </label>
              <textarea
                required
                rows={6}
                placeholder="Describe your issue in detail..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200"
                value={newTicket.description}
                onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
              />
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={creating || !newTicket.description.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] group"
            >
              {creating ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium">Create Ticket</span>
                </>
              )}
            </button>
          </form>

          {/* Tips */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Tips:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Be specific about your issue</li>
              <li>• Include error messages if any</li>
              <li>• Mention steps to reproduce</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Your ticket will be assigned to our support team
          </p>
        </div>
      </div>

      {/* Main Content - Tickets List */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:h-full">
        {/* Header */}
        <div className="bg-white border-b px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">My Tickets</h1>
          <span className="text-sm text-gray-500">
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
              <p className="text-gray-500 max-w-sm">
                Use the sidebar to create your first ticket. Our team will respond as soon as possible.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl">
              {tickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="bg-white rounded-lg shadow-sm border hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200 p-4 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {ticket.title}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticket.status === 'open' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {ticket.description}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500">
                        {formatDate(ticket.created_at)}
                      </p>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mt-2 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
