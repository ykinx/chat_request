'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Swal from 'sweetalert2'
import { TICKET_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types/ticket'

interface User {
  id: string
  name: string
  email: string
  role: string
  department: string
  is_active: boolean
  created_at: string
}

interface AuditLog {
  id: string
  user: {
    name: string
    email: string
    role: string
  } | null
  action: string
  details: string
  ip_address: string
  created_at: string
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'tickets' | 'logs'>('tickets')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketCategory, setTicketCategory] = useState('')
  const [ticketStatus, setTicketStatus] = useState('')
  
  // User form states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    work_id: '',
    password: '',
    role: 'super_admin',
    department: ''
  })

  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    role: 'admin',
    department: '',
    is_active: true
  })

  useEffect(() => {
    fetchUsers()
    fetchTickets()
    fetchAuditLogs()
  }, [ticketSearch, ticketCategory, ticketStatus])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/audit-logs?limit=20')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    }
  }

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams()
      if (ticketSearch) params.append('search', ticketSearch)
      if (ticketCategory) params.append('category', ticketCategory)
      if (ticketStatus) params.append('status', ticketStatus)

      const response = await fetch(`/api/tickets?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        const data = await response.json()
        setUsers([data.user, ...users])
        setShowCreateForm(false)
        setNewUser({ name: '', email: '', work_id: '', password: '', role: 'super_admin', department: '' })
        fetchAuditLogs() // Refresh logs
        Swal.fire({
          title: "Created!",
          text: "User has been created successfully",
          icon: "success",
          draggable: true
        })
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to create user',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUser)
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(users.map(u => u.id === selectedUser.id ? data.user : u))
        setShowEditForm(false)
        setSelectedUser(null)
        fetchAuditLogs() // Refresh logs
        Swal.fire({
          title: "Updated!",
          text: "User has been updated successfully",
          icon: "success",
          draggable: true
        })
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to update user',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const result = await Swal.fire({
      title: "Delete this user?",
      text: "This action cannot be undone!",
      showDenyButton: true,
      showCancelButton: false,
      confirmButtonText: "Yes, delete it",
      denyButtonText: "No, keep it",
      icon: "warning"
    })
    
    if (!result.isConfirmed) return

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId))
        fetchAuditLogs() // Refresh logs
        Swal.fire({
          title: "Deleted!",
          text: "User has been deleted successfully",
          icon: "success",
          draggable: true
        })
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to delete user',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !newPassword) return

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      })

      if (response.ok) {
        setShowResetPasswordForm(false)
        setSelectedUser(null)
        setNewPassword('')
        Swal.fire({
          title: "Reset Successful!",
          text: "Password has been reset successfully",
          icon: "success",
          draggable: true
        })
        fetchAuditLogs() // Refresh logs
      } else {
        const error = await response.json()
        Swal.fire({
          title: "Error",
          text: error.error || 'Failed to reset password',
          icon: "error",
          draggable: true
        })
      }
    } catch (error) {
      console.error('Error resetting password:', error)
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active })
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(users.map(u => u.id === user.id ? data.user : u))
        fetchAuditLogs() // Refresh logs
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
    }
  }

  const openEditForm = (user: User) => {
    setSelectedUser(user)
    setEditUser({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      is_active: user.is_active
    })
    setShowEditForm(true)
  }

  const openResetPasswordForm = (user: User) => {
    setSelectedUser(user)
    setNewPassword('')
    setShowResetPasswordForm(true)
  }

  const formatRole = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'it': return 'IT'
      case 'user': return 'User'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800'
      case 'admin': return 'bg-blue-100 text-blue-800'
      case 'it': return 'bg-green-100 text-green-800'
      case 'user': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-xs text-gray-500">System administration and monitoring</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'tickets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Tickets
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Audit Logs
            </button>
          </div>
        </div>

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create User
              </button>
            </div>

            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {users.map((user) => (
                  <li key={user.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-linear-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-semibold shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-gray-900">
                                {user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                              {formatRole(user.role)}
                            </span>
                            {user.department && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {user.department}
                              </span>
                            )}
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {user.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {user.role !== 'super_admin' && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className={`inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg ${
                                  user.is_active
                                    ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                                    : 'text-green-700 bg-green-100 hover:bg-green-200'
                                }`}
                              >
                                {user.is_active ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                onClick={() => openResetPasswordForm(user)}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => openEditForm(user)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-white bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
                />
              </div>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
              >
                <option value="">All Categories</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="access_request">Access Request</option>
                <option value="email">Email</option>
                <option value="printer">Printer</option>
                <option value="other">Other</option>
              </select>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requestor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned IT</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-sm text-gray-500 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        No tickets found
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-700'}`}>
                            {CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS] || ticket.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            ticket.status === 'open' ? 'bg-green-100 text-green-700' :
                            ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.user?.name || ticket.user_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.assigned_it?.name || 'Unassigned'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(ticket.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(ticket.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
            </div>
            <ul className="divide-y divide-gray-100 max-h-150 overflow-y-auto">
              {logs.length === 0 ? (
                <li className="px-4 py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No audit logs found</p>
                </li>
              ) : (
                logs.map((log) => (
                  <li key={log.id} className="px-4 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          <p className="text-sm font-semibold text-gray-900">
                            {log.action}
                          </p>
                        </div>
                        {log.user && (
                          <p className="text-xs text-gray-500 ml-4">
                            by <span className="font-medium">{log.user.name}</span> ({log.user.role})
                          </p>
                        )}
                        {log.details && (
                          <p className="text-xs text-gray-600 mt-2 ml-4 bg-gray-50 p-2 rounded">
                            {log.details}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatDate(log.created_at)}
                        </p>
                        {log.ip_address && (
                          <p className="text-xs text-gray-500 mt-1">
                            IP: <span className="font-mono">{log.ip_address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 flex items-center justify-center">
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-2xl rounded-2xl bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Create New User</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work ID</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.work_id}
                      onChange={(e) => setNewUser({ ...newUser, work_id: e.target.value })}
                      placeholder="Enter work ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="it">IT</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      placeholder="Enter department"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditForm && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 flex items-center justify-center">
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-2xl rounded-2xl bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Edit User</h3>
                <button
                  onClick={() => setShowEditForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={editUser.name}
                      onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={editUser.email}
                      onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={editUser.role}
                      onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="it">IT</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={editUser.department}
                      onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editUser.is_active}
                        onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active User</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordForm && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 flex items-center justify-center">
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-2xl rounded-2xl bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                <button
                  onClick={() => setShowResetPasswordForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">
                  Reset password for
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {selectedUser.name}
                </p>
              </div>
              <form onSubmit={handleResetPassword}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordForm(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    Reset Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
