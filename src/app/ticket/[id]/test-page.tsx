'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TestTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [ticketId, setTicketId] = useState<string>('')
  const [ticketData, setTicketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unwrapParams = async () => {
      try {
        const unwrappedParams = await params
        console.log('Params received:', unwrappedParams)
        setTicketId(unwrappedParams.id)
      } catch (err) {
        console.error('Error unwrapping params:', err)
        setError('Failed to get ticket ID')
      }
    }
    unwrapParams()
  }, [params])

  useEffect(() => {
    if (ticketId) {
      console.log('Fetching ticket:', ticketId)
      fetchTicket()
    }
  }, [ticketId])

  const fetchTicket = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tickets/${ticketId}`)
      console.log('API Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Ticket data received:', data)
        setTicketData(data.ticket)
      } else {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        setError(`Failed to load ticket: ${response.status}`)
        // Redirect to admin on error
        router.push('/admin')
      }
    } catch (err) {
      console.error('Network error:', err)
      setError('Network error occurred')
      router.push('/admin')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Loading ticket...</h1>
        <p>Ticket ID: {ticketId}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => router.push('/admin')}>Back to Admin</button>
      </div>
    )
  }

  if (!ticketData) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>No ticket data</h1>
        <p>Ticket ID: {ticketId}</p>
        <button onClick={() => router.push('/admin')}>Back to Admin</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Ticket Details</h1>
      <p><strong>ID:</strong> {ticketData.id}</p>
      <p><strong>Title:</strong> {ticketData.title}</p>
      <p><strong>Status:</strong> {ticketData.status}</p>
      <p><strong>Created by:</strong> {ticketData.user?.name}</p>
      <button onClick={() => router.push('/admin')}>Back to Admin</button>
    </div>
  )
}