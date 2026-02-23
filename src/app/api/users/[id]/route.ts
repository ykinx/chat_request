import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { logAction } from '@/lib/audit'

// PUT - Update user (Super Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only super_admin can update users
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin can update users' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { name, email, role, department, is_active, password } = await request.json()

    // Find user
    const user = await User.findById(id)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent modifying own role or status
    if (user._id.toString() === currentUser.id) {
      if (role && role !== user.role) {
        return NextResponse.json(
          { error: 'Cannot change your own role' },
          { status: 400 }
        )
      }
      if (is_active === false) {
        return NextResponse.json(
          { error: 'Cannot deactivate your own account' },
          { status: 400 }
        )
      }
    }

    // Update fields
    if (name) user.name = name
    if (email) user.email = email.toLowerCase()
    if (role) user.role = role
    if (department !== undefined) user.department = department
    if (is_active !== undefined) user.is_active = is_active
    if (password) {
      user.password = await bcrypt.hash(password, 10)
    }

    await user.save()

    // Log the action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const updatedFields = []
    if (name) updatedFields.push('name')
    if (email) updatedFields.push('email')
    if (role) updatedFields.push('role')
    if (department !== undefined) updatedFields.push('department')
    if (is_active !== undefined) updatedFields.push('is_active')
    const actionDetails = password 
      ? `Updated user: ${user.name} (password reset)` 
      : `Updated user: ${user.name} (${updatedFields.join(', ')})`
    await logAction(currentUser.id, 'USER_UPDATED', actionDetails, ipAddress)

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        is_active: user.is_active,
        created_at: user.created_at
      }
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only super_admin can delete users
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin can delete users' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Prevent deleting self
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Find and delete user
    const user = await User.findByIdAndDelete(id)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Log the action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    await logAction(currentUser.id, 'USER_DELETED', `Deleted user: ${user.name} (${user.email})`, ipAddress)

    return NextResponse.json({
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
