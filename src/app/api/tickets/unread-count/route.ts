import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { verifyToken } from '@/lib/auth'
import { User } from '@/models'
import { getUnreadCount } from '@/lib/ticket-participant'

async function getCurrentUserFromToken(token: string) {
    try {
        await connectToDatabase()
        const payload = verifyToken(token)
        const user = await User.findById(payload.userId)

        if (!user || !user.is_active) {
            return null
        }

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
        }
    } catch (error) {
        console.error('Error getting user from token:', error)
        return null
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase()

        const authCookie = request.cookies.get('auth-token')
        if (!authCookie) {
            return NextResponse.json({ error: 'Unauthorized - No auth token' }, { status: 401 })
        }

        const user = await getCurrentUserFromToken(authCookie.value)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const ticket_id = searchParams.get('ticket_id')

        if (!ticket_id) {
            return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
        }

        const unreadCount = await getUnreadCount(ticket_id, user.id)

        return NextResponse.json({ ticket_id, unread_count: unreadCount })
    } catch (error) {
        console.error('Error getting unread count:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
