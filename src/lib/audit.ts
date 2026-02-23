import { connectToDatabase } from './mongodb'
import { AuditLog } from '@/models'

export async function logAction(
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  try {
    await connectToDatabase()
    
    const log = new AuditLog({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress
    })
    
    await log.save()
  } catch (error) {
    console.error('Error logging action:', error)
  }
}
