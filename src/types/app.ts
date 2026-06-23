import type { PropertyFacts } from '../lib/db/propertyLookup'
import type { CompactReviewPacket, InspectionIntelligenceDraft, ReviewLane } from '../agents/inspectionIntelligence'

export type RequestStatus = 'new' | 'in_progress' | 'needs_info' | 'pending_approval' | 'estimate_ready'

export type Tab = 'new' | 'properties' | 'dashboard' | 'reports' | 'gallery' | 'intake' | 'messages' | 'archived' | 'invoices' | 'history' | 'sellerPrep' | 'pricingMemory' | 'materials' | 'labor' | 'estimates' | 'agentLearning' | 'fieldLessons' | 'settings'

export type PropertyReportStatusLabel =
  | 'AI Draft'
  | 'Needs Review'
  | 'Human Reviewed'
  | 'Contractor Reviewed'
  | 'Seller Ready'
  | 'Finalized'

export type WorkflowAccessState =
  | 'preview'
  | 'workspace_active'
  | 'reviewed_report'
  | 'contractor_packet'
  | 'finalized_report'

export type RoleBasedShareView = 'Agent View' | 'Seller View' | 'Contractor View' | 'Admin View'

export type GeneratedOutputEvidenceLink = {
  propertyId: string
  sourceFileId?: string | null
  evidenceItemId?: string | null
  repairItemId?: string | null
  reviewStatus: string
  generatedAt: string
  reviewerId?: string | null
}

export type WorkflowGatingSummary = {
  state: WorkflowAccessState
  reportStatus: PropertyReportStatusLabel
  sourceFileReferences: string[]
  roleViews: RoleBasedShareView[]
  evidenceLinks: GeneratedOutputEvidenceLink[]
}

export type StoredFile = {
  id?: string
  name: string
  path: string
  url?: string
  previewUrl?: string
  bucket?: string
  mimeType?: string | null
  sizeBytes?: number | null
  propertyId?: string | number | null
  workRequestId?: string | null
  uploadedBy?: string | null
  reviewStatus?: string | null
  type: 'photo' | 'document'
  createdAt?: string | null
  source?: 'files' | 'property_files' | 'local'
}

export type UploadEvidenceStatus = 'selected' | 'uploading' | 'uploaded' | 'failed'

export type UploadEvidenceCategory = 'photo' | 'video' | 'inspection report' | 'document'

export type InspectionProcessingStatus =
  | 'uploaded'
  | 'extracting_pdf'
  | 'inspection_review_drafted'
  | 'needs_human_review'
  | 'human_verified'
  | 'extraction_failed'

export type EvidenceInspectionStatus =
  | 'uploaded'
  | 'queued_for_interpretation'
  | 'interpreting'
  | 'interpretation_drafted'
  | 'needs_admin_review'
  | 'needs_more_info'
  | 'researched'
  | 'human_verified'
  | 'rejected'
  | 'failed'

export type EvidenceType =
  | 'full_inspection_report'
  | 'inspection_page'
  | 'photo'
  | 'screenshot'
  | 'invoice'
  | 'seller_disclosure'
  | 'contractor_photo'
  | 'manual'

export type AdminNoteType = 'internal' | 'agent-facing' | 'contractor-facing'

export type AdminNote = {
  id: string
  body: string
  noteType: AdminNoteType
  createdAt: string
  updatedAt?: string
  authorLabel: string
}

export type RequestEditDraft = {
  propertyAddress: string
  bedrooms: string
  bathrooms: string
  squareFeet: string
  yearBuilt: string
  propertyType: string
  jurisdiction: string
  workType: string
  description: string
  status: RequestStatus
  urgency: string
  occupancy: string
  scopeInterpretation: string
  missingInformation: string
  internalNotes: string
  agentFacingNotes: string
  contractorFacingNotes: string
}

export type AdminNoteDraft = {
  noteType: AdminNoteType
  body: string
}

export type EvidenceResearchDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

export type SourceResearchSetupDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

export type AiEstimate = {
  projectSummary?: string
  lowPrice?: number
  standardPrice?: number
  premiumPrice?: number
  pricingRationale?: string
}

export type WorkRequest = {
  id: string
  propertyId?: string | number | null
  createdAt: string
  requesterName: string
  email: string
  phone: string
  workType: string
  propertyAddress: string
  city: string
  state: string
  zip: string
  urgency: string
  occupancy: string
  timeline: string
  propertyFacts?: PropertyFacts
  description: string
  photos: StoredFile[]
  documents: StoredFile[]
  status: RequestStatus
  archived?: boolean
  archivedAt?: string
  archivedBy?: string
  archiveReason?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  aiEstimate?: AiEstimate
  inspectionIntelligence?: InspectionIntelligenceDraft | null
  inspectionProcessingStatus?: InspectionProcessingStatus
  inspectionExtractionSummary?: string
  inspectionExtractionMessage?: string
  scopeInterpretation?: string
  missingInformation?: string
  adminNotes?: AdminNote[]
  internalNotes?: string
  agentFacingNotes?: string
  contractorFacingNotes?: string
  groupedRequests?: WorkRequest[]
}

export type PropertyAgentName =
  | 'property_profile_agent'
  | 'photo_agent'
  | 'measurement_agent'
  | 'material_agent'
  | 'labor_scope_agent'
  | 'pricing_agent'
  | 'seller_prep_agent'
  | 'logistics_agent'
  | 'audit_agent'
  | 'coordination_agent'

export type PropertyAgentStatus = 'ai_draft' | 'needs_review' | 'human_reviewed' | 'approved' | 'rejected'

export type PropertyAgentResult = {
  id: string
  created_at?: string | null
  property_id: string
  work_request_id: string
  repair_item_id?: string | null
  agent_name: PropertyAgentName
  input_summary: string
  output_json: Record<string, unknown>
  assumptions: string[]
  confidence: string
  missing_info: string[]
  audit_notes: string[]
  status: PropertyAgentStatus
  reviewed_at?: string | null
  reviewed_by?: string | null
}

export type PropertyAgentResultInsert = Omit<PropertyAgentResult, 'id' | 'created_at'>

export type AgentName =
  | 'design_agent'
  | 'estimator_agent'
  | 'material_takeoff_agent'
  | 'photo_interpreter_agent'
  | 'client_communication_agent'
  | 'project_workflow_agent'
  | 'contractor_review_agent'
  | 'pricing_memory_agent'
  | 'quality_check_agent'

export type CorrectionCategory =
  | 'function'
  | 'safety'
  | 'access'
  | 'sequencing'
  | 'cost'
  | 'quantity'
  | 'labor'
  | 'material'
  | 'code_or_best_practice'
  | 'user_comfort'
  | 'workflow_logic'
  | 'client_communication'
  | 'style_preference'
  | 'wording_preference'
  | 'visual_preference'

export type LessonStatus = 'draft' | 'needs_confirmation' | 'human_verified' | 'rejected' | 'deprecated'

export type AgentLearningEvent = {
  id: string
  created_at?: string | null
  property_id?: string | null
  work_request_id?: string | null
  memory_scope?: string | null
  lesson_status: LessonStatus
  source_agent: AgentName
  affected_agents: AgentName[]
  task_type: string
  original_agent_output: string
  human_correction: string
  correction_category: CorrectionCategory
  inferred_reason: string
  confirmation_question: string
  human_confirmed_reason: string
  learning_value_score: number
  reusable: boolean
  human_verified: boolean
  verified_by?: string | null
  confidence: string
  notes: string
}

export type AgentLearningRule = {
  id: string
  created_at?: string | null
  updated_at?: string | null
  title: string
  memory_scope?: string | null
  lesson_status: LessonStatus
  rule_type: string
  rule_text: string
  reason: string
  applies_when: string
  does_not_apply_when: string
  source_event_id?: string | null
  source_agent: AgentName
  affected_agents: AgentName[]
  confidence: string
  human_verified: boolean
  active: boolean
  usage_count: number
  last_used_at?: string | null
  conflict_group_id?: string | null
  conflicts_with_rule_ids?: string[] | null
  conflict_notes?: string | null
  priority_level?: 'low' | 'normal' | 'high' | 'critical' | null
  context_precedence?: string | null
}

export type AgentMemoryConflictStatus = 'needs_review' | 'resolved' | 'dismissed' | 'escalated' | 'needs_site_review' | 'ask_client'

export type AgentMemoryConflict = {
  id: string
  created_at?: string | null
  resolved_at?: string | null
  property_id?: string | null
  work_request_id?: string | null
  task_type: string
  detected_by_agent: AgentName
  conflicting_rule_ids: string[]
  conflict_summary: string
  recommended_resolution?: string | null
  human_selected_rule_id?: string | null
  human_resolution_notes?: string | null
  resolution_status: AgentMemoryConflictStatus
  resolved_by?: string | null
  creates_new_rule: boolean
  new_rule_id?: string | null
}

export type MemoryActorRole = 'owner' | 'admin' | 'estimator' | 'contractor' | 'agent' | 'client' | 'viewer'

export type SourceLessonSourceType = 'youtube' | 'article' | 'manual' | 'field_note'

export type SourceLessonStatus = 'draft' | 'needs_review' | 'approved' | 'rejected' | 'archived'

export type SourceLessonConfidence = 'low' | 'medium' | 'high'

export type SourceLessonComprehensionGrade = '' | 'A' | 'B' | 'C' | 'D' | 'F'

export type SourceLessonHumanReviewStatus = 'ai_draft' | 'needs_review' | 'edited' | 'approved' | 'rejected' | 'human_verified'

export type SourceLessonMemoryDestination = 'none' | 'project_specific' | 'global_operational' | 'material_pricing' | 'contractor_scope' | 'job_execution_context'

export type SourceLessonLink = {
  url: string
  title?: string
  source_type?: SourceLessonSourceType
  date_checked?: string
}

export type SourceLesson = {
  id: string
  created_at?: string | null
  created_by?: string | null
  source_type: SourceLessonSourceType
  source_url: string
  source_title: string
  work_type: string
  problem_description: string
  admin_intent: string
  lesson_summary: string
  observed_method: string
  hidden_labor: string
  job_steps: string[]
  tools_materials: string[]
  safety_notes: string
  access_notes: string
  cleanup_notes: string
  estimate_impact: string
  missing_info_questions: string[]
  applies_when: string
  does_not_apply_when: string
  confidence: SourceLessonConfidence
  source_links?: SourceLessonLink[]
  operational_meaning?: string
  materials_tools_equipment?: string[]
  cleanup_disposal?: string
  comprehension_grade?: SourceLessonComprehensionGrade | null
  admin_feedback?: string
  human_review_status?: SourceLessonHumanReviewStatus
  memory_destination?: SourceLessonMemoryDestination
  original_draft?: Record<string, unknown> | null
  edited_lesson?: Record<string, unknown> | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  status: SourceLessonStatus
  approved_by?: string | null
  approved_at?: string | null
  admin_notes: string
  linked_property_id?: string | null
  linked_work_request_id?: string | null
  linked_repair_item_id?: string | null
}

export type SourceLessonDraft = Omit<SourceLesson, 'id' | 'created_at' | 'created_by' | 'approved_by' | 'approved_at'>

export type PropertyMediaReviewStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'in_review'
  | 'needs_more_info'
  | 'research_requested'
  | 'research_drafted'
  | 'approved'
  | 'rejected'
  | 'human_verified'
  | 'deprecated'

export type PropertyMediaConfidence = 'low' | 'medium' | 'high'

export type AgentResearchTaskStatus = 'draft' | 'queued' | 'researching' | 'answered' | 'needs_review' | 'human_verified' | 'rejected'

export type AgentResearchQuestionType =
  | 'code / jurisdiction'
  | 'material / product'
  | 'cost range'
  | 'contractor verification'
  | 'missing info'
  | 'safety'
  | 'permit / inspection'
  | 'property-specific'

export type AgentResearchScope =
  | 'Uploaded evidence only'
  | 'Property database'
  | 'Shelter Prep memory'
  | 'Official/code resources'
  | 'Supplier/material resources'
  | 'General web allowed'
  | 'Uploaded files only'
  | 'Uploaded files + property data'
  | 'Online resources allowed'
  | 'Building code / jurisdiction resources'

export type AgentResearchSourceType = 'uploaded_file' | 'property_record' | 'building_code' | 'supplier' | 'web' | 'manual'

export type SourceConfirmationStatus = 'not_reviewed' | 'confirms' | 'partially_supports' | 'does_not_support' | 'needs_more_research'

export type SourceReportVisibility = 'internal_only' | 'report_candidate' | 'report_approved' | 'report_hidden' | 'rejected'

export type AgentResearchCategory =
  | 'Building code / jurisdiction'
  | 'Parts / materials'
  | 'Product / manufacturer documentation'
  | 'Supplier references'
  | 'Safety guidance'
  | 'Permit / inspection requirements'
  | 'Internal Shelter Prep memory'
  | 'Property history'
  | 'General web'

export type AgentResearchSourceQuality = 'official' | 'manufacturer' | 'supplier' | 'internal_memory' | 'general_web' | 'unknown'

export type FastReviewStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'in_review'
  | 'needs_more_info'
  | 'research_requested'
  | 'human_verified'
  | 'rejected'
  | 'deprecated'

export type ReviewPacketMetadataFields = {
  review_lane?: ReviewLane | null
  review_status?: FastReviewStatus | null
  target_review_time_seconds?: number | null
  review_started_at?: string | null
  review_due_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  packet_size_bytes?: number | null
  packet_warning?: string | null
  packet_version?: string | null
  source_reference_count?: number | null
  compact_review_packet?: CompactReviewPacket | null
  full_source_refs?: Array<Record<string, unknown>> | null
  extended_review_message?: string | null
}

export type PropertyMediaAnalysis = ReviewPacketMetadataFields & {
  id: string
  created_at?: string | null
  updated_at?: string | null
  property_id?: string | number | null
  lead_id?: string | null
  source_type: string
  source_url?: string | null
  source_file_id?: string | null
  analyzed_at?: string | null
  terrain_risk_level?: string | null
  access_risk_level?: string | null
  estimate_impact_notes?: string | null
  missing_info?: string | null
  confidence: PropertyMediaConfidence
  review_status: PropertyMediaReviewStatus
  admin_notes?: string | null
}

export type PropertyMediaFinding = ReviewPacketMetadataFields & {
  id: string
  created_at?: string | null
  updated_at?: string | null
  property_media_analysis_id?: string | null
  property_id?: string | number | null
  lead_id?: string | null
  finding_type: string
  observation: string
  field_consequence: string
  estimate_impact: string
  access_notes: string
  safety_notes: string
  confidence: PropertyMediaConfidence
  source_file_id?: string | null
  review_status: PropertyMediaReviewStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  admin_notes: string
}

export type AgentResearchTask = ReviewPacketMetadataFields & {
  id: string
  property_id?: string | number | null
  lead_id?: string | null
  finding_id?: string | null
  note_id?: string | null
  source_file_id?: string | null
  evidence_id?: string | null
  page_number?: number | null
  page_range?: string | null
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  status: AgentResearchTaskStatus
  answer_draft?: string | null
  confidence?: PropertyMediaConfidence | null
  evidence_summary?: string | null
  missing_information?: string | null
  recommended_next_action?: string | null
  needs_more_info_prompt?: string | null
  research_categories?: AgentResearchCategory[] | null
  online_search_requested?: boolean | null
  online_search_performed?: boolean | null
  internal_memory_used?: boolean | null
  official_sources_used?: boolean | null
  supplier_sources_used?: boolean | null
  source_quality?: AgentResearchSourceQuality | null
  answer_status?: string | null
  source_priority?: string | null
  verified_for_memory?: boolean | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export type AgentResearchSource = {
  id: string
  research_task_id: string
  source_title: string
  source_url?: string | null
  source_type: AgentResearchSourceType
  source_category?: string | null
  source_quality?: AgentResearchSourceQuality | null
  source_publisher?: string | null
  source_excerpt?: string | null
  source_date_accessed?: string | null
  relevance_note?: string | null
  excerpt?: string | null
  confidence?: PropertyMediaConfidence | null
  admin_confirmation_status?: SourceConfirmationStatus | null
  report_visibility?: SourceReportVisibility | null
  consumer_summary?: string | null
  admin_notes?: string | null
  checked_at?: string | null
  checked_by?: string | null
  created_at?: string | null
}

export type AgentResearchQuestionDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

export type AgentMemoryAuditLog = {
  id: string
  created_at?: string | null
  actor_id?: string | null
  actor_role?: MemoryActorRole | null
  action_type: string
  target_table: string
  target_id: string
  previous_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  reason?: string | null
  property_id?: string | null
  work_request_id?: string | null
}

export type ContractorProfile = {
  id: string
  email?: string | null
  full_name?: string | null
  role: MemoryActorRole
  contractor_approval_status?: 'pending_review' | 'approved' | 'suspended' | 'rejected' | 'expired_credentials' | null
  license_number?: string | null
  license_state?: string | null
  license_expiration?: string | null
  bonded_status?: string | null
  insurance_status?: string | null
  insurance_expiration?: string | null
  verified_at?: string | null
  verified_by?: string | null
  service_area?: string | null
  approved_trades?: string[] | null
  notes?: string | null
}

export type ContractorAssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'declined'
  | 'walkthrough_requested'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'

export type ContractorAssignment = {
  id: string
  created_at?: string | null
  updated_at?: string | null
  property_id?: string | null
  work_request_id?: string | null
  contractor_profile_id: string
  assigned_by?: string | null
  status: ContractorAssignmentStatus
  assignment_notes?: string | null
  contractor_notes?: string | null
  last_status_change_at?: string | null
}

export type AgentRuleApplication = {
  id: string
  created_at?: string | null
  rule_id: string
  application_type: 'suggested' | 'applied'
  applied_by_agent: AgentName
  property_id?: string | null
  work_request_id?: string | null
  task_type: string
  output_context: string
  generated_output_excerpt: string
  human_feedback_status: 'accepted' | 'edited' | 'rejected' | 'ignored'
  human_feedback_notes?: string | null
  confidence_before?: string | null
  confidence_after?: string | null
  reviewed_at?: string | null
}

export type AgentRuleApplicationFeedbackStatus = AgentRuleApplication['human_feedback_status']

export type AgentRuleApplicationType = AgentRuleApplication['application_type']

export type LearningRuleApplicationContext = {
  property_id?: string | null
  work_request_id?: string | null
  generated_output_excerpt?: string
  confidence_before?: string | null
  application_type?: AgentRuleApplicationType
}

export type CorrectionLearningEvaluation = {
  correction_category: CorrectionCategory
  learning_value_score: number
  reusable: boolean
  should_ask_confirmation: boolean
  confirmation_question: string
  affected_agents: AgentName[]
  inferred_reason: string
}

export type CorrectionLearningInput = {
  source_agent: AgentName
  task_type: string
  original_agent_output: string
  human_correction: string
}

export type CuratedLessonIntakeDraft = {
  sourceLinksText: string
  transcriptOrNotes: string
  learningGoal: string
  tradeCategory: string
  memoryDestination: SourceLessonMemoryDestination
}

export type LessonExtractionResult = {
  status?: string
  error?: string
  errorCode?: string
  warning?: string
  transcriptSource?: 'pasted' | 'youtube' | 'fallback' | 'unavailable'
  draft?: {
    lesson_summary?: string
    operational_meaning?: string
    estimate_impact?: string
    hidden_labor?: string
    materials_tools_equipment?: string[]
    cleanup_disposal?: string
    confidence?: SourceLessonConfidence
    observed_method?: string
    job_steps?: string[]
    tools_materials?: string[]
    safety_notes?: string
    access_notes?: string
    cleanup_notes?: string
    missing_info_questions?: string[]
    applies_when?: string
    does_not_apply_when?: string
  }
}

export type IntakeDraft = {
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
  missingInfo?: string[]
  suggestedReply?: string
  confidence?: string
  notes?: string
}

export type Invoice = {
  id: string
  created_at: string
  file_name: string
  file_url: string | null
  storage_bucket?: string | null
  storage_path: string
  vendor_name: string | null
  invoice_number?: string | null
  invoice_date?: string | null
  property_address: string | null
  extraction_status: string | null
  extraction_error?: string | null
  subtotal?: number | null
  tax?: number | null
  total: number | null
}

export type InvoiceCostAnalysis = {
  id: string
  created_at: string
  invoice_id: string
  risk_level: 'low' | 'medium' | 'high' | string | null
  summary: string | null
  client_summary: string | null
  overcharge_flags: any[] | null
  scope_gaps: any[] | null
  pricing_risks: any[] | null
  recommended_actions: string[] | null
}

export type MaterialCost = {
  id: string
  created_at?: string | null
  updated_at: string | null

  item_name?: string | null
  material_name?: string | null
  normalized_name?: string | null
  category: string | null
  unit: string | null

  low_price?: number | null
  typical_price?: number | null
  high_price?: number | null
  current_price?: number | null
  previous_price?: number | null
  percent_change?: number | null

  source: string | null
  source_url?: string | null
  store_name?: string | null
  zip?: string | null
  region?: string | null

  confidence?: string | null
  human_verified?: boolean | null
  last_checked?: string | null
  notes?: string | null
}

export type MaterialEditorDraft = {
  name: string
  unit: string
  typicalPrice: string
  lowPrice: string
  highPrice: string
  category: string
  zip: string
  source: string
}

export type SellerPrepAnalysisV1 = {
  id: string
  lead_id?: string | null
  property_address: string | null
  summary: string | null
  total_low_estimate: number | null
  total_high_estimate: number | null
  seller_net_impact: string | null
  confidence: string | null
  human_review_status: string
  created_at?: string | null
  updated_at?: string | null
}

export type SellerPrepItemV1 = {
  id: string
  analysis_id: string
  repair_item: string
  trade_category: string | null
  estimated_low: number | null
  estimated_high: number | null
  buyer_impact_score: number | null
  inspection_risk_score: number | null
  recommendation: string | null
  missing_info: string | null
  ai_notes: string | null
  human_review_status: string
  created_at?: string | null
}

export type InspectionTaskIntelligence = {
  id: string
  task_title: string
  defect_concern: string
  building_system: string
  risk_level: string
  trade_needed: string
  urgency: string
  missing_information_needed: string[]
  photo_requests: string[]
  recommended_next_action: string
  human_review_status: string
  source_label: string
}

export type InspectionReportDraft = {
  fileName: string
  frontPagePayloadBytes: number
  propertyAddress: string
  city: string
  state: string
  inspectionDate: string
  clientName: string
  inspectorName: string
  inspectorCompany: string
  reportType: string
  summaryItems: string[]
  missingInfo: string[]
  intelligence: InspectionIntelligenceDraft
  status: 'AI Draft' | 'Needs Review'
}

export type PricingMemoryEntry = {
  id: string
  created_at?: string | null
  item_name: string | null
  category: string | null
  unit: string | null
  verified_price: number | null
  zip: string | null
  source: string | null
  human_verified: boolean | null
  notes: string | null
  last_checked?: string | null
}

export type HumanPricingMemory = {
  id: string
  property_id?: string | null
  work_request_id?: string | null
  repair_item_id?: string | null
  work_type?: string | null
  item_name?: string | null
  original_ai_price?: number | null
  human_approved_price?: number | null
  unit?: string | null
  zip?: string | null
  source?: string | null
  markup_notes?: string | null
  admin_notes?: string | null
  confidence_before?: string | null
  confidence_after?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  human_verified?: boolean | null
}

export type MaterialEstimateDraftLine = {
  materialName: string
  category: string
  requiredQuantity: number
  requiredUnit: string
  packageSize: number
  packageUnit: string
  packageCoverage: number
  packageCoverageUnit: string
  packagePrice: number
  packagesNeeded: number
  extendedTotal: number
  sourceUrl: string
  source: string
  sourceStatus: 'pricing_memory' | 'needs_source_review'
  confidence: string
  reviewStatus: string
  quantityReason: string
}

export type LeadPropertyProfile = {
  beds?: string
  baths?: string
  sqft?: string
  yearBuilt?: string
  propertyType?: string
  jurisdiction?: string
  parcelNumber?: string
  raw?: unknown
}

export type LaborRate = {
  id: string
  created_at?: string | null
  updated_at?: string | null

  trade: string
  job_type?: string | null
  unit?: string | null

  low_rate?: number | null
  typical_rate?: number | null
  high_rate?: number | null

  minimum_charge?: number | null
  trip_charge?: number | null
  disposal_fee?: number | null

  zip?: string | null
  region?: string | null

  source?: string | null
  source_links?: LaborSourceLink[] | null
  source_priority?: string | null
  labor_hours_low?: number | null
  labor_hours_high?: number | null
  hourly_rate_low?: number | null
  hourly_rate_high?: number | null
  access_multiplier?: number | null
  setup_cleanup_hours?: number | null
  admin_override_note?: string | null
  admin_edited?: boolean | null
  verified_at?: string | null
  confidence?: string | null
  human_verified?: boolean | null
  last_checked?: string | null
  notes?: string | null
}

export type LaborSourceLink = {
  name: string
  url: string
  date_checked: string
  confidence: string
  admin_override_note?: string
  priority: number
}

export type CuratedLaborDraft = {
  trade: string
  jobType: string
  laborHoursLow: string
  laborHoursHigh: string
  hourlyRateLow: string
  hourlyRateHigh: string
  accessMultiplier: string
  setupCleanupHours: string
  notes: string
  confidence: string
  sourceLinks: LaborSourceLink[]
  sourcePriority: string
  adminEdited: boolean
}

export type EstimateItem = {
  id: string
  research_id?: string | null
  lead_id: string
  created_at?: string
  property_id?: string | null
  job_id?: string | null
  request_id?: string | null
  repair_item_id?: string | null
  item_name: string
  category?: string | null
  source: string | null
  source_url: string | null
  quantity: number | null
  quantity_low?: number | null
  quantity_high?: number | null
  unit_price: number | null
  original_unit_price?: number | null
  total_price: number | null
  required_quantity?: number | null
  required_unit?: string | null
  package_size?: number | null
  package_unit?: string | null
  package_coverage?: number | null
  package_coverage_unit?: string | null
  packages_needed?: number | null
  package_price?: number | null
  extended_total?: number | null
  quantity_reason?: string | null
  scope_source?: string | null
  relevance_reason?: string | null
  source_status?: string | null
  review_status?: string | null
  material_complexity?: MaterialListComplexity | null
  required_optional?: 'required' | 'optional' | 'review' | null
  admin_editable?: boolean | null
  material_review_notes?: string | null
  rejection_reason?: string | null
  admin_notes?: string | null
  confidence: string | null
  human_approved: boolean | null
}

export type MaterialListComplexity =
  | 'small_simple'
  | 'medium_defined'
  | 'large_complex'
  | 'unknown_needs_review'

export type MaterialComplexityClassification = {
  level: MaterialListComplexity
  confidence: 'low' | 'medium' | 'high'
  reason: string
  missingInfo: string[]
  reviewChecklist: string[]
  tradePackages: string[]
}

export type JobExecutionStepStatus = 'ai_draft' | 'needs_review' | 'human_verified' | 'rejected' | 'deprecated'

export type JobExecutionStep = {
  id: string
  created_at?: string | null
  property_id: string
  job_request_id: string
  repair_item_id: string
  step_number: number
  title: string
  labor_scope: string
  trade: string
  estimated_hours_low: number
  estimated_hours_high: number
  materials_tools: string
  equipment: string
  safety_notes: string
  access_notes: string
  cleanup_notes: string
  disposal_needed: boolean
  confidence: string
  status: JobExecutionStepStatus
  admin_notes: string
}

export type JobExecutionStepLearningRecord = {
  id?: string
  property_id?: string | null
  work_request_id?: string | null
  repair_item_id?: string | null
  work_type: string
  repair_context?: string | null
  repair_description_context: string
  step_title: string
  labor_scope: string
  trade?: string | null
  ai_hours_low?: number | null
  ai_hours_high?: number | null
  approved_hours_low?: number | null
  approved_hours_high?: number | null
  approved_hours: number | null
  materials_tools?: string | null
  equipment?: string | null
  access_notes?: string | null
  safety_notes?: string | null
  cleanup_notes?: string | null
  disposal_needed?: boolean | null
  rejected_reason: string | null
  admin_notes: string | null
  status?: 'approved' | 'edited' | 'rejected' | 'added_by_human' | null
  confidence_before: string
  confidence_after: string
  reviewed_at: string
}

export type JobExecutionStepAction = 'edited' | 'approved' | 'rejected' | 'added' | 'reordered'

export type PhotoFieldMemory = {
  id: string
  property_id?: string | null
  work_request_id?: string | null
  file_id?: string | null
  photo_description?: string | null
  trade_category?: string | null
  work_phase?: string | null
  equipment_seen?: string | null
  field_consequence?: string | null
  estimate_impact?: string | null
  required_line_items?: string[] | null
  risk_flags?: string[] | null
  human_verified?: boolean | null
  follow_up_lesson?: string | null
  reviewed_at?: string | null
}

export type JobPacketMetadata = {
  id: string
  lead_id: string
  property_address: string
  file_name: string
  generated_at: string
  generated_by: string
  packet_status: string
  approved_labor_hours: number
  estimate_total: number
  review_status: string
}

export type AiResearchDraftStatus = 'ai_draft' | 'needs_review' | 'human_verified' | 'rejected' | 'deprecated'

export type AiResearchDraft = {
  id: string
  created_at?: string | null
  lead_id: string
  property_id: string
  job_request_id: string
  repair_item_id: string
  research_topic: string
  source_name: string
  source_url: string
  item_material_name: string
  observed_price: number | null
  availability_note: string
  confidence: string
  screenshot_file_reference: string
  ai_notes: string
  human_review_status: AiResearchDraftStatus
  admin_notes: string
  reviewed_at: string | null
}

export type MaterialReviewAction =
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'added'
  | 'saved_for_next_time'

export type ManualMaterialDraft = {
  itemName: string
  vendor: string
  quantity: string
  unitCost: string
  totalCost: string
  sourceUrl: string
  notes: string
  reviewStatus: 'human_verified' | 'needs_review'
  repairItemId: string
}

export type EstimateResearchRow = {
  id: string
  lead_id: string
  created_at?: string
  status: string | null
  source: string | null
  search_query: string | null
  screenshot_url: string | null
  notes: string | null
  human_approved: boolean | null
}

export type MessageLog = {
  id: string
  created_at?: string | null
  lead_id?: string | null
  direction?: string | null
  channel?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  recipient_phone?: string | null
  message_type?: string | null
  message_body: string
  ai_generated?: boolean | null
  auto_sent?: boolean | null
  human_reviewed?: boolean | null
  human_approved?: boolean | null
  status?: string | null
  notes?: string | null
}

export type MissingInfoRequest = {
  id: string
  created_at?: string | null
  lead_id?: string | null
  missing_address?: boolean | null
  missing_photos?: boolean | null
  missing_inspection_report?: boolean | null
  missing_deadline?: boolean | null
  missing_access_info?: boolean | null
  missing_scope_clarity?: boolean | null
  generated_message?: string | null
  status?: string | null
  auto_send_allowed?: boolean | null
  sent_at?: string | null
  human_reviewed?: boolean | null
}
