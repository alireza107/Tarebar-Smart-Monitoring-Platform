import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const managementFiltersSchema = z.object({
  locationType: z.enum(['organization', 'field', 'market', 'booth']).default('organization'),
  locationId: z.string().min(1).optional(),
  placeType: z.enum(['all', 'field', 'market', 'booth']).default('all'),
  from: isoDate,
  to: isoDate,
  comparison: z.enum(['previous_period', 'previous_week', 'previous_month', 'none']).default('previous_period'),
  timeFrom: clockTime.optional(),
  timeTo: clockTime.optional(),
}).superRefine((value, context) => {
  if (value.locationType !== 'organization' && !value.locationId) {
    context.addIssue({ code: 'custom', path: ['locationId'], message: 'locationId is required' })
  }
  if (value.from > value.to) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'to must be on or after from' })
  }
})

export type ManagementFiltersInput = z.infer<typeof managementFiltersSchema>

