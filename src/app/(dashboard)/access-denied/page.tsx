import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-6xl font-bold text-gray-200">۴۰۳</div>
      <h1 className="text-xl font-semibold text-gray-800">دسترسی ممنوع</h1>
      <p className="text-sm text-gray-500">
        شما مجوز دسترسی به این صفحه را ندارید.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  )
}
