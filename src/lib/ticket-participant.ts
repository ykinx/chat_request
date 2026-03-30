import { TicketParticipant } from '@/models/TicketParticipant'
import { Message } from '@/models/Message'
import mongoose from 'mongoose'

/**
 * Initialize ticket participant when a ticket is created
 * This adds the ticket creator as a participant with 0 unread count
 */
export async function initializeTicketParticipant(
  ticketId: string,
  userId: string
) {
  try {
    await TicketParticipant.findOneAndUpdate(
      {
        ticket_id: new mongoose.Types.ObjectId(ticketId),
        user_id: new mongoose.Types.ObjectId(userId)
      },
      {
        $setOnInsert: {
          unread_count: 0,
          last_read_at: new Date()
        }
      },
      { upsert: true, new: true }
    )
  } catch (error) {
    console.error('Error initializing ticket participant:', error)
    throw error
  }
}

/**
 * Add a user as a participant to a ticket (if not already exists)
 * Used when admin/IT is assigned to a ticket
 */
export async function addTicketParticipant(
  ticketId: string,
  userId: string
) {
  try {
    const participant = await TicketParticipant.findOneAndUpdate(
      {
        ticket_id: new mongoose.Types.ObjectId(ticketId),
        user_id: new mongoose.Types.ObjectId(userId)
      },
      {
        $setOnInsert: {
          unread_count: 0,
          last_read_at: new Date()
        }
      },
      { upsert: true, new: true }
    )
    return participant
  } catch (error) {
    console.error('Error adding ticket participant:', error)
    throw error
  }
}

/**
 * Increment unread count for all participants except the sender
 * Called when a new message is sent
 */
export async function incrementUnreadCounts(
  ticketId: string,
  senderId: string
) {
  try {
    const result = await TicketParticipant.updateMany(
      {
        ticket_id: new mongoose.Types.ObjectId(ticketId),
        user_id: { $ne: new mongoose.Types.ObjectId(senderId) }
      },
      {
        $inc: { unread_count: 1 },
        $set: { updated_at: new Date() }
      }
    )
    
    console.log(`Incremented unread counts for ${result.modifiedCount} participants in ticket ${ticketId}`)
    return result
  } catch (error) {
    console.error('Error incrementing unread counts:', error)
    throw error
  }
}

/**
 * Mark all messages as read for a user in a ticket
 * Resets unread count to 0 and updates last_read_at
 */
export async function markMessagesAsRead(
  ticketId: string,
  userId: string
) {
  try {
    const result = await TicketParticipant.findOneAndUpdate(
      {
        ticket_id: new mongoose.Types.ObjectId(ticketId),
        user_id: new mongoose.Types.ObjectId(userId)
      },
      {
        $set: { 
          unread_count: 0,
          last_read_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true, new: true }
    )
    
    console.log(`Marked messages as read for user ${userId} in ticket ${ticketId}`)
    return result
  } catch (error) {
    console.error('Error marking messages as read:', error)
    throw error
  }
}

/**
 * Get unread count for a user in a specific ticket
 */
export async function getUnreadCount(
  ticketId: string,
  userId: string
): Promise<number> {
  try {
    const participant = await TicketParticipant.findOne({
      ticket_id: new mongoose.Types.ObjectId(ticketId),
      user_id: new mongoose.Types.ObjectId(userId)
    })
    
    return participant?.unread_count || 0
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}

/**
 * Get all tickets with unread messages for a user
 * Returns array of ticket IDs with their unread counts
 */
export async function getTicketsWithUnreadMessages(userId: string) {
  try {
    const participants = await TicketParticipant.find({
      user_id: new mongoose.Types.ObjectId(userId),
      unread_count: { $gt: 0 }
    }).populate('ticket_id')
    
    return participants.map(p => ({
      ticket_id: p.ticket_id._id.toString(),
      unread_count: p.unread_count
    }))
  } catch (error) {
    console.error('Error getting tickets with unread messages:', error)
    return []
  }
}

/**
 * Remove participant when ticket is deleted or user is removed
 */
export async function removeTicketParticipant(
  ticketId: string,
  userId?: string
) {
  try {
    const query: any = {
      ticket_id: new mongoose.Types.ObjectId(ticketId)
    }
    
    if (userId) {
      query.user_id = new mongoose.Types.ObjectId(userId)
    }
    
    await TicketParticipant.deleteMany(query)
    console.log(`Removed participant(s) for ticket ${ticketId}`)
  } catch (error) {
    console.error('Error removing ticket participant:', error)
    throw error
  }
}
