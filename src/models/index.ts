import mongoose, { Schema, Document, Model } from 'mongoose'

// User Schema
export interface IUser extends Document {
  name: string
  email: string
  work_id: string
  password: string
  role: 'super_admin' | 'admin' | 'it' | 'user'
  department?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  work_id: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'it', 'user'],
    default: 'user'
  },
  department: { type: String },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

// Ticket Schema
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

// Message Schema
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

// Audit Log Schema
export interface IAuditLog extends Document {
  user_id: mongoose.Types.ObjectId
  action: string
  details?: string
  ip_address?: string
  created_at: Date
}

const AuditLogSchema = new Schema<IAuditLog>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: String },
  ip_address: { type: String },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at' }
})

// Models
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
export const Ticket: Model<ITicket> = mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema)
export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema)
export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)