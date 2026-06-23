import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models'
import { hashPassword } from '@/lib/utils'

// Timeout wrapper to prevent hanging requests
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ])
}

export async function POST(request: NextRequest) {
  try {
    // Connect to database with 10s timeout
    await withTimeout(
      connectToDatabase(),
      10000,
      'Database connection timeout. Please ensure MongoDB is running.'
    )
    const body = await request.json()
    console.log('Registration request body:', body)
    
    const { name, email, work_id, department, password, confirmPassword } = body

    // Validate input
    if (!name || !email || !work_id || !department || !password || !confirmPassword) {
      console.log('Validation failed - missing fields:', { name: !!name, email: !!email, work_id: !!work_id, department: !!department, password: !!password, confirmPassword: !!confirmPassword })
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase()
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Check if work_id already exists
    const existingWorkId = await User.findOne({
      work_id: work_id.toUpperCase()
    })

    if (existingWorkId) {
      return NextResponse.json(
        { error: 'Work ID already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user (default role is 'user')
    const user = new User({
      name,
      email: email.toLowerCase(),
      work_id: work_id.toUpperCase(),
      department,
      password: hashedPassword,
      role: 'user'
    })

    console.log('Creating user:', { name, email: email.toLowerCase(), work_id: work_id.toUpperCase() })
    
    await user.save()
    
    console.log('User saved successfully with ID:', user._id.toString())

    // Return success (no auto-login)
    const { password: _, ...userWithoutPassword } = user.toObject()

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Registration error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message.includes('timeout') || message.includes('Mongo')
        ? 'Server is currently unavailable. Please ensure MongoDB is running and try again.'
        : 'Internal server error' },
      { status: 500 }
    )
  }
}