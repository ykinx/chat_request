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

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    console.log('Message API - Received body:', body)
    console.log('Message API - User:', user)

    const { ticket_id, message } = body
    console.log('Message API - Extracted values:', { ticket_id, message, ticket_id_type: typeof ticket_id, message_type: typeof message })

    if (!ticket_id || !message) {
      console.log('Message API - Validation failed:', { ticket_id, message, ticket_id_type: typeof ticket_id, message_type: typeof message })
      return NextResponse.json(
        { error: 'Ticket ID and message are required', details: { ticket_id, message } },
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
      message
    })

    await newMessage.save()
    console.log('Message API - Message created:', newMessage._id)

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