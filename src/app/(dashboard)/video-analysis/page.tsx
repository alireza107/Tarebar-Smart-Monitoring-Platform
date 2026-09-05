import Link from 'next/link'
import { Apple, ArrowLeft, ScanSearch, UsersRound } from 'lucide-react'

const analysisOptions = [
  {
    href: '/analytics',
    title: 'مانیتورینگ افراد',
    description: 'ویدیوی ضبط‌شده را برای شناسایی، ردیابی و بررسی تردد افراد تحلیل کنید.',
    icon: UsersRound,
  },
  {
    href: '/fruit-analysis',
    title: 'تحلیل میوه',
    description: 'با استفاده از دوربین کالیبره‌شده، تعداد و اندازه میوه‌های روی پالت را بررسی کنید.',
    icon: Apple,
  },
]

export default function VideoAnalysisPage() {
  return <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ScanSearch className="size-5" /></span>
        <h2 className="text-lg font-semibold">تحلیل ویدیو</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">نوع تحلیلی را که می‌خواهید اجرا و آزمایش کنید، انتخاب کنید.</p>
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
