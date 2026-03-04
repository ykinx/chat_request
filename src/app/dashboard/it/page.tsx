'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'
import { TICKET_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, TicketCategory } from '@/types/ticket'

export default function ITDashboard() {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const [tickets, setTickets] = useState<any[]>([])
  const [filteredTickets, setFilteredTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ticketsPerPage = 5

  useEffect(() => {
    fetchTickets()
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
    if (!socket || !isConnected) return

    // Fetch current user to get userId
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          // Join IT room for assigned ticket updates
          socket.emit('join-it', data.user.id)

          // Listen for new assigned tickets
          socket.on('ticket-assigned', ({ ticket }: { ticket: any }) => {
            setTickets(prev => [ticket, ...prev])
          })

          // Listen for ticket updates
          socket.on('ticket-updated', ({ ticket }: { ticket: any }) => {
            setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
          })
        }
      })

    return () => {
      socket.off('ticket-assigned')
      socket.off('ticket-updated')
    }
  }, [socket, isConnected])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets)
        setFilteredTickets(data.tickets)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
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
      <div className="px-4 py-6 sm:px-0 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900">My Assigned Tickets</h1>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block w-40 pl-3 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
            >
              <option value="">All Categories</option>
              {TICKET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-40 pl-3 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Ticket Count Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{totalTickets}</p>
            <p className="text-xs text-gray-600 mt-1">Total</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{openTickets}</p>
            <p className="text-xs text-gray-600 mt-1">Open</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">{inProgressTickets}</p>
            <p className="text-xs text-gray-600 mt-1">In Progress</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-600">{closedTickets}</p>
            <p className="text-xs text-gray-600 mt-1">Closed</p>
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-3 max-w-4xl mx-auto">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery || filterCategory || filterStatus ? 'No tickets found' : 'No assigned tickets'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterCategory || filterStatus ? 'Try different search or filter criteria.' : 'Tickets assigned to you will appear here.'}
              </p>
            </div>
          ) : (
            currentTickets.map((ticket) => (
              <div 
                key={ticket.id}
                className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Ticket Header */}
                <div className="px-2 py-1.5 border-b border-gray-100 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">{ticket.title}</h3>
                  {/* Category Badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[ticket.category as TicketCategory] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[ticket.category as TicketCategory] || 'Other'}
                  </span>
                </div>
                
                {/* Ticket Body */}
                <div className="px-2 py-1.5 flex items-start gap-1.5">
                  {/* Left Border Indicator */}
                  <div className={`w-0.5 h-full min-h-8 rounded-full ${
                    ticket.status === 'open' 
                      ? 'bg-green-500' 
                      : ticket.status === 'in_progress'
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                  }`}></div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-0.5">{ticket.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-600 line-clamp-1">{ticket.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Created {formatDate(ticket.created_at)}</p>
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
                        className={`appearance-none pl-3 pr-8 py-1.5 text-sm font-medium rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                    >
                      {ticket.status === 'closed' ? 'View' : 'Open'}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          {filteredTickets.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <span className="text-sm text-gray-600">
                {indexOfFirstTicket + 1}-{Math.min(indexOfLastTicket, filteredTickets.length)} of {filteredTickets.length} tickets
              </span>
              
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}