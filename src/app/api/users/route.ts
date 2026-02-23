import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { logAction } from '@/lib/audit'

// GET - Fetch all users (Super Admin only)
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // super_admin and admin can view users
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin and Admin can view users' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    let query: any = {}
    
    if (role) {
      query.role = role
    }

    const users = await User.find(query)
      .select('id name email role department is_active created_at')
      .sort({ created_at: -1 })
      .lean()

    // Format the response
    const formattedUsers = users.map(u => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      is_active: u.is_active,
      created_at: u.created_at
    }))

    return NextResponse.json({
      users: formattedUsers
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new user (Super Admin only)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only super_admin can create users
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin can create users' },
        { status: 403 }
      )
    }

    const { name, email, work_id, password, role, department } = await request.json()

    // Validation
    if (!name || !email || !work_id || !password || !role) {
      return NextResponse.json(
        { error: 'Name, email, work_id, password, and role are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Check if work_id already exists
    const existingWorkId = await User.findOne({ work_id: work_id.toUpperCase() })
    if (existingWorkId) {
      return NextResponse.json(
        { error: 'Work ID already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      work_id: work_id.toUpperCase(),
      password: hashedPassword,
      role,
      department: department || '',
      is_active: true
    })

    await newUser.save()

    // Log the action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    await logAction(currentUser.id, 'USER_CREATED', `Created user: ${name} (${email}) with role ${role}`, ipAddress)

    return NextResponse.json({
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        is_active: newUser.is_active,
        created_at: newUser.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
