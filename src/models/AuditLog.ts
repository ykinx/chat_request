import mongoose, { Schema, Document, Model } from 'mongoose'

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

export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
