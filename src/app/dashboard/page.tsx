'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'
import { TICKET_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, TicketCategory } from '@/types/ticket'

export default function UserDashboard() {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const [tickets, setTickets] = useState<any[]>([])
  const [filteredTickets, setFilteredTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const ticketsPerPage = 5
  const [newTicket, setNewTicket] = useState({
    description: '',
    category: 'other' as TicketCategory
  })
  const [ticketImage, setTicketImage] = useState<string | null>(null)
  const [uploadingTicketImage, setUploadingTicketImage] = useState(false)
  const ticketFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTickets()
  }, [])

  // Socket.IO - Listen for real-time ticket updates
  useEffect(() => {
    if (!socket || !isConnected) return

    // Fetch current user to get userId
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          // Join user room for ticket updates
          socket.emit('join-user', data.user.id)

          // Listen for new tickets
          socket.on('new-ticket', ({ ticket }: { ticket: any }) => {
            // Filter out duplicates before adding
            setTickets(prev => [ticket, ...prev.filter(t => t.id !== ticket.id)])
            setFilteredTickets(prev => [ticket, ...prev.filter(t => t.id !== ticket.id)])
          })

          // Listen for ticket updates
          socket.on('ticket-updated', ({ ticket }: { ticket: any }) => {
            setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
            setFilteredTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
          })
        }
      })

    return () => {
      socket.off('new-ticket')
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

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    filterAndSortTickets(query, sortBy)
  }

  // Sort functionality
  const handleSort = (sortOption: string) => {
    setSortBy(sortOption)
    filterAndSortTickets(searchQuery, sortOption)
  }

  // Filter and sort combined
  const filterAndSortTickets = (query: string, sort: string) => {
    let result = [...tickets]
    
    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      result = result.filter((ticket: any) => 
        ticket.title?.toLowerCase().includes(lowerQuery) ||
        ticket.description?.toLowerCase().includes(lowerQuery) ||
        ticket.status?.toLowerCase().includes(lowerQuery) ||
        ticket.category?.toLowerCase().includes(lowerQuery)
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
    
    // Sort
    result.sort((a: any, b: any) => {
      switch (sort) {
        case 'latest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'status':
          return (a.status || '').localeCompare(b.status || '')
        case 'category':
          return (a.category || '').localeCompare(b.category || '')
        default:
          return 0
      }
    })
    
    setFilteredTickets(result)
    setCurrentPage(1) // Reset to first page when filtering
  }

  // Apply filters when category or status changes
  useEffect(() => {
    filterAndSortTickets(searchQuery, sortBy)
  }, [filterCategory, filterStatus, tickets])

  // Pagination logic
  const indexOfLastTicket = currentPage * ticketsPerPage
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage
  const currentTickets = filteredTickets.slice(indexOfFirstTicket, indexOfLastTicket)
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage)

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleTicketImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingTicketImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setTicketImage(data.image_url)
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to upload image',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      Swal.fire({
        title: "Error",
        text: 'Failed to upload image',
        icon: "error",
        draggable: true
      })
    } finally {
      setUploadingTicketImage(false)
    }
  }

  const removeTicketImage = () => {
    setTicketImage(null)
    if (ticketFileInputRef.current) {
      ticketFileInputRef.current.value = ''
    }
  }

  const [errorMessage, setErrorMessage] = useState('')

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTicket.description.trim()) return

    // Check if user already has 3 open or in_progress tickets
    const activeTickets = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress')
    if (activeTickets.length >= 3) {
      setErrorMessage('You can only have a maximum of 3 active tickets (Open or In Progress). Please close an existing ticket before creating a new one.')
      return
    }

    setCreating(true)
    setErrorMessage('')
    try {
      // Use FormData for large image uploads
      const formData = new FormData()
      formData.append('description', newTicket.description)
      formData.append('category', newTicket.category)
      if (ticketImage) {
        formData.append('image_url', ticketImage)
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        // Filter out any duplicate before adding
        setTickets(prev => [data.ticket, ...prev.filter(t => t.id !== data.ticket.id)])
        setNewTicket({ description: '', category: 'other' })
        setTicketImage(null)
        if (ticketFileInputRef.current) {
          ticketFileInputRef.current.value = ''
        }
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

  // Calculate ticket counts (based on all tickets, not filtered)
  const openCount = tickets.filter((t: any) => t.status === 'open').length
  const inProgressCount = tickets.filter((t: any) => t.status === 'in_progress').length
  const closedCount = tickets.filter((t: any) => t.status === 'closed').length
  const totalCount = tickets.length

  // Skeleton loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{openCount}</p>
              <p className="text-sm text-green-600">Open</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
              <p className="text-sm text-yellow-600">In Progress</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{closedCount}</p>
              <p className="text-sm text-blue-600">Closed</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Ticket Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Create Ticket</h2>
              <p className="text-sm text-gray-500">Describe your issue in detail...</p>
            </div>

            <form onSubmit={handleCreateTicket}>
              {/* Category Selection */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({...newTicket, category: e.target.value as TicketCategory})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {TICKET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <textarea
                required
                rows={4}
                placeholder="Describe your issue in detail..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none mb-3"
                value={newTicket.description}
                onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
              />
              
              {/* Image Upload */}
              <div className="mb-4">
                <input
                  type="file"
                  ref={ticketFileInputRef}
                  onChange={handleTicketImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                
                {ticketImage ? (
                  <div className="relative inline-block">
                    <img 
                      src={ticketImage} 
                      alt="Ticket attachment" 
                      className="h-20 w-20 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={removeTicketImage}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => ticketFileInputRef.current?.click()}
                    disabled={uploadingTicketImage}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {uploadingTicketImage ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Add Image</span>
                      </>
                    )}
                  </button>
                )}
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
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 text-white px-4 py-3 rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Ticket</span>
                  </>
                )}
              </button>
            </form>

            {/* Tips */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Tips:</h4>
              <ul className="text-sm text-gray-500 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  <span>Be specific about your issue</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  <span>Include error messages if any</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  <span>Mention steps to reproduce</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Tickets List */}
          <div className="lg:col-span-2">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-lg font-bold text-gray-900">My Tickets</h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>

                {/* Sort */}
                <select 
                  value={sortBy}
                  onChange={(e) => handleSort(e.target.value)}
                  className="px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="latest">Sort by: Latest</option>
                  <option value="oldest">Sort by: Oldest</option>
                  <option value="title">Sort by: Title</option>
                  <option value="status">Sort by: Status</option>
                  <option value="category">Sort by: Category</option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 placeholder-gray-500 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Tickets */}
            {filteredTickets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No tickets found' : 'No tickets yet'}
                </h3>
                <p className="text-gray-600">
                  {searchQuery ? 'Try a different search term' : 'Create your first ticket to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md cursor-pointer transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-gray-600">
                          {ticket.user?.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{ticket.user?.name || 'Unknown'}</h3>
                              {/* Category Badge */}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[ticket.category as TicketCategory] || 'bg-gray-100 text-gray-700'}`}>
                                {CATEGORY_LABELS[ticket.category as TicketCategory] || 'Other'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-1">{ticket.description}</p>
                          </div>
                          
                          {/* Status Dropdown (Read-only for user) */}
                          <div className="relative">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              ticket.status === 'open' 
                                ? 'bg-green-100 text-green-800' 
                                : ticket.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {ticket.status === 'in_progress' ? 'In Progress' : ticket.status}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            {formatDate(ticket.created_at)}
                          </p>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                
                {searchQuery && (
                  <button 
                    onClick={() => handleSearch('')}
                    className="flex items-center gap-1 text-sm hover:text-gray-900 text-indigo-600"
                  >
                    Clear search
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
