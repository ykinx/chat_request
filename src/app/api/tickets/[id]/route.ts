import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ticket, User, Message } from '@/models'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    // Fetch ticket with messages
    const ticket = await Ticket.findById(ticketId)
      .populate('user_id', 'id name email')
      .populate('assigned_it_id', 'id name')
      .lean()

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

    // Fetch messages for this ticket
    const messages = await Message.find({ ticket_id: ticketId })
      .populate('sender_id', 'id name role')
      .sort({ created_at: 1 })
      .lean()

    // Format the response
    const formattedTicket = {
      id: ticket._id.toString(),
      user_id: (ticket.user_id as any)._id.toString(),
      assigned_it_id: ticket.assigned_it_id ? (ticket.assigned_it_id as any)._id.toString() : null,
      status: ticket.status,
      title: ticket.title,
      description: ticket.description,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      user: {
        id: (ticket.user_id as any)._id.toString(),
        name: (ticket.user_id as any).name,
        email: (ticket.user_id as any).email
      },
      assigned_it: ticket.assigned_it_id ? {
        id: (ticket.assigned_it_id as any)._id.toString(),
        name: (ticket.assigned_it_id as any).name
      } : null,
      messages: messages.map(message => ({
        id: message._id.toString(),
        ticket_id: message.ticket_id.toString(),
        sender_id: (message.sender_id as any)._id.toString(),
        message: message.message,
        created_at: message.created_at,
        sender: {
          id: (message.sender_id as any)._id.toString(),
          name: (message.sender_id as any).name,
          role: (message.sender_id as any).role
        }
      }))
    }

    return NextResponse.json({
      ticket: formattedTicket
    })

  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params
    const requestBody = await request.json()
    console.log('PUT request body:', requestBody)
    console.log('Ticket ID:', ticketId)
    console.log('User:', user)
    
    const { status, assigned_it_id } = requestBody

    // Check if ticket exists
    const existingTicket = await Ticket.findById(ticketId)
    if (!existingTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    console.log('Existing ticket:', existingTicket)

    // Check permissions
    if (user.role === 'user') {
      return NextResponse.json(
        { error: 'Users cannot modify tickets' },
        { status: 403 }
      )
    }

    // Admin, super_admin and IT can update tickets
    const updateData: any = {}
    
    // IT can update status to in_progress or closed for their assigned tickets
    if (status && user.role === 'it') {
      // Check if ticket is assigned to this IT user
      if (existingTicket.assigned_it_id?.toString() !== user.id) {
        return NextResponse.json(
          { error: 'You can only modify tickets assigned to you' },
          { status: 403 }
        )
      }
      // IT can change status to in_progress or closed
      if (status === 'in_progress' || status === 'closed' || status === 'open') {
        updateData.status = status
      }
    }
    // Admin and super_admin can update any status
    else if (status && (user.role === 'admin' || user.role === 'super_admin')) {
      updateData.status = status
    }
    
    // Handle assigned_it_id - can be string to assign, or empty string/null to unassign
    if (assigned_it_id !== undefined && (user.role === 'admin' || user.role === 'super_admin')) {
      // Cannot assign closed tickets
      if (existingTicket.status === 'closed' && assigned_it_id !== '' && assigned_it_id !== null) {
        return NextResponse.json(
          { error: 'Cannot assign a closed ticket' },
          { status: 400 }
        )
      }
      
      if (assigned_it_id === '' || assigned_it_id === null) {
        // Unassign the ticket
        updateData.assigned_it_id = null
      } else {
        console.log('Attempting to assign IT user:', assigned_it_id)
        // Validate that the assigned IT user exists
        const itUser = await User.findOne({ 
          _id: assigned_it_id,
          role: 'it',
          is_active: true
        })
        
        console.log('IT User found:', itUser)
        
        if (!itUser) {
          console.log('IT User not found:', assigned_it_id)
          return NextResponse.json(
            { error: 'Invalid IT user ID or user is not active IT staff' },
            { status: 400 }
          )
        }
        
        updateData.assigned_it_id = assigned_it_id
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    console.log('Update data:', updateData)
    
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      updateData,
      { new: true }
    )
      .populate('user_id', 'id name email')
      .populate('assigned_it_id', 'id name')
      .lean()

    console.log('Updated ticket:', updatedTicket)

    if (!updatedTicket) {
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      )
    }

    // Format the response
    const formattedTicket = {
      id: updatedTicket._id.toString(),
      user_id: (updatedTicket.user_id as any)._id.toString(),
      assigned_it_id: updatedTicket.assigned_it_id ? (updatedTicket.assigned_it_id as any)._id.toString() : null,
      status: updatedTicket.status,
      title: updatedTicket.title,
      description: updatedTicket.description,
      created_at: updatedTicket.created_at,
      updated_at: updatedTicket.updated_at,
      user: {
        id: (updatedTicket.user_id as any)._id.toString(),
        name: (updatedTicket.user_id as any).name,
        email: (updatedTicket.user_id as any).email
      },
      assigned_it: updatedTicket.assigned_it_id ? {
        id: (updatedTicket.assigned_it_id as any)._id.toString(),
        name: (updatedTicket.assigned_it_id as any).name
      } : null
    }

    // Emit socket event for ticket update
    if (globalThis.io) {
      // Emit to ticket room
      globalThis.io.to(`ticket-${ticketId}`).emit('ticket-updated', {
        ticket: formattedTicket
      })
      // Emit to user room
      globalThis.io.to(`user-${formattedTicket.user_id}`).emit('ticket-updated', {
        ticket: formattedTicket
      })
      // Emit to admin room
      globalThis.io.to('admin-room').emit('ticket-updated', {
        ticket: formattedTicket
      })
      // Emit to IT room if assigned
      if (formattedTicket.assigned_it_id) {
        globalThis.io.to(`it-${formattedTicket.assigned_it_id}`).emit('ticket-assigned', {
          ticket: formattedTicket
        })
        globalThis.io.to(`it-${formattedTicket.assigned_it_id}`).emit('ticket-updated', {
          ticket: formattedTicket
        })
      }
    }

    return NextResponse.json({
      ticket: formattedTicket
    })

  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}