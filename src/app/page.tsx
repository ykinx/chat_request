'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in and redirect to appropriate dashboard
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          // Redirect based on role
          switch (data.user.role) {
            case 'super_admin':
              router.push('/super-admin')
              break
            case 'admin':
              router.push('/admin')
              break
            case 'it':
              router.push('/it')
              break
            case 'user':
              router.push('/dashboard')
              break
            default:
              router.push('/dashboard')
          }
        } else {
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )
}
