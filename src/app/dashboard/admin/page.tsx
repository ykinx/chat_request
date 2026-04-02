'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'
import { useNotificationManager, sendNotification, playNotificationSound } from '@/lib/notifications'
import { TICKET_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types/ticket'
import dynamic from 'next/dynamic'

const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const STATUS_COLORS = { open: '#22c55e', in_progress: '#f59e0b', closed: '#6b7280' }

// Category-specific colors for Pie chart
const CATEGORY_PIE_COLORS: Record<string, string> = {
  hardware: '#f97316',
  software: '#3b82f6',
  network: '#8b5cf6',
  access_request: '#14b8a6',
  email: '#ec4899',
  printer: '#f59e0b',
  other: '#94a3b8'
}

interface AnalyticsData {
  summary: {
    totalTickets: number
    openTickets: number
    inProgressTickets: number
    closedTickets: number
    resolutionRate: number
  }
  categoryData: { name: string; value: number }[]
  ticketsPerDay: { date: string; tickets: number }[]
  statusTrend: { date: string; open: number; in_progress: number; closed: number }[]
}

// Helper: format tanggal + waktu sesuai locale Indonesia
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminDashboard() {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const { canNotify, requestPermission } = useNotificationManager()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [itUsers, setItUsers] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const ticketsPerPage = 5

  useEffect(() => {
    fetchTickets()
    fetchITUsers()
    fetchAnalytics()
    fetchCurrentUser()
  }, [filter, filterCategory, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, filterCategory, searchQuery])

  useEffect(() => {
    if (!socket || !isConnected) return
    socket.emit('join-admin')
    
    socket.on('new-ticket', ({ ticket }: { ticket: any }) => {
      setTickets(prev => {
        const exists = prev.some(t => t.id === ticket.id)
        if (exists) return prev
        return [ticket, ...prev]
      })
    })
    
    socket.on('ticket-updated', ({ ticket }: { ticket: any }) => {
      setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
    })

    socket.on('new-message', async (message: any) => {
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
      
      setUnreadCounts(prev => ({
        ...prev,
        [message.ticket_id]: (prev[message.ticket_id] || 0) + 1
      }))
      
      setTickets(prev => prev.map(t => 
        t.id === message.ticket_id 
          ? { ...t, last_message: message.message, last_message_at: new Date().toISOString() }
          : t
      ))
    })

    socket.on('messages-marked-read', ({ ticket_id, user_id, unread_count }: { ticket_id: string, user_id: string, unread_count: number }) => {
      if (user_id === currentUserId) {
        setUnreadCounts(prev => ({
          ...prev,
          [ticket_id]: unread_count
        }))
      }
    })

    return () => {
      socket.off('new-ticket')
      socket.off('ticket-updated')
      socket.off('new-message')
      socket.off('messages-marked-read')
      socket.emit('leave-admin')
    }
  }, [socket, isConnected, currentUserId])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics')
      if (response.ok) {
        const data = await response.json()
        console.log('Analytics data:', data)
        setAnalytics(data)
      } else {
        console.error('Analytics API error:', response.status)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    }
  }

  const fetchITUsers = async () => {
    try {
      const response = await fetch('/api/users?role=it')
      if (response.ok) {
        const data = await response.json()
        setItUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching IT users:', error)
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

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (filterCategory) params.append('category', filterCategory)
      
      const response = await fetch(`/api/tickets?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        let filtered = data.tickets || []
        if (filter !== 'all') {
          filtered = filtered.filter((t: any) => t.status === filter)
        }
        setTickets(filtered)
        
        setTimeout(() => {
          if (currentUserId && filtered.length > 0) {
            filtered.forEach((ticket: any) => {
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

  const handleAssignTicket = async (ticketId: string, assignedTo: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_it_id: assignedTo, status: assignedTo ? 'in_progress' : 'open' })
      })
      if (response.ok) {
        fetchTickets()
        fetchAnalytics()
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Ticket assigned successfully',
          timer: 2000
        })
      } else {
        const error = await response.json()
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error || 'Failed to assign ticket'
        })
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to assign ticket' })
    }
  }

  const handleCloseTicket = async (ticketId: string) => {
    const result = await Swal.fire({ title: 'Close Ticket?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes' })
    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' })
        })
        if (response.ok) { fetchTickets(); fetchAnalytics() }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to close ticket' })
      }
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (response.ok) { fetchTickets(); fetchAnalytics() }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update status' })
    }
  }

  const indexOfLastTicket = currentPage * ticketsPerPage
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket)
  const totalPages = Math.ceil(tickets.length / ticketsPerPage)

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'text-green-600 bg-green-50 border-green-200',
      in_progress: 'text-amber-600 bg-amber-50 border-amber-200',
      closed: 'text-gray-600 bg-gray-100 border-gray-200'
    }
    return colors[status] || colors.open
  }

  return (
    <DashboardLayout role="admin">
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col max-w-7xl mx-auto gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Manage and monitor all tickets</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{analytics.summary.totalTickets}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Total Tickets</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{analytics.summary.openTickets}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Open</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-500">{analytics.summary.inProgressTickets}</p>
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
              <p className="text-3xl font-bold text-gray-700">{analytics.summary.closedTickets}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Closed</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-indigo-600">{analytics.summary.resolutionRate}%</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Resolution Rate</p>
            </div>
          </div>
        )}

        {/* Charts Row */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Tickets Created (Last 7 Days)</h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.ticketsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }} />
                    <Line type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Category Distribution</h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.categoryData.map((entry) => ({
                        ...entry,
                        fill: CATEGORY_PIE_COLORS[entry.name] || COLORS[analytics.categoryData.findIndex((e) => e.name === entry.name) % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {analytics.categoryData.map((entry, index) => {
                        const color = CATEGORY_PIE_COLORS[entry.name] || COLORS[index % COLORS.length]
                        return <Cell key={`cell-${index}`} fill={color} />
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
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
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-black">
              <option value="">All Categories</option>
              {TICKET_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>))}
            </select>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-black">
              <option value="all">All Tickets</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : currentTickets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No tickets found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {currentTickets.map((ticket) => {
                const unreadCount = unreadCounts[ticket.id] || 0
                return (
                  <div key={ticket.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/80 transition-colors relative">
                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                      <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-5 text-center z-10">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    <div
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 shadow-sm">
                        {ticket.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{ticket.user?.name || 'Unknown'}</span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CATEGORY_COLORS[ticket.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-700'}`}>{CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS] || ticket.category}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{ticket.description}</p>
                        {/* ✅ UPDATED: Tampilkan tanggal + waktu lengkap dalam format Indonesia */}
                        <p className="text-xs text-gray-500 mt-1.5">
                          Updated: {formatDateTime(ticket.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* IT Staff Assignment Dropdown - Only for open/in_progress tickets */}
                      {ticket.status !== 'closed' && (
                        <select
                          value={ticket.assigned_it_id || ''}
                          onChange={(e) => handleAssignTicket(ticket.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="max-w-[150px] text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Assign IT...</option>
                          {itUsers.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs px-3 py-1.5 rounded-full border-0 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer ${getStatusColor(ticket.status)}`}
                      >
                        <option value="open" className="text-gray-900 bg-white">Open</option>
                        <option value="in_progress" className="text-gray-900 bg-white">In Progress</option>
                        <option value="closed" className="text-gray-900 bg-white">Closed</option>
                      </select>
                      {ticket.status !== 'closed' && (
                        <button onClick={(e) => { e.stopPropagation(); handleCloseTicket(ticket.id) }} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 font-medium transition-colors">Close</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{indexOfFirstTicket + 1}-{Math.min(indexOfLastTicket, tickets.length)} of {tickets.length} tickets</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-medium px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg min-w-10 text-center">{currentPage}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}