import { QualityReportClient } from './quality-report-client'

export default async function QualityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QualityReportClient id={id} />
}
