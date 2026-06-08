import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'
import { SessionProvider } from '@/providers/session-provider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Tarebar – Smart Monitoring Platform',
  description: 'سامانه هوشمند مدیریت میادین میوه و تره‌بار',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <SessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </SessionProvider>
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  )
}
