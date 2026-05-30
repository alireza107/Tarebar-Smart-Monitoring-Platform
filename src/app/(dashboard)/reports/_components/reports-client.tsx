'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReportsData } from '@/modules/report/types'

async function fetchReports(): Promise<ReportsData> {
  const res = await fetch('/api/reports')
  if (!res.ok) throw new Error('خطا در دریافت گزارش‌ها')
  const json = await res.json()
  return json.data
}

export function ReportsClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })

  if (isLoading) return <p className="p-6 text-sm text-gray-500">در حال بارگذاری...</p>
  if (isError || !data) return <p className="p-6 text-sm text-red-500">خطا در دریافت گزارش‌ها.</p>

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900">گزارش‌ها</h1>

      {/* Camera Status Summary */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-700">خلاصه وضعیت دوربین‌ها</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="کل"     value={data.cameraStatus.total}   colorClass="text-gray-700" />
          <SummaryCard label="آنلاین" value={data.cameraStatus.online}  colorClass="text-green-600" />
          <SummaryCard label="آفلاین" value={data.cameraStatus.offline} colorClass="text-red-600" />
          <SummaryCard label="نامشخص" value={data.cameraStatus.unknown} colorClass="text-gray-400" />
        </div>
      </section>

      {/* Cameras per Field */}
      {data.camerasByField.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-700">دوربین‌ها به تفکیک میدان</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">میدان</th>
                  <th className="px-4 py-3 text-center">کل</th>
                  <th className="px-4 py-3 text-center text-green-600">آنلاین</th>
                  <th className="px-4 py-3 text-center text-red-600">آفلاین</th>
                  <th className="px-4 py-3 text-center text-gray-400">نامشخص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.camerasByField.map(row => (
                  <tr key={row.fieldId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.fieldName}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{row.total}</td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">{row.online}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-600">{row.offline}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{row.unknown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Booths per Market */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-700">غرفه‌ها به تفکیک بازار</h2>
        {data.boothsByMarket.length === 0 ? (
          <p className="text-sm text-gray-500">داده‌ای یافت نشد.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">بازار</th>
                  <th className="px-4 py-3">میدان</th>
                  <th className="px-4 py-3 text-center">تعداد غرفه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.boothsByMarket.map(row => (
                  <tr key={row.marketId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.marketName}</td>
                    <td className="px-4 py-3 text-gray-500">{row.fieldName}</td>
                    <td className="px-4 py-3 text-center font-semibold text-indigo-600">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
