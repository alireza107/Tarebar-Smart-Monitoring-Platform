import Link from 'next/link'
import { ArrowLeft, Camera, Shapes, Tags, Users } from 'lucide-react'

const items = [
  { href: '/users', label: 'کاربران و دسترسی‌ها', description: 'نقش‌ها و محدوده دسترسی سازمانی', icon: Users },
  { href: '/booth-categories', label: 'دسته‌بندی غرفه‌ها', description: 'داده پایه برای ساختار کسب‌وکار', icon: Tags },
  { href: '/cameras', label: 'منابع دوربین', description: 'ثبت و تخصیص دارایی‌های تصویری به مکان', icon: Camera },
  { href: '/regions', label: 'zoneها و هندسه', description: 'مدیریت نواحی عملیاتی هر بازار', icon: Shapes },
]
export default function Page() { return <div className="space-y-5"><div><h2 className="text-lg font-semibold">تنظیمات سامانه</h2><p className="mt-0.5 text-xs text-muted-foreground">مدیریت داده پایه، دسترسی‌ها و دارایی‌های عملیاتی</p></div><div className="grid gap-3 sm:grid-cols-2">{items.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span><span className="flex-1"><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span><ArrowLeft className="size-4 text-muted-foreground group-hover:text-primary" /></Link>)}</div></div> }

