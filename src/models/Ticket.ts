import mongoose, { Schema, Document, Model } from 'mongoose'

// Ticket categories
export const TICKET_CATEGORIES = [
  'hardware',
  'software', 
  'network',
  'access_request',
  'email',
  'printer',
  'other'
] as const

export type TicketCategory = typeof TICKET_CATEGORIES[number]

export interface ITicket extends Document {
  user_id: mongoose.Types.ObjectId
  assigned_it_id?: mongoose.Types.ObjectId
  status: 'open' | 'in_progress' | 'closed'
  category: TicketCategory
  title: string
  description: string
  image_url?: string
  created_at: Date
  updated_at: Date
}

const TicketSchema = new Schema<ITicket>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_it_id: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'closed'],
    default: 'open'
  },
  category: {
    type: String,
    enum: TICKET_CATEGORIES,
    default: 'other'
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  image_url: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

export const Ticket: Model<ITicket> = mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema)
