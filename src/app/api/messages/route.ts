import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Message, Ticket } from '@/models'
import { verifyToken } from '@/lib/auth'
import { User } from '@/models'

// Helper function to get user from token (since cookies() doesn't work in API routes called from client)
async function getCurrentUserFromToken(token: string) {
  try {
    await connectToDatabase();
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);
    
    if (!user || !user.is_active) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      department: user.department,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
}

// GET /api/messages?ticket_id=xxx - Get messages for a ticket
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    // Get token from request cookies
    const authCookie = request.cookies.get('auth-token')
    if (!authCookie) {
      return NextResponse.json(
        { error: 'Unauthorized - No auth token' },
        { status: 401 }
      )
    }
    
    const user = await getCurrentUserFromToken(authCookie.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Get ticket_id from query params
    const { searchParams } = new URL(request.url)
    const ticket_id = searchParams.get('ticket_id')

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    // Check if ticket exists and user has access
    const ticket = await Ticket.findById(ticket_id)
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    let hasAccess = false
    
    // Super admin and admin can access all tickets
    if (user.role === 'super_admin' || user.role === 'admin') {
      hasAccess = true
    }
    // IT can only access assigned tickets
    else if (user.role === 'it') {
      hasAccess = ticket.assigned_it_id !== null && (ticket.assigned_it_id as any)._id.toString() === user.id
    }
    // Regular users can only access their own tickets
    else {
      hasAccess = (ticket.user_id as any)._id.toString() === user.id
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get messages for the ticket
    const messages = await Message.find({ ticket_id })
      .populate('sender_id', 'name role')
      .sort({ created_at: 1 })

    // Format messages
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      ticket_id: msg.ticket_id.toString(),
      sender_id: (msg.sender_id as any)._id.toString(),
      message: msg.message,
      image_url: msg.image_url,
      created_at: msg.created_at,
      sender: {
        id: (msg.sender_id as any)._id.toString(),
        name: (msg.sender_id as any).name,
        role: (msg.sender_id as any).role
      }
    }))

    return NextResponse.json({ messages: formattedMessages })

  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('=== MESSAGE API POST CALLED ===')
  try {
    await connectToDatabase()
    
    // Get token from request cookies
    const authCookie = request.cookies.get('auth-token')
    console.log('Auth cookie:', authCookie ? 'Present' : 'Missing')
    if (!authCookie) {
      return NextResponse.json(
        { error: 'Unauthorized - No auth token' },
        { status: 401 }
      )
    }
    
    const user = await getCurrentUserFromToken(authCookie.value)
    console.log('User:', user ? user.id : 'Invalid')
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Handle both JSON and FormData
    let ticket_id: string | null = null
    let message: string | null = null
    let image_url: string | null = null
    
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      ticket_id = formData.get('ticket_id') as string
      message = formData.get('message') as string
      image_url = formData.get('image_url') as string
      console.log('Message API - FormData received')
      console.log('  ticket_id:', ticket_id)
      console.log('  message:', message?.substring(0, 50))
      console.log('  image_url:', image_url ? 'YES (length: ' + image_url.length + ')' : 'NO')
    } else {
      const body = await request.json()
      ticket_id = body.ticket_id
      message = body.message
      image_url = body.image_url
      console.log('Message API - JSON received')
      console.log('  image_url:', image_url ? 'YES (length: ' + image_url.length + ')' : 'NO')
    }

    if (!ticket_id || (!message && !image_url)) {
      console.log('Message API - Validation failed:', { ticket_id, message, image_url })
      return NextResponse.json(
        { error: 'Ticket ID and message or image are required', details: { ticket_id, message, image_url } },
        { status: 400 }
      )
    }

    // Check if ticket exists and user has access
    console.log('Message API - Attempting to find ticket:', ticket_id)
    const ticket = await Ticket.findById(ticket_id)
    if (!ticket) {
      console.log('Message API - Ticket not found:', ticket_id)
      return NextResponse.json(
        { error: 'Ticket not found', ticket_id },
        { status: 404 }
      )
    }

    console.log('Message API - Found ticket:', ticket._id)
    console.log('Message API - Ticket status:', ticket.status)
    console.log('Message API - Ticket user_id:', ticket.user_id)
    console.log('Message API - Ticket assigned_it_id:', ticket.assigned_it_id)

    // Check access permissions
    let hasAccess = false
    
    // Super admin and admin can access all tickets
    if (user.role === 'super_admin' || user.role === 'admin') {
      hasAccess = true
      console.log('Message API - Admin/super_admin access granted')
    }
    // IT can only access assigned tickets
    else if (user.role === 'it') {
      hasAccess = ticket.assigned_it_id !== null && (ticket.assigned_it_id as any)._id.toString() === user.id
      console.log('Message API - IT access check:', hasAccess, 'Assigned IT:', ticket.assigned_it_id, 'User ID:', user.id)
    }
    // Regular users can only access their own tickets
    else {
      hasAccess = (ticket.user_id as any)._id.toString() === user.id
      console.log('Message API - User access check:', hasAccess, 'Ticket User ID:', (ticket.user_id as any)?._id?.toString(), 'User ID:', user.id)
    }

    if (!hasAccess) {
      console.log('Message API - Access denied for user:', user.id, 'role:', user.role)
      return NextResponse.json(
        { error: 'Forbidden', user_id: user.id, user_role: user.role },
        { status: 403 }
      )
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      console.log('Message API - Ticket is closed')
      return NextResponse.json(
        { error: 'Cannot send message to closed ticket', status: ticket.status },
        { status: 400 }
      )
    }

    // Create message
    const newMessage = new Message({
      ticket_id,
      sender_id: user.id,
      message: message || '',
      image_url: image_url || null
    })

    await newMessage.save()
    console.log('Message API - Message created:', newMessage._id, 'Image URL:', image_url ? 'Yes (length: ' + image_url.length + ')' : 'No')

    // Populate sender data
    await newMessage.populate('sender_id', 'id name role')

    // Update ticket's updated_at timestamp
    await Ticket.findByIdAndUpdate(ticket_id, {
      updated_at: new Date()
    })

    // Format the response
    const formattedMessage = {
      id: newMessage._id.toString(),
      ticket_id: newMessage.ticket_id.toString(),
      sender_id: (newMessage.sender_id as any)._id.toString(),
      message: newMessage.message,
      image_url: newMessage.image_url,
      created_at: newMessage.created_at,
      sender: {
        id: (newMessage.sender_id as any)._id.toString(),
        name: (newMessage.sender_id as any).name,
        role: (newMessage.sender_id as any).role
      }
    }

    // Emit socket event for real-time updates
    if (globalThis.io) {
      globalThis.io.to(`ticket-${ticket_id}`).emit('new-message', formattedMessage)
    }

    console.log('Message API - Success response sent')
    return NextResponse.json({
      message: formattedMessage
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating message:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}