import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models'
import { hashPassword } from '@/lib/utils'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
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
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    )
  }
}