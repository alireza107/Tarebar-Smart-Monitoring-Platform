import { VideoAnalyticsClient } from './_components/video-analytics-client'
import { auth } from '@/lib/auth'

export default async function AnalyticsPage() {
  const session = await auth()
  return <VideoAnalyticsClient canEnableReid={session?.user.role === 'ORG_ADMIN'} />
}
