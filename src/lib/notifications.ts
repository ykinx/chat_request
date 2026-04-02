import { useEffect, useRef, useState, useCallback } from 'react'

interface BrowserNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  duration?: number
}

// ─────────────────────────────────────────────
// Deteksi environment
// ─────────────────────────────────────────────

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

function isPWA(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

// ─────────────────────────────────────────────
// Permission
// ─────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') return true

  if (Notification.permission !== 'denied') {
    // iOS 16.4+ hanya izinkan permission jika sudah install sebagai PWA
    if (isIOS() && !isPWA()) {
      console.log('iOS: Notifications hanya tersedia di PWA (Add to Home Screen)')
      showIOSInstallPrompt()
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

export const activeNotifications = new Set<Notification>()

export function canSendNotifications(): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

export function closeAllNotifications() {
  if (typeof window === 'undefined') return
  activeNotifications.forEach((n) => {
    try { n.close() } catch {}
  })
  activeNotifications.clear()
}

// ─────────────────────────────────────────────
// Kirim Notifikasi Utama
// ─────────────────────────────────────────────

export function sendNotification(options: BrowserNotificationOptions) {
  if (typeof window === 'undefined') return

  if (!canSendNotifications()) {
    // Fallback: selalu tampilkan in-app toast di mobile
    showToastNotification(options)
    return
  }

  const { title, body, icon, badge, tag, requireInteraction, duration } = options

  // Di mobile, hindari requireInteraction=true karena sering di-block OS
  const mobile = isMobile()
  const effectiveRequireInteraction = mobile ? false : (requireInteraction ?? false)

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: badge || '/favicon.ico',
      tag: tag || 'ticket-notification',
      requireInteraction: effectiveRequireInteraction,
      silent: false,
      // Android Chrome mendukung vibrate pattern di service worker,
      // tapi Notification API biasa tidak, jadi kita handle terpisah
    })

    activeNotifications.add(notification)
    notification.onclose = () => activeNotifications.delete(notification)

    notification.onclick = () => {
      if (typeof window !== 'undefined') {
        window.focus()
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'NOTIFICATION_CLICK' })
        }
      }
      notification.close()
    }

    // Auto-close — lebih cepat di mobile agar tidak menumpuk
    const closeAfter = duration ?? (mobile ? 6000 : 8000)
    if (!effectiveRequireInteraction) {
      setTimeout(() => {
        try { notification.close() } catch {}
      }, closeAfter)
    }

    // Haptic feedback & vibrate
    vibrateDevice()

    return notification
  } catch (err) {
    console.warn('Notification API error:', err)
    // Fallback ke toast jika Notification gagal (misal iOS bug)
    showToastNotification(options)
  }
}

// ─────────────────────────────────────────────
// Vibrate / Haptic
// ─────────────────────────────────────────────

export function vibrateDevice(pattern: number | number[] = [200, 100, 200]) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {}
}

// ─────────────────────────────────────────────
// iOS Install Prompt
// ─────────────────────────────────────────────

function showIOSInstallPrompt() {
  if (typeof document === 'undefined') return
  if (document.getElementById('ios-install-prompt')) return // sudah tampil

  const banner = document.createElement('div')
  banner.id = 'ios-install-prompt'
  banner.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #1c1c1e;
    color: white;
    padding: 16px 20px 28px;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    border-top: 1px solid rgba(255,255,255,0.15);
    border-radius: 16px 16px 0 0;
    animation: slideUpBanner 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  `
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <img src="/favicon.ico" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;" onerror="this.style.display='none'" />
      <div style="flex:1;">
        <div style="font-weight:600;font-size:15px;margin-bottom:4px;">Aktifkan Notifikasi</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.4;">
          Untuk menerima notifikasi di iPhone/iPad, install app ini ke Home Screen terlebih dahulu.
        </div>
        <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.55);">
          Ketuk <strong style="color:white;">⎋ Share</strong> lalu pilih <strong style="color:white;">"Add to Home Screen"</strong>
        </div>
      </div>
      <button id="ios-prompt-close" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;">✕</button>
    </div>
  `

  // Tambah animasi CSS
  if (!document.getElementById('banner-anim-style')) {
    const style = document.createElement('style')
    style.id = 'banner-anim-style'
    style.textContent = `
      @keyframes slideUpBanner {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(banner)

  document.getElementById('ios-prompt-close')?.addEventListener('click', () => {
    banner.remove()
  })

  // Auto-dismiss setelah 12 detik
  setTimeout(() => banner.remove(), 12000)
}

// ─────────────────────────────────────────────
// In-App Toast Notification (Fallback Mobile)
// ─────────────────────────────────────────────

let toastContainer: HTMLDivElement | null = null

function getToastContainer(): HTMLDivElement {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer
  }
  const container = document.createElement('div')
  container.id = 'toast-notification-container'
  container.style.cssText = `
    position: fixed;
    top: env(safe-area-inset-top, 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(420px, calc(100vw - 32px));
    pointer-events: none;
  `
  document.body.appendChild(container)
  toastContainer = container
  return container
}

function showToastNotification(options: BrowserNotificationOptions) {
  if (typeof document === 'undefined') return

  ensureToastStyles()

  const container = getToastContainer()
  const toast = document.createElement('div')
  toast.style.cssText = `
    width: 100%;
    background: rgba(30, 30, 32, 0.92);
    color: white;
    padding: 12px 16px;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.08);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    pointer-events: auto;
    cursor: pointer;
    animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  `

  toast.innerHTML = `
    <img 
      src="${options.icon || '/favicon.ico'}" 
      style="width:36px;height:36px;border-radius:8px;flex-shrink:0;margin-top:1px;"
      onerror="this.style.display='none'"
    />
    <div style="flex:1;min-width:0;">
      <div style="
        font-weight:600;
        font-size:14px;
        font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        margin-bottom:2px;
      ">${options.title}</div>
      <div style="
        font-size:13px;
        color:rgba(255,255,255,0.72);
        font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;
        line-height:1.35;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      ">${options.body}</div>
    </div>
    <button style="
      background:none;border:none;color:rgba(255,255,255,0.35);
      font-size:16px;cursor:pointer;padding:0;line-height:1;
      flex-shrink:0;margin-top:1px;
    " aria-label="Tutup">✕</button>
  `

  const closeBtn = toast.querySelector('button')
  const dismiss = () => {
    toast.style.animation = 'toastOut 0.25s ease-in forwards'
    setTimeout(() => toast.remove(), 250)
  }

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    dismiss()
  })
  toast.addEventListener('click', () => {
    window.focus()
    dismiss()
  })

  container.appendChild(toast)
  vibrateDevice()

  // Auto-dismiss
  const dur = options.duration ?? (isMobile() ? 6000 : 8000)
  setTimeout(dismiss, dur)
}

function ensureToastStyles() {
  if (document.getElementById('toast-notif-styles')) return
  const style = document.createElement('style')
  style.id = 'toast-notif-styles'
  style.textContent = `
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(-12px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes toastOut {
      from { opacity: 1; transform: translateY(0)    scale(1);    }
      to   { opacity: 0; transform: translateY(-8px) scale(0.97); }
    }
  `
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────
// Hook useNotificationManager
// ─────────────────────────────────────────────

export function useNotificationManager(onTabHidden: boolean = false) {
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [canNotify, setCanNotify] = useState(canSendNotifications())
  // Apakah user sudah melihat prompt iOS
  const [iosPromptShown, setIosPromptShown] = useState(false)

  const checkTabVisibility = useCallback(() => {
    if (typeof document === 'undefined') return true
    return !document.hidden
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setCanNotify(canSendNotifications())

    const handleVisibilityChange = () => {
      const isVisible = checkTabVisibility()
      console.log('Tab visibility changed:', isVisible)
      setIsTabVisible(isVisible)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [checkTabVisibility])

  const requestPermission = useCallback(async () => {
    // iOS non-PWA: tampilkan prompt install, jangan request permission
    if (isIOS() && !isPWA()) {
      if (!iosPromptShown) {
        showIOSInstallPrompt()
        setIosPromptShown(true)
      }
      return false
    }

    const granted = await requestNotificationPermission()
    setCanNotify(granted)
    return granted
  }, [iosPromptShown])

  const sendIfHidden = useCallback(
    (title: string, body: string, options?: Partial<BrowserNotificationOptions>) => {
      const shouldSend = onTabHidden ? !isTabVisible : true
      if (shouldSend) {
        // Kalau tidak bisa notify via browser, tetap tampilkan toast
        if (canNotify) {
          sendNotification({ title, body, ...options })
        } else {
          showToastNotification({ title, body, ...options })
        }
      }
    },
    [isTabVisible, canNotify, onTabHidden]
  )

  return {
    canNotify,
    isTabVisible,
    isMobileDevice: isMobile(),
    isIOSDevice: isIOS(),
    isAndroidDevice: isAndroid(),
    isPWAMode: isPWA(),
    requestPermission,
    sendNotification: sendIfHidden,
  }
}

// ─────────────────────────────────────────────
// Sound
// ─────────────────────────────────────────────

export function playNotificationSound() {
  try {
    if (typeof window === 'undefined') return

    // Mobile sering block autoplay audio — wrap di try/catch per attempt
    const audio = new Audio('/notification-sound.mp3')
    audio.volume = isMobile() ? 0.7 : 0.5 // Sedikit lebih keras di mobile

    const fallbackBeep = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()

        // Buat beep dua nada agar lebih mirip notifikasi HP
        const playTone = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0, startTime)
          gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01)
          gain.gain.linearRampToValueAtTime(0, startTime + duration)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(startTime)
          osc.stop(startTime + duration)
        }

        const now = ctx.currentTime
        playTone(880, now, 0.1)        // nada tinggi
        playTone(660, now + 0.12, 0.15) // nada rendah

        setTimeout(() => { try { ctx.close() } catch {} }, 500)
      } catch {}
    }

    audio.play().catch((err) => {
      console.log('Audio playback blocked:', err?.message || err)
      fallbackBeep()
    })

    audio.onerror = () => {
      console.log('Sound file not found, using fallback beep')
      fallbackBeep()
    }
  } catch (error) {
    console.log('Notification sound error:', error)
  }
}