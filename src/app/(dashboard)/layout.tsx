import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="contents print:hidden"><Sidebar /></div>
      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <div className="contents print:hidden"><Header /></div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  )
}
