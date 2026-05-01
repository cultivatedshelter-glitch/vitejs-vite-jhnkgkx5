export type ShelterPrepLeadInput = {
    requesterName?: string
    email?: string
    phone?: string
    workType?: string
    propertyAddress?: string
    city?: string
    state?: string
    zip?: string
    urgency?: string
    occupancy?: string
    timeline?: string
    description?: string
    photos?: Array<{ name?: string; url?: string }>
    documents?: Array<{ name?: string; url?: string }>
    notes?: string
  }
  
  export type AiScopeItem = {
    title: string
    details: string
  }
  
  export type AiPricingTier = {
    name: string
    priceLow: number
    priceHigh: number
    description: string
    included: string[]
  }
  
  export type ShelterPrepAiEstimate = {
    summary: string
    scope: AiScopeItem[]
    pricingTiers: AiPricingTier[]
    missingInfo: string[]
    assumptions: string[]
    exclusions: string[]
    risks: string[]
    materials: string[]
    schedule: {
      estimatedDuration: string
      recommendedNextStep: string
    }
    clientMessage: string
    privateContractorNotes: string
  }