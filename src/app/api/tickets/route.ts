import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ticket, User, Message } from '@/models'
import { getCurrentUser } from '@/lib/auth'
import { TICKET_CATEGORIES } from '@/models/Ticket'

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

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''

    // Build query filter
    let query: any = {}

    // Role-based access
    if (user.role === 'it') {
      query.assigned_it_id = user.id
    } else if (user.role === 'user') {
      query.user_id = user.id
    }
    // Super admin and admin can see all tickets

    // Category filter
    if (category && TICKET_CATEGORIES.includes(category as any)) {
      query.category = category
    }

    // Status filter
    if (status && ['open', 'in_progress', 'closed'].includes(status)) {
      query.status = status
    }

    // Search filter (title or description)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    const tickets = await Ticket.find(query)
      .populate('user_id', 'id name email')
      .populate('assigned_it_id', 'id name')
      .sort({ updated_at: -1 })
      .lean()

    // Format the response to match the expected structure
    // Filter out tickets with null user_id (orphaned tickets)
    const formattedTickets = tickets
      .filter(ticket => ticket.user_id !== null && ticket.user_id !== undefined)
      .map(ticket => ({
        id: ticket._id.toString(),
        user_id: ticket.user_id._id.toString(),
        assigned_it_id: ticket.assigned_it_id ? ticket.assigned_it_id._id.toString() : null,
        status: ticket.status,
        category: ticket.category || 'other',
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

    // Handle both JSON and FormData
    let description: string | null = null
    let image_url: string | null = null
    let category: string = 'other'
    
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      description = formData.get('description') as string
      image_url = formData.get('image_url') as string
      category = (formData.get('category') as string) || 'other'
      console.log('POST /api/tickets - FormData received')
      console.log('  description:', description?.substring(0, 50))
      console.log('  category:', category)
      console.log('  image_url:', image_url ? 'YES (length: ' + image_url.length + ')' : 'NO')
    } else {
      const body = await request.json()
      console.log('=== POST /api/tickets ===')
      console.log('Body keys:', Object.keys(body))
      console.log('image_url in body:', 'image_url' in body)
      
      description = body.description
      image_url = body.image_url
      category = body.category || 'other'
      console.log('Description:', description?.substring(0, 50))
      console.log('Category:', category)
      console.log('Image URL type:', typeof image_url)
      console.log('Image URL length:', image_url?.length)
      console.log('Image URL exists:', !!image_url)
    }

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

    // Check if user already has 3 active tickets (open or in_progress)
    const activeTicketsCount = await Ticket.countDocuments({
      user_id: user.id,
      status: { $in: ['open', 'in_progress'] }
    })

    if (activeTicketsCount >= 3) {
      return NextResponse.json(
        { error: 'You can only have a maximum of 3 active tickets (Open or In Progress). Please close an existing ticket before creating a new one.' },
        { status: 400 }
      )
    }

    // Create ticket with user's name as title
    const ticket = new Ticket({
      user_id: user.id,
      title: user.name,
      description: description,
      category: TICKET_CATEGORIES.includes(category as any) ? category : 'other',
      image_url: image_url || null,
      status: 'open'
    })
    console.log('Creating ticket with image_url:', ticket.image_url ? 'Yes' : 'No')

    await ticket.save()
    console.log('Ticket saved with image_url:', ticket.image_url ? 'Yes (length: ' + ticket.image_url.length + ')' : 'No')

    // Create the first message from description (with image if provided)
    const message = new Message({
      ticket_id: ticket._id,
      sender_id: user.id,
      message: description,
      image_url: image_url || null
    })
    await message.save()
    console.log('First message saved with image_url:', message.image_url ? 'Yes' : 'No')

    // Populate user data
    await ticket.populate('user_id', 'id name email')
    await message.populate('sender_id', 'id name role')
    
    // Re-fetch ticket to get all fields including image_url
    const savedTicket = await Ticket.findById(ticket._id).lean()
    console.log('Saved ticket image_url:', savedTicket?.image_url ? 'Yes' : 'No')

    const formattedTicket = {
      id: ticket._id.toString(),
      user_id: ticket.user_id._id.toString(),
      status: ticket.status,
      category: ticket.category,
      title: ticket.title,
      description: ticket.description,
      image_url: ticket.image_url,
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
        image_url: message.image_url,
        created_at: message.created_at,
        sender: {
          id: (message.sender_id as any)._id.toString(),
          name: (message.sender_id as any).name,
          role: (message.sender_id as any).role
        }
      }]
    }

    // Emit socket event for new ticket
    if (globalThis.io) {
      // Emit to user room
      globalThis.io.to(`user-${user.id}`).emit('new-ticket', {
        ticket: formattedTicket
      })
      // Emit to admin room
      globalThis.io.to('admin-room').emit('new-ticket', {
        ticket: formattedTicket
      })
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