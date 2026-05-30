import type { Camera } from '@/modules/camera/types'

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  ONLINE:  { label: 'آنلاین',  dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  OFFLINE: { label: 'آفلاین',  dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700' },
  UNKNOWN: { label: 'نامشخص', dot: 'bg-gray-400',  badge: 'bg-gray-100 text-gray-500' },
}

function locationLabel(camera: Camera): string {
  if (camera.booth)  return `غرفه ${camera.booth.number}`
  if (camera.market) return camera.market.name
  if (camera.field)  return camera.field.name
  return '—'
}

interface CameraCardProps {
  camera: Camera
}

export function CameraCard({ camera }: CameraCardProps) {
  const status = statusConfig[camera.status] ?? statusConfig.UNKNOWN

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-gray-800 leading-tight">{camera.name}</span>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      <div className="text-sm text-gray-500">
        <span className="font-medium text-gray-600">مکان: </span>
        {locationLabel(camera)}
      </div>

      {camera.streamUrl ? (
        <a
          href={camera.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-blue-600 hover:underline"
          dir="ltr"
        >
          {camera.streamUrl}
        </a>
      ) : (
        <span className="text-xs text-gray-400">بدون آدرس استریم</span>
      )}
    </div>
  )
}
