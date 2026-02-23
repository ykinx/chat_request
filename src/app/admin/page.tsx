'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

export default function AdminDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [itUsers, setItUsers] = useState<any[]>([])
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])

  useEffect(() => {
    fetchTickets()
    fetchITUsers()
  }, [filter]) // Hanya re-fetch ketika filter berubah

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
      const response = await fetch('/api/tickets')
      console.log('Admin - Tickets API response:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Admin - Tickets data:', data.tickets?.length || 0, 'tickets')
        let filteredTickets = data.tickets
        
        if (filter === 'open') {
          filteredTickets = filteredTickets.filter((t: any) => t.status === 'open')
        } else if (filter === 'closed') {
          filteredTickets = filteredTickets.filter((t: any) => t.status === 'closed')
        } else if (filter === 'assigned') {
          filteredTickets = filteredTickets.filter((t: any) => t.assigned_it_id)
        } else if (filter === 'unassigned') {
          filteredTickets = filteredTickets.filter((t: any) => !t.assigned_it_id)
        }
        
        console.log('Admin - Filtered tickets:', filteredTickets?.length || 0)
        setTickets(filteredTickets)
      } else {
        console.error('Admin - Failed to fetch tickets:', response.status)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignIT = async (ticketId: string, itId: string) => {
    if (!itId) return
    
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assigned_it_id: itId
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
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to assign IT')
      }
    } catch (error) {
      console.error('Error assigning IT:', error)
    }
  }

  const handleCloseTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to close this ticket?')) return
    
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
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to close ticket')
      }
    } catch (error) {
      console.error('Error closing ticket:', error)
    }
  }

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets((prevSelected) =>
      prevSelected.includes(ticketId)
        ? prevSelected.filter((id) => id !== ticketId)
        : [...prevSelected, ticketId]
    )
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

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="admin">
      <div className="px-0 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Tickets</h1>
          <div className="w-full sm:w-auto">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="block w-full sm:w-auto pl-3 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            >
              <option value="all">All Tickets</option>
              <option value="open">Open Tickets</option>
              <option value="closed">Closed Tickets</option>
              <option value="assigned">Assigned Tickets</option>
              <option value="unassigned">Unassigned Tickets</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
              <p className="mt-1 text-sm text-gray-500">Try changing the filter criteria.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <div className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center space-x-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedTickets.includes(ticket.id)}
                          onChange={() => toggleTicketSelection(ticket.id)}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1 sm:mt-0"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{ticket.title}</div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                            {ticket.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 shrink-0">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {/* Assigned IT Info */}
                    {ticket.assigned_it && (
                      <div className="mt-2 text-xs text-gray-600">
                        Assigned to: <span className="font-medium text-gray-900">{ticket.assigned_it.name}</span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!ticket.assigned_it ? (
                        <div className="flex gap-2 items-center">
                          {itUsers.length > 0 ? (
                            <>
                              <select
                                id={`assign-select-${ticket.id}`}
                                className="block w-40 sm:w-48 pl-2 pr-6 py-1.5 text-xs text-gray-900 bg-white border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                              >
                                <option value="">Select IT staff...</option>
                                {itUsers.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  const select = document.getElementById(`assign-select-${ticket.id}`) as HTMLSelectElement
                                  if (select && select.value) {
                                    handleAssignIT(ticket.id, select.value)
                                  } else {
                                    alert('Please select an IT staff first')
                                  }
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Assign
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">No IT staff available</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAssignIT(ticket.id, '')}
                          className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Unassign
                        </button>
                      )}
                      {ticket.status === 'open' && (
                        <button
                          onClick={() => handleCloseTicket(ticket.id)}
                          className="inline-flex items-center px-2 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Close
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/ticket/${ticket.id}`)}
                        className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}