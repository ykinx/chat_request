'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'
import { useNotificationManager, sendNotification, playNotificationSound } from '@/lib/notifications'
import { TICKET_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, TicketCategory } from '@/types/ticket'

export default function ITDashboard() {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const { canNotify, requestPermission } = useNotificationManager()
  const [tickets, setTickets] = useState<any[]>([])
  const [filteredTickets, setFilteredTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ticketsPerPage = 5
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    fetchTickets()
    fetchCurrentUser()
  }, [])

  // Filter tickets when search/filter changes
  useEffect(() => {
    let result = [...tickets]
    
    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase()
      result = result.filter((ticket: any) => 
        ticket.title?.toLowerCase().includes(lowerQuery) ||
        ticket.description?.toLowerCase().includes(lowerQuery) ||
        ticket.user?.name?.toLowerCase().includes(lowerQuery)
      )
    }

    // Filter by category
    if (filterCategory) {
      result = result.filter((ticket: any) => ticket.category === filterCategory)
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter((ticket: any) => ticket.status === filterStatus)
    }
    
    setFilteredTickets(result)
    setCurrentPage(1)
  }, [tickets, searchQuery, filterCategory, filterStatus])

  // Pagination logic
  const indexOfLastTicket = currentPage * ticketsPerPage
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage
  const currentTickets = filteredTickets.slice(indexOfFirstTicket, indexOfLastTicket)
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage)

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  // Socket.IO - Listen for real-time ticket updates
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('Socket not connected:', { socket, isConnected })
      return
    }

    // Fetch current user to get userId
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          const userId = data.user.id
          setCurrentUserId(userId)
          
          console.log('IT Staff joining room:', `it-${userId}`)
          // Join IT room for assigned ticket updates
          socket.emit('join-it', userId)

          // Listen for new assigned tickets
          socket.on('ticket-assigned', ({ ticket }: { ticket: any }) => {
            console.log('IT Staff received ticket-assigned:', ticket)
            // Prevent duplicates by checking if ticket already exists
            setTickets(prev => {
              const exists = prev.some(t => t.id === ticket.id)
              if (exists) {
                console.log('Ticket already exists, updating instead:', ticket.id)
                return prev.map(t => t.id === ticket.id ? ticket : t)
              }
              return [ticket, ...prev]
            })
            // Also fetch unread count for newly assigned ticket
            setTimeout(() => fetchUnreadCount(ticket.id), 500)
          })

          // Listen for ticket updates
          socket.on('ticket-updated', ({ ticket }: { ticket: any }) => {
            console.log('IT Staff received ticket-updated:', ticket)
            setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
          })

          // Listen for new messages
          socket.on('new-message', async (message: any) => {
            console.log('IT Staff received new-message event:', message)
            
            let granted = canNotify
            if (!granted) {
              granted = await requestPermission()
            }

            if (!granted) return

            const senderName = message.sender?.name || message.sender_name || 'Someone'
            sendNotification({
              title: `New message from ${senderName}`,
              body: message.message || 'Ada pesan baru',
              icon: '/favicon.ico',
              tag: `ticket-${message.ticket_id}`
            })
            playNotificationSound()
            
            // Increment unread count for this ticket
            setUnreadCounts(prev => ({
              ...prev,
              [message.ticket_id]: (prev[message.ticket_id] || 0) + 1
            }))
            
            // Also update the ticket in the list to show latest message preview
            setTickets(prev => prev.map(t => 
              t.id === message.ticket_id 
                ? { ...t, last_message: message.message, last_message_at: new Date().toISOString() }
                : t
            ))
          })
          
          // Listen for messages marked as read
          socket.on('messages-marked-read', ({ ticket_id, user_id, unread_count }: { ticket_id: string, user_id: string, unread_count: number }) => {
            console.log('IT Staff received messages-marked-read:', { ticket_id, user_id, unread_count })
            if (user_id === userId) {
              setUnreadCounts(prev => ({
                ...prev,
                [ticket_id]: unread_count
              }))
            }
          })
          
          // Listen for unread count updates
          socket.on('unread-count-updated', ({ ticket_id, updated_by }: { ticket_id: string, updated_by: string }) => {
            console.log('IT Staff received unread-count-updated:', { ticket_id, updated_by })
            // Only update if we're not the one who updated it
            if (updated_by !== userId) {
              setUnreadCounts(prev => ({
                ...prev,
                [ticket_id]: (prev[ticket_id] || 0) + 1
              }))
            }
          })
        } else {
          console.error('No user data received from /api/auth/me')
        }
      })
      .catch(err => console.error('Error fetching user for IT staff:', err))

    return () => {
      console.log('Cleaning up IT staff socket listeners')
      socket.off('ticket-assigned')
      socket.off('ticket-updated')
      socket.off('new-message')
      socket.off('messages-marked-read')
      socket.off('unread-count-updated')
    }
  }, [socket, isConnected])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      if (response.ok) {
        const data = await response.json()
        // Remove duplicates from API response just in case
        const uniqueTickets = Array.from(new Map(data.tickets.map((t: any) => [t.id, t])).values())
        setTickets(uniqueTickets)
        setFilteredTickets(uniqueTickets)
        
        // Fetch unread counts for all tickets after user ID is available
        setTimeout(() => {
          if (currentUserId && uniqueTickets.length > 0) {
            uniqueTickets.forEach((ticket: any) => {
              fetchUnreadCount(ticket.id)
            })
          }
        }, 100)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setCurrentUserId(data.user.id)
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const fetchUnreadCount = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets/unread-count?ticket_id=${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setUnreadCounts(prev => ({
          ...prev,
          [ticketId]: data.unread_count || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
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

  const handleCloseTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const result = await Swal.fire({
      title: "Close this ticket?",
      text: "Are you sure you want to close this ticket?",
      showDenyButton: true,
      showCancelButton: false,
      confirmButtonText: "Yes, close it",
      denyButtonText: "No, keep it open",
      icon: "question"
    })
    
    if (!result.isConfirmed) return
    
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'closed'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update local state with the updated ticket
        setTickets(tickets.map(ticket => 
          ticket.id === ticketId 
            ? data.ticket
            : ticket
        ))
        Swal.fire({
          title: "Closed!",
          text: "Ticket has been closed successfully",
          icon: "success",
          draggable: true
        })
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to close ticket',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error closing ticket:', error)
    }
  }

  // Calculate ticket counts from ALL tickets (not affected by filters)
  const totalTickets = tickets.length
  const openTickets = tickets.filter((t: any) => t.status === 'open').length
  const inProgressTickets = tickets.filter((t: any) => t.status === 'in_progress').length
  const closedTickets = tickets.filter((t: any) => t.status === 'closed').length

  if (loading) {
    return (
      <DashboardLayout role="it">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="it">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Assigned Tickets</h1>
              <p className="text-xs text-gray-500">Manage and resolve assigned tickets</p>
            </div>
          </div>
        </div>

        {/* Ticket Count Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalTickets}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Total</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600">{openTickets}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Open</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{inProgressTickets}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">In Progress</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-700">{closedTickets}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Closed</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-black"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-black"
            >
              <option value="">All Categories</option>
              {TICKET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-black"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="flex flex-col gap-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {searchQuery || filterCategory || filterStatus ? 'No tickets found' : 'No assigned tickets'}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {searchQuery || filterCategory || filterStatus ? 'Try different search or filter criteria.' : 'Tickets assigned to you will appear here.'}
              </p>
            </div>
          ) : (
            currentTickets.map((ticket) => {
              const unreadCount = unreadCounts[ticket.id] || 0
              return (
                <div 
                  key={ticket.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow relative"
                >
                  {/* Unread Badge */}
                  {unreadCount > 0 && (
                    <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-5 text-center z-10">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  
                  {/* Ticket Header */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 flex-1">{ticket.title}</h3>
                    {/* Category Badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[ticket.category as TicketCategory] || 'bg-gray-100 text-gray-700'}`}>
                      {CATEGORY_LABELS[ticket.category as TicketCategory] || 'Other'}
                    </span>
                  </div>
                  
                  {/* Ticket Body */}
                  <div className="px-5 py-4 flex items-start gap-4">
                    {/* Left Border Indicator */}
                    <div className={`w-1 h-full min-h-12 rounded-full ${
                      ticket.status === 'open' 
                        ? 'bg-green-500' 
                        : ticket.status === 'in_progress'
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                    }`}></div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{ticket.user?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{ticket.description}</p>
                      <p className="text-xs text-gray-500">Created {formatDate(ticket.created_at)}</p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                      {/* Status Dropdown */}
                      <div className="relative">
                        <select
                          value={ticket.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value as 'open' | 'in_progress' | 'closed'
                            if (newStatus === 'closed') {
                              const result = await Swal.fire({
                                title: "Close this ticket?",
                                text: "Are you sure you want to close this ticket?",
                                showDenyButton: true,
                                showCancelButton: false,
                                confirmButtonText: "Yes, close it",
                                denyButtonText: "No, keep it open",
                                icon: "question"
                              })
                              if (!result.isConfirmed) {
                                e.target.value = ticket.status
                                return
                              }
                            }
                            try {
                              const response = await fetch(`/api/tickets/${ticket.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: newStatus })
                              })
                              if (response.ok) {
                                const data = await response.json()
                                setTickets(tickets.map(t => t.id === ticket.id ? data.ticket : t))
                                Swal.fire({
                                  title: "Updated!",
                                  text: "Ticket status has been updated",
                                  icon: "success",
                                  draggable: true
                                })
                              }
                            } catch (error) {
                              console.error('Error updating status:', error)
                            }
                          }}
                          disabled={ticket.status === 'closed'}
                          className={`appearance-none pl-3 pr-8 py-2 text-sm font-semibold rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                            ticket.status === 'open'
                              ? 'bg-green-100 text-green-800 focus:ring-green-500'
                              : ticket.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800 focus:ring-yellow-500'
                              : 'bg-gray-100 text-gray-800 focus:ring-gray-500'
                          }`}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Open Ticket Button */}
                      <button
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                      >
                        {ticket.status === 'closed' ? 'View' : 'Open'}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination */}
          {filteredTickets.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm text-gray-600 font-medium">
                  {indexOfFirstTicket + 1}-{Math.min(indexOfLastTicket, filteredTickets.length)} of {filteredTickets.length} tickets
                </span>
                
                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => paginate(page)}
                        className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  {/* Next Button */}
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}