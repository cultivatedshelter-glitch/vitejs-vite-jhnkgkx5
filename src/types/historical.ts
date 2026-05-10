export type HistoricalReviewStatus =
  | 'needs_human_review'
  | 'reviewed'
  | 'human_verified'
  | 'archived'

export type HistoricalProject = {
  id: string
  created_at: string
  updated_at?: string | null
  project_type: string
  city: string | null
  state: string | null
  zip: string | null
  property_type: string | null
  estimated_amount: number | null
  final_invoice_amount: number | null
  notes: string | null
  customer_name: string | null
  customer_visible: boolean
  anonymized: boolean
  review_status: HistoricalReviewStatus
  human_verified: boolean
  extraction_status: string | null
  extraction_notes: string | null
}

export type HistoricalProjectFile = {
  id: string
  project_id: string
  created_at: string
  file_type: string
  file_name: string
  storage_bucket: string
  storage_path: string
  notes: string | null
  extraction_status: string | null
  human_verified: boolean
}
