import { FruitAnalysisClient } from '@/app/(dashboard)/fruit-analysis/_components/fruit-analysis-client'

export const dynamic = 'force-dynamic'

export default function LiveFruitAnalyticsPage() {
  return <FruitAnalysisClient mode="live" legacyDashboard={process.env.FRUIT_PIPELINE_LEGACY_DASHBOARD === 'true'} />
}
