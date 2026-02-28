import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMessage extends Document {
  ticket_id: mongoose.Types.ObjectId
  sender_id: mongoose.Types.ObjectId
  message: string
  created_at: Date
}

const MessageSchema = new Schema<IMessage>({
  ticket_id: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at' }
})

export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema)
