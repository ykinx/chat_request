'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/socket'
import Swal from 'sweetalert2'

interface Message {
    id: string
    ticket_id: string
    sender_id: string
    message: string
    image_url?: string
    created_at: string
    sender?: {
        id: string
        name: string
        role: string
    }
}

interface Ticket {
    id: string
    title: string
    status: 'open' | 'in_progress' | 'closed'
    user_id: string
    image_url?: string
    user?: {
        id: string
        name: string
        email: string
    }
    assigned_it?: {
        id: string
        name: string
    } | null
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter()
    const { socket, isConnected } = useSocket()
    const [ticket, setTicket] = useState<Ticket | null>(null)
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState<string>('')
    const [currentUserId, setCurrentUserId] = useState<string>('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Unwrap params Promise
    const { id: ticketId } = use(params)

    useEffect(() => {
        fetchTicketAndMessages()
        fetchCurrentUser()
    }, [ticketId])

    useEffect(() => {
        console.log('userRole changed to:', userRole)
        if (userRole === 'admin' || userRole === 'it' || userRole === 'super_admin') {
            console.log('User is admin/IT, fetching all tickets...')
            fetchAllTickets()
        }
    }, [userRole])

    useEffect(() => {
        if (socket) {
            socket.emit('join-ticket', ticketId)

            socket.on('new-message', (message: Message) => {
                console.log('Received new message via Socket.IO:', message)
                console.log('Message has image:', message.image_url ? 'Yes (length: ' + message.image_url.length + ')' : 'No')
                setMessages(prev => {
                    if (prev.find(m => m.id === message.id)) return prev
                    return [...prev, message]
                })
            })

            return () => {
                socket.emit('leave-ticket', ticketId)
                socket.off('new-message')
            }
        }
    }, [socket, ticketId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const fetchCurrentUser = async () => {
        try {
            console.log('Fetching current user...')
            const response = await fetch('/api/auth/me')
            console.log('Auth me response status:', response.status)
            if (response.ok) {
                const data = await response.json()
                console.log('Current user data:', data.user)
                console.log('Setting user role to:', data.user.role)
                setUserRole(data.user.role)
                setCurrentUserId(data.user.id)
            } else {
                console.error('Failed to fetch user:', await response.text())
            }
        } catch (error) {
            console.error('Error fetching user:', error)
        }
    }

    const fetchAllTickets = async () => {
        try {
            console.log('Fetching all tickets for sidebar')
            const response = await fetch('/api/tickets')
            if (response.ok) {
                const data = await response.json()
                console.log('Tickets fetched:', data.tickets?.length || 0)
                setTickets(data.tickets || [])
            }
        } catch (error) {
            console.error('Error fetching tickets:', error)
        }
    }

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const data = await response.json()
                console.log('Image uploaded, URL length:', data.image_url?.length)
                console.log('Image URL preview:', data.image_url?.substring(0, 100) + '...')
                setSelectedImage(data.image_url)
            } else {
                const errorText = await response.text()
                console.error('Upload error status:', response.status)
                console.error('Upload error text:', errorText)
                let errorMessage = 'Failed to upload image'
                try {
                    const errorJson = JSON.parse(errorText)
                    errorMessage = errorJson.error || errorMessage
                } catch (e) {
                    // Not JSON response
                }
                Swal.fire({
                    title: "Error",
                    text: errorMessage,
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
            setUploadingImage(false)
        }
    }

    const removeSelectedImage = () => {
        setSelectedImage(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const fetchTicketAndMessages = async () => {
        try {
            console.log('Fetching ticket:', ticketId)
            const [ticketRes, messagesRes] = await Promise.all([
                fetch(`/api/tickets/${ticketId}`),
                fetch(`/api/messages?ticket_id=${ticketId}`)
            ])

            console.log('Ticket response:', ticketRes.status)
            console.log('Messages response:', messagesRes.status)

            if (ticketRes.ok && messagesRes.ok) {
                const ticketData = await ticketRes.json()
                const messagesData = await messagesRes.json()
                console.log('Ticket data:', ticketData)
                console.log('Messages data:', messagesData)
                // Log messages with images for debugging
                const messagesWithImages = messagesData.messages?.filter((m: Message) => m.image_url) || []
                console.log('Messages with images:', messagesWithImages)
                setTicket(ticketData.ticket)
                setMessages(messagesData.messages || [])
            } else {
                const ticketError = await ticketRes.text()
                const messagesError = await messagesRes.text()
                console.error('Ticket error:', ticketError)
                console.error('Messages error:', messagesError)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!newMessage.trim() && !selectedImage) {
            return
        }

        try {
            // Use FormData for large image uploads
            const formData = new FormData()
            formData.append('ticket_id', ticketId)
            formData.append('message', newMessage)
            if (selectedImage) {
                formData.append('image_url', selectedImage)
            }

            const response = await fetch('/api/messages', {
                method: 'POST',
                body: formData
            })

            const data = await response.json()

            if (response.ok) {
                setNewMessage('')
                setSelectedImage(null)
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            } else {
                console.error('Failed to send message:', data)
                Swal.fire({
                    title: "Error",
                    text: data.error || 'Failed to send message',
                    icon: "error",
                    draggable: true
                })
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }



    if (!ticket) {
        return (
            <div className="h-screen flex flex-col bg-[#d9dbd5]">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center bg-white p-8 rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Ticket not found</h2>
                        <p className="text-gray-500 mb-4">The ticket you are looking for does not exist.</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 bg-[#4a6b4a] text-white rounded-lg hover:bg-[#3d5a3d] transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const isAdminOrIT = userRole === 'admin' || userRole === 'it' || userRole === 'super_admin'

    return (
        <div className="h-screen flex">
            {/* Sidebar for Admin/IT */}
            {isAdminOrIT && (
                <div className="w-80 bg-white border-r flex flex-col h-screen">
                    {/* Sidebar Header - Fixed */}
                    <div className="bg-white border-b px-4 py-3 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="font-semibold text-gray-900">Tickets</h2>
                                <p className="text-xs text-gray-600">Role: {userRole}</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (userRole === 'it') {
                                        router.push('/dashboard/it')
                                    } else if (userRole === 'admin') {
                                        router.push('/dashboard/admin')
                                    } else if (userRole === 'super_admin') {
                                        router.push('/dashboard/super-admin')
                                    } else {
                                        router.push('/dashboard')
                                    }
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                        {/* Ticket Count Stats */}
                        <div className="flex gap-2 text-xs flex-wrap">
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                Total: {tickets.length}
                            </div>
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Open: {tickets.filter(t => t.status === 'open').length}
                            </div>
                            <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                In Progress: {tickets.filter(t => t.status === 'in_progress').length}
                            </div>
                            <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                                Closed: {tickets.filter(t => t.status === 'closed').length}
                            </div>
                        </div>
                    </div>

                    {/* Tickets List - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        {tickets.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => router.push(`/tickets/${t.id}`)}
                                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${t.id === ticketId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm text-gray-900 truncate">
                                        {t.user?.name || 'Unknown'}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            t.status === 'open'
                                                ? 'bg-green-100 text-green-800'
                                                : t.status === 'in_progress'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {t.status === 'in_progress' ? 'In Progress' : t.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 truncate">{t.title}</p>
                                {t.assigned_it && (
                                    <p className="text-xs text-blue-600 mt-1">
                                        Assigned: {t.assigned_it.name}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
                    <div className="flex-1 flex flex-col bg-gray-100">
                        {/* Header */}
                        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {!isAdminOrIT && (
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="p-2 rounded-lg hover:bg-gray-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                )}
                                <div>
                                    <h1 className="font-semibold text-gray-900">{ticket.title}</h1>
                                    <p className="text-sm text-gray-700">
                                        {ticket.status === 'open' ? 'Open' : ticket.status === 'in_progress' ? 'In Progress' : 'Closed'}
                                        {isConnected && <span className="ml-2 text-green-600">● Live</span>}
                                        <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded text-xs">Role: {userRole || 'loading...'}</span>
                                    </p>
                                </div>
                            </div>
                            {/* Status Update Dropdown for Admin/IT */}
                            {isAdminOrIT && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-700">Status:</span>
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
                                                const response = await fetch(`/api/tickets/${ticketId}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ status: newStatus })
                                                })
                                                if (response.ok) {
                                                    setTicket({ ...ticket, status: newStatus })
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
                                        className="px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
                            {/* Ticket Image (if exists) - DEBUG */}
                            {(() => {
                                console.log('Ticket image_url check:', ticket?.id, 'has image_url:', !!ticket?.image_url)
                                if (ticket?.image_url) {
                                    console.log('Ticket image URL length:', ticket.image_url.length)
                                    console.log('Ticket image URL starts with:', ticket.image_url.substring(0, 50))
                                }
                                return null
                            })()}
                            {ticket?.image_url && (
                                <div className="flex justify-center">
                                    <div className="bg-white rounded-lg shadow-sm p-4 max-w-md w-full">
                                        <p className="text-xs text-gray-500 mb-2 font-medium">📎 Ticket Attachment</p>
                                        <a 
                                            href={ticket.image_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block"
                                        >
                                            <img 
                                                src={ticket.image_url} 
                                                alt="Ticket attachment" 
                                                className="max-w-full max-h-64 rounded-lg border border-gray-200 mx-auto"
                                                onError={(e) => {
                                                    console.error('Ticket image failed to load')
                                                    e.currentTarget.style.display = 'none'
                                                }}
                                            />
                                        </a>
                                    </div>
                                </div>
                            )}
                            
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((message) => {
                                    const isOwnMessage = message.sender_id === currentUserId
                                    if (message.image_url) {
                                        console.log('Rendering message with image:', message.id, 'Image URL length:', message.image_url.length)
                                    }
                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isOwnMessage
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-white text-gray-900 border'
                                                    }`}
                                            >
                                                {!isOwnMessage && message.sender && (
                                                    <p className="text-xs font-medium mb-1 opacity-75">
                                                        {message.sender.name}
                                                    </p>
                                                )}
                                                {/* Image in message - DEBUG */}
                                                {(() => {
                                                    console.log('Checking message for image:', message.id, 'has image_url:', !!message.image_url)
                                                    if (message.image_url) {
                                                        console.log('Image URL type:', typeof message.image_url)
                                                        console.log('Image URL length:', message.image_url.length)
                                                        console.log('Image URL starts with:', message.image_url.substring(0, 30))
                                                    }
                                                    return null
                                                })()}
                                                {message.image_url ? (
                                                    <div className="mb-2">
                                                        <a 
                                                            href={message.image_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="block"
                                                        >
                                                            <img 
                                                                src={message.image_url} 
                                                                alt="Shared image" 
                                                                className="max-w-full max-h-48 rounded-lg border border-gray-200"
                                                                style={{ display: 'block' }}
                                                                onError={(e) => {
                                                                    console.error('Image failed to load for message:', message.id)
                                                                    console.error('Image URL starts with:', message.image_url?.substring(0, 50))
                                                                    const img = e.currentTarget
                                                                    img.style.display = 'none'
                                                                    const parent = img.parentElement
                                                                    if (parent) {
                                                                        parent.innerHTML = '<span class="text-xs text-red-400 underline">Image failed to load</span>'
                                                                    }
                                                                }}
                                                            />
                                                        </a>
                                                    </div>
                                                ) : null}
                                                {message.message && <p>{message.message}</p>}
                                                <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                                                    {new Date(message.created_at).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        {ticket.status === 'open' && (
                            <form onSubmit={handleSendMessage} className="bg-gray-50 border-t border-gray-200 p-3">
                                {/* Selected Image Preview */}
                                {selectedImage && (
                                    <div className="max-w-3xl mx-auto mb-2">
                                        <div className="relative inline-block">
                                            <img 
                                                src={selectedImage} 
                                                alt="Selected" 
                                                className="h-16 w-16 object-cover rounded-lg border border-gray-300"
                                            />
                                            <button
                                                type="button"
                                                onClick={removeSelectedImage}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-2 items-center max-w-3xl mx-auto">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder={selectedImage ? "Add a description (optional)..." : "Type a message..."}
                                        className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 text-sm"
                                    />
                                    {/* Image Upload Button */}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage || !!selectedImage}
                                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                    >
                                        {uploadingImage ? '...' : '📷'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() && !selectedImage}
                                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                    >
                                        Send
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )
            }
