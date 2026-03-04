import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ticket } from '@/models'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user || (user.role !== 'admin' && user.role !== 'it')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Base query - IT users only see their assigned tickets
    let baseQuery: any = {}
    if (user.role === 'it') {
      baseQuery = { assigned_it_id: user.id }
    }

    // Get summary stats
    const totalTickets = await Ticket.countDocuments(baseQuery)
    const openTickets = await Ticket.countDocuments({ ...baseQuery, status: 'open' })
    const inProgressTickets = await Ticket.countDocuments({ ...baseQuery, status: 'in_progress' })
    const closedTickets = await Ticket.countDocuments({ ...baseQuery, status: 'closed' })

    console.log('Ticket counts:', { totalTickets, openTickets, inProgressTickets, closedTickets, baseQuery })

    // Calculate resolution rate
    const resolutionRate = totalTickets > 0 
      ? Math.round((closedTickets / totalTickets) * 100) 
      : 0

    // Get category distribution
    const categoryStats = await Ticket.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])

    const categoryData = categoryStats.map(item => ({
      name: item._id || 'other',
      value: item.count
    }))

    // Get tickets per day (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const ticketsPerDay = await Ticket.aggregate([
      { 
        $match: { 
          ...baseQuery,
          created_at: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' } 
          },
          tickets: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])

    // Fill in missing dates
    const dateMap = new Map()
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dateMap.set(dateStr, 0)
    }

    ticketsPerDay.forEach(item => {
      dateMap.set(item._id, item.tickets)
    })

    const formattedTicketsPerDay = Array.from(dateMap.entries()).map(([date, tickets]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tickets
    }))

    // Get status trend (last 7 days)
    const statusTrend = await Ticket.aggregate([
      { 
        $match: { 
          ...baseQuery,
          updated_at: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$updated_at' } 
          },
          open: { 
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } 
          },
          in_progress: { 
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } 
          },
          closed: { 
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } 
          }
        }
      },
      { $sort: { _id: 1 } }
    ])

    // Fill in missing dates for status trend
    const trendMap = new Map()
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      trendMap.set(dateStr, { open: 0, in_progress: 0, closed: 0 })
    }

    statusTrend.forEach(item => {
      trendMap.set(item._id, { 
        open: item.open, 
        in_progress: item.in_progress, 
        closed: item.closed 
      })
    })

    const formattedStatusTrend = Array.from(trendMap.entries()).map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...counts
    }))

    return NextResponse.json({
      summary: {
        totalTickets,
        openTickets,
        inProgressTickets,
        closedTickets,
        avgResolutionTime: 24, // Placeholder
        resolutionRate
      },
      categoryData,
      ticketsPerDay: formattedTicketsPerDay,
      statusTrend: formattedStatusTrend
    })

  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
