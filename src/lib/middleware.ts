import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export interface AuthMiddlewareOptions {
  requireAuth?: boolean
  allowedRoles?: string[]
}

export const authMiddleware = async (
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<NextResponse | null> => {
  const { requireAuth = true, allowedRoles = [] } = options

  if (!requireAuth) {
    return null
  }

  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Add user to request context (for use in route handlers)
    const response = NextResponse.next()
    response.headers.set('x-user-id', user.id)
    response.headers.set('x-user-role', user.role)
    response.headers.set('x-user-email', user.email)
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }
}

// Helper functions for common role checks
export const withAuth = (handler: any) => {
  return async (request: NextRequest) => {
    const authResponse = await authMiddleware(request, { requireAuth: true })
    if (authResponse) return authResponse
    return handler(request)
  }
}

export const withRole = (allowedRoles: string[]) => {
  return (handler: any) => {
    return async (request: NextRequest) => {
      const authResponse = await authMiddleware(request, { 
        requireAuth: true, 
        allowedRoles 
      })
      if (authResponse) return authResponse
      return handler(request)
    }
  }
}

export const withOptionalAuth = (handler: any) => {
  return async (request: NextRequest) => {
    await authMiddleware(request, { requireAuth: false })
    return handler(request)
  }
}