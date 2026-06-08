'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CameraMappingPanel } from './camera-mapping-panel'
import { StallMappingPanel } from './stall-mapping-panel'
import type { RegionDetail } from '@/modules/region/types'

interface Props {
  regionId: string | null
  canEdit: boolean
  onClose: () => void
}

type Tab = 'cameras' | 'stalls'

export function RegionDetailDialog({ regionId, canEdit, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cameras')

  const { data: region, isLoading } = useQuery<RegionDetail>({
    queryKey: ['region', regionId],
    queryFn: () => fetch(`/api/regions/${regionId}`).then(r => r.json()).then(j => j.data),
    enabled: !!regionId,
  })

  return (
    <Dialog open={!!regionId} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {region ? (
              <span className="flex items-center gap-2">
                {region.color && <span className="size-3 rounded-full" style={{ background: region.color }} />}
                مدیریت منطقه: {region.name}
              </span>
            ) : (
              'مدیریت منطقه'
            )}
          </DialogTitle>
          <DialogDescription>
            {region?.market ? `بازار: ${region.market.name}` : 'نگاشت دوربین‌ها و غرفه‌های این منطقه'}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <TabButton active={tab === 'cameras'} onClick={() => setTab('cameras')}>
            نگاشت دوربین {region ? `(${region.cameraCount})` : ''}
          </TabButton>
          <TabButton active={tab === 'stalls'} onClick={() => setTab('stalls')}>
            نگاشت غرفه {region ? `(${region.boothCount})` : ''}
          </TabButton>
        </div>

        {isLoading || !region ? (
          <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری...</p>
        ) : tab === 'cameras' ? (
          <CameraMappingPanel region={region} canEdit={canEdit} />
        ) : (
          <StallMappingPanel region={region} canEdit={canEdit} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'border-emerald-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
