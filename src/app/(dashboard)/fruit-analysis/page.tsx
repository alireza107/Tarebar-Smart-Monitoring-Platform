import { FruitAnalysisClient } from './_components/fruit-analysis-client'

export const dynamic = 'force-dynamic'

export default function FruitAnalysisPage() {
  return <FruitAnalysisClient legacyDashboard={process.env.FRUIT_PIPELINE_LEGACY_DASHBOARD === 'true'} />
}
