import bcrypt from 'bcryptjs'

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

export const isValidRole = (role: string): boolean => {
  return ['super_admin', 'admin', 'it', 'user'].includes(role)
}

export const formatRole = (role: string): string => {
  switch (role) {
    case 'super_admin': return 'Super Admin'
    case 'admin': return 'Admin'
    case 'it': return 'IT'
    case 'user': return 'User'
    default: return role
  }
}

export const canAccessTicket = (userRole: string, ticketUserId: string, assignedItId: string | null): boolean => {
  // Super admin and admin can access all tickets
  if (userRole === 'super_admin' || userRole === 'admin') {
    return true
  }
  
  // IT can only access assigned tickets
  if (userRole === 'it') {
    return assignedItId === ticketUserId
  }
  
  // User can only access their own tickets
  if (userRole === 'user') {
    return ticketUserId === ticketUserId
  }
  
  return false
}