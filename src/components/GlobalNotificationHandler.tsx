'use client'

import { useEffect } from 'react'
import { useSocket } from '@/lib/socket'
import { useNotificationManager, sendNotification, playNotificationSound } from '@/lib/notifications'

export default function GlobalNotificationHandler() {
  const { socket, isConnected } = useSocket()
  const { canNotify, requestPermission } = useNotificationManager()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ensure permission request is triggered via user interaction once per session
    const askPermissionOnInteraction = async () => {
      if (Notification.permission === 'default') {
        await requestPermission()
      }
    }

    window.addEventListener('click', askPermissionOnInteraction)
    window.addEventListener('keydown', askPermissionOnInteraction)

    if (!socket || !isConnected) return

    const initUserRooms = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (!response.ok) return

        const data = await response.json()
        if (!data.user) return

        const user = data.user
        socket.emit('join-user', user.id)

        if (user.role === 'admin' || user.role === 'super_admin') {
          socket.emit('join-admin')
        }

        if (user.role === 'it') {
          socket.emit('join-it', user.id)
        }
      } catch (error) {
        console.error('GlobalNotificationHandler init user rooms error:', error)
      }
    }

    initUserRooms()

    const handleNewMessage = async (message: any) => {
      let granted = canNotify
      if (!granted) {
        granted = await requestPermission()
      }
      if (!granted) return

      const senderName = message.sender?.name || message.sender_name || message.user?.name || 'Someone'
      const ticketCode = message.ticket_code || message.ticket_id || 'ticket'
      sendNotification({
        title: `New message from ${senderName}`,
        body: message.message
          ? message.message.length > 80
            ? `${message.message.slice(0, 77)}...`
            : message.message
          : `New activity on ${ticketCode}`,
        icon: '/favicon.ico',
        tag: `ticket-${ticketCode}`,
        requireInteraction: false,
        duration: 18000
      })
      playNotificationSound()
    }

    socket.on('new-message', handleNewMessage)

    return () => {
      socket.off('new-message', handleNewMessage)
      window.removeEventListener('click', askPermissionOnInteraction)
      window.removeEventListener('keydown', askPermissionOnInteraction)
    }
  }, [socket, isConnected, canNotify, requestPermission])

  return null
}
