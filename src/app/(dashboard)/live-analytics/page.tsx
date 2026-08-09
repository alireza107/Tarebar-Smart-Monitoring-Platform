import { auth } from '@/lib/auth'
import { VideoAnalyticsClient } from '@/app/(dashboard)/analytics/_components/video-analytics-client'

export default async function LiveAnalyticsPage() {
  const session = await auth()
  return <VideoAnalyticsClient mode="live" canEnableReid={session?.user.role === 'ORG_ADMIN'} />
}
