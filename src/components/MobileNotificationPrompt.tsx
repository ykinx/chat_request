'use client'

import { useState, useEffect } from 'react'
import { canSendNotifications, requestNotificationPermission } from '@/lib/notifications'

interface MobileNotificationPromptProps {
    onPermissionGranted?: () => void
}

export default function MobileNotificationPrompt({ onPermissionGranted }: MobileNotificationPromptProps) {
    const [showPrompt, setShowPrompt] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const userAgent = navigator.userAgent

        // ✅ FIX: regex harus pakai /
        const mobileCheck =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
            window.innerWidth <= 768

        const iosCheck = /iPhone|iPad|iPod/i.test(userAgent)

        setIsMobile(mobileCheck)
        setIsIOS(iosCheck)

        const hasDismissed = localStorage.getItem('notification-prompt-dismissed')
        const notificationNotGranted = !canSendNotifications()

        if (mobileCheck && notificationNotGranted && !hasDismissed) {
            // delay dikit biar gak ganggu UX
            const timer = setTimeout(() => setShowPrompt(true), 5000)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleEnable = async () => {
        if (isIOS) {
            alert('Di iPhone, aktifkan dengan "Add to Home Screen" dulu ya.')
            return
        }

        const granted = await requestNotificationPermission()

        if (granted) {
            setShowPrompt(false)
            onPermissionGranted?.()
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('notification-prompt-dismissed', 'true')
    }

    if (!showPrompt) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden">
            <div className=" from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-4 text-white animate-slide-up">
                <div className="flex items-start gap-3">

                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                            />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="font-bold text-base mb-1">Aktifin Notifikasi</h3>
                        <p className="text-sm text-white/90 mb-3">
                            Jangan sampai telat balas tiket penting. Aktifin notifikasi biar update masuk real-time.
                        </p>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleEnable}
                                className="flex-1 bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90 active:scale-95 transition"
                            >
                                Aktifkan
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2.5 text-white/80 hover:text-white text-sm font-medium transition"
                            >
                                Nanti
                            </button>
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={handleDismiss}
                        className="shrink-0 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Features */}
                <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-center">
                    <div>
                        <div className="text-lg">🔔</div>
                        <div className="text-xs text-white/80">Realtime</div>
                    </div>
                    <div>
                        <div className="text-lg">📱</div>
                        <div className="text-xs text-white/80">Mobile</div>
                    </div>
                    <div>
                        <div className="text-lg">⚡</div>
                        <div className="text-xs text-white/80">Cepat</div>
                    </div>
                </div>
            </div>
        </div>
    )
}