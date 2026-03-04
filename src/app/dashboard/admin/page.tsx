'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'
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

export default function AdminDashboard() {
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [itUsers, setItUsers] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const ticketsPerPage = 5

  useEffect(() => {
    fetchTickets()
    fetchITUsers()
    fetchAnalytics()
  }, [filter, filterCategory, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, filterCategory, searchQuery])

  useEffect(() => {
    if (!socket || !isConnected) return
    socket.emit('join-admin')
    socket.on('new-ticket', ({ ticket }: { ticket: any }) => {
      setTickets(prev => [ticket, ...prev])
    })
    socket.on('ticket-updated', ({ ticket }: { ticket: any }) => {
      setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t))
    })
    return () => {
      socket.off('new-ticket')
      socket.off('ticket-updated')
      socket.emit('leave-admin')
    }
  }, [socket, isConnected])

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
      if (response.ok) { fetchTickets(); fetchAnalytics() }
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
      <div className="p-6 h-screen overflow-hidden flex flex-col max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
        </div>

        {/* Stats Cards */}
        {analytics && (
          <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{analytics.summary.totalTickets}</p>
              <p className="text-xs text-gray-500 mt-1">Total Tickets</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{analytics.summary.openTickets}</p>
              <p className="text-xs text-gray-500 mt-1">Open</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-amber-500">{analytics.summary.inProgressTickets}</p>
              <p className="text-xs text-gray-500 mt-1">In Progress</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-gray-700">{analytics.summary.closedTickets}</p>
              <p className="text-xs text-gray-500 mt-1">Closed</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-indigo-600">{analytics.summary.resolutionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Resolution Rate</p>
            </div>
          </div>
        )}

        {/* Charts Row */}
        {analytics && (
          <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Tickets Created (Last 7 Days)</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={analytics.ticketsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Category Distribution</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={analytics.categoryData} cx="35%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {analytics.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none">
            <option value="">All Category</option>
            {TICKET_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>))}
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none">
            <option value="all">All Tickets</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Content: Tickets + Mini Chart */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Ticket List */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div></div>
            ) : currentTickets.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No tickets found</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {currentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0">
                        {ticket.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{ticket.user?.name || 'Unknown'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[ticket.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-700'}`}>{CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS] || ticket.category}</span>
                        </div>
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{ticket.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Updated at: {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium focus:outline-none cursor-pointer ${getStatusColor(ticket.status)}`}
                      >
                        <option value="open" className="text-gray-900 bg-white">Open</option>
                        <option value="in_progress" className="text-gray-900 bg-white">In Progress</option>
                        <option value="closed" className="text-gray-900 bg-white">Closed</option>
                      </select>
                      {ticket.status !== 'closed' && (
                        <button onClick={(e) => { e.stopPropagation(); handleCloseTicket(ticket.id) }} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 font-medium">Close</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 shrink-0">
          <p className="text-xs text-gray-400">{indexOfFirstTicket + 1}-{Math.min(indexOfLastTicket, tickets.length)} of {tickets.length} tickets</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 bg-white border border-gray-200 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm text-gray-700 px-3 py-1 bg-white border border-gray-200 rounded-lg min-w-[36px] text-center">{currentPage}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 bg-white border border-gray-200 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
