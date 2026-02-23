import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ticket, User, Message } from '@/models'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let tickets
    
    // Super admin and admin can see all tickets
    if (user.role === 'super_admin' || user.role === 'admin') {
      tickets = await Ticket.find({})
        .populate('user_id', 'id name email')
        .populate('assigned_it_id', 'id name')
        .sort({ updated_at: -1 })
        .lean()
    }
    // IT can only see assigned tickets
    else if (user.role === 'it') {
      tickets = await Ticket.find({ assigned_it_id: user.id })
        .populate('user_id', 'id name email')
        .populate('assigned_it_id', 'id name')
        .sort({ updated_at: -1 })
        .lean()
    }
    // Regular users can only see their own tickets
    else {
      tickets = await Ticket.find({ user_id: user.id })
        .populate('user_id', 'id name email')
        .populate('assigned_it_id', 'id name')
        .sort({ updated_at: -1 })
        .lean()
    }

    // Format the response to match the expected structure
    // Filter out tickets with null user_id (orphaned tickets)
    const formattedTickets = tickets
      .filter(ticket => ticket.user_id !== null && ticket.user_id !== undefined)
      .map(ticket => ({
        id: ticket._id.toString(),
        user_id: ticket.user_id._id.toString(),
        assigned_it_id: ticket.assigned_it_id ? ticket.assigned_it_id._id.toString() : null,
        status: ticket.status,
        title: ticket.title,
        description: ticket.description,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        user: {
          id: ticket.user_id._id.toString(),
          name: (ticket.user_id as any).name,
          email: (ticket.user_id as any).email
        },
        assigned_it: ticket.assigned_it_id ? {
          id: ticket.assigned_it_id._id.toString(),
          name: (ticket.assigned_it_id as any).name
        } : null
      }))

    return NextResponse.json({
      tickets: formattedTickets
    })

  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { description } = await request.json()

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    // Only regular users can create tickets
    if (user.role !== 'user') {
      return NextResponse.json(
        { error: 'Only users can create tickets' },
        { status: 403 }
      )
    }

    // Check if user already has an open ticket
    const existingOpenTicket = await Ticket.findOne({
      user_id: user.id,
      status: 'open'
    })

    if (existingOpenTicket) {
      return NextResponse.json(
        { error: 'You already have an open ticket. Please wait for it to be closed before creating a new one.', existingTicketId: existingOpenTicket._id.toString() },
        { status: 400 }
      )
    }

    // Create ticket with user's name as title
    const ticket = new Ticket({
      user_id: user.id,
      title: user.name,
      description: description,
      status: 'open'
    })

    await ticket.save()

    // Create the first message from description
    const message = new Message({
      ticket_id: ticket._id,
      sender_id: user.id,
      message: description
    })
    await message.save()

    // Populate user data
    await ticket.populate('user_id', 'id name email')
    await message.populate('sender_id', 'id name role')

    const formattedTicket = {
      id: ticket._id.toString(),
      user_id: ticket.user_id._id.toString(),
      status: ticket.status,
      title: ticket.title,
      description: ticket.description,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      user: {
        id: ticket.user_id._id.toString(),
        name: (ticket.user_id as any).name,
        email: (ticket.user_id as any).email
      },
      messages: [{
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
      }]
    }

    return NextResponse.json({
      ticket: formattedTicket
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}