export interface MarketField {
  id: string
  name: string
}

export interface Market {
  id: string
  name: string
  address: string | null
  fieldId: string
  field: MarketField
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
