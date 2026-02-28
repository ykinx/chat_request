import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITicket extends Document {
  user_id: mongoose.Types.ObjectId
  assigned_it_id?: mongoose.Types.ObjectId
  status: 'open' | 'closed'
  title: string
  description: string
  created_at: Date
  updated_at: Date
}

const TicketSchema = new Schema<ITicket>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_it_id: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['open', 'closed'],
    default: 'open'
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

export const Ticket: Model<ITicket> = mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema)
