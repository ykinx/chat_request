import { useEffect, useRef, useState, useCallback } from 'react'

interface BrowserNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  duration?: number // Duration in milliseconds for auto-close (if not requireInteraction)
}

/**
 * Request permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

/**
 * Check if notifications are supported and permitted
 */
export const activeNotifications = new Set<Notification>()

export function canSendNotifications(): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false
  }

  if (!('Notification' in window)) {
    return false
  }

  return Notification.permission === 'granted'
}

/**
 * Close all active notifications
 */
export function closeAllNotifications() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return

  activeNotifications.forEach((notification) => {
    try {
      notification.close()
    } catch (error) {
      // ignore
    }
  })
  activeNotifications.clear()
}

/**
 * Send a browser notification
 */
export function sendNotification(options: BrowserNotificationOptions) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    console.log('Notifications not available in this environment')
    return
  }

  if (!canSendNotifications()) {
    console.log('Notifications not permitted')
    return
  }

  const { title, body, icon, badge, tag, requireInteraction, duration } = options

  const notification = new Notification(title, {
    body,
    icon: icon || '/favicon.ico',
    badge: badge || '/favicon.ico',
    tag: tag || 'ticket-notification',
    requireInteraction: requireInteraction ?? true
  })

  activeNotifications.add(notification)
  notification.onclose = () => {
    activeNotifications.delete(notification)
  }

  // If requireInteraction is false, auto-close after duration (default 12 seconds)
  if (!notification.requireInteraction) {
    const closeAfter = duration ?? 12000
    setTimeout(() => {
      try {
        notification.close()
      } catch (err) {
        // ignore
      }
    }, closeAfter)
  }

  // Click handler - focus window
  notification.onclick = () => {
    window.focus()
    notification.close()
  }

  return notification
}

/**
 * Hook to manage notification permissions and visibility detection
 */
export function useNotificationManager(onTabHidden: boolean = false) {
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [canNotify, setCanNotify] = useState(canSendNotifications())

  // Check if tab is currently visible to user
  const checkTabVisibility = useCallback(() => {
    if (typeof document === 'undefined') return true
    return !document.hidden
  }, [])

  // Initialize notification permissions and visibility tracking
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    setCanNotify(canSendNotifications())

    const handleVisibilityChange = () => {
      const isVisible = checkTabVisibility()
      console.log('Tab visibility changed:', isVisible)
      setIsTabVisible(isVisible)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkTabVisibility])

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission()
    setCanNotify(granted)
    return granted
  }, [])

  const sendIfHidden = useCallback(
    (title: string, body: string, options?: Partial<BrowserNotificationOptions>) => {
      // Send on hidden or always; onTabHidden=true means only send when tab is hidden.
      const shouldSend = onTabHidden ? !isTabVisible : true
      if (shouldSend && canNotify) {
        sendNotification({
          title,
          body,
          ...options
        })
      }
    },
    [isTabVisible, canNotify, onTabHidden]
  )

  return {
    canNotify,
    isTabVisible,
    requestPermission,
    sendNotification: sendIfHidden
  }
}

/**
 * Play notification sound (optional enhancement)
 */
export function playNotificationSound() {
  try {
    if (typeof window === 'undefined') return

    const audio = new Audio('/notification-sound.mp3')
    audio.volume = 0.5

    const fallbackCW = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        const oscillator = ctx.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.value = 520
        oscillator.connect(ctx.destination)
        oscillator.start()
        setTimeout(() => {
          oscillator.stop()
          if (ctx.close) ctx.close()
        }, 100)
      } catch (fallbackError) {
        // ignore fallback failure
      }
    }

    audio
      .play()
      .then(() => {
        // playback started successfully
      })
      .catch(err => {
        console.log('Audio playback failed:', err?.message || err)
        // fallback: try web audio beep tone
        fallbackCW()
      })

    audio.onerror = () => {
      console.log('Notification sound file not found at /notification-sound.mp3')
      fallbackCW()
    }
  } catch (error) {
    console.log('Notification sound not available:', error)
  }
}
