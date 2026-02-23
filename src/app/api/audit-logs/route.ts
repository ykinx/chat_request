import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { AuditLog } from '@/models'
import { getCurrentUser } from '@/lib/auth'

// GET - Fetch audit logs (Super Admin only)
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

    // Only super_admin can view audit logs
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin can view audit logs' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    let query: any = {}
    
    if (userId) {
      query.user_id = userId
    }
    
    if (action) {
      query.action = { $regex: action, $options: 'i' }
    }

    const skip = (page - 1) * limit

    const logs = await AuditLog.find(query)
      .populate('user_id', 'name email role')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await AuditLog.countDocuments(query)

    // Format the response
    const formattedLogs = logs.map(log => ({
      id: log._id.toString(),
      user: log.user_id ? {
        id: (log.user_id as any)._id.toString(),
        name: (log.user_id as any).name,
        email: (log.user_id as any).email,
        role: (log.user_id as any).role
      } : null,
      action: log.action,
      details: log.details,
      ip_address: log.ip_address,
      created_at: log.created_at
    }))

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
