export interface BoothMarket {
  id: string
  name: string
  fieldId: string
}

export interface BoothCategoryRef {
  id: string
  name: string
}

export interface Booth {
  id: string
  number: string
  marketId: string
  categoryId: string
  ownerId: string | null
  market: BoothMarket
  category: BoothCategoryRef
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
