import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITicketParticipant extends Document {
  ticket_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  unread_count: number
  last_read_at?: Date
  created_at: Date
  updated_at: Date
}

const TicketParticipantSchema = new Schema<ITicketParticipant>({
  ticket_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Ticket', 
    required: true 
  },
  user_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  unread_count: { 
    type: Number, 
    default: 0,
    min: 0
  },
  last_read_at: { 
    type: Date,
    default: null
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

// Compound index for efficient queries
TicketParticipantSchema.index({ ticket_id: 1, user_id: 1 }, { unique: true })
TicketParticipantSchema.index({ user_id: 1, unread_count: -1 })

export const TicketParticipant: Model<ITicketParticipant> = 
  mongoose.models.TicketParticipant || 
  mongoose.model<ITicketParticipant>('TicketParticipant', TicketParticipantSchema)
