import { notFound } from 'next/navigation'
import type { ManagementLocationType } from '@/modules/management-analytics/types'
import { LocationOverviewClient } from './_components/location-overview-client'

export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params
  if (!['field', 'market', 'booth'].includes(type)) notFound()
  return <LocationOverviewClient type={type as ManagementLocationType} id={id} />
}

