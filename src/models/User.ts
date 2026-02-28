import mongoose, { Schema, Document, Model } from 'mongoose'

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

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
