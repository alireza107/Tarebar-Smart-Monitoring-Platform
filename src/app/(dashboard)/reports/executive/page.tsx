import { Suspense } from 'react'
import { ExecutiveReportClient } from './_components/executive-report-client'

export default function ExecutiveReportPage() {
  // useSearchParams() in the client component needs a Suspense boundary.
  return <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-xl bg-muted" />}><ExecutiveReportClient /></Suspense>
}
