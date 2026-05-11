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

export type EstimateReviewStatus = 'needs_review' | 'approved' | 'rejected'

export type EstimateMemory = {
  id: string
  created_at: string
  updated_at?: string | null
  source_project_id: string | null
  source_file_id: string | null
  extraction_run_id: string | null
  source_storage_bucket: string | null
  source_file_path: string | null
  source_file_url: string | null
  extracted_text: string | null
  normalized_scope: any
  exclusions: any
  risk_factors: any
  project_type: string | null
  square_feet: number | null
  city: string | null
  state: string | null
  zip: string | null
  project_class: string | null
  labor_cost: number | null
  material_cost: number | null
  demo_cost: number | null
  total_cost: number | null
  confidence_score: number | null
  review_status: EstimateReviewStatus
  approved_at: string | null
  approved_by: string | null
  notes: string | null
}
