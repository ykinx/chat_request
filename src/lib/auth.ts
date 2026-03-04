import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { connectToDatabase } from './mongodb'
import { User } from '@/models'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

export interface JWTPayload {
  userId: string
  role: string
  email: string
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

export const getCurrentUser = async () => {
  try {
    await connectToDatabase()
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      console.log('getCurrentUser: No token found')
      return null
    }

    const payload = verifyToken(token)
    console.log('getCurrentUser: Token payload:', payload)
    
    const user = await User.findById(payload.userId)
    console.log('getCurrentUser: User from DB:', user ? { id: user._id, email: user.email, role: user.role } : 'Not found')
    
    if (!user || !user.is_active) {
      return null
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      department: user.department,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

export const requireAuth = async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export const requireRole = async (allowedRoles: string[]) => {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}