import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models'
import { hashPassword, verifyPassword } from '@/lib/utils'
import { generateToken, JWTPayload } from '@/lib/auth'
import { cookies } from 'next/headers'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const { identifier, password } = await request.json()

    // Validate input
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/Work ID and password are required' },
        { status: 400 }
      )
    }

    // Find user by email or work_id
    console.log('Login attempt with identifier:', identifier)
    
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { work_id: identifier.toUpperCase() }
      ],
      is_active: true 
    })

    console.log('User found:', user ? 'Yes' : 'No')
    if (user) {
      console.log('User email:', user.email, 'work_id:', user.work_id)
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const payload: JWTPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email
    }

    const token = generateToken(payload)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    // Log the login action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    await logAction(user._id.toString(), 'USER_LOGIN', `User logged in`, ipAddress)

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user.toObject()

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      token
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}