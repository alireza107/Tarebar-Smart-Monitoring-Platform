import Link from 'next/link'
import { Apple, ArrowLeft, RadioTower, UsersRound } from 'lucide-react'

const analysisOptions = [
  {
    href: '/live-analytics/people',
    title: 'مانیتورینگ افراد',
    description: 'شناسایی، ردیابی، شمارش و تحلیل تردد افراد را روی دوربین زنده اجرا کنید.',
    icon: UsersRound,
  },
  {
    href: '/live-analytics/fruit',
    title: 'تحلیل میوه',
    description: 'دوربین کالیبره‌شده را انتخاب و تعداد و اندازه میوه‌ها را از استریم زنده پردازش کنید.',
    icon: Apple,
  },
]

export default function LiveAnalyticsPage() {
  return <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><RadioTower className="size-5" /></span>
        <h2 className="text-lg font-semibold">تحلیل زنده دوربین‌ها</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">نوع تحلیل زنده‌ای را که می‌خواهید روی دوربین‌ها اجرا کنید، انتخاب کنید.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {analysisOptions.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-40 items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
        <span className="flex min-w-0 flex-1 flex-col self-stretch">
          <span className="text-base font-semibold">{title}</span>
          <span className="mt-2 text-sm leading-6 text-muted-foreground">{description}</span>
          <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-primary">ورود به تحلیل <ArrowLeft className="size-3.5 transition group-hover:-translate-x-1" /></span>
        </span>
      </Link>)}
    </div>
  </div>
}
