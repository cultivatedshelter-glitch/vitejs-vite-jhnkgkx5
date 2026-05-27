import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from './supabase'
import { emptyPropertyFacts, lookupPropertyFacts, type PropertyFacts, type PropertyLookupStatus } from './propertyLookup'
import { buildPropertyResearchPack } from './propertyIntelligence'
import {
  buildEstimateIntelligence,
  type EstimateIntelligenceResult,
} from './estimateIntelligence'
import {
  buildBerlinAveWorkGroups,
  buildInspectionIntelligenceDraft,
  buildRepairBundles,
  extractInspectionDate,
  extractInspectionFindings,
  type InspectionDraftStatus,
  type InspectionIntelligenceDraft,
  type InspectionRepairBundleDraft,
  type InspectionRepairItemDraft,
} from './inspectionIntelligence'
import { InspectionIntelligencePanel } from './components/InspectionIntelligencePanel'

const Gallery = React.lazy(() => import('./components/Gallery'))
const HistoricalUpload = React.lazy(() => import('./components/historical/HistoricalUpload'))

type RequestStatus = 'new' | 'in_progress' | 'needs_info' | 'pending_approval' | 'estimate_ready'

type Tab = 'new' | 'properties' | 'dashboard' | 'reports' | 'gallery' | 'intake' | 'messages' | 'archived' | 'invoices' | 'history' | 'sellerPrep' | 'pricingMemory' | 'materials' | 'labor' | 'estimates' | 'agentLearning' | 'fieldLessons' | 'settings'

type StoredFile = {
  id?: string
  name: string
  path: string
  url?: string
  previewUrl?: string
  bucket?: string
  type: 'photo' | 'document'
  createdAt?: string | null
  source?: 'files' | 'property_files' | 'local'
}

type UploadEvidenceStatus = 'selected' | 'uploading' | 'uploaded' | 'failed'
type UploadEvidenceCategory = 'photo' | 'video' | 'inspection report' | 'document'
type InspectionProcessingStatus =
  | 'uploaded'
  | 'extracting_pdf'
  | 'inspection_review_drafted'
  | 'needs_human_review'
  | 'human_verified'
  | 'extraction_failed'
type EvidenceInspectionStatus =
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
type EvidenceType =
  | 'full_inspection_report'
  | 'inspection_page'
  | 'photo'
  | 'screenshot'
  | 'invoice'
  | 'seller_disclosure'
  | 'contractor_photo'
  | 'manual'

type AdminNoteType = 'internal' | 'agent-facing' | 'contractor-facing'

type AdminNote = {
  id: string
  body: string
  noteType: AdminNoteType
  createdAt: string
  updatedAt?: string
  authorLabel: string
}

type RequestEditDraft = {
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

type AdminNoteDraft = {
  noteType: AdminNoteType
  body: string
}

type EvidenceResearchDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

type SourceResearchSetupDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

type AiEstimate = {
  projectSummary?: string
  lowPrice?: number
  standardPrice?: number
  premiumPrice?: number
  pricingRationale?: string
}

type WorkRequest = {
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
  archiveReason?: string
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
}

type PropertyAgentName =
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

type PropertyAgentStatus = 'ai_draft' | 'needs_review' | 'human_reviewed' | 'approved' | 'rejected'

type PropertyAgentResult = {
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

type PropertyAgentResultInsert = Omit<PropertyAgentResult, 'id' | 'created_at'>

type AgentName =
  | 'design_agent'
  | 'estimator_agent'
  | 'material_takeoff_agent'
  | 'photo_interpreter_agent'
  | 'client_communication_agent'
  | 'project_workflow_agent'
  | 'contractor_review_agent'
  | 'pricing_memory_agent'
  | 'quality_check_agent'

type CorrectionCategory =
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

type LessonStatus = 'draft' | 'needs_confirmation' | 'human_verified' | 'rejected' | 'deprecated'

type AgentLearningEvent = {
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

type AgentLearningRule = {
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

type AgentMemoryConflictStatus = 'needs_review' | 'resolved' | 'dismissed' | 'escalated' | 'needs_site_review' | 'ask_client'

type AgentMemoryConflict = {
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

type MemoryActorRole = 'owner' | 'admin' | 'estimator' | 'contractor' | 'agent' | 'client' | 'viewer'

type SourceLessonSourceType = 'youtube' | 'article' | 'manual' | 'field_note'
type SourceLessonStatus = 'draft' | 'needs_review' | 'approved' | 'rejected' | 'archived'
type SourceLessonConfidence = 'low' | 'medium' | 'high'
type SourceLessonComprehensionGrade = '' | 'A' | 'B' | 'C' | 'D' | 'F'
type SourceLessonHumanReviewStatus = 'ai_draft' | 'needs_review' | 'edited' | 'approved' | 'rejected' | 'human_verified'
type SourceLessonMemoryDestination = 'none' | 'project_specific' | 'global_operational' | 'material_pricing' | 'contractor_scope' | 'job_execution_context'

type SourceLessonLink = {
  url: string
  title?: string
  source_type?: SourceLessonSourceType
  date_checked?: string
}

type SourceLesson = {
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

type SourceLessonDraft = Omit<SourceLesson, 'id' | 'created_at' | 'created_by' | 'approved_by' | 'approved_at'>

type PropertyMediaReviewStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'needs_more_info'
  | 'research_requested'
  | 'research_drafted'
  | 'approved'
  | 'rejected'
  | 'human_verified'
  | 'deprecated'
type PropertyMediaConfidence = 'low' | 'medium' | 'high'
type AgentResearchTaskStatus = 'draft' | 'queued' | 'researching' | 'answered' | 'needs_review' | 'human_verified' | 'rejected'
type AgentResearchQuestionType =
  | 'code / jurisdiction'
  | 'material / product'
  | 'cost range'
  | 'contractor verification'
  | 'missing info'
  | 'safety'
  | 'permit / inspection'
  | 'property-specific'
type AgentResearchScope =
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
type AgentResearchSourceType = 'uploaded_file' | 'property_record' | 'building_code' | 'supplier' | 'web' | 'manual'
type AgentResearchCategory =
  | 'Building code / jurisdiction'
  | 'Parts / materials'
  | 'Product / manufacturer documentation'
  | 'Supplier references'
  | 'Safety guidance'
  | 'Permit / inspection requirements'
  | 'Internal Shelter Prep memory'
  | 'Property history'
  | 'General web'
type AgentResearchSourceQuality = 'official' | 'manufacturer' | 'supplier' | 'internal_memory' | 'general_web' | 'unknown'

type PropertyMediaAnalysis = {
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

type PropertyMediaFinding = {
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

type AgentResearchTask = {
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

type AgentResearchSource = {
  id: string
  research_task_id: string
  source_title: string
  source_url?: string | null
  source_type: AgentResearchSourceType
  source_category?: AgentResearchCategory | null
  source_quality?: AgentResearchSourceQuality | null
  source_publisher?: string | null
  source_excerpt?: string | null
  source_date_accessed?: string | null
  relevance_note?: string | null
  excerpt?: string | null
  confidence?: PropertyMediaConfidence | null
  created_at?: string | null
}

type AgentResearchQuestionDraft = {
  question: string
  question_type: AgentResearchQuestionType
  research_scope: AgentResearchScope
  research_categories: AgentResearchCategory[]
}

type AgentMemoryAuditLog = {
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

type ContractorProfile = {
  id: string
  email?: string | null
  full_name?: string | null
  role: MemoryActorRole
}

type ContractorAssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'declined'
  | 'walkthrough_requested'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'

type ContractorAssignment = {
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

type AgentRuleApplication = {
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

type AgentRuleApplicationFeedbackStatus = AgentRuleApplication['human_feedback_status']
type AgentRuleApplicationType = AgentRuleApplication['application_type']

type LearningRuleApplicationContext = {
  property_id?: string | null
  work_request_id?: string | null
  generated_output_excerpt?: string
  confidence_before?: string | null
  application_type?: AgentRuleApplicationType
}

type CorrectionLearningEvaluation = {
  correction_category: CorrectionCategory
  learning_value_score: number
  reusable: boolean
  should_ask_confirmation: boolean
  confirmation_question: string
  affected_agents: AgentName[]
  inferred_reason: string
}

type CorrectionLearningInput = {
  source_agent: AgentName
  task_type: string
  original_agent_output: string
  human_correction: string
}

type CuratedLessonIntakeDraft = {
  sourceLinksText: string
  transcriptOrNotes: string
  learningGoal: string
  tradeCategory: string
  memoryDestination: SourceLessonMemoryDestination
}

type LessonExtractionResult = {
  status?: string
  error?: string
  transcriptSource?: 'pasted' | 'youtube' | 'unavailable'
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

const AGENT_NAMES: AgentName[] = [
  'design_agent',
  'estimator_agent',
  'material_takeoff_agent',
  'photo_interpreter_agent',
  'client_communication_agent',
  'project_workflow_agent',
  'contractor_review_agent',
  'pricing_memory_agent',
  'quality_check_agent',
]

const CORRECTION_CATEGORIES: CorrectionCategory[] = [
  'function',
  'safety',
  'access',
  'sequencing',
  'cost',
  'quantity',
  'labor',
  'material',
  'code_or_best_practice',
  'user_comfort',
  'workflow_logic',
  'client_communication',
  'style_preference',
  'wording_preference',
  'visual_preference',
]

const LESSON_STATUSES: LessonStatus[] = [
  'human_verified',
  'needs_confirmation',
  'draft',
  'rejected',
  'deprecated',
]

const AGENT_RULE_FEEDBACK_STATUSES: AgentRuleApplicationFeedbackStatus[] = [
  'ignored',
  'accepted',
  'edited',
  'rejected',
]

const AGENT_RULE_APPLICATION_TYPES: AgentRuleApplicationType[] = ['suggested', 'applied']

const AGENT_MEMORY_CONFLICT_STATUSES: AgentMemoryConflictStatus[] = [
  'needs_review',
  'resolved',
  'dismissed',
  'escalated',
  'needs_site_review',
  'ask_client',
]

const SOURCE_LESSON_SOURCE_TYPES: SourceLessonSourceType[] = ['youtube', 'article', 'manual', 'field_note']
const SOURCE_LESSON_STATUSES: SourceLessonStatus[] = ['needs_review', 'draft', 'approved', 'rejected', 'archived']
const SOURCE_LESSON_COMPREHENSION_GRADES: { value: SourceLessonComprehensionGrade; label: string }[] = [
  { value: '', label: 'Comprehension grade required' },
  { value: 'A', label: 'A: Accurate and useful' },
  { value: 'B', label: 'B: Mostly accurate, minor edits needed' },
  { value: 'C', label: 'C: Partially accurate, needs revision' },
  { value: 'D', label: 'D: Mostly inaccurate' },
  { value: 'F', label: 'F: Reject / do not save' },
]
const SOURCE_LESSON_MEMORY_ALLOWED_GRADES: SourceLessonComprehensionGrade[] = ['A', 'B']
const CURATED_LESSON_TRADE_CATEGORIES = [
  'General Repair',
  'Carpentry',
  'Drywall',
  'Painting',
  'Roofing',
  'Flooring',
  'Tile',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Landscaping',
  'Cleaning',
]
const CURATED_LESSON_MEMORY_DESTINATIONS: { value: SourceLessonMemoryDestination; label: string }[] = [
  { value: 'project_specific', label: 'Project-specific' },
  { value: 'global_operational', label: 'Global labor memory' },
  { value: 'material_pricing', label: 'Material/pricing memory' },
  { value: 'none', label: 'Do not save yet' },
]

const EMPTY_CURATED_LESSON_INTAKE: CuratedLessonIntakeDraft = {
  sourceLinksText: '',
  transcriptOrNotes: '',
  learningGoal: '',
  tradeCategory: 'General Repair',
  memoryDestination: 'none',
}

const EMPTY_SOURCE_LESSON_DRAFT: SourceLessonDraft = {
  source_type: 'youtube',
  source_url: '',
  source_title: '',
  work_type: 'General Repair',
  problem_description: '',
  admin_intent: 'Extract hidden labor, tools, safety risks, cleanup, missing info, and estimate impact.',
  lesson_summary: '',
  observed_method: '',
  hidden_labor: '',
  job_steps: [],
  tools_materials: [],
  safety_notes: '',
  access_notes: '',
  cleanup_notes: '',
  estimate_impact: '',
  missing_info_questions: [],
  applies_when: '',
  does_not_apply_when: '',
  confidence: 'low',
  source_links: [],
  operational_meaning: '',
  materials_tools_equipment: [],
  cleanup_disposal: '',
  comprehension_grade: '',
  admin_feedback: '',
  human_review_status: 'ai_draft',
  memory_destination: 'none',
  original_draft: null,
  edited_lesson: null,
  reviewed_by: null,
  reviewed_at: null,
  status: 'draft',
  admin_notes: '',
  linked_property_id: '',
  linked_work_request_id: '',
  linked_repair_item_id: '',
}

const ACTIVE_CONTRACTOR_ASSIGNMENT_STATUSES: ContractorAssignmentStatus[] = [
  'assigned',
  'accepted',
  'walkthrough_requested',
  'revision_requested',
]

const CONTRACTOR_UPDATABLE_ASSIGNMENT_STATUSES: ContractorAssignmentStatus[] = [
  'accepted',
  'declined',
  'walkthrough_requested',
  'revision_requested',
  'completed',
]

const SITE_MEDIA_FINDING_TYPES = ['roof', 'access', 'terrain', 'obstruction', 'equipment', 'safety', 'estimate_impact', 'other']
const SITE_MEDIA_CONFIDENCE_LEVELS: PropertyMediaConfidence[] = ['low', 'medium', 'high']
const AGENT_RESEARCH_SCOPES: AgentResearchScope[] = [
  'Uploaded evidence only',
  'Property database',
  'Shelter Prep memory',
  'Official/code resources',
  'Supplier/material resources',
  'General web allowed',
  'Uploaded files only',
  'Uploaded files + property data',
  'Online resources allowed',
  'Building code / jurisdiction resources',
]
const AGENT_RESEARCH_CATEGORIES: AgentResearchCategory[] = [
  'Building code / jurisdiction',
  'Parts / materials',
  'Product / manufacturer documentation',
  'Supplier references',
  'Safety guidance',
  'Permit / inspection requirements',
  'Internal Shelter Prep memory',
  'Property history',
  'General web',
]
const AGENT_RESEARCH_QUESTION_TYPES: AgentResearchQuestionType[] = [
  'code / jurisdiction',
  'material / product',
  'cost range',
  'contractor verification',
  'missing info',
  'safety',
  'permit / inspection',
  'property-specific',
]

function canApproveOperationalMemory(role: MemoryActorRole) {
  return role === 'owner' || role === 'admin'
}

function canResolveMemoryConflict(role: MemoryActorRole) {
  return role === 'owner' || role === 'admin'
}

function canEditOperationalMemory(role: MemoryActorRole) {
  return role === 'owner' || role === 'admin' || role === 'estimator'
}

function getEffectiveMemoryActorRole(role: MemoryActorRole) {
  return role
}

function getSourceResearchDefaults(questionType: AgentResearchQuestionType, text = ''): AgentResearchCategory[] {
  const haystack = `${questionType} ${text}`.toLowerCase()
  const categories = new Set<AgentResearchCategory>()

  if (/code|jurisdiction|fire marshal|permit|inspection/.test(haystack)) {
    categories.add('Building code / jurisdiction')
    categories.add('Permit / inspection requirements')
  }
  if (/material|part|product|manufacturer|manual|install|appliance|microwave/.test(haystack)) {
    categories.add('Parts / materials')
    categories.add('Product / manufacturer documentation')
  }
  if (/supplier|price|cost|quote|ferguson|grainger|home depot|lowe/.test(haystack)) {
    categories.add('Supplier references')
  }
  if (/safety|fire|sprinkler|electrical|shock|hazard|osha/.test(haystack)) {
    categories.add('Safety guidance')
  }

  categories.add('Property history')
  return Array.from(categories)
}

function normalizeResearchCategories(value: unknown, fallback: AgentResearchCategory[] = ['Property history']): AgentResearchCategory[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim())
      : []
  const categories = rawItems.filter((item): item is AgentResearchCategory =>
    AGENT_RESEARCH_CATEGORIES.includes(item as AgentResearchCategory)
  )
  return categories.length ? categories : fallback
}

function toggleResearchCategory(current: AgentResearchCategory[], category: AgentResearchCategory) {
  return current.includes(category)
    ? current.filter((item) => item !== category)
    : [...current, category]
}

function researchCategoriesRequestOnline(categories: AgentResearchCategory[], scope: AgentResearchScope) {
  return categories.some((category) =>
    [
      'Building code / jurisdiction',
      'Parts / materials',
      'Product / manufacturer documentation',
      'Supplier references',
      'Safety guidance',
      'Permit / inspection requirements',
      'General web',
    ].includes(category)
  ) || ['Online resources allowed', 'Building code / jurisdiction resources', 'Official/code resources', 'Supplier/material resources', 'General web allowed'].includes(scope)
}

function getPrimarySourceQuality(categories: AgentResearchCategory[]): AgentResearchSourceQuality {
  if (categories.some((category) => ['Building code / jurisdiction', 'Permit / inspection requirements', 'Safety guidance'].includes(category))) return 'official'
  if (categories.includes('Product / manufacturer documentation')) return 'manufacturer'
  if (categories.includes('Supplier references') || categories.includes('Parts / materials')) return 'supplier'
  if (categories.includes('Internal Shelter Prep memory') || categories.includes('Property history')) return 'internal_memory'
  if (categories.includes('General web')) return 'general_web'
  return 'unknown'
}

function canDraftSourceLessonsWithSession(role: MemoryActorRole, hasSession: boolean) {
  return hasSession && canEditOperationalMemory(role)
}

function canApproveSourceLessonsWithSession(role: MemoryActorRole, hasSession: boolean) {
  return hasSession && canApproveOperationalMemory(role)
}

function canProvideRuleFeedback(
  role: MemoryActorRole,
  application?: AgentRuleApplication | null,
  status?: AgentRuleApplicationFeedbackStatus,
  assignments: ContractorAssignment[] = [],
  currentUserId?: string | null
) {
  if (role === 'owner' || role === 'admin') return true
  if (role === 'estimator') return status !== 'accepted'
  if (role !== 'contractor') return false
  if (!application || application.application_type !== 'applied' || !currentUserId) return false
  return assignments.some((assignment) => {
    const active = ACTIVE_CONTRACTOR_ASSIGNMENT_STATUSES.includes(assignment.status)
    const sameContractor = assignment.contractor_profile_id === currentUserId
    const sameProperty = Boolean(application.property_id && assignment.property_id === application.property_id)
    const sameRequest = Boolean(application.work_request_id && assignment.work_request_id === application.work_request_id)
    return active && sameContractor && (sameProperty || sameRequest)
  })
}

type IntakeDraft = {
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

type Invoice = {
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

type InvoiceCostAnalysis = {
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

type MaterialCost = {
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

type MaterialEditorDraft = {
  name: string
  unit: string
  typicalPrice: string
  lowPrice: string
  highPrice: string
  category: string
  zip: string
  source: string
}

type SellerPrepAnalysisV1 = {
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

type SellerPrepItemV1 = {
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

type InspectionTaskIntelligence = {
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

type InspectionReportDraft = {
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

type PricingMemoryEntry = {
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

type HumanPricingMemory = {
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

type MaterialEstimateDraftLine = {
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

type LeadPropertyProfile = {
  beds?: string
  baths?: string
  sqft?: string
  yearBuilt?: string
  propertyType?: string
  jurisdiction?: string
  parcelNumber?: string
  raw?: unknown
}

type LaborRate = {
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

type LaborSourceLink = {
  name: string
  url: string
  date_checked: string
  confidence: string
  admin_override_note?: string
  priority: number
}

type CuratedLaborDraft = {
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

function getLaborConfidenceLabel(value: string | null | undefined, verified?: boolean | null) {
  if (verified) return 'labor_verified'
  return value || 'needs_review'
}

function normalizeLaborText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeScopeText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRequestPropertyId(request: WorkRequest | null | undefined) {
  return request?.id || ''
}

function getLinkedPropertyId(request: WorkRequest | null | undefined) {
  return request?.propertyId || null
}

function getDefaultRepairItemId(request: WorkRequest | null | undefined, itemName = '') {
  if (!request) return ''
  const seed = normalizeScopeText(itemName || request.workType || request.description || 'repair')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `${request.id}:${seed || 'repair-item'}`
}

function getCurrentScopeReason(request: WorkRequest | null | undefined) {
  if (!request) return 'current estimate scope'
  return [request.workType, request.description].filter(Boolean).join(' — ') || 'current estimate scope'
}

function getEstimateInclusionReason(item: EstimateItem) {
  return (
    item.relevance_reason ||
    item.quantity_reason ||
    (item.scope_source ? item.scope_source.replace(/_/g, ' ') : '') ||
    (item.repair_item_id ? `repair item ${item.repair_item_id}` : '') ||
    'current job scope'
  )
}

function isEstimateItemRejected(item: EstimateItem) {
  return item.review_status === 'rejected'
}

function isHumanScopedMaterial(item: EstimateItem) {
  const confidence = String(item.confidence || '')
  return confidence.includes('human') || Boolean(item.human_approved)
}

function estimateItemMatchesCurrentScope(item: EstimateItem, request: WorkRequest | null) {
  if (!request) return true
  if (isEstimateItemRejected(item)) return false

  const propertyId = getRequestPropertyId(request)
  const matchesCurrentJob =
    item.lead_id === request.id ||
    item.request_id === request.id ||
    item.job_id === request.id ||
    item.property_id === propertyId ||
    (!item.request_id && !item.job_id && !item.property_id)

  if (!matchesCurrentJob) return false

  if (isHumanScopedMaterial(item)) return true

  const scopeText = normalizeScopeText([request.workType, request.description].join(' '))
  const itemText = normalizeScopeText(
    [
      item.item_name,
      item.category,
      item.quantity_reason,
      item.scope_source,
      item.relevance_reason,
    ].join(' ')
  )

  if (!scopeText || !itemText) return Boolean(item.repair_item_id || item.quantity_reason)

  const scopeWords = scopeText.split(' ').filter((word) => word.length > 3)
  const hasScopeMatch = scopeWords.some((word) => itemText.includes(word))
  const hasScopeLink = Boolean(item.repair_item_id || item.scope_source || item.relevance_reason || item.quantity_reason)
  const confidence = String(item.confidence || '')
  const hasReviewableConfidence =
    confidence.includes('verified') ||
    confidence.includes('review') ||
    confidence.includes('source') ||
    confidence.includes('draft') ||
    confidence.includes('memory')

  return hasScopeLink && hasScopeMatch && hasReviewableConfidence
}

function getLaborKeywordMatches(request: WorkRequest) {
  const text = normalizeLaborText(
    [request.workType, request.description, request.timeline, request.urgency].join(' ')
  )

  const keywords: Record<string, string[]> = {
    roofing: ['roof', 'roofing', 'shingle', 'leak', 'flashing', 'gutter'],
    painting: ['paint', 'painting', 'primer', 'interior paint', 'exterior paint'],
    concrete: ['concrete', 'slab', 'demo', 'remove concrete', 'post block'],
    decking: ['deck', 'decking', 'framing deck', 'post base', '2x6'],
    drywall: ['drywall', 'sheetrock', 'patch', 'joint compound', 'texture'],
    plumbing: ['plumb', 'plumbing', 'leak', 'fixture', 'toilet', 'sink'],
    electrical: ['electric', 'electrical', 'outlet', 'panel', 'breaker', 'light'],
    flooring: ['floor', 'flooring', 'vinyl', 'lvp', 'tile floor'],
    tile: ['tile', 'grout', 'thinset', 'backsplash', 'shower'],
    landscaping: ['landscape', 'yard', 'lawn', 'tree', 'mulch'],
    cleaning: ['clean', 'cleaning', 'turnover', 'debris'],
  }

  return Object.entries(keywords)
    .filter(([, words]) => words.some((word) => text.includes(word)))
    .map(([trade]) => trade)
}

function scoreLaborRateForRequest(rate: LaborRate, request: WorkRequest) {
  const workText = normalizeLaborText([request.workType, request.description].join(' '))
  const trade = normalizeLaborText(rate.trade || '')
  const jobType = normalizeLaborText(rate.job_type || '')
  const matches = getLaborKeywordMatches(request)

  let score = 0

  if (rate.human_verified) score += 100
  if (rate.zip && request.zip && rate.zip === request.zip) score += 30
  if (!rate.zip) score += 5
  if (trade && workText.includes(trade)) score += 30
  if (jobType && workText.includes(jobType)) score += 35
  if (matches.some((match) => trade.includes(match) || match.includes(trade))) score += 40
  if (matches.some((match) => jobType.includes(match) || match.includes(jobType))) score += 25
  if (Number(rate.typical_rate || 0) > 0) score += 10

  return score
}

function getDefaultLaborUnits(rate: LaborRate | null, request?: WorkRequest | null) {
  const unit = normalizeLaborText(rate?.unit || 'hour')
  const text = normalizeLaborText([request?.workType || '', request?.description || ''].join(' '))

  if (unit.includes('sqft') || unit.includes('sq ft') || unit.includes('square')) {
    const sqftMatch = text.match(/(\d{2,5})\s*(sqft|sq ft|square feet|sf)/)
    return sqftMatch ? Number(sqftMatch[1]) : 100
  }

  if (unit.includes('day')) return 1
  if (unit.includes('job') || unit.includes('project') || unit.includes('flat')) return 1

  if (text.includes('asap') || text.includes('urgent')) return 6
  return 4
}

function calculateLaborTotalFromRate(
  rate: LaborRate | null,
  unitsText: string,
  minimumText: string,
  tripText: string,
  disposalText: string
) {
  if (!rate) return 0

  const units = Number(unitsText || 0)
  const typicalRate = Number(rate.typical_rate || 0)
  const minimumCharge = Number(minimumText || 0)
  const tripCharge = Number(tripText || 0)
  const disposalFee = Number(disposalText || 0)
  const baseLabor = typicalRate * units

  return Math.round((Math.max(baseLabor, minimumCharge) + tripCharge + disposalFee) * 100) / 100
}

function getBenchmarkLaborRange(request: WorkRequest | null | undefined) {
  const text = normalizeLaborText([request?.workType || '', request?.description || ''].join(' '))
  if (text.includes('roof')) return { trade: 'Roofing', low: 65, high: 115 }
  if (text.includes('paint')) return { trade: 'Painting', low: 45, high: 85 }
  if (text.includes('electric')) return { trade: 'Electrical', low: 85, high: 145 }
  if (text.includes('plumb')) return { trade: 'Plumbing', low: 85, high: 150 }
  if (text.includes('drywall') || text.includes('sheetrock')) return { trade: 'Drywall', low: 50, high: 95 }
  if (text.includes('deck') || text.includes('framing')) return { trade: 'Carpentry', low: 60, high: 110 }
  if (text.includes('landscape') || text.includes('tree')) return { trade: 'Landscaping', low: 45, high: 90 }
  if (text.includes('clean')) return { trade: 'Cleaning', low: 35, high: 65 }
  return { trade: request?.workType || 'General Repair', low: 55, high: 105 }
}

function curatedLaborTotal(lowHours: number, highHours: number, lowRate: number, highRate: number, multiplier: number, setupHours: number) {
  const safeMultiplier = multiplier > 0 ? multiplier : 1
  const low = (lowHours + setupHours) * lowRate * safeMultiplier
  const high = (highHours + setupHours) * highRate * safeMultiplier
  return {
    low: Math.round(low * 100) / 100,
    high: Math.round(high * 100) / 100,
    standard: Math.round(((low + high) / 2) * 100) / 100,
  }
}

function getLaborSourceLinks(request: WorkRequest, matchedRate: LaborRate | null, dateChecked: string): LaborSourceLink[] {
  const links: LaborSourceLink[] = []

  if (matchedRate?.human_verified) {
    links.push({
      name: 'Shelter Prep verified labor memory',
      url: matchedRate.source || 'internal://labor-rates',
      date_checked: matchedRate.last_checked || matchedRate.verified_at || dateChecked,
      confidence: getLaborConfidenceLabel(matchedRate.confidence, matchedRate.human_verified),
      admin_override_note: matchedRate.admin_override_note || matchedRate.notes || '',
      priority: 1,
    })
  }

  links.push(
    {
      name: 'Homewyse / industry benchmark',
      url: `https://www.homewyse.com/services/index.html`,
      date_checked: dateChecked,
      confidence: matchedRate?.human_verified ? 'supporting_reference' : 'benchmark_review',
      priority: 4,
    },
    {
      name: 'BLS Occupational Employment and Wage Statistics',
      url: 'https://www.bls.gov/oes/current/oes_nat.htm',
      date_checked: dateChecked,
      confidence: 'public_wage_reference',
      priority: 5,
    },
    {
      name: 'SAM.gov Wage Determinations / Davis-Bacon',
      url: 'https://sam.gov/content/wage-determinations',
      date_checked: dateChecked,
      confidence: 'public_wage_reference',
      priority: 5,
    }
  )

  if (request.zip) {
    links.push({
      name: `Similar completed jobs / local ZIP context ${request.zip}`,
      url: 'internal://lead-location',
      date_checked: dateChecked,
      confidence: 'similar_job_context_review',
      priority: 2,
    })
  }

  links.push({
    name: 'Contractor corrections memory',
    url: 'internal://contractor-corrections',
    date_checked: dateChecked,
    confidence: 'contractor_correction_context',
    priority: 3,
  })

  return links.sort((a, b) => a.priority - b.priority)
}

function buildCuratedLaborDraftForRequest(
  request: WorkRequest,
  matchedRate: LaborRate | null,
  approvedLaborHours = 0
): CuratedLaborDraft {
  const benchmark = getBenchmarkLaborRange(request)
  const dateChecked = new Date().toISOString()
  const defaultHours = approvedLaborHours > 0 ? approvedLaborHours : getDefaultLaborUnits(matchedRate, request)
  const lowRate = Number(matchedRate?.hourly_rate_low || matchedRate?.low_rate || benchmark.low)
  const highRate = Number(matchedRate?.hourly_rate_high || matchedRate?.high_rate || benchmark.high)
  const typicalRate = Number(matchedRate?.typical_rate || (lowRate + highRate) / 2)
  const lowHours = Number(matchedRate?.labor_hours_low || Math.max(1, Math.round(defaultHours * 0.75 * 10) / 10))
  const highHours = Number(matchedRate?.labor_hours_high || Math.max(lowHours, Math.round(defaultHours * 1.35 * 10) / 10))

  return {
    trade: matchedRate?.trade || benchmark.trade,
    jobType: matchedRate?.job_type || request.workType || 'General Repair',
    laborHoursLow: String(lowHours),
    laborHoursHigh: String(highHours),
    hourlyRateLow: String(lowRate || Math.round(typicalRate * 0.85 * 100) / 100),
    hourlyRateHigh: String(highRate || Math.round(typicalRate * 1.2 * 100) / 100),
    accessMultiplier: String(matchedRate?.access_multiplier || 1),
    setupCleanupHours: String(matchedRate?.setup_cleanup_hours || 1),
    notes: [
      'Curated labor estimate. Admin approval required.',
      matchedRate?.human_verified ? 'Prioritized admin-approved Shelter Prep labor memory.' : 'No matching verified Shelter Prep labor memory was found; benchmark/public wage references are draft context.',
      'Final labor must be edited or approved by an admin before use.',
    ].join('\n'),
    confidence: matchedRate?.human_verified ? 'labor_memory_review' : 'benchmark_review',
    sourceLinks: getLaborSourceLinks(request, matchedRate, dateChecked),
    sourcePriority: matchedRate?.human_verified ? 'admin_verified_shelter_prep_labor_memory' : 'homewyse_industry_public_wage_draft',
    adminEdited: false,
  }
}

type EstimateItem = {
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

type MaterialListComplexity =
  | 'small_simple'
  | 'medium_defined'
  | 'large_complex'
  | 'unknown_needs_review'

type MaterialComplexityClassification = {
  level: MaterialListComplexity
  confidence: 'low' | 'medium' | 'high'
  reason: string
  missingInfo: string[]
  reviewChecklist: string[]
  tradePackages: string[]
}

type JobExecutionStepStatus = 'ai_draft' | 'needs_review' | 'human_verified' | 'rejected' | 'deprecated'

type JobExecutionStep = {
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

type JobExecutionStepLearningRecord = {
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

type JobExecutionStepAction = 'edited' | 'approved' | 'rejected' | 'added' | 'reordered'

type PhotoFieldMemory = {
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

type JobPacketMetadata = {
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

type AiResearchDraftStatus = 'ai_draft' | 'needs_review' | 'human_verified' | 'rejected' | 'deprecated'

type AiResearchDraft = {
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

type MaterialReviewAction =
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'added'
  | 'saved_for_next_time'

type ManualMaterialDraft = {
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

const MATERIAL_REJECTION_REASONS = [
  'Wrong job',
  'Wrong material',
  'Duplicate',
  'Bad source',
  'Not needed for scope',
  'Price too high',
  'Other',
]

const EMPTY_MANUAL_MATERIAL_DRAFT: ManualMaterialDraft = {
  itemName: '',
  vendor: '',
  quantity: '1',
  unitCost: '',
  totalCost: '',
  sourceUrl: '',
  notes: '',
  reviewStatus: 'needs_review',
  repairItemId: '',
}

const JOB_STEP_STATUSES: JobExecutionStepStatus[] = ['ai_draft', 'needs_review', 'human_verified', 'rejected', 'deprecated']
const AI_RESEARCH_DRAFT_STATUSES: AiResearchDraftStatus[] = ['ai_draft', 'needs_review', 'human_verified', 'rejected', 'deprecated']

const JOB_SCOPE_LOCAL_STORAGE_KEY = 'shelter-prep-job-execution-steps-v1'
const JOB_PACKET_METADATA_LOCAL_STORAGE_KEY = 'shelter-prep-job-packets-v1'
const AI_RESEARCH_DRAFT_LOCAL_STORAGE_KEY = 'shelter-prep-ai-research-drafts-v1'
const PROPERTY_AGENT_OUTPUT_LOCAL_STORAGE_KEY = 'shelter-prep-property-agent-outputs-v1'

function getJobScopeStorageKey(requestId: string) {
  return `${JOB_SCOPE_LOCAL_STORAGE_KEY}:${requestId}`
}

function getAiResearchDraftStorageKey(requestId: string) {
  return `${AI_RESEARCH_DRAFT_LOCAL_STORAGE_KEY}:${requestId}`
}

function getPropertyAgentOutputStorageKey(requestId: string) {
  return `${PROPERTY_AGENT_OUTPUT_LOCAL_STORAGE_KEY}:${requestId}`
}

function sortJobExecutionSteps(steps: JobExecutionStep[]) {
  return [...steps].sort((a, b) => a.step_number - b.step_number)
}

function normalizeJobScopeTokenText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function jobScopeMemoryMatchesCurrentRequest(memory: JobExecutionStepLearningRecord, request: WorkRequest) {
  const requestText = normalizeJobScopeTokenText([request.workType, request.description].join(' '))
  const memoryText = normalizeJobScopeTokenText(
    [memory.work_type, memory.repair_context, memory.repair_description_context, memory.step_title, memory.labor_scope, memory.trade].join(' ')
  )
  const requestTokens = requestText.split(' ').filter((word) => word.length > 4)
  if (!requestTokens.length || !memoryText) return false

  const matchedTokens = requestTokens.filter((word) => memoryText.includes(word))
  return matchedTokens.length >= Math.min(2, requestTokens.length)
}

function pricingMemoryMatchesCurrentRequest(memory: HumanPricingMemory, request: WorkRequest) {
  if (!memory.human_verified) return false
  const sameZipOrUnknown = !memory.zip || !request.zip || memory.zip === request.zip
  const requestText = normalizeJobScopeTokenText([request.workType, request.description, request.propertyFacts?.propertyType || ''].join(' '))
  const memoryText = normalizeJobScopeTokenText([memory.work_type, memory.item_name, memory.admin_notes, memory.markup_notes].join(' '))
  const requestTokens = requestText.split(' ').filter((word) => word.length > 4)
  const matchedTokens = requestTokens.filter((word) => memoryText.includes(word))
  return sameZipOrUnknown && matchedTokens.length >= Math.min(2, requestTokens.length || 2)
}

function evaluateCorrectionForLearning(input: CorrectionLearningInput): CorrectionLearningEvaluation {
  const text = normalizeJobScopeTokenText(
    [input.task_type, input.original_agent_output, input.human_correction].join(' ')
  )
  const hasAny = (words: string[]) => words.some((word) => text.includes(word))
  let score = 0
  let correctionCategory: CorrectionCategory = 'style_preference'
  let inferredReason = 'Correction appears to be a preference unless the human confirms reusable operational logic.'

  const functionHit = hasAny(['function', 'usable', 'feasible', 'work', 'operate', 'placement', 'layout'])
  const safetyAccessComfortHit = hasAny(['safe', 'safety', 'access', 'spray', 'reach', 'entry', 'comfort', 'ergonomic', 'hazard'])
  const costMaterialLaborHit = hasAny(['cost', 'price', 'labor', 'hour', 'material', 'quantity', 'takeoff', 'waste', 'markup'])
  const assumptionHit = hasAny(['instead', 'not', 'wrong', 'actually', 'because', 'should', 'move', 'change'])
  const futureHit = hasAny(['when', 'usually', 'future', 'similar', 'feasible', 'before', 'after', 'avoid'])
  const styleOnly = hasAny(['color', 'font', 'visual', 'style', 'taste', 'prettier'])
  const wordingOnly = hasAny(['wording', 'tone', 'phrase', 'copy', 'say'])

  if (functionHit) {
    score += 2
    correctionCategory = 'function'
    inferredReason = 'The correction may affect how the repair or design works in the field.'
  }
  if (safetyAccessComfortHit) {
    score += 2
    correctionCategory = text.includes('access') || text.includes('reach') ? 'access' : text.includes('safe') ? 'safety' : 'user_comfort'
    inferredReason = 'The correction may improve safety, access, or user comfort.'
  }
  if (costMaterialLaborHit) {
    score += 2
    correctionCategory = text.includes('labor') || text.includes('hour') ? 'labor' : text.includes('material') || text.includes('quantity') ? 'material' : 'cost'
    inferredReason = 'The correction may change cost, labor, quantity, or material assumptions.'
  }
  if (assumptionHit) score += 2
  if (futureHit) score += 2
  if (styleOnly && !functionHit && !safetyAccessComfortHit && !costMaterialLaborHit) {
    score -= 2
    correctionCategory = 'visual_preference'
  }
  if (wordingOnly && !functionHit && !safetyAccessComfortHit && !costMaterialLaborHit) {
    score -= 2
    correctionCategory = 'wording_preference'
  }

  const affectedAgents = new Set<AgentName>([input.source_agent, 'quality_check_agent'])
  if (['function', 'user_comfort', 'code_or_best_practice'].includes(correctionCategory)) {
    affectedAgents.add('design_agent')
    affectedAgents.add('estimator_agent')
  }
  if (['cost', 'quantity', 'labor', 'material'].includes(correctionCategory)) {
    affectedAgents.add('estimator_agent')
    affectedAgents.add('material_takeoff_agent')
    affectedAgents.add('pricing_memory_agent')
  }
  if (['safety', 'access', 'sequencing', 'workflow_logic'].includes(correctionCategory)) {
    affectedAgents.add('project_workflow_agent')
    affectedAgents.add('contractor_review_agent')
  }
  if (correctionCategory === 'client_communication' || correctionCategory === 'wording_preference') {
    affectedAgents.add('client_communication_agent')
  }
  if (input.source_agent === 'photo_interpreter_agent') affectedAgents.add('photo_interpreter_agent')

  const shouldAskConfirmation = score >= 6
  const confirmationQuestion = shouldAskConfirmation
    ? buildTargetedLearningConfirmation(input.human_correction, correctionCategory, inferredReason)
    : ''

  return {
    correction_category: correctionCategory,
    learning_value_score: Math.max(0, score),
    reusable: score >= 3,
    should_ask_confirmation: shouldAskConfirmation,
    confirmation_question: confirmationQuestion,
    affected_agents: Array.from(affectedAgents),
    inferred_reason: inferredReason,
  }
}

function buildTargetedLearningConfirmation(
  correction: string,
  category: CorrectionCategory,
  inferredReason: string
) {
  const normalized = normalizeJobScopeTokenText(correction)
  if (normalized.includes('shower') || normalized.includes('handle') || normalized.includes('control')) {
    return 'Got it - is the reason so the user can turn the water on before stepping into the spray?'
  }
  if (category === 'access') return 'Should this become a reusable access rule for similar site conditions, with exceptions for constraints or client preference?'
  if (category === 'safety') return 'Should future drafts treat this as a safety rule when similar hazards or access conditions appear?'
  if (category === 'labor') return 'Should future estimates include this labor adjustment when similar scope, access, and sequencing conditions match?'
  if (category === 'material' || category === 'quantity') return 'Should future takeoffs use this quantity/material adjustment only when the same scope and field conditions match?'
  if (category === 'cost') return 'Should future estimates use this pricing logic only for similar work type, region, and verified scope?'
  return `${inferredReason} Should Shelter Prep save this as a conditional rule for similar future jobs?`
}

function buildJobExecutionSteps(request: WorkRequest, learnedRecords: JobExecutionStepLearningRecord[] = []) {
  const propertyId = getRequestPropertyId(request)
  const repairItemId = getDefaultRepairItemId(request, request.workType || request.description)
  const text = normalizeJobScopeTokenText([request.workType, request.description].join(' '))
  const now = new Date().toISOString()

  const baseSteps: Array<Omit<JobExecutionStep, 'id' | 'property_id' | 'job_request_id' | 'repair_item_id' | 'created_at'>> = [
    {
      step_number: 1,
      title: 'Protect work area',
      labor_scope: 'Mask floors, counters, and adjacent finishes; set dust control before work begins.',
      trade: 'Prep / general labor',
      estimated_hours_low: 0.5,
      estimated_hours_high: 1,
      materials_tools: 'Plastic, tape, drop cloths, painter paper',
      equipment: 'Shop vacuum, step ladder',
      safety_notes: 'Keep walk paths clear and tape down trip edges.',
      access_notes: 'Confirm occupied areas, pets, keys, and work hours before setup.',
      cleanup_notes: 'Remove temporary protection after dusty work is complete.',
      disposal_needed: false,
      confidence: 'ai_draft_scope_template',
      status: 'ai_draft',
      admin_notes: '',
    },
  ]

  if (text.includes('cabinet') || text.includes('demo') || text.includes('remove')) {
    baseSteps.push({
      step_number: baseSteps.length + 1,
      title: text.includes('cabinet') ? 'Remove upper cabinets' : 'Remove existing material',
      labor_scope: 'Detach existing items, remove fasteners, lower safely, and limit wall or finish damage where possible.',
      trade: 'Carpenter / demo',
      estimated_hours_low: 2,
      estimated_hours_high: 4,
      materials_tools: 'Drill, pry bar, utility knife, fastener bits, disposal bags',
      equipment: 'Helper, ladder, hand truck as needed',
      safety_notes: 'Verify electrical, plumbing, hidden fasteners, and load before removal.',
      access_notes: 'Confirm parking/load-out path and whether items are saved or discarded.',
      cleanup_notes: 'Stage debris away from active work and sweep loose fasteners.',
      disposal_needed: true,
      confidence: 'ai_draft_scope_template',
      status: 'ai_draft',
      admin_notes: '',
    })
  }

  if (text.includes('drywall') || text.includes('patch') || text.includes('cabinet') || text.includes('wall')) {
    baseSteps.push({
      step_number: baseSteps.length + 1,
      title: 'Wall patch and prep',
      labor_scope: 'Patch fastener holes, repair drywall damage, tape as needed, sand smooth, and prep for finish.',
      trade: 'Drywall / painter',
      estimated_hours_low: 2,
      estimated_hours_high: 5,
      materials_tools: 'Joint compound, tape, sanding block, primer-ready patch material',
      equipment: 'Sanding pole, shop vacuum',
      safety_notes: 'Use dust control and eye protection while sanding.',
      access_notes: 'Allow return access if compound requires dry time between coats.',
      cleanup_notes: 'Vacuum sanding dust and wipe adjacent surfaces.',
      disposal_needed: false,
      confidence: 'ai_draft_scope_template',
      status: 'ai_draft',
      admin_notes: '',
    })
  }

  if (text.includes('paint') || text.includes('patch') || text.includes('wall') || text.includes('cabinet')) {
    baseSteps.push({
      step_number: baseSteps.length + 1,
      title: 'Prime and paint affected wall area',
      labor_scope: 'Spot prime patched areas, paint to blend, or repaint full wall when touch-up will not look clean.',
      trade: 'Painter',
      estimated_hours_low: 2,
      estimated_hours_high: 4,
      materials_tools: 'Primer, paint, rollers, brushes, tray liners',
      equipment: 'Drop cloths, ladder',
      safety_notes: 'Ventilate work area and follow product dry-time guidance.',
      access_notes: 'Confirm paint color, sheen, and whether owner has attic/garage stock paint.',
      cleanup_notes: 'Clean tools and remove paint waste from finished surfaces.',
      disposal_needed: false,
      confidence: 'ai_draft_scope_template',
      status: 'ai_draft',
      admin_notes: '',
    })
  }

  if (!baseSteps.some((step) => step.title !== 'Protect work area')) {
    baseSteps.push({
      step_number: 2,
      title: 'Complete repair work',
      labor_scope: 'Perform the requested repair using current job notes, photos, and site conditions; adjust sequence after field verification.',
      trade: request.workType || 'General repair',
      estimated_hours_low: 2,
      estimated_hours_high: 6,
      materials_tools: 'Trade-specific hand tools and approved materials',
      equipment: 'Ladder, power tools, or specialty equipment as conditions require',
      safety_notes: 'Verify utilities, structural risks, moisture, and occupied-area hazards before work.',
      access_notes: 'Confirm access window and any homeowner/agent coordination needs.',
      cleanup_notes: 'Keep work area broom clean between visits.',
      disposal_needed: false,
      confidence: 'ai_draft_general_scope',
      status: 'ai_draft',
      admin_notes: '',
    })
  }

  const matchingLearning = learnedRecords
    .filter((record) => jobScopeMemoryMatchesCurrentRequest(record, request))
    .slice(0, 2)
    .map((record) => ({
      step_number: 0,
      title: record.step_title,
      labor_scope: record.labor_scope,
      trade: record.trade || request.workType || 'General repair',
      estimated_hours_low: Number(record.approved_hours_low ?? record.approved_hours ?? 1),
      estimated_hours_high: Number(record.approved_hours_high ?? record.approved_hours ?? 1),
      materials_tools: record.materials_tools || 'Use verified memory as supporting context; verify current materials before approval.',
      equipment: record.equipment || 'Verify against current site conditions.',
      safety_notes: record.safety_notes || 'Apply only if current scope matches the learned repair context.',
      access_notes: record.access_notes || 'Confirm current job access before relying on memory.',
      cleanup_notes: record.cleanup_notes || 'Match cleanup to current scope.',
      disposal_needed: Boolean(record.disposal_needed),
      confidence: 'learned_scope_match_needs_review',
      status: 'ai_draft' as JobExecutionStepStatus,
      admin_notes: `Learned from prior review on ${new Date(record.reviewed_at).toLocaleDateString()}.`,
    }))

  const cleanupStep: Omit<JobExecutionStep, 'id' | 'property_id' | 'job_request_id' | 'repair_item_id' | 'created_at'> = {
    step_number: baseSteps.length + matchingLearning.length + 1,
    title: 'Clean up and disposal',
    labor_scope: 'Remove debris, vacuum dust, wipe affected surfaces, and haul away removed materials if required.',
    trade: 'General labor',
    estimated_hours_low: 1,
    estimated_hours_high: 2,
    materials_tools: 'Vacuum, trash bags, cleaning wipes, disposal containers',
    equipment: 'Hand truck or truck access if hauling is included',
    safety_notes: 'Bag sharp debris and keep dust contained during load-out.',
    access_notes: 'Confirm disposal path, parking, and dump/haul-away responsibility.',
    cleanup_notes: 'Leave work area clean enough for owner/client walkthrough.',
    disposal_needed: true,
    confidence: 'ai_draft_scope_template',
    status: 'ai_draft',
    admin_notes: '',
  }

  return [...baseSteps, ...matchingLearning, cleanupStep].map((step, index) => ({
    ...step,
    id: makeId(),
    created_at: now,
    property_id: propertyId,
    job_request_id: request.id,
    repair_item_id: repairItemId,
    step_number: index + 1,
  }))
}

function buildPropertyAgentDrafts(request: WorkRequest): PropertyAgentResult[] {
  const propertyId = getRequestPropertyId(request)
  const repairItemId = getDefaultRepairItemId(request, request.workType || request.description)
  const missingInfo = [
    ...getMissingInfoForAgentDraft(request),
    ...(!request.propertyFacts?.bedrooms ? ['bedrooms'] : []),
    ...(!request.propertyFacts?.squareFeet ? ['square footage'] : []),
  ]
  const propertyPack = buildPropertyResearchPack(request.propertyAddress, request.city, request.state || 'OR', request.zip)
  const intelligence = buildEstimateIntelligence({
    id: request.id,
    workType: request.workType,
    description: request.description,
    urgency: request.urgency,
    occupancy: request.occupancy,
    timeline: request.timeline,
    city: request.city,
    state: request.state,
    zip: request.zip,
    propertyFacts: request.propertyFacts,
    photoCount: request.photos.length,
    documentCount: request.documents.length,
  })
  const jobSteps = buildJobExecutionSteps(request).map((step) => ({
    title: step.title,
    trade: step.trade,
    hours: `${step.estimated_hours_low}-${step.estimated_hours_high}`,
  }))
  const logisticsAudit = buildLogisticsAgentAudit(request, intelligence, jobSteps)
  const now = new Date().toISOString()
  const base = {
    property_id: propertyId,
    work_request_id: request.id,
    repair_item_id: repairItemId,
    status: 'ai_draft' as PropertyAgentStatus,
    reviewed_at: null,
    reviewed_by: null,
    created_at: now,
  }

  const drafts: Array<Omit<PropertyAgentResult, 'id'>> = [
    {
      ...base,
      agent_name: 'property_profile_agent',
      input_summary: `${request.propertyAddress}, ${request.city}, ${request.state} ${request.zip}`,
      output_json: {
        beds: request.propertyFacts?.bedrooms || null,
        baths: request.propertyFacts?.bathrooms || null,
        sqft: request.propertyFacts?.squareFeet || null,
        year_built: request.propertyFacts?.yearBuilt || null,
        property_type: request.propertyFacts?.propertyType || null,
        jurisdiction: request.propertyFacts?.jurisdiction || propertyPack.jurisdiction,
        map_links: propertyPack.links,
      },
      assumptions: ['Public-record style facts must be verified before permit-sensitive scope is finalized.'],
      confidence: request.propertyFacts?.verified ? 'medium_verified_by_operator' : 'low_needs_property_review',
      missing_info: missingInfo.filter((item) => ['bedrooms', 'square footage', 'property address'].includes(item)),
      audit_notes: ['Property profile is contextual support only; it does not approve pricing or scope.'],
    },
    {
      ...base,
      agent_name: 'photo_agent',
      input_summary: `${request.photos.length} photo(s), ${request.documents.length} document(s), ${request.description.slice(0, 120)}`,
      output_json: {
        visible_repair_conditions: request.photos.length ? ['Uploaded visuals available for human/photo review.'] : [],
        room_area_classification: inferRoomOrArea(request),
        trade_category: intelligence.tradeBreakdown,
        likely_repair_items: intelligence.draftItems.slice(0, 4).map((item) => item.itemName),
      },
      assumptions: ['Photo analysis is limited to uploaded context and request text in this local draft.'],
      confidence: request.photos.length ? 'medium_needs_visual_review' : 'low_missing_photos',
      missing_info: request.photos.length ? [] : ['photos'],
      audit_notes: ['Missing angles, close-ups, and measurements may materially change scope.'],
    },
    {
      ...base,
      agent_name: 'measurement_agent',
      input_summary: request.description,
      output_json: {
        quantity_assumptions: intelligence.quantityBasis,
        material_quantity_estimates: intelligence.draftItems.map((item) => ({
          item: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
        })),
        field_verified_required: true,
      },
      assumptions: intelligence.quantityBasis,
      confidence: 'medium_rule_based',
      missing_info: intelligence.missingInfo,
      audit_notes: ['All quantities are rough planning assumptions until field verified.'],
    },
    {
      ...base,
      agent_name: 'material_agent',
      input_summary: `${request.workType} material package draft`,
      output_json: {
        materials: intelligence.draftItems.map((item) => ({
          name: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          estimated_cost: item.quantity * item.unitPrice,
          confidence: item.confidence,
        })),
        human_review_status: 'needs_review',
      },
      assumptions: ['Material package prices are draft assumptions and must be source-reviewed.'],
      confidence: 'medium_needs_source_review',
      missing_info: intelligence.missingInfo,
      audit_notes: ['Do not purchase materials from agent output; approved estimate lines remain the source of truth.'],
    },
    {
      ...base,
      agent_name: 'labor_scope_agent',
      input_summary: `${request.workType} labor scope plan`,
      output_json: {
        labor_steps: jobSteps,
        safety_access_cleanup_required: true,
      },
      assumptions: ['Labor step order may change after field conditions are verified.'],
      confidence: 'medium_scope_draft',
      missing_info: intelligence.missingInfo,
      audit_notes: ['Labor steps are draft until a proficient human approves job execution scope.'],
    },
    {
      ...base,
      agent_name: 'pricing_agent',
      input_summary: `${request.workType} pricing draft`,
      output_json: {
        labor_hours: intelligence.laborHours,
        labor_rate: intelligence.laborRate,
        labor_subtotal: intelligence.laborSubtotal,
        material_subtotal: intelligence.materialSubtotal,
        markup_percent: intelligence.overheadPercent + intelligence.coordinationPercent,
        contingency_percent: intelligence.riskPercent,
        suggested_range: [intelligence.suggestedLow, intelligence.suggestedHigh],
      },
      assumptions: ['Pricing uses local draft intelligence and known request context only.'],
      confidence: 'medium_pricing_draft',
      missing_info: intelligence.missingInfo,
      audit_notes: ['Pricing Agent cannot approve, send, purchase, submit, or finalize.'],
    },
    {
      ...base,
      agent_name: 'seller_prep_agent',
      input_summary: `${request.workType} seller-prep decision support`,
      output_json: {
        recommendation: intelligence.riskFlags.length ? 'review_priority_repairs' : 'review_scope_before_credit_decision',
        buyer_impact_score: intelligence.riskFlags.length ? 7 : 5,
        inspection_risk_score: intelligence.riskFlags.length ? 7 : 4,
        priority_ranking: intelligence.tradeBreakdown,
      },
      assumptions: ['Seller-facing recommendations must be reviewed for local market and transaction context.'],
      confidence: 'medium_decision_support',
      missing_info: intelligence.missingInfo,
      audit_notes: ['Seller Prep Agent supports decisions; it does not make final recommendations.'],
    },
    {
      ...base,
      agent_name: 'logistics_agent',
      input_summary: `Audit ${request.workType} against site access, material handling, staging, parking, disposal, safety, weather, occupancy, and hidden labor.`,
      output_json: logisticsAudit,
      assumptions: [
        'Logistics Agent audits execution reality only; it does not approve scope, pricing, seller reports, contractor packages, or proposals.',
        'Access, staging, delivery, disposal, and field conditions can materially change labor and pricing.',
      ],
      confidence: logisticsAudit.blocked_until_verified ? 'medium_blocked_until_verified' : 'medium_execution_audit',
      missing_info: logisticsAudit.missing_info_questions,
      audit_notes: logisticsAudit.audit_notes,
    },
    {
      ...base,
      agent_name: 'audit_agent',
      input_summary: 'Audit all draft outputs for missing info, assumptions, and failure points.',
      output_json: {
        needs_human_review: true,
        possible_failure_points: [
          ...intelligence.riskFlags,
          ...logisticsAudit.logistics_conflicts,
          ...logisticsAudit.hidden_labor_flags,
          ...(!request.photos.length ? ['No photos uploaded.'] : []),
          ...(!request.documents.length ? ['No documents uploaded.'] : []),
        ],
      },
      assumptions: ['Every agent output is an AI draft until human reviewed.'],
      confidence: 'high_policy_guardrail',
      missing_info: [...new Set([...missingInfo, ...intelligence.missingInfo, ...logisticsAudit.missing_info_questions])],
      audit_notes: ['AI may organize, estimate, research, compare, audit, and recommend only.'],
    },
    {
      ...base,
      agent_name: 'coordination_agent',
      input_summary: 'Merge agent outputs into one property workflow recommendation.',
      output_json: {
        unified_scope_summary: `${request.workType || 'Repair'} request for ${request.propertyAddress}. Draft scope, material assumptions, labor steps, pricing, and seller context require human review.`,
        recommended_next_step: logisticsAudit.blocked_until_verified || missingInfo.length ? 'Create Info Request' : 'Prepare Draft',
        contradictions: logisticsAudit.logistics_conflicts,
        logistics_blockers: logisticsAudit.blocked_until_verified ? logisticsAudit.missing_info_questions : [],
        contamination_guardrail: 'Only current property/request context and matching learned scope should influence this job.',
        final_output_targets: ['scope of work', 'material list', 'labor steps', 'estimate summary', 'seller explanation', 'audit trail'],
      },
      assumptions: ['Coordination organizes and audits; it does not approve final decisions.'],
      confidence: logisticsAudit.blocked_until_verified || missingInfo.length ? 'medium_needs_review' : 'medium_ready_for_review',
      missing_info: [...new Set([...missingInfo, ...intelligence.missingInfo, ...logisticsAudit.missing_info_questions])],
      audit_notes: [
        'Human approval remains mandatory for scope, estimate, seller report, contractor package, and proposal.',
        ...logisticsAudit.audit_notes,
      ],
    },
  ]

  return drafts.map((draft) => ({ ...draft, id: makeId() }))
}

function getMissingInfoForAgentDraft(request: WorkRequest) {
  const items: string[] = []
  if (!request.propertyAddress || !request.city || !request.state || !request.zip) items.push('property address')
  if (request.photos.length === 0) items.push('photos')
  if (!request.timeline) items.push('deadline')
  if (!request.description || request.description.trim().length < 35) items.push('scope clarity')
  if (!request.occupancy || request.occupancy === 'Unknown') items.push('access/occupancy context')
  return [...new Set(items)]
}

function buildLogisticsAgentAudit(
  request: WorkRequest,
  intelligence: EstimateIntelligenceResult,
  jobSteps: Array<{ title: string; trade: string; hours: string }>
) {
  const text = normalizeScopeText(
    [
      request.workType,
      request.description,
      request.urgency,
      request.occupancy,
      request.timeline,
      request.propertyFacts?.verificationNotes || '',
    ].join(' ')
  )
  const conflicts: string[] = []
  const hiddenLaborFlags: string[] = []
  const missingQuestions: string[] = []
  const recommendedLineItems: string[] = []
  const confidenceAdjustments: string[] = []
  const auditNotes: string[] = []

  const hasAccessClues = [
    'parking',
    'driveway',
    'garage',
    'stairs',
    'elevator',
    'floor',
    'crawl',
    'attic',
    'roof',
    'vacant',
    'occupied',
    'tenant',
    'hoa',
    'dumpster',
    'dump',
    'lockbox',
  ].some((word) => text.includes(word))
  const constrainedAccess = ['crawl', 'attic', 'roof', 'stairs', 'second floor', 'third floor', 'tenant', 'occupied', 'hoa'].some((word) =>
    text.includes(word)
  )
  const heavyMaterials = ['drywall', 'sheetrock', 'cabinet', 'deck', 'lumber', 'concrete', 'tile', 'roof', 'shingle'].some((word) =>
    text.includes(word)
  )
  const exteriorWeather = ['roof', 'deck', 'fence', 'exterior', 'gutter', 'siding', 'paint exterior'].some((word) => text.includes(word))
  const disposalLikely = ['demo', 'remove', 'tear out', 'cabinet', 'drywall', 'deck', 'floor', 'roof', 'debris'].some((word) => text.includes(word))
  const protectionLikely = ['paint', 'drywall', 'cabinet', 'floor', 'occupied', 'kitchen', 'bath'].some((word) => text.includes(word))

  if (!hasAccessClues) {
    conflicts.push('Material handling path is unclear.')
    missingQuestions.push('Where can crews park, unload, and stage materials?')
    confidenceAdjustments.push('Access unknown: reduce confidence until parking/loading/staging is verified.')
  }

  if (constrainedAccess) {
    hiddenLaborFlags.push('Constrained access may increase labor for setup, protection, movement, and cleanup.')
    recommendedLineItems.push('Access difficulty allowance')
  }

  if (heavyMaterials) {
    hiddenLaborFlags.push('Material handling labor may be missing from specialist estimates.')
    missingQuestions.push('Are stairs, hallway turns, elevator limits, or truck-to-work-area distance known?')
    recommendedLineItems.push('Material delivery and handling allowance')
  }

  if (disposalLikely) {
    hiddenLaborFlags.push('Disposal path, dump run, or dumpster feasibility should be priced before final approval.')
    missingQuestions.push('Will debris be bagged, hauled by crew, staged for pickup, or placed in a dumpster?')
    recommendedLineItems.push('Debris removal / dump fee')
  }

  if (protectionLikely) {
    hiddenLaborFlags.push('Site protection and dust containment should be included in labor scope.')
    recommendedLineItems.push('Protection, masking, and cleanup allowance')
  }

  if (request.occupancy === 'Occupied' || text.includes('occupied') || text.includes('tenant')) {
    conflicts.push('Occupied-property constraints may affect work hours, dust control, pets/children, and access.')
    missingQuestions.push('Are there pets, tenants, children, work-hour limits, or rooms that must stay usable?')
  }

  if (exteriorWeather) {
    conflicts.push('Weather exposure may affect schedule, safety setup, and material staging.')
    recommendedLineItems.push('Weather/safety setup allowance')
  }

  if (intelligence.laborHours <= 4 && (heavyMaterials || constrainedAccess || disposalLikely)) {
    hiddenLaborFlags.push('Labor hours may be low because logistics-heavy work often needs staging, handling, and cleanup time.')
    confidenceAdjustments.push('Labor scope should be reviewed against logistics before approval.')
  }

  if (jobSteps.length > 0 && !jobSteps.some((step) => normalizeScopeText(step.title).includes('clean'))) {
    hiddenLaborFlags.push('Job steps may be missing cleanup/disposal sequence.')
  }

  auditNotes.push('Logistics Agent sends execution objections upward to Coordination; it does not approve final decisions.')
  auditNotes.push('Human field verification is required before final scope, price, report, package, or proposal.')

  const blockedUntilVerified = missingQuestions.length > 0 || conflicts.length > 0

  return {
    logistics_summary: blockedUntilVerified
      ? 'Site logistics need verification before final estimate approval.'
      : 'No major logistics blocker detected from current request text; field verification still required.',
    audited_agents: [
      'property_profile_agent',
      'photo_agent',
      'measurement_agent',
      'material_agent',
      'labor_scope_agent',
      'pricing_agent',
      'seller_prep_agent',
    ],
    logistics_conflicts: conflicts,
    hidden_labor_flags: hiddenLaborFlags,
    missing_info_questions: [...new Set(missingQuestions)],
    recommended_line_items: [...new Set(recommendedLineItems)],
    confidence_adjustments: confidenceAdjustments,
    blocked_until_verified: blockedUntilVerified,
    access_classification: !hasAccessClues ? 'unknown' : constrainedAccess ? 'constrained' : 'normal',
    material_handling_difficulty: heavyMaterials && constrainedAccess ? 'high' : heavyMaterials ? 'medium' : hasAccessClues ? 'low' : 'unknown',
    delivery_feasibility: heavyMaterials
      ? 'Verify supplier delivery, parking/loading zone, turn radius, floor level, and staging before final estimate.'
      : 'Standard delivery assumptions; verify parking/loading.',
    staging_plan: hasAccessClues
      ? 'Stage materials near work area without blocking egress; confirm protection needs.'
      : 'Staging area not confirmed.',
    transportation_notes: hasAccessClues
      ? 'Transportation assumptions depend on current access notes.'
      : 'Truck-to-work-area distance and unloading conditions are unknown.',
    disposal_plan: disposalLikely
      ? 'Confirm bagging, hauling, dump run, dumpster, or client-provided disposal path.'
      : 'No heavy disposal detected; keep cleanup allowance in scope.',
    safety_setup_notes: constrainedAccess
      ? 'Plan PPE, ventilation/dust control, lighting, egress, and confined/height access safety.'
      : 'Standard PPE and site protection still required.',
    weather_risk: exteriorWeather ? 'Weather may affect schedule and safety.' : 'Low obvious weather risk from current scope.',
    audit_notes: auditNotes,
    status: 'ai_draft' as PropertyAgentStatus,
  }
}

function getJsonString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function getJsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function inferRoomOrArea(request: WorkRequest) {
  const text = normalizeScopeText([request.workType, request.description].join(' '))
  if (text.includes('kitchen') || text.includes('cabinet')) return 'Kitchen / cabinetry'
  if (text.includes('bath') || text.includes('toilet') || text.includes('shower')) return 'Bathroom'
  if (text.includes('roof') || text.includes('gutter')) return 'Exterior / roof'
  if (text.includes('deck') || text.includes('fence') || text.includes('yard')) return 'Exterior / site'
  if (text.includes('paint') || text.includes('drywall') || text.includes('wall')) return 'Interior finish'
  return 'General property area'
}

function getAgentDisplayName(agentName: PropertyAgentName) {
  return agentName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getLearningDisplayName(value?: string | null) {
  const operationalStatusLabels: Record<string, string> = {
    ai_draft: 'AI Draft',
    needs_review: 'Needs Review',
    needs_more_info: 'Needs More Info',
    research_requested: 'Research Needed',
    needs_confirmation: 'Needs Review',
    approved: 'Human Verified',
    human_approved: 'Human Verified',
    human_reviewed: 'Human Verified',
    human_verified: 'Human Verified',
    deprecated: 'Deprecated',
    rejected: 'Rejected',
  }
  const normalized = String(value || '').trim().toLowerCase()
  if (operationalStatusLabels[normalized]) return operationalStatusLabels[normalized]

  return (value || 'Not set')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isHumanVerifiedStatus(value?: string | null) {
  return ['human_verified', 'approved', 'human_approved', 'human_reviewed'].includes(
    String(value || '').trim().toLowerCase()
  )
}

function getLearningAgentList(agents?: AgentName[] | null) {
  return Array.isArray(agents) && agents.length
    ? agents.map((agent) => getLearningDisplayName(agent)).join(', ')
    : 'No agents assigned yet'
}

function getSourceLessonArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function getSourceLessonLinks(value: unknown): SourceLessonLink[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const link = item as Record<string, unknown>
      const url = typeof link.url === 'string' ? link.url : ''
      if (!url) return null
      return {
        url,
        title: typeof link.title === 'string' ? link.title : '',
        source_type: SOURCE_LESSON_SOURCE_TYPES.includes(link.source_type as SourceLessonSourceType)
          ? (link.source_type as SourceLessonSourceType)
          : undefined,
        date_checked: typeof link.date_checked === 'string' ? link.date_checked : undefined,
      }
    })
    .filter(Boolean) as SourceLessonLink[]
}

function getSourceLessonDisplayList(value: unknown) {
  return getSourceLessonArray(value).join('\n')
}

function splitSourceLessonLines(value: string) {
  return value
    .split(/\n|;/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
}

function inferSourceLessonType(url: string): SourceLessonSourceType {
  const normalized = url.toLowerCase()
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube'
  if (normalized.endsWith('.pdf') || normalized.includes('manual')) return 'manual'
  if (normalized.startsWith('http')) return 'article'
  return 'field_note'
}

function asNullableUuid(value?: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function getSourceLessonRequestLabel(request: WorkRequest) {
  return `${request.propertyAddress || 'Property'} - ${request.workType || 'Work request'}`
}

function normalizeSourceLessonRow(row: SourceLesson): SourceLesson {
  const sourceLinks = getSourceLessonLinks(row.source_links)
  const fallbackLink = row.source_url
    ? [{ url: row.source_url, title: row.source_title, source_type: row.source_type, date_checked: row.created_at || undefined }]
    : []
  return {
    ...row,
    job_steps: getSourceLessonArray(row.job_steps),
    tools_materials: getSourceLessonArray(row.tools_materials),
    missing_info_questions: getSourceLessonArray(row.missing_info_questions),
    source_links: sourceLinks.length ? sourceLinks : fallbackLink,
    operational_meaning: row.operational_meaning || row.observed_method || '',
    materials_tools_equipment: getSourceLessonArray(row.materials_tools_equipment).length
      ? getSourceLessonArray(row.materials_tools_equipment)
      : getSourceLessonArray(row.tools_materials),
    cleanup_disposal: row.cleanup_disposal || row.cleanup_notes || '',
    comprehension_grade: row.comprehension_grade || '',
    admin_feedback: row.admin_feedback || '',
    human_review_status: row.human_review_status || (row.status === 'approved' ? 'human_verified' : row.status === 'rejected' ? 'rejected' : 'needs_review'),
    memory_destination: row.memory_destination || 'none',
    original_draft: row.original_draft || null,
    edited_lesson: row.edited_lesson || null,
    reviewed_by: row.reviewed_by || row.approved_by || null,
    reviewed_at: row.reviewed_at || row.approved_at || null,
    linked_property_id: row.linked_property_id || '',
    linked_work_request_id: row.linked_work_request_id || '',
    linked_repair_item_id: row.linked_repair_item_id || '',
  }
}

function buildSourceLessonPromptFeedbackContext(lessons: SourceLesson[]) {
  return lessons
    .filter((lesson) => lesson.comprehension_grade && lesson.admin_feedback?.trim())
    .slice(0, 5)
    .map((lesson) => `Grade ${lesson.comprehension_grade}: ${lesson.admin_feedback}`)
    .join('\n')
}

function getSourceLessonSnapshot(lesson: SourceLesson | SourceLessonDraft): Record<string, unknown> {
  return {
    source_links: lesson.source_links || [],
    admin_intent: lesson.admin_intent,
    trade_category: lesson.work_type,
    lesson_summary: lesson.lesson_summary,
    operational_meaning: lesson.operational_meaning || lesson.observed_method,
    estimate_impact: lesson.estimate_impact,
    hidden_labor: lesson.hidden_labor,
    materials_tools_equipment: lesson.materials_tools_equipment || lesson.tools_materials,
    cleanup_disposal: lesson.cleanup_disposal || lesson.cleanup_notes,
    confidence: lesson.confidence,
    comprehension_grade: lesson.comprehension_grade || '',
    admin_feedback: lesson.admin_feedback || '',
    human_review_status: lesson.human_review_status || 'needs_review',
    memory_destination: lesson.memory_destination || 'none',
  }
}

function sourceLessonHasAdminEdits(lesson: SourceLesson) {
  if (!lesson.original_draft) return false
  const original = lesson.original_draft as Record<string, unknown>
  const comparable = getSourceLessonSnapshot(lesson)
  return ['lesson_summary', 'operational_meaning', 'estimate_impact', 'hidden_labor', 'materials_tools_equipment', 'cleanup_disposal'].some(
    (key) => JSON.stringify(original[key] || '') !== JSON.stringify(comparable[key] || '')
  )
}

function getSourceLessonMemoryGateMessage(lesson: SourceLesson) {
  if (!lesson.comprehension_grade) return 'Add a comprehension grade before saving this lesson to memory.'
  if (lesson.comprehension_grade === 'C') return 'Grade C lessons must stay Needs Review until edited and regraded A or B.'
  if (lesson.comprehension_grade === 'D' || lesson.comprehension_grade === 'F') return 'Grade D or F lessons cannot become global or project memory.'
  return ''
}

function canPromoteSourceLessonToMemory(lesson: SourceLesson) {
  return SOURCE_LESSON_MEMORY_ALLOWED_GRADES.includes((lesson.comprehension_grade || '') as SourceLessonComprehensionGrade)
}

function getConciseLessonText(value: string, fallback: string) {
  const clean = value.replace(/\s+/g, ' ').trim() || fallback
  return clean.length > 520 ? `${clean.slice(0, 517).trim()}...` : clean
}

function getCuratedLessonDestinationNote(destination: SourceLessonMemoryDestination) {
  if (destination === 'project_specific') return 'Draft destination: project-specific memory after approval.'
  if (destination === 'global_operational') return 'Draft destination: global labor memory after approval.'
  if (destination === 'material_pricing') return 'Draft destination: material/pricing memory after approval.'
  return 'Draft only. Do not save to memory yet.'
}

function buildCuratedLessonDraft(input: CuratedLessonIntakeDraft, extraction?: LessonExtractionResult['draft']): SourceLessonDraft {
  const links = splitSourceLessonLines(input.sourceLinksText).map((url) => ({
    url,
    title: 'Curated video source',
    source_type: inferSourceLessonType(url),
    date_checked: new Date().toISOString(),
  }))
  const primaryLink = links[0]
  const learningGoal = getConciseLessonText(input.learningGoal, 'Extract estimating and operational lessons from the curated source links.')
  const tradeCategory = input.tradeCategory || 'General Repair'
  const sourceCount = links.length
  const lessonSummary = getConciseLessonText(
    extraction?.lesson_summary ||
      `For ${tradeCategory}, review ${sourceCount} curated video source${sourceCount === 1 ? '' : 's'} to learn: ${learningGoal}. Keep the lesson estimating-focused: scope steps, hidden labor, materials/tools/equipment, cleanup, and conditions that change price or schedule.`,
    `Curated ${tradeCategory} lesson draft for estimating review.`
  )

  const draft: SourceLessonDraft = {
    ...EMPTY_SOURCE_LESSON_DRAFT,
    source_type: primaryLink?.source_type || 'youtube',
    source_url: primaryLink?.url || '',
    source_title: `${tradeCategory} curated video lesson`,
    work_type: tradeCategory,
    problem_description: learningGoal,
    admin_intent: 'Generate a concise, estimating-focused lesson summary. AI may summarize and suggest, but may not auto-update memory.',
    lesson_summary: lessonSummary,
    observed_method: getConciseLessonText(
      extraction?.observed_method ||
        `Review the source sequence for how the work is prepared, performed, checked, and cleaned up. Treat the source as a draft reference until a human confirms field fit.`,
      'Review the source method before reuse.'
    ),
    operational_meaning: getConciseLessonText(
      extraction?.operational_meaning ||
        `Translate the video into field decisions: what must be verified, staged, protected, measured, sequenced, and documented before estimate approval.`,
      'Translate the video into field decisions before estimating.'
    ),
    estimate_impact: getConciseLessonText(
      extraction?.estimate_impact ||
        `Estimate impact should consider labor hours, setup/protection, access, material handling, specialty tools, return trips, disposal, and contingency. Do not use the draft as pricing memory until approved.`,
      'Estimate impact requires human review.'
    ),
    hidden_labor: extraction?.hidden_labor || 'Look for prep, protection, masking, staging, material pickup, setup/cleanup, dry time, haul-off, rework risk, and final verification.',
    job_steps: extraction?.job_steps?.length ? extraction.job_steps : [
      'Review source links and extract only estimating-relevant steps.',
      'Confirm site conditions, measurements, access, safety, and finish expectations.',
      'Admin grades the summary before any memory save.',
    ],
    tools_materials: extraction?.tools_materials?.length ? extraction.tools_materials : ['Capture materials/tools/equipment shown in source.', 'Verify brand, size, quantity, and alternatives before pricing.'],
    materials_tools_equipment: extraction?.materials_tools_equipment?.length ? extraction.materials_tools_equipment : ['Materials/tools/equipment require admin verification from the source before estimate reuse.'],
    cleanup_notes: extraction?.cleanup_notes || 'Include protection removal, dust/debris handling, haul-off responsibility, and final cleanup.',
    cleanup_disposal: extraction?.cleanup_disposal || 'Confirm cleanup/disposal scope, dump/haul-off needs, and whether cleanup is included in labor.',
    safety_notes: extraction?.safety_notes || 'Human review required for PPE, ladder/fall risk, dust, utilities, moisture, structural risk, and code/licensed trade limits.',
    access_notes: extraction?.access_notes || 'Verify access, parking, staging, occupied-area constraints, work hours, and material path.',
    missing_info_questions: extraction?.missing_info_questions?.length ? extraction.missing_info_questions : [
      'Does the source show enough detail to estimate quantities and labor?',
      'What field conditions would make this lesson invalid?',
      'What cleanup, protection, disposal, or return trip labor is easy to miss?',
    ],
    applies_when: extraction?.applies_when || `Use only for ${tradeCategory} scopes with matching site conditions, materials, access, and quality expectations.`,
    does_not_apply_when: extraction?.does_not_apply_when || 'Do not apply when substrate, code, moisture/structural risk, access, material system, or finish expectations differ.',
    confidence: extraction?.confidence || (sourceCount > 1 ? 'medium' : 'low'),
    source_links: links,
    comprehension_grade: '',
    admin_feedback: '',
    human_review_status: 'needs_review',
    memory_destination: input.memoryDestination,
    status: 'needs_review',
    admin_notes: [
      'Curated Lesson Intake draft. Summary must stay under one page and remain concise/estimating-focused.',
      'AI may summarize and suggest. AI may not auto-update memory. Only approved lessons can become memory.',
      input.transcriptOrNotes ? 'Transcript/notes were provided by admin fallback input.' : 'Transcript was requested from the lesson extraction function.',
      getCuratedLessonDestinationNote(input.memoryDestination),
    ].join('\n'),
  }

  return {
    ...draft,
    original_draft: getSourceLessonSnapshot(draft),
    edited_lesson: null,
  }
}

function buildSourceLessonDraftFromNotes(input: SourceLessonDraft, notes: string, promptFeedbackContext = ''): SourceLessonDraft {
  const allText = normalizeJobScopeTokenText([input.work_type, input.problem_description, input.admin_intent, notes].join(' '))
  const lines = splitSourceLessonLines(notes)
  const jobSteps = lines
    .filter((line) =>
      normalizeJobScopeTokenText(line).match(/\b(remove|prep|protect|measure|cut|install|fasten|patch|sand|prime|paint|clean|haul|verify|inspect|stage|mask|dry|seal|caulk|replace|repair)\b/)
    )
    .slice(0, 8)
  const toolsMaterials = lines
    .filter((line) =>
      normalizeJobScopeTokenText(line).match(/\b(tool|saw|drill|screw|fastener|caulk|adhesive|primer|paint|tape|plastic|ladder|vacuum|glove|mask|blade|brush|roller|lumber|drywall|compound|material)\b/)
    )
    .slice(0, 10)
  const missingQuestions = [
    'Are dimensions, quantities, and site photos sufficient for estimating?',
    'Are utilities, moisture, structural damage, or code constraints involved?',
    'Who is responsible for access, parking, staging, and debris removal?',
  ]
  const safetyNotes: string[] = []
  const accessNotes: string[] = []
  const cleanupNotes: string[] = []
  const hiddenLaborNotes: string[] = []

  if (allText.match(/\b(ladder|roof|height|deck|exterior|saw|blade|electrical|wire|mold|lead|asbestos|dust|ppe|glove|mask)\b/)) {
    safetyNotes.push('Confirm hazards, PPE, dust control, utilities, and fall/ladder exposure before work.')
  }
  if (allText.match(/\b(access|parking|staging|occupied|tenant|key|entry|tight|crawl|attic|stairs|haul)\b/)) {
    accessNotes.push('Verify entry, parking, staging, work hours, material path, and occupied-area constraints.')
  }
  if (allText.match(/\b(clean|debris|haul|dust|vacuum|dispose|dump|protect|mask)\b/)) {
    cleanupNotes.push('Include protection removal, dust/debris cleanup, and haul-away responsibility.')
  }
  if (allText.match(/\b(mask|protect|dry|return|setup|staging|demo|haul|patch|prime|paint|dispose|trip|pickup)\b/)) {
    hiddenLaborNotes.push('Include setup/protection, material handling, dry-time returns, debris handling, and finish cleanup as separate labor.')
  }

  const sourceLinks = input.source_links?.length
    ? input.source_links
    : input.source_url
      ? [{ url: input.source_url, title: input.source_title, source_type: input.source_url ? inferSourceLessonType(input.source_url) : input.source_type, date_checked: new Date().toISOString() }]
      : []
  const draft = {
    ...input,
    source_type: input.source_url ? inferSourceLessonType(input.source_url) : input.source_type,
    source_links: sourceLinks,
    lesson_summary:
      input.lesson_summary ||
      `Draft field lesson for ${input.work_type || 'this repair'}: use the source notes as evidence, then confirm scope, hidden labor, safety, access, cleanup, and estimate impact before saving memory.`,
    observed_method:
      input.observed_method ||
      (jobSteps.length
        ? jobSteps.slice(0, 4).join(' ')
        : 'Manual notes captured the source method. Admin review should confirm exact sequence before use.'),
    hidden_labor: input.hidden_labor || hiddenLaborNotes.join(' ') || 'Check for prep, protection, staging, material handling, return trips, disposal, and cleanup labor.',
    job_steps: input.job_steps.length ? input.job_steps : jobSteps.length ? jobSteps : ['Review source notes and photos/transcript.', 'Confirm site conditions and constraints.', 'Draft scope steps for admin review.'],
    tools_materials: input.tools_materials.length ? input.tools_materials : toolsMaterials.length ? toolsMaterials : ['Confirm tools and materials from source notes before estimating.'],
    safety_notes: input.safety_notes || safetyNotes.join(' ') || 'Human review required for safety risks before operational use.',
    access_notes: input.access_notes || accessNotes.join(' ') || 'Confirm access, staging, parking, and occupied-area limits.',
    cleanup_notes: input.cleanup_notes || cleanupNotes.join(' ') || 'Confirm dust control, debris removal, and final cleanup expectations.',
    operational_meaning: input.operational_meaning || input.observed_method || 'Admin review should confirm what this source means operationally before reuse.',
    materials_tools_equipment: input.materials_tools_equipment?.length ? input.materials_tools_equipment : input.tools_materials.length ? input.tools_materials : toolsMaterials,
    cleanup_disposal: input.cleanup_disposal || input.cleanup_notes || cleanupNotes.join(' ') || 'Confirm cleanup, disposal, and protection removal before reuse.',
    estimate_impact: input.estimate_impact || 'May affect labor hours, material allowances, trip count, protection, disposal, and contingency.',
    missing_info_questions: input.missing_info_questions.length ? input.missing_info_questions : missingQuestions,
    applies_when: input.applies_when || `Apply only to similar ${input.work_type || 'repair'} scopes with matching source evidence and field conditions.`,
    does_not_apply_when: input.does_not_apply_when || 'Do not apply when site conditions, access, materials, code requirements, moisture/structural risk, or client expectations differ.',
    confidence: notes.trim().length > 600 ? 'medium' : 'low',
    comprehension_grade: '',
    admin_feedback: '',
    human_review_status: 'needs_review' as SourceLessonHumanReviewStatus,
    memory_destination: 'none' as SourceLessonMemoryDestination,
    status: 'needs_review',
    admin_notes: [
      input.admin_notes,
      promptFeedbackContext ? `Prior comprehension feedback for future extraction prompts:\n${promptFeedbackContext}` : '',
      notes ? `Manual notes/transcript used for draft:\n${notes}` : 'TODO: Add transcript extraction API integration before automated source extraction.',
      'TODO: YouTube transcript extraction API integration later. Do not automatically train from YouTube.',
    ].filter(Boolean).join('\n\n'),
  }
  return {
    ...draft,
    original_draft: getSourceLessonSnapshot(draft),
    edited_lesson: null,
  }
}

type EstimateResearchRow = {
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

type MessageLog = {
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

type MissingInfoRequest = {
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

const STORAGE_KEY = 'shelter-prep-requests-v1'
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || ''
const REQUEST_FILES_BUCKET = 'job-files'
const INVOICE_BUCKET = 'invoices'
const INSPECTION_FRONT_PAGE_MAX_BYTES = 240 * 1024

const AGENT_API_URL =
  import.meta.env.VITE_AGENT_API_URL || 'https://shelter-prep-agent-production.up.railway.app'
const AGENT_API_KEY = import.meta.env.VITE_AGENT_API_KEY || ''
const isAgentApiKeyConfigured = Boolean(AGENT_API_KEY && AGENT_API_KEY !== 'PASTE_YOUR_AGENT_API_KEY_HERE')

console.info('[agent-env]', {
  hasAgentApiUrl: Boolean(AGENT_API_URL),
  hasAgentApiKey: isAgentApiKeyConfigured,
})

function createAgentHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AGENT_API_KEY}`,
    'X-Agent-Api-Key': AGENT_API_KEY,
    'x-agent-key': AGENT_API_KEY,
  }
}

const WORK_TYPES = [
  'General Repair',
  'Painting',
  'Roofing',
  'Electrical',
  'Plumbing',
  'Cleaning',
  'Landscaping',
  'Inspection Repairs',
  'Turnover Work',
  'Home Services',
]

const STATUS_META: Record<
  RequestStatus,
  { label: string; cardBg: string; border: string }
> = {
  new: { label: 'New', cardBg: '#eef5ff', border: '#c8d9f2' },
  in_progress: { label: 'In Progress', cardBg: '#fff8e8', border: '#ecd9a7' },
  needs_info: { label: 'Needs Info', cardBg: '#fff3dc', border: '#e9c878' },
  pending_approval: { label: 'Ready', cardBg: '#f1fbf2', border: '#c9e3ce' },
  estimate_ready: { label: 'Done', cardBg: '#f4f1ec', border: '#d8cfc4' },
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now())
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function slugForFileName(value: string) {
  return safeFileName(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'property'
  )
}

function todayFileStamp() {
  return new Date().toISOString().slice(0, 10)
}

function storagePathFromPublicUrl(fileUrl = '', bucket = REQUEST_FILES_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return ''
  return decodeURIComponent(fileUrl.slice(index + marker.length))
}

function formatUploadedAt(value?: string | null) {
  if (!value) return 'Upload time not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Upload time not recorded'
  return date.toLocaleString()
}

function getEvidenceCategory(name = '', mimeType = '', storedType?: 'photo' | 'document'): UploadEvidenceCategory {
  const lowerName = name.toLowerCase()
  const lowerMime = mimeType.toLowerCase()

  if (storedType === 'photo' || lowerMime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(lowerName)) return 'photo'
  if (lowerMime.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(lowerName)) return 'video'
  if (/\binspection\b|\breport\b/.test(lowerName) || /\.(pdf|doc|docx)$/i.test(lowerName)) return 'inspection report'
  return 'document'
}

function getEvidenceTypeLabel(category: UploadEvidenceCategory, mimeType = '') {
  if (mimeType) return mimeType
  if (category === 'photo') return 'Image'
  if (category === 'video') return 'Video'
  if (category === 'inspection report') return 'Inspection / report file'
  return 'Document'
}

function getLocalEvidenceKey(file: File, index: number, group: 'photo' | 'document') {
  return `${group}-${index}-${file.name}-${file.size}-${file.lastModified}`
}

function isInspectionPdf(file: File) {
  const lowerName = file.name.toLowerCase()
  return lowerName.endsWith('.pdf') || file.type === 'application/pdf'
}

function normalizeInspectionReportText(value = '') {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/\\r|\\n|\\t|\r|\n|\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/[<>[\]{}]/g, ' ')
    .replace(/Tj|TJ|ET|BT|Td|Tm/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function readInspectionPdfText(file: File) {
  const frontPageSlice = file.slice(0, Math.min(file.size, INSPECTION_FRONT_PAGE_MAX_BYTES))
  const raw = await frontPageSlice.text()
  const literalStrings = Array.from(raw.matchAll(/\(([^()]{3,})\)/g))
    .map((match) => match[1])
    .join(' ')
  const arrayStrings = Array.from(raw.matchAll(/\[((?:\s*\([^()]{2,}\)\s*){2,})\]/g))
    .map((match) => Array.from(match[1].matchAll(/\(([^()]{2,})\)/g)).map((item) => item[1]).join(' '))
    .join(' ')
  const text = normalizeInspectionReportText(`${literalStrings} ${arrayStrings} ${raw.slice(0, 12000)}`)
  return {
    text: text.slice(0, 24000),
    payloadBytes: frontPageSlice.size,
  }
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, ' ')
  }
  return ''
}

function extractInspectionAddress(text: string) {
  const addressPattern = /\b(\d{1,6}\s+(?:N|S|E|W|NE|NW|SE|SW)?\s*[A-Za-z0-9.'#\-\s]+?\s(?:Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Blvd|Boulevard|Pl|Place|Ter|Terrace|Loop|Cir|Circle))\s*,?\s*([A-Za-z .'-]+),?\s+(OR|WA|CA|ID)\b(?:\s+(\d{5}(?:-\d{4})?))?/i
  const match = text.match(addressPattern)
  if (!match) return { propertyAddress: '', city: '', state: '', zip: '' }
  return {
    propertyAddress: match[1].trim(),
    city: match[2].trim().replace(/\s{2,}/g, ' '),
    state: match[3].trim().toUpperCase(),
    zip: match[4]?.trim() || '',
  }
}

function getInspectionTaskBasics(finding: string) {
  const text = finding.toLowerCase()
  if (text.includes('sprinkler') || text.includes('fire')) {
    return {
      title: 'Fire suppression sprinkler issue',
      system: 'Fire suppression / life safety',
      trade: 'Fire suppression specialist / Fire Marshal',
      risk: 'Life safety / fire hazard',
      urgency: 'Immediate review before pricing or seller guidance',
    }
  }
  if (text.includes('roof') || text.includes('leak') || text.includes('moisture')) {
    return {
      title: 'Roof or water-intrusion concern',
      system: 'Roof / water intrusion',
      trade: 'Roofer / exterior contractor',
      risk: 'Water intrusion risk',
      urgency: 'Needs review before estimating',
    }
  }
  if (text.includes('electrical') || text.includes('breaker') || text.includes('outlet') || text.includes('panel')) {
    return {
      title: 'Electrical inspection concern',
      system: 'Electrical',
      trade: 'Licensed electrician',
      risk: 'Safety / code risk',
      urgency: 'Needs licensed trade review',
    }
  }
  if (text.includes('plumb') || text.includes('water heater') || text.includes('drain') || text.includes('fixture')) {
    return {
      title: 'Plumbing inspection concern',
      system: 'Plumbing',
      trade: 'Licensed plumber',
      risk: 'Leak / fixture performance risk',
      urgency: 'Needs trade review before estimating',
    }
  }
  return {
    title: 'Inspection repair concern',
    system: 'Building system needs review',
    trade: 'Trade needs review',
    risk: 'Needs review',
    urgency: 'Needs review before estimating',
  }
}

function buildInspectionTasksFromFindings(findings: string[], fileName: string) {
  return findings.map((finding, index): InspectionTaskIntelligence => {
    const basics = getInspectionTaskBasics(finding)
    return {
      id: `inspection-pdf-${index}-${safeFileName(fileName)}`,
      task_title: basics.title,
      defect_concern: finding,
      building_system: basics.system,
      risk_level: basics.risk,
      trade_needed: basics.trade,
      urgency: basics.urgency,
      missing_information_needed: ['Confirm exact location, quantity/count, severity, and whether the report includes related photos.'],
      photo_requests: ['Upload report page photos plus close-up and wide photos of the affected area.'],
      recommended_next_action: 'Review extracted finding, confirm missing evidence, then route to the appropriate trade before pricing.',
      human_review_status: 'AI Draft',
      source_label: `AI Draft from ${fileName}`,
    }
  })
}

function inferStoredFileType(row: any): 'photo' | 'document' {
  const rawType = String(row.file_type || row.type || '').toLowerCase()
  const path = String(row.storage_path || row.file_url || row.file_name || '').toLowerCase()
  const mime = String(row.mime_type || '').toLowerCase()

  if (rawType === 'photo' || path.includes('/photos/') || mime.startsWith('image/')) return 'photo'
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(path)) return 'photo'
  return 'document'
}

function mapFileRowToStoredFile(row: any): StoredFile {
  const bucket = row.storage_bucket || row.bucket || REQUEST_FILES_BUCKET
  const path = row.storage_path || storagePathFromPublicUrl(row.file_url || '', bucket)

  return {
    id: row.id,
    name: row.file_name || row.name || path.split('/').pop() || 'Uploaded file',
    path,
    url: row.file_url || '',
    bucket,
    type: inferStoredFileType(row),
    createdAt: row.created_at || row.uploaded_at || null,
    source: row.source || 'files',
  }
}

async function resolveStoredFileUrl(file: StoredFile, download = false) {
  const bucket = file.bucket || REQUEST_FILES_BUCKET
  const path = file.path || storagePathFromPublicUrl(file.url || '', bucket)

  if (!path) {
    if (file.url) return file.url
    throw new Error('Missing file storage path.')
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10, download ? { download: file.name } : undefined)

  if (error || !data?.signedUrl) {
    if (file.url) return file.url
    throw error || new Error('Signed URL was not returned.')
  }

  return data.signedUrl
}

async function attachPreviewUrls(files: StoredFile[]) {
  return Promise.all(
    files.map(async (file) => {
      if (file.type !== 'photo') return file

      try {
        return { ...file, previewUrl: await resolveStoredFileUrl(file) }
      } catch (error) {
        console.warn('Photo thumbnail URL could not be created; using stored URL fallback.', error)
        return { ...file, previewUrl: file.url || '' }
      }
    })
  )
}

function uniqueStoredFiles(files: StoredFile[]) {
  const seen = new Set<string>()

  return files.filter((file) => {
    const key = file.id || `${file.bucket || REQUEST_FILES_BUCKET}:${file.path || file.url || file.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function attachFilesToRequests(items: WorkRequest[]) {
  const ids = items.map((item) => item.id).filter(Boolean)
  const propertyIds = items
    .map((item) => item.propertyId)
    .filter((id): id is string | number => id !== null && id !== undefined && String(id) !== '')
    .map((id) => String(id))

  if (ids.length === 0 && propertyIds.length === 0) return items

  const fileRows: any[] = []

  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .in('lead_id', ids)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Leads loaded, but lead-linked uploaded files could not be loaded:', error)
    } else {
      fileRows.push(...(data || []))
    }
  }

  if (propertyIds.length > 0) {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .in('linked_property_id', propertyIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Property-linked files could not be loaded; continuing with lead files.', error)
    } else {
      fileRows.push(...(data || []))
    }

    const { data: propertyFileRows, error: propertyFilesError } = await supabase
      .from('property_files')
      .select('*')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })

    if (propertyFilesError) {
      console.warn('property_files could not be loaded; continuing with files table rows.', propertyFilesError)
    } else {
      fileRows.push(
        ...(propertyFileRows || []).map((row: any) => ({
          ...row,
          source: 'property_files',
          storage_bucket: row.storage_bucket || 'property-files',
        }))
      )
    }
  }

  const byLeadId = fileRows.reduce((acc: Record<string, StoredFile[]>, row: any) => {
    const leadId = row.lead_id
    if (!leadId) return acc
    acc[leadId] = [...(acc[leadId] || []), mapFileRowToStoredFile(row)]
    return acc
  }, {})

  const byPropertyId = fileRows.reduce((acc: Record<string, StoredFile[]>, row: any) => {
    const propertyId = row.property_id || row.linked_property_id
    if (!propertyId) return acc
    const key = String(propertyId)
    acc[key] = [...(acc[key] || []), mapFileRowToStoredFile(row)]
    return acc
  }, {})

  return Promise.all(items.map(async (item) => {
    const files = uniqueStoredFiles([
      ...(byLeadId[item.id] || []),
      ...(item.propertyId ? byPropertyId[String(item.propertyId)] || [] : []),
    ])
    const hydratedFiles = await attachPreviewUrls(files)

    return {
      ...item,
      photos: hydratedFiles.filter((file) => file.type === 'photo'),
      documents: hydratedFiles.filter((file) => file.type === 'document'),
    }
  }))
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not set'
  return `$${Number(value).toFixed(2)}`
}

function pdfSafeText(value: unknown) {
  return String(value ?? '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdfText(value: unknown) {
  return pdfSafeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapPdfLine(value: unknown, maxLength = 88) {
  const words = pdfSafeText(value).split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLength && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function buildSimplePdfBlob(title: string, sections: Array<{ heading: string; lines: string[] }>) {
  const pageLines: string[][] = []
  let currentPage: string[] = []
  const maxLinesPerPage = 48

  const pushLine = (line: string) => {
    if (currentPage.length >= maxLinesPerPage) {
      pageLines.push(currentPage)
      currentPage = []
    }
    currentPage.push(line)
  }

  pushLine(title)
  pushLine('')

  sections.forEach((section) => {
    pushLine(section.heading.toUpperCase())
    section.lines.forEach((line) => {
      wrapPdfLine(line).forEach(pushLine)
    })
    pushLine('')
  })

  if (currentPage.length) pageLines.push(currentPage)

  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${pageLines.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageLines.length} >>`)

  pageLines.forEach((lines, index) => {
    const pageObjectNumber = 3 + index * 2
    const contentObjectNumber = pageObjectNumber + 1
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`
    )

    const content = [
      'BT',
      '50 742 Td',
      '/F2 15 Tf',
      `(${escapePdfText(lines[0] || title)}) Tj`,
      '0 -22 Td',
      '/F1 10 Tf',
      '14 TL',
      ...lines.slice(1).map((line) => `(${escapePdfText(line)}) Tj T*`),
      'ET',
    ].join('\n')

    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function propertyLookupStatusLabel(status: PropertyLookupStatus) {
  if (status === 'function_missing') return 'function missing'
  if (status === 'function_unavailable') return 'function unavailable'
  if (status === 'provider_not_configured') return 'provider missing'
  if (status === 'no_records_found') return 'provider returned no data'
  if (status === 'data_found') return 'data found'
  if (status === 'error') return 'lookup error'
  return 'not pulled'
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0

  const cleaned = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/)

  if (!cleaned) return 0

  const parsed = Number(cleaned[0])
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMaterialName(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMaterialName(item: MaterialCost) {
  return item.item_name || item.material_name || 'Unnamed material'
}

function getMaterialTypicalPrice(item: MaterialCost) {
  return item.typical_price ?? item.current_price ?? 0
}

function getConfidenceLabel(value: string | null | undefined, verified?: boolean | null) {
  if (verified) return 'database_verified'
  return value || 'needs_review'
}

function ceilToPackage(requiredQuantity: number, packageCoverage: number) {
  if (!packageCoverage || packageCoverage <= 0) return 0
  return Math.ceil(requiredQuantity / packageCoverage)
}

function searchUrl(query: string) {
  return `https://www.homedepot.com/s/${encodeURIComponent(query)}`
}

function classifyMaterialListComplexity(request: WorkRequest): MaterialComplexityClassification {
  const text = normalizeMaterialName([
    request.workType,
    request.description,
    request.timeline,
    request.urgency,
    request.occupancy,
    request.photos.map((file) => file.name).join(' '),
    request.documents.map((file) => file.name).join(' '),
  ].join(' '))
  const mediaCount = request.photos.length + request.documents.length
  const dimensionSignals = [
    /\d{1,5}\s*(sqft|sq ft|square feet|sf)/,
    /\d{1,4}\s*(linear feet|lf|feet|ft|inches|inch|in)/,
    /\d{1,3}\s*[xX]\s*\d{1,3}/,
  ].some((pattern) => pattern.test(text))
  const smallSignals = ['bulb', 'light bulb', 'swap fixture', 'replace fixture', 'minor patch', 'small patch', 'faucet part', 'outlet cover', 'caulk', 'handle', 'knob']
  const mediumSignals = ['toilet', 'p trap', 'ptrap', 'drywall patch', 'paint one room', 'one room', 'faucet', 'vanity', 'door', 'window trim', 'small leak']
  const largeSignals = ['remodel', 'renovation', 'roof replacement', 'replace roof', 'full flooring', 'whole house', 'deck rebuild', 'rebuild deck', 'bathroom remodel', 'kitchen remodel', 'structural', 'framing', 'waterproof', 'shower pan', 'subfloor', 'foundation']
  const demolitionSignals = ['demo', 'demolition', 'tear out', 'remove existing', 'haul']
  const plumbingElectricalSignals = ['plumb', 'electrical', 'wire', 'panel', 'breaker', 'drain', 'supply line', 'valve']
  const accessSignals = ['stairs', 'second floor', 'third floor', 'tight access', 'ladder', 'roof', 'crawlspace', 'attic', 'occupied', 'hoa']
  const tradeKeywords = ['roof', 'paint', 'drywall', 'plumb', 'electrical', 'floor', 'tile', 'deck', 'carpentry', 'landscape', 'hvac']
  const tradePackages = tradeKeywords
    .filter((word) => text.includes(word))
    .map((word) => word === 'plumb' ? 'Plumbing' : word.charAt(0).toUpperCase() + word.slice(1))
  const tradeCount = new Set(tradePackages).size
  const hasLarge = largeSignals.some((word) => text.includes(word))
  const hasMedium = mediumSignals.some((word) => text.includes(word))
  const hasSmall = smallSignals.some((word) => text.includes(word))
  const hasDemo = demolitionSignals.some((word) => text.includes(word))
  const hasMEP = plumbingElectricalSignals.some((word) => text.includes(word))
  const hasAccess = accessSignals.some((word) => text.includes(word))
  const missingInfo = [
    !dimensionSignals ? 'What are the key dimensions, counts, or square footage for the material takeoff?' : '',
    mediaCount === 0 ? 'Can you upload photos or an inspection report showing the work area?' : '',
    hasAccess ? 'Are access, staging, stairs, ladders, or carry distance constraints confirmed?' : '',
    hasMEP ? 'Are plumbing/electrical shutoffs, code requirements, and fixture specs confirmed?' : '',
    hasDemo ? 'What material is being removed and how much disposal is expected?' : '',
  ].filter(Boolean)
  const reviewChecklist = [
    'Confirm dimensions and counts before approving quantities.',
    'Confirm existing conditions from photos or onsite review.',
    'Confirm substitutions, waste factor, delivery path, and disposal.',
    hasMEP ? 'Confirm licensed trade requirements for plumbing/electrical work.' : '',
    hasLarge ? 'Split into trade packages before detailed purchasing.' : '',
  ].filter(Boolean)

  if (!request.description.trim() || request.description.trim().length < 20 || (!dimensionSignals && mediaCount === 0 && !hasSmall)) {
    return {
      level: 'unknown_needs_review',
      confidence: 'low',
      reason: 'Scope lacks enough media, dimensions, or detail for a responsible material takeoff.',
      missingInfo,
      reviewChecklist,
      tradePackages: tradePackages.length ? tradePackages : ['General Repair'],
    }
  }

  if (hasLarge || tradeCount >= 3 || (hasDemo && hasMEP) || text.includes('structural') || text.includes('waterproof')) {
    return {
      level: 'large_complex',
      confidence: dimensionSignals || mediaCount > 0 ? 'medium' : 'low',
      reason: 'Scope appears multi-step, multi-trade, structural, waterproofing, demolition-heavy, or too large for precise auto quantities.',
      missingInfo,
      reviewChecklist,
      tradePackages: tradePackages.length ? tradePackages : ['General Contractor', 'Materials Review'],
    }
  }

  if (hasSmall && tradeCount <= 1 && !hasDemo && !text.includes('waterproof') && !text.includes('structural')) {
    return {
      level: 'small_simple',
      confidence: mediaCount > 0 || dimensionSignals ? 'high' : 'medium',
      reason: 'Scope appears limited to a small repair or part replacement with low material complexity.',
      missingInfo,
      reviewChecklist,
      tradePackages: tradePackages.length ? tradePackages : ['General Repair'],
    }
  }

  return {
    level: 'medium_defined',
    confidence: hasMedium || dimensionSignals || mediaCount > 0 ? 'medium' : 'low',
    reason: 'Scope is defined enough for draft material ranges, but quantities still need human verification.',
    missingInfo,
    reviewChecklist,
    tradePackages: tradePackages.length ? tradePackages : ['General Repair'],
  }
}

function materialComplexityLabel(level: MaterialListComplexity) {
  return level.replace(/_/g, ' ')
}

function inferDeckSquareFeet(request: WorkRequest) {
  const text = [request.description, request.workType].join(' ')
  const sqftMatch = text.match(/(\d{2,5})\s*(?:sq\.?\s*ft|sqft|square feet|sf)/i)
  if (sqftMatch?.[1]) return Number(sqftMatch[1])
  if (/deck/i.test(text)) return 400
  return 0
}

function getPricingMemoryMatch(entries: PricingMemoryEntry[], name: string, zip: string) {
  const normalized = normalizeMaterialName(name)
  const zipPrefix = zip.slice(0, 3)

  return entries
    .filter((entry) => entry.human_verified && Number(entry.verified_price || entry.unit_cost || 0) > 0)
    .map((entry) => {
      const entryName = normalizeMaterialName([entry.item_name, entry.category].filter(Boolean).join(' '))
      let score = 0
      if (entryName === normalized) score += 6
      if (entryName.includes(normalized) || normalized.includes(entryName)) score += 4
      for (const word of normalized.split(' ')) {
        if (word.length > 2 && entryName.includes(word)) score += 1
      }
      if (entry.zip && entry.zip === zip) score += 2
      else if (entry.zip && zipPrefix && entry.zip.startsWith(zipPrefix)) score += 1

      return { entry, score }
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)[0]?.entry || null
}

function applyPricingMemory(
  draft: Omit<MaterialEstimateDraftLine, 'packagesNeeded' | 'extendedTotal' | 'sourceStatus' | 'confidence' | 'reviewStatus'>,
  entries: PricingMemoryEntry[],
  zip: string
): MaterialEstimateDraftLine {
  const memory = getPricingMemoryMatch(entries, draft.materialName, zip)
  const packagePrice = Number(memory?.verified_price || memory?.unit_cost || draft.packagePrice)
  const packagesNeeded = ceilToPackage(draft.requiredQuantity, draft.packageCoverage)
  const fromMemory = Boolean(memory)

  return {
    ...draft,
    packagePrice,
    packagesNeeded,
    extendedTotal: packagesNeeded * packagePrice,
    source: fromMemory ? 'pricing_memory' : draft.source,
    sourceUrl: memory?.source || draft.sourceUrl,
    sourceStatus: fromMemory ? 'pricing_memory' : 'needs_source_review',
    confidence: fromMemory ? 'pricing_memory_verified' : 'needs_source_review',
    reviewStatus: 'needs_review',
  }
}

function buildDeckMaterialEstimateLines(
  request: WorkRequest,
  entries: PricingMemoryEntry[]
): MaterialEstimateDraftLine[] {
  const deckSqft = inferDeckSquareFeet(request) || 400
  const framingWasteFactor = 1.1
  const estimatedBoardCount = Math.ceil((deckSqft / 400) * 50 * framingWasteFactor)
  const rimBlockingCount = Math.ceil((deckSqft / 400) * 14 * framingWasteFactor)
  const pierBlockCount = Math.ceil(deckSqft / 25)
  const hangerCount = Math.ceil(estimatedBoardCount * 1.6)
  const gravelBags = Math.ceil(pierBlockCount * 0.5)

  const baseLines: Array<Omit<MaterialEstimateDraftLine, 'packagesNeeded' | 'extendedTotal' | 'sourceStatus' | 'confidence' | 'reviewStatus'>> = [
    {
      materialName: '2x6 pressure-treated framing lumber',
      category: 'Deck Framing',
      requiredQuantity: estimatedBoardCount,
      requiredUnit: 'boards',
      packageSize: 1,
      packageUnit: '2x6 board',
      packageCoverage: 1,
      packageCoverageUnit: 'board',
      packagePrice: 11.98,
      sourceUrl: searchUrl('2x6 pressure treated lumber 12 ft'),
      source: 'fallback_product_search',
      quantityReason: `Floating deck framing draft for ${deckSqft} sqft at roughly 16 in. OC plus 10% waste. Verify span, beam layout, board lengths, and local code.`,
    },
    {
      materialName: '2x6 pressure-treated rim boards and blocking',
      category: 'Deck Framing',
      requiredQuantity: rimBlockingCount,
      requiredUnit: 'boards',
      packageSize: 1,
      packageUnit: '2x6 board',
      packageCoverage: 1,
      packageCoverageUnit: 'board',
      packagePrice: 11.98,
      sourceUrl: searchUrl('2x6 pressure treated lumber 12 ft'),
      source: 'fallback_product_search',
      quantityReason: `Rim boards, blocking, and layout waste allowance scaled from a ${deckSqft} sqft floating deck. Human layout review required.`,
    },
    {
      materialName: 'concrete deck pier blocks',
      category: 'Deck Foundation',
      requiredQuantity: pierBlockCount,
      requiredUnit: 'blocks',
      packageSize: 1,
      packageUnit: 'pier block',
      packageCoverage: 1,
      packageCoverageUnit: 'block',
      packagePrice: 10.98,
      sourceUrl: searchUrl('concrete deck block pier block'),
      source: 'fallback_product_search',
      quantityReason: `Draft pier block count uses approximately one support point per 25 sqft for a floating deck. Verify load path, soil, and code.`,
    },
    {
      materialName: 'joist hangers and galvanized framing hardware',
      category: 'Deck Hardware',
      requiredQuantity: hangerCount,
      requiredUnit: 'pieces',
      packageSize: 1,
      packageUnit: 'hardware piece',
      packageCoverage: 1,
      packageCoverageUnit: 'piece',
      packagePrice: 1.78,
      sourceUrl: searchUrl('2x6 joist hanger galvanized'),
      source: 'fallback_product_search',
      quantityReason: `Hardware count approximates joist ends, rim connections, and blocking hardware. Final connector schedule needs human review.`,
    },
    {
      materialName: 'exterior structural/deck screws',
      category: 'Deck Fasteners',
      requiredQuantity: deckSqft,
      requiredUnit: 'sqft deck area',
      packageSize: 1,
      packageUnit: '10 lb box',
      packageCoverage: 250,
      packageCoverageUnit: 'sqft deck area',
      packagePrice: 89,
      sourceUrl: searchUrl('exterior deck screws 10 lb box'),
      source: 'fallback_product_search',
      quantityReason: `Fastener count uses deck area coverage per bulk screw box. Verify screw type, coating, and approved structural uses.`,
    },
    {
      materialName: 'weed barrier landscape fabric roll',
      category: 'Deck Ground Prep',
      requiredQuantity: deckSqft,
      requiredUnit: 'sqft',
      packageSize: 1,
      packageUnit: 'roll',
      packageCoverage: 400,
      packageCoverageUnit: 'sqft',
      packagePrice: 25,
      sourceUrl: searchUrl('weed barrier landscape fabric 400 sq ft roll'),
      source: 'fallback_product_search',
      quantityReason: `Weed barrier is package-priced by roll coverage: ${deckSqft} sqft required / 400 sqft per roll. This prevents the wrong 400 sqft x $25 calculation.`,
    },
    {
      materialName: 'gravel/base material under pier blocks',
      category: 'Deck Ground Prep',
      requiredQuantity: gravelBags,
      requiredUnit: '0.5 cu ft bags',
      packageSize: 1,
      packageUnit: 'bag',
      packageCoverage: 1,
      packageCoverageUnit: '0.5 cu ft bag',
      packagePrice: 5.48,
      sourceUrl: searchUrl('0.5 cu ft gravel bag paver base'),
      source: 'fallback_product_search',
      quantityReason: `Draft base allowance uses about 0.5 cu ft of compacted base per pier block. Verify excavation depth and drainage.`,
    },
  ]

  return baseLines.map((line) => applyPricingMemory(line, entries, request.zip || ''))
}

function countItems(value: unknown[] | null | undefined) {
  return Array.isArray(value) ? value.length : 0
}

function calculateEstimateTotals(
  items: EstimateItem[],
  laborCost: string,
  markupPercent: string,
  contingencyPercent: string
) {
  const activeItems = items.filter((item) => !isEstimateItemRejected(item))
  const materialSubtotal = activeItems.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  )
  const labor = Number(laborCost || 0)
  const markup = Number(markupPercent || 0)
  const contingency = Number(contingencyPercent || 0)
  const directCost = materialSubtotal + labor
  const markupDollars = directCost * (markup / 100)
  const contingencyDollars = directCost * (contingency / 100)
  const standardTotal = directCost + markupDollars + contingencyDollars

  return {
    materialSubtotal,
    labor,
    markup,
    contingency,
    directCost,
    markupDollars,
    contingencyDollars,
    standardTotal,
    lowTotal: standardTotal * 0.9,
    premiumTotal: standardTotal * 1.15,
    approvedCount: activeItems.filter((item) => item.human_approved).length,
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image file.'))
    reader.readAsDataURL(file)
  })
}

function getBestWorkType(value = '', description = '') {
  const text = [value, description].join(' ').toLowerCase()
  const exact = WORK_TYPES.find((item) => item.toLowerCase() === value.toLowerCase())
  if (exact) return exact

  const matchers: Array<[string, string[]]> = [
    ['Roofing', ['roof', 'shingle', 'leak', 'flashing', 'gutter']],
    ['Painting', ['paint', 'primer', 'interior paint', 'exterior paint']],
    ['Electrical', ['electrical', 'outlet', 'breaker', 'panel', 'light fixture']],
    ['Plumbing', ['plumbing', 'leak', 'toilet', 'sink', 'faucet', 'water heater']],
    ['Landscaping', ['landscape', 'yard', 'lawn', 'tree', 'mulch']],
    ['Cleaning', ['clean', 'cleaning', 'debris', 'turnover']],
    ['Inspection Repairs', ['inspection', 'repair request', 'buyer', 'seller']],
    ['Turnover Work', ['turnover', 'move out', 'tenant', 'unit']],
  ]

  const found = matchers.find(([_, words]) => words.some((word) => text.includes(word)))
  return found?.[0] || WORK_TYPES[0]
}

const FIRE_SUPPRESSION_INSPECTION_TASK: InspectionTaskIntelligence = {
  id: 'mock-fire-suppression-sprinkler-issue',
  task_title: 'Fire suppression sprinkler issue',
  defect_concern: 'Inspection context may indicate painted-over, obstructed, or sealed sprinkler heads. Real extraction is not wired yet, so this is sample task intelligence for admin review.',
  building_system: 'Fire suppression / life safety',
  risk_level: 'Life safety / fire hazard',
  trade_needed: 'Fire suppression specialist / Fire Marshal',
  urgency: 'Immediate review before seller guidance, pricing, closeout, or any representation that the system is functional.',
  missing_information_needed: [
    'Count of sprinkler heads.',
    'Locations of every sprinkler head and affected room.',
    'Any fire system inspection tags.',
    'Any fire panel photos or visible system status.',
  ],
  photo_requests: [
    'Close-up photos of every sprinkler head.',
    'Wide photos of rooms and ceilings.',
    'Better angled photos where paint, sealant, or obstruction is unclear.',
    'Photos of inspection tags and fire panel if present.',
  ],
  recommended_next_action: 'Contact Fire Marshal or licensed fire suppression specialist for review.',
  human_review_status: 'needs_review',
  source_label: 'Sample AI Draft',
}

function splitInspectionInfo(value?: string | null) {
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function requestHasInspectionContext(request: WorkRequest) {
  const documentNames = request.documents.map((file) => file.name).join(' ')
  const text = [
    request.workType,
    request.description,
    request.timeline,
    request.urgency,
    documentNames,
  ].join(' ').toLowerCase()
  const hasInspectionWord = ['inspection', 'inspector', 'report', 'seller', 'buyer', 'sprinkler', 'fire suppression', 'fire marshal'].some((word) => text.includes(word))
  const hasReportLikeDocument = request.documents.some((file) => /\.(pdf|doc|docx)$/i.test(file.name))
  return hasInspectionWord || hasReportLikeDocument
}

function inferInspectionBuildingSystem(item: SellerPrepItemV1) {
  const text = [item.repair_item, item.trade_category, item.ai_notes].join(' ').toLowerCase()
  if (text.includes('roof') || text.includes('gutter') || text.includes('flashing')) return 'Roof / water intrusion'
  if (text.includes('paint') || text.includes('siding') || text.includes('trim') || text.includes('caulk')) return 'Exterior envelope / finishes'
  if (text.includes('plumb') || text.includes('water') || text.includes('drain') || text.includes('fixture')) return 'Plumbing'
  if (text.includes('electrical') || text.includes('breaker') || text.includes('outlet') || text.includes('panel')) return 'Electrical'
  if (text.includes('fire') || text.includes('sprinkler') || text.includes('smoke')) return 'Life safety'
  return item.trade_category || 'General repair'
}

function getInspectionRiskLabel(score?: number | null) {
  const value = Number(score || 0)
  if (value >= 8) return 'High inspection risk'
  if (value >= 6) return 'Medium inspection risk'
  if (value > 0) return 'Low inspection risk'
  return 'Needs review'
}

function buildInspectionTaskIntelligence(request: WorkRequest | null, items: SellerPrepItemV1[]) {
  if (!request || !requestHasInspectionContext(request)) return []

  const itemTasks: InspectionTaskIntelligence[] = items.map((item) => {
    const missingInfo = splitInspectionInfo(item.missing_info)
    const reviewStatus = isHumanVerifiedStatus(item.human_review_status)
      ? 'human_verified'
      : item.human_review_status || 'needs_review'

    return {
      id: `seller-prep-${item.id}`,
      task_title: item.repair_item || 'Inspection repair task',
      defect_concern: item.ai_notes || item.repair_item || 'Inspection concern needs human review.',
      building_system: inferInspectionBuildingSystem(item),
      risk_level: getInspectionRiskLabel(item.inspection_risk_score),
      trade_needed: item.trade_category || 'Trade needs review',
      urgency: item.recommendation === 'must_fix' ? 'High priority / review before seller report' : 'Needs review before estimating or routing',
      missing_information_needed: missingInfo.length ? missingInfo : ['Confirm exact inspection finding, affected location, quantity, and access constraints.'],
      photo_requests: ['Upload clear close-up photos, wide context photos, and any inspection report pages or tags that show this condition.'],
      recommended_next_action: item.recommendation
        ? `Review ${String(item.recommendation).replace(/_/g, ' ')} recommendation with the appropriate trade before pricing or sending.`
        : 'Review defect, risk, trade, missing evidence, and next task before pricing or sending.',
      human_review_status: reviewStatus,
      source_label: 'Seller Prep AI Draft',
    }
  })

  return [...itemTasks, { ...FIRE_SUPPRESSION_INSPECTION_TASK }]
}

function localIntakeFallback(text = ''): IntakeDraft {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const lower = cleaned.toLowerCase()

  const emailMatch = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = cleaned.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  const zipMatch = cleaned.match(/\b\d{5}(?:-\d{4})?\b/)
  const addressMatch = cleaned.match(/\b\d{1,6}\s+[A-Za-z0-9.'\-\s]+\s+(?:Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Blvd|Boulevard|Pl|Place|Terrace|Ter|Loop|Cir|Circle)\b[^,.\n]*/i)

  const missing: string[] = []
  if (!addressMatch) missing.push('property address')
  if (!lower.includes('photo') && !lower.includes('pic') && !lower.includes('image')) missing.push('photos')
  if (!lower.includes('deadline') && !lower.includes('tonight') && !lower.includes('tomorrow') && !lower.includes('asap')) missing.push('deadline')
  if (!lower.includes('inspection')) missing.push('inspection report')
  if (!lower.includes('access') && !lower.includes('lockbox')) missing.push('access instructions')

  const workType = getBestWorkType('', cleaned)
  const urgency = lower.includes('asap') || lower.includes('urgent') || lower.includes('tonight') || lower.includes('tight') ? 'Urgent' : 'Standard'

  return {
    requesterName: '',
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    workType,
    propertyAddress: addressMatch?.[0]?.trim() || '',
    city: '',
    state: '',
    zip: zipMatch?.[0] || '',
    urgency,
    occupancy: 'Unknown',
    timeline: lower.includes('tonight') ? 'Tonight' : lower.includes('tomorrow') ? 'Tomorrow' : '',
    description: cleaned || 'Imported from text/screenshot intake. Review required.',
    missingInfo: missing,
    suggestedReply: `Thanks — I have the ${workType.toLowerCase()} request started. Please send ${missing.length ? missing.join(', ') : 'any photos, deadline, access instructions, and inspection notes'} so we can prepare a more accurate estimate.`,
    confidence: 'local_draft',
    notes: 'Local fallback parser used. Human review required.',
  }
}


function normalizeRequestStatus(value: string | null | undefined): RequestStatus {
  const raw = String(value || '').toLowerCase().trim()

  if (raw === 'needs info' || raw === 'needs_info' || raw === 'need info' || raw === 'missing info') {
    return 'needs_info'
  }

  if (raw === 'in progress' || raw === 'in_progress' || raw === 'progress' || raw === 'working') {
    return 'in_progress'
  }

  if (raw === 'done' || raw === 'estimate ready' || raw === 'estimate_ready' || raw === 'complete' || raw === 'completed') {
    return 'estimate_ready'
  }

  if (raw === 'ready' || raw === 'pending approval' || raw === 'pending_approval' || raw === 'pending' || raw === 'review') {
    return 'pending_approval'
  }

  return 'new'
}

function normalizeInspectionProcessingStatus(value: unknown): InspectionProcessingStatus {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'extracting_pdf') return 'extracting_pdf'
  if (raw === 'inspection_review_drafted') return 'inspection_review_drafted'
  if (raw === 'needs_human_review') return 'needs_human_review'
  if (raw === 'human_verified') return 'human_verified'
  if (raw === 'extraction_failed') return 'extraction_failed'
  return 'uploaded'
}

function getOperationalRecord(propertyFacts: Record<string, any>) {
  const record = propertyFacts.operationalRecord
  return record && typeof record === 'object' ? record : {}
}

function getAdminNotesFromFacts(propertyFacts: Record<string, any>): AdminNote[] {
  return Array.isArray(propertyFacts.adminNotes)
    ? propertyFacts.adminNotes.filter((note: any) => note && typeof note.body === 'string')
    : []
}

function mapLeadRowToWorkRequest(row: any): WorkRequest {
  const rowPropertyFacts = row.property_facts && typeof row.property_facts === 'object'
    ? row.property_facts
    : {}
  const operationalRecord = getOperationalRecord(rowPropertyFacts)

  return {
    id: row.id,
    propertyId: row.property_id || row.property_profile_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    requesterName: row.name || row.requester_name || row.client_name || '',
    email: row.email || row.client_email || row.requester_email || row.contact_email || '',
    phone: row.phone || row.client_phone || row.requester_phone || '',
    workType: operationalRecord.workType || row.work_type || row.workType || row.project_type || 'Home Services',
    propertyAddress: row.address || row.property_address || row.project_address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || row.postal_code || '',
    urgency: operationalRecord.urgency || row.urgency || 'Standard',
    occupancy: operationalRecord.occupancy || row.occupancy || 'Unknown',
    timeline: row.timeline || '',
    propertyFacts: {
      ...emptyPropertyFacts(),
      ...rowPropertyFacts,
      propertyType: row.property_type || rowPropertyFacts.propertyType || '',
      jurisdiction: row.property_jurisdiction || rowPropertyFacts.jurisdiction || '',
      zoning: row.zoning || rowPropertyFacts.zoning || '',
      parcelNumber: row.parcel_number || rowPropertyFacts.parcelNumber || '',
      verified: Boolean(row.property_verified || rowPropertyFacts.verified),
    },
    description: operationalRecord.description || row.description || row.scope || row.notes || '',
    photos: [],
    documents: [],
    status: normalizeRequestStatus(row.status),
    archived: Boolean(row.archived),
    archivedAt: row.archived_at || '',
    archiveReason: row.archive_reason || '',
    inspectionIntelligence: rowPropertyFacts.inspectionIntelligence || null,
    inspectionProcessingStatus: normalizeInspectionProcessingStatus(rowPropertyFacts.inspectionProcessingStatus),
    inspectionExtractionSummary: rowPropertyFacts.inspectionExtractionSummary || '',
    inspectionExtractionMessage: rowPropertyFacts.inspectionExtractionMessage || '',
    scopeInterpretation: operationalRecord.scopeInterpretation || '',
    missingInformation: operationalRecord.missingInformation || '',
    adminNotes: getAdminNotesFromFacts(rowPropertyFacts),
    internalNotes: operationalRecord.internalNotes || '',
    agentFacingNotes: operationalRecord.agentFacingNotes || '',
    contractorFacingNotes: operationalRecord.contractorFacingNotes || '',
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [showLogin, setShowLogin] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [authEmail, setAuthEmail] = useState('cultivated.shelter@gmail.com')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<MemoryActorRole>('viewer')
  const [isCompact, setIsCompact] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 760px)').matches
  )

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [archivedRequests, setArchivedRequests] = useState<WorkRequest[]>([])
  const [archivedSearch, setArchivedSearch] = useState('')
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [requestEditDrafts, setRequestEditDrafts] = useState<Record<string, RequestEditDraft>>({})
  const [requestSavingId, setRequestSavingId] = useState<string | null>(null)
  const [adminNoteDrafts, setAdminNoteDrafts] = useState<Record<string, AdminNoteDraft>>({})
  const [pdfProcessingByRequest, setPdfProcessingByRequest] = useState<Record<string, InspectionProcessingStatus>>({})
  const [inspectionFindingSavingId, setInspectionFindingSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')

  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [workType, setWorkType] = useState(WORK_TYPES[0])
  const [propertyAddress, setPropertyAddress] = useState('')
  const [propertyFacts, setPropertyFacts] = useState<PropertyFacts>(emptyPropertyFacts())
  const [propertyLookupLoading, setPropertyLookupLoading] = useState(false)
  const [propertyLookupMessage, setPropertyLookupMessage] = useState('')
  const [propertyLookupStatus, setPropertyLookupStatus] = useState<PropertyLookupStatus>('idle')
  const [propertyProfilesByLeadId, setPropertyProfilesByLeadId] = useState<Record<string, LeadPropertyProfile>>({})
  const [propertyProfileLoadingByLeadId, setPropertyProfileLoadingByLeadId] = useState<Record<string, boolean>>({})
  const [propertyProfileErrorsByLeadId, setPropertyProfileErrorsByLeadId] = useState<Record<string, string>>({})
  const [propertyType, setPropertyType] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [zoning, setZoning] = useState('')
  const [parcelNumber, setParcelNumber] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [city, setCity] = useState('')
  const [stateValue, setStateValue] = useState('')
  const [zip, setZip] = useState('')
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [localEvidenceStatus, setLocalEvidenceStatus] = useState<UploadEvidenceStatus>('selected')
  const [localEvidencePreviews, setLocalEvidencePreviews] = useState<Record<string, string>>({})
  const [inspectionReading, setInspectionReading] = useState(false)
  const [inspectionReportDraft, setInspectionReportDraft] = useState<InspectionReportDraft | null>(null)
  const [inspectionDraftTasks, setInspectionDraftTasks] = useState<InspectionTaskIntelligence[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [researchingId, setResearchingId] = useState<string | null>(null)
  const [materialListLoadingId, setMaterialListLoadingId] = useState<string | null>(null)
  const [takeoffLoadingId, setTakeoffLoadingId] = useState<string | null>(null)
  const [materialEstimateLoadingId, setMaterialEstimateLoadingId] = useState<string | null>(null)
  const [autoWorkflowLoadingId, setAutoWorkflowLoadingId] = useState<string | null>(null)
  const [sellerPrepLoadingId, setSellerPrepLoadingId] = useState<string | null>(null)
const [sellerPrepReview, setSellerPrepReview] = useState<any | null>(null)
  const [intakeText, setIntakeText] = useState('')
  const [intakeScreenshotFile, setIntakeScreenshotFile] = useState<File | null>(null)
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft | null>(null)
  const [intakeAnalyzing, setIntakeAnalyzing] = useState(false)

  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [missingInfoRequests, setMissingInfoRequests] = useState<MissingInfoRequest[]>([])
  const [messageLoading, setMessageLoading] = useState(false)
  const [messageSavingId, setMessageSavingId] = useState<string | null>(null)
  const [messageFilter, setMessageFilter] = useState<'all' | 'draft' | 'sent' | 'approved'>('all')
  const [reviewingMessageId, setReviewingMessageId] = useState<string | null>(null)

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceVendor, setInvoiceVendor] = useState('')
  const [invoiceAddress, setInvoiceAddress] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceFileUrls, setInvoiceFileUrls] = useState<Record<string, string>>({})
  const [invoiceAnalyses, setInvoiceAnalyses] = useState<Record<string, InvoiceCostAnalysis>>({})
  const [invoiceUploading, setInvoiceUploading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [extractingInvoiceId, setExtractingInvoiceId] = useState<string | null>(null)
  const [analyzingInvoiceId, setAnalyzingInvoiceId] = useState<string | null>(null)

  const [materials, setMaterials] = useState<MaterialCost[]>([])
  const [materialName, setMaterialName] = useState('')
  const [materialCategory, setMaterialCategory] = useState('')
  const [materialUnit, setMaterialUnit] = useState('')
  const [materialPrice, setMaterialPrice] = useState('')
  const [materialSource, setMaterialSource] = useState('')
  const [materialLoading, setMaterialLoading] = useState(false)
  const [materialUpdating, setMaterialUpdating] = useState(false)
  const [materialSavingId, setMaterialSavingId] = useState<string | null>(null)
  const [materialEditorItem, setMaterialEditorItem] = useState<MaterialCost | null>(null)
  const [materialEditorDraft, setMaterialEditorDraft] = useState<MaterialEditorDraft | null>(null)

  const [sellerPrepSelectedId, setSellerPrepSelectedId] = useState('')
  const [sellerPrepAnalysisV1, setSellerPrepAnalysisV1] = useState<SellerPrepAnalysisV1 | null>(null)
  const [sellerPrepItemsV1, setSellerPrepItemsV1] = useState<SellerPrepItemV1[]>([])
  const [sellerPrepSavingId, setSellerPrepSavingId] = useState<string | null>(null)
  const [pricingMemoryEntries, setPricingMemoryEntries] = useState<PricingMemoryEntry[]>([])
  const [pricingMemoryLoading, setPricingMemoryLoading] = useState(false)
  const [agentLearningEvents, setAgentLearningEvents] = useState<AgentLearningEvent[]>([])
  const [agentLearningRules, setAgentLearningRules] = useState<AgentLearningRule[]>([])
  const [agentRuleApplications, setAgentRuleApplications] = useState<AgentRuleApplication[]>([])
  const [agentMemoryConflicts, setAgentMemoryConflicts] = useState<AgentMemoryConflict[]>([])
  const [agentMemoryAuditLogs, setAgentMemoryAuditLogs] = useState<AgentMemoryAuditLog[]>([])
  const [contractorProfiles, setContractorProfiles] = useState<ContractorProfile[]>([])
  const [contractorAssignments, setContractorAssignments] = useState<ContractorAssignment[]>([])
  const [contractorAssignmentLoading, setContractorAssignmentLoading] = useState(false)
  const [contractorAssignmentSavingId, setContractorAssignmentSavingId] = useState<string | null>(null)
  const [selectedContractorByRequest, setSelectedContractorByRequest] = useState<Record<string, string>>({})
  const [contractorNotesByAssignment, setContractorNotesByAssignment] = useState<Record<string, string>>({})
  const [agentLearningLoading, setAgentLearningLoading] = useState(false)
  const [agentLearningSavingId, setAgentLearningSavingId] = useState<string | null>(null)
  const [agentLearningStatusFilter, setAgentLearningStatusFilter] = useState<'all' | LessonStatus>('human_verified')
  const [sourceLessons, setSourceLessons] = useState<SourceLesson[]>([])
  const [sourceLessonsLoading, setSourceLessonsLoading] = useState(false)
  const [sourceLessonSavingId, setSourceLessonSavingId] = useState<string | null>(null)
  const [sourceLessonStatusFilter, setSourceLessonStatusFilter] = useState<'all' | SourceLessonStatus>('needs_review')
  const [sourceLessonDraft, setSourceLessonDraft] = useState<SourceLessonDraft>(EMPTY_SOURCE_LESSON_DRAFT)
  const [sourceLessonManualNotes, setSourceLessonManualNotes] = useState('')
  const [curatedLessonIntake, setCuratedLessonIntake] = useState<CuratedLessonIntakeDraft>(EMPTY_CURATED_LESSON_INTAKE)
  const [curatedLessonDraftId, setCuratedLessonDraftId] = useState<string | null>(null)
  const [curatedLessonError, setCuratedLessonError] = useState('')
  const [ruleApplicationRuleFilter, setRuleApplicationRuleFilter] = useState('all')
  const [ruleApplicationTypeFilter, setRuleApplicationTypeFilter] = useState<'all' | AgentRuleApplicationType>('all')
  const [ruleApplicationAgentFilter, setRuleApplicationAgentFilter] = useState<'all' | AgentName>('all')
  const [ruleApplicationFeedbackFilter, setRuleApplicationFeedbackFilter] = useState<'all' | AgentRuleApplicationFeedbackStatus>('all')
  const [ruleApplicationTaskFilter, setRuleApplicationTaskFilter] = useState('')
  const [memoryConflictStatusFilter, setMemoryConflictStatusFilter] = useState<'all' | AgentMemoryConflictStatus>('needs_review')
  const [learningDraft, setLearningDraft] = useState<CorrectionLearningInput>({
    source_agent: 'quality_check_agent',
    task_type: '',
    original_agent_output: '',
    human_correction: '',
  })
  const memoryActorRole: MemoryActorRole = getEffectiveMemoryActorRole(currentUserRole)
  const hasAuthenticatedAdminAccess = hasSupabaseSession && canApproveOperationalMemory(memoryActorRole)
  const hasAdminConsoleAccess = hasAuthenticatedAdminAccess
  const galleryCanManage = hasAuthenticatedAdminAccess
  const canViewSourceLessonAgent = hasSupabaseSession && canEditOperationalMemory(memoryActorRole)
  const canDraftSourceLessons = canDraftSourceLessonsWithSession(currentUserRole, hasSupabaseSession)
  const canApproveSourceLessons = canApproveSourceLessonsWithSession(currentUserRole, hasSupabaseSession)
  const canSaveGlobalLaborMemory = canApproveSourceLessons
  const canCreateSourceLessonJobSteps = canApproveSourceLessons
  const canAccessSourceLessonAgent = canViewSourceLessonAgent

  const [laborRates, setLaborRates] = useState<LaborRate[]>([])
  const [laborTrade, setLaborTrade] = useState('')
  const [laborJobType, setLaborJobType] = useState('')
  const [laborUnit, setLaborUnit] = useState('hour')
  const [laborTypicalRate, setLaborTypicalRate] = useState('')
  const [laborMinimumCharge, setLaborMinimumCharge] = useState('')
  const [laborTripCharge, setLaborTripCharge] = useState('')
  const [laborDisposalFee, setLaborDisposalFee] = useState('')
  const [laborRegion, setLaborRegion] = useState('')
  const [laborLoading, setLaborLoading] = useState(false)
  const [laborSavingId, setLaborSavingId] = useState<string | null>(null)


  const [selectedEstimateRequest, setSelectedEstimateRequest] = useState<WorkRequest | null>(null)
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([])
  const [estimateResearchRows, setEstimateResearchRows] = useState<EstimateResearchRow[]>([])
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateSavingId, setEstimateSavingId] = useState<string | null>(null)
  const [estimateLaborCost, setEstimateLaborCost] = useState('0')
  const [appliedLaborRate, setAppliedLaborRate] = useState<LaborRate | null>(null)
  const [curatedLaborDraft, setCuratedLaborDraft] = useState<CuratedLaborDraft | null>(null)
  const [curatedLaborSaving, setCuratedLaborSaving] = useState(false)
  const [estimateLaborUnits, setEstimateLaborUnits] = useState('4')
  const [estimateMinimumCharge, setEstimateMinimumCharge] = useState('0')
  const [estimateTripCharge, setEstimateTripCharge] = useState('0')
  const [estimateDisposalFee, setEstimateDisposalFee] = useState('0')
  const [estimateLaborMessage, setEstimateLaborMessage] = useState('No labor rate applied yet.')
  const [estimateMarkupPercent, setEstimateMarkupPercent] = useState('20')
  const [estimateContingencyPercent, setEstimateContingencyPercent] = useState('10')
  const [estimateNotes, setEstimateNotes] = useState('Draft estimate. Final price requires human review and site verification.')
  const [estimateIntelligence, setEstimateIntelligence] = useState<EstimateIntelligenceResult | null>(null)
  const [matchedPricingMemory, setMatchedPricingMemory] = useState<HumanPricingMemory[]>([])
  const [matchedJobStepMemory, setMatchedJobStepMemory] = useState<JobExecutionStepLearningRecord[]>([])
  const [matchedFieldMemory, setMatchedFieldMemory] = useState<PhotoFieldMemory[]>([])
  const [showRejectedEstimateItems, setShowRejectedEstimateItems] = useState(false)
  const [showManualMaterialForm, setShowManualMaterialForm] = useState(false)
  const [manualMaterialDraft, setManualMaterialDraft] = useState<ManualMaterialDraft>(EMPTY_MANUAL_MATERIAL_DRAFT)
  const [jobExecutionSteps, setJobExecutionSteps] = useState<JobExecutionStep[]>([])
  const [jobStepSavingId, setJobStepSavingId] = useState<string | null>(null)
  const [jobScopeMessage, setJobScopeMessage] = useState('AI-generated job steps are drafts until a human approves them.')
  const [aiResearchDrafts, setAiResearchDrafts] = useState<AiResearchDraft[]>([])
  const [aiResearchSavingId, setAiResearchSavingId] = useState<string | null>(null)
  const [aiResearchMessage, setAiResearchMessage] = useState('AI Research Draft — Human Review Required')
  const [propertyAgentOutputsByRequest, setPropertyAgentOutputsByRequest] = useState<Record<string, PropertyAgentResult[]>>({})
  const [siteMediaAnalysesByRequest, setSiteMediaAnalysesByRequest] = useState<Record<string, PropertyMediaAnalysis[]>>({})
  const [siteMediaFindingsByRequest, setSiteMediaFindingsByRequest] = useState<Record<string, PropertyMediaFinding[]>>({})
  const [siteMediaLoadingByRequest, setSiteMediaLoadingByRequest] = useState<Record<string, boolean>>({})
  const [siteMediaSavingId, setSiteMediaSavingId] = useState<string | null>(null)
  const [agentResearchTasksByFinding, setAgentResearchTasksByFinding] = useState<Record<string, AgentResearchTask[]>>({})
  const [agentResearchTasksByRequest, setAgentResearchTasksByRequest] = useState<Record<string, AgentResearchTask[]>>({})
  const [agentResearchSourcesByTask, setAgentResearchSourcesByTask] = useState<Record<string, AgentResearchSource[]>>({})
  const [agentResearchDraftsByFinding, setAgentResearchDraftsByFinding] = useState<Record<string, AgentResearchQuestionDraft>>({})
  const [agentResearchSavingId, setAgentResearchSavingId] = useState<string | null>(null)
  const [noteResearchDraftsByNote, setNoteResearchDraftsByNote] = useState<Record<string, SourceResearchSetupDraft>>({})
  const [openNoteResearchByNote, setOpenNoteResearchByNote] = useState<Record<string, boolean>>({})
  const [sourceResearchMessagesByRequest, setSourceResearchMessagesByRequest] = useState<Record<string, string>>({})
  const [evidenceInspectionStatusByKey, setEvidenceInspectionStatusByKey] = useState<Record<string, EvidenceInspectionStatus>>({})
  const [evidencePageDraftsByKey, setEvidencePageDraftsByKey] = useState<Record<string, string>>({})
  const [evidenceResearchDraftsByKey, setEvidenceResearchDraftsByKey] = useState<Record<string, EvidenceResearchDraft>>({})

  useEffect(() => {
    const previewUrls: Record<string, string> = {}
    const selectedFiles = [
      ...photoFiles.map((file, index) => ({ file, index, group: 'photo' as const })),
      ...documentFiles.map((file, index) => ({ file, index, group: 'document' as const })),
    ]

    selectedFiles.forEach(({ file, index, group }) => {
      if (file.type.startsWith('image/')) {
        previewUrls[getLocalEvidenceKey(file, index, group)] = URL.createObjectURL(file)
      }
    })

    setLocalEvidencePreviews(previewUrls)

    return () => {
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photoFiles, documentFiles])

  useEffect(() => {
    loadRequestsFromSupabase()
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadProfileForSession(session?: { user?: { id?: string | null } | null } | null) {
      try {
        const resolvedSession =
          session === undefined ? (await supabase.auth.getSession()).data.session : session
        const userId = resolvedSession?.user?.id || null
        if (!mounted) return

        if (!userId) {
          setHasSupabaseSession(false)
          setCurrentUserId(null)
          setCurrentUserRole('viewer')
          return
        }

        setHasSupabaseSession(true)
        setCurrentUserId(userId)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error

        const role = String((profile as { role?: string } | null)?.role || 'viewer') as MemoryActorRole
        const normalizedRole: MemoryActorRole =
          ['owner', 'admin', 'estimator', 'contractor', 'agent', 'client', 'viewer'].includes(role)
            ? role
            : 'viewer'
        setCurrentUserRole(normalizedRole)
        setAuthMessage(normalizedRole === 'viewer' ? 'Signed in, but no admin role was found for this account.' : '')
        if (normalizedRole === 'contractor') {
          setActiveTab((tab) => (tab === 'new' ? 'properties' : tab))
        }
      } catch (error) {
        console.warn('Could not load Supabase profile role; using viewer role.', error)
        if (mounted) {
          setHasSupabaseSession(false)
          setCurrentUserId(null)
          setCurrentUserRole('viewer')
          setAuthMessage('Could not load your profile role.')
        }
      }
    }

    loadProfileForSession()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfileForSession(session)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(max-width: 760px)')
    const updateCompactMode = () => setIsCompact(query.matches)

    updateCompactMode()
    query.addEventListener('change', updateCompactMode)

    return () => query.removeEventListener('change', updateCompactMode)
  }, [])

  // Requests are now loaded from Supabase so phone + desktop stay in sync.
  // Do not save dashboard requests to browser localStorage.

  useEffect(() => {
    if (hasAdminConsoleAccess && activeTab === 'invoices') loadInvoices()
    if (hasAdminConsoleAccess && activeTab === 'materials') loadMaterials()
    if (hasAdminConsoleAccess && activeTab === 'labor') loadLaborRates()
    if (hasAdminConsoleAccess && activeTab === 'messages') loadMessageCenter()
    if (hasAdminConsoleAccess && activeTab === 'archived') loadArchivedRequestsFromSupabase()
    if (hasAdminConsoleAccess && activeTab === 'pricingMemory') loadPricingMemoryEntries()
    if (hasAdminConsoleAccess && activeTab === 'agentLearning') {
      loadAgentLearning()
      loadSourceLessons()
    }
    if (canAccessSourceLessonAgent && activeTab === 'fieldLessons') loadSourceLessons()
    if ((hasAdminConsoleAccess || currentUserRole === 'contractor') && (activeTab === 'dashboard' || activeTab === 'properties')) loadContractorAssignments()
  }, [hasAdminConsoleAccess, canAccessSourceLessonAgent, isAdmin, activeTab, currentUserRole])

  useEffect(() => {
    if (!appliedLaborRate) return

    const nextLaborTotal = calculateLaborTotalFromRate(
      appliedLaborRate,
      estimateLaborUnits,
      estimateMinimumCharge,
      estimateTripCharge,
      estimateDisposalFee
    )

    setEstimateLaborCost(String(nextLaborTotal))
  }, [
    appliedLaborRate,
    estimateLaborUnits,
    estimateMinimumCharge,
    estimateTripCharge,
    estimateDisposalFee,
  ])

  function requireAdmin(tab: Tab) {
    if (!hasAdminConsoleAccess) {
      setShowLogin(true)
      return
    }

    setActiveTab(tab)
  }

  function openSourceLessonAgent() {
    if (!canAccessSourceLessonAgent) {
      setShowLogin(true)
      return
    }

    setActiveTab('fieldLessons')
  }

  async function handleSupabaseLogin() {
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage('Enter your Supabase admin email and password.')
      return
    }

    setAuthLoading(true)
    setAuthMessage('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      })
      if (error) throw error
      if (!data.session?.user?.id) throw new Error('Supabase did not return an active session.')
      setAuthPassword('')
      setShowLogin(false)
      setActiveTab('dashboard')
    } catch (error: any) {
      console.error(error)
      setAuthMessage(error?.message || 'Could not sign in with Supabase.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogin() {
    if (!ADMIN_PIN) {
      alert('Demo PIN is not configured. Add VITE_ADMIN_PIN only for local read-only demos.')
      return
    }

    if (adminPinInput === ADMIN_PIN) {
      setIsAdmin(true)
      setShowLogin(false)
      setAdminPinInput('')
      setAuthMessage('Demo PIN accepted. This is not real admin security and does not unlock protected Supabase writes. Sign in with an admin/owner account for operations.')
      setActiveTab('new')
    } else {
      alert('Wrong demo PIN')
    }
  }

  async function handleLogout() {
    setIsAdmin(false)
    setHasSupabaseSession(false)
    setCurrentUserId(null)
    setCurrentUserRole('viewer')
    setAuthPassword('')
    setAuthMessage('')
    await supabase.auth.signOut()
    setActiveTab('new')
  }

  function resetForm() {
    setRequesterName('')
    setEmail('')
    setPhone('')
    setWorkType(WORK_TYPES[0])
    setPropertyAddress('')
    setPropertyFacts(emptyPropertyFacts())
    setPropertyLookupMessage('')
    setPropertyType('')
    setJurisdiction('')
    setZoning('')
    setParcelNumber('')
    setVerificationNotes('')
    setCity('')
    setStateValue('')
    setZip('')
    setUrgency('Standard')
    setOccupancy('Occupied')
    setTimeline('')
    setDescription('')
    setPhotoFiles([])
    setDocumentFiles([])
    setLocalEvidenceStatus('selected')
    setInspectionReportDraft(null)
    setInspectionDraftTasks([])
    setInspectionReading(false)
  }

  async function readInspectionFiles(files: File[]) {
    const inspectionFiles = files.filter(isInspectionPdf)
    if (!inspectionFiles.length) return

    setInspectionReading(true)
    setInspectionReportDraft(null)
    setInspectionDraftTasks([])

    try {
      const file = inspectionFiles[0]
      const { text, payloadBytes } = await readInspectionPdfText(file)
      const address = extractInspectionAddress(text)
      const clientName = firstMatch(text, [
        /(?:Client|Customer|Prepared\s+For|Report\s+Prepared\s+For)\s*:?\s*([A-Z][A-Za-z .'-]{2,80})/i,
      ])
      const inspectorCombined = firstMatch(text, [
        /(?:Inspector|Inspected\s+By)\s*:?\s*([A-Z][A-Za-z .'-]{2,80}(?:\s*\/\s*[A-Z][A-Za-z0-9 .,&'-]{2,100})?)/i,
      ])
      const companyFromInspector = inspectorCombined.includes('/')
        ? inspectorCombined.split('/').slice(1).join('/').trim()
        : ''
      const inspectorName = inspectorCombined.includes('/')
        ? inspectorCombined.split('/')[0].trim()
        : inspectorCombined
      const inspectorCompany = companyFromInspector || firstMatch(text, [
        /(?:Company|Inspection\s+Company)\s*:?\s*([A-Z][A-Za-z0-9 .,&'-]{2,100})/i,
        /\b([A-Z][A-Za-z0-9 .,&'-]{2,80}\s+(?:Home\s+Inspections|Inspections|Inspection\s+Services|Inspection\s+LLC|Inspections\s+LLC))\b/,
      ])
      const reportType = firstMatch(text, [
        /\b(Home\s+Inspection\s+Report|Property\s+Inspection\s+Report|Inspection\s+Report|Pre[-\s]?Listing\s+Inspection|Buyer\s+Inspection)\b/i,
      ]) || 'Inspection report'
      const inspectionDate = extractInspectionDate(text)
      const summaryItems = extractInspectionFindings(text)
      const missingInfo = [
        !address.propertyAddress ? 'Confirm property address.' : '',
        !inspectionDate ? 'inspection date' : '',
        !clientName ? 'client/customer name' : '',
        !inspectorName && !inspectorCompany ? 'inspector name/company' : '',
        !summaryItems.length ? 'inspection summary findings' : '',
      ].filter(Boolean)
      const intelligence = buildInspectionIntelligenceDraft({
        fileName: file.name,
        reportType,
        propertyAddress: address.propertyAddress,
        city: address.city,
        state: address.state,
        inspectionDate,
        inspectorName,
        inspectorCompany,
        findings: summaryItems,
        missingInfo,
      })

      if (intelligence.propertyAddress || address.propertyAddress) setPropertyAddress(intelligence.propertyAddress || address.propertyAddress)
      if (intelligence.city || address.city) setCity(intelligence.city || address.city)
      if (intelligence.state || address.state) setStateValue(intelligence.state || address.state)
      if (address.zip) setZip(address.zip)
      if (clientName) setRequesterName((current) => current || clientName)
      setWorkType('Inspection Repairs')
      setPropertyFacts((prev) => ({
        ...prev,
        verified: true,
        source: 'fallback',
        confidence: 'low',
        notes: 'AI Draft from uploaded inspection report. Human review required.',
        verificationNotes: [
          `AI Draft from ${file.name}.`,
          `Front-page extraction payload: ${payloadBytes} bytes.`,
          inspectionDate ? `Inspection date: ${inspectionDate}.` : '',
          inspectorName || inspectorCompany ? `Inspector/company: ${[inspectorName, inspectorCompany].filter(Boolean).join(' / ')}.` : '',
          reportType ? `Report/source: ${reportType}.` : '',
          missingInfo.length ? `Missing info to confirm: ${missingInfo.join(', ')}.` : 'Extracted fields need human review before save.',
        ].filter(Boolean).join(' '),
      }))
      setPropertyLookupStatus(missingInfo.length ? 'no_records_found' : 'data_found')
      setPropertyLookupMessage(
        missingInfo.length
          ? `AI Draft from inspection report. Missing Info: ${missingInfo.join(', ')}`
          : 'AI Draft from inspection report. Review detected property details before saving.'
      )

      if (summaryItems.length && !description.trim()) {
        setDescription(`Inspection report uploaded. Draft findings for review:\n- ${summaryItems.slice(0, 4).join('\n- ')}`)
      }

      setInspectionReportDraft({
        fileName: file.name,
        frontPagePayloadBytes: payloadBytes,
        propertyAddress: intelligence.propertyAddress || address.propertyAddress,
        city: intelligence.city || address.city,
        state: intelligence.state || address.state,
        inspectionDate,
        clientName,
        inspectorName,
        inspectorCompany,
        reportType,
        summaryItems,
        missingInfo,
        intelligence,
        status: missingInfo.length ? 'Needs Review' : 'AI Draft',
      })
      setInspectionDraftTasks(buildInspectionTasksFromFindings(summaryItems, file.name))
    } catch (error) {
      console.warn('Inspection PDF extraction failed.', error)
      setInspectionReportDraft({
        fileName: inspectionFiles[0].name,
        frontPagePayloadBytes: Math.min(inspectionFiles[0].size, INSPECTION_FRONT_PAGE_MAX_BYTES),
        propertyAddress: '',
        city: '',
        state: '',
        inspectionDate: '',
        clientName: '',
        inspectorName: '',
        inspectorCompany: '',
        reportType: 'Inspection report',
        summaryItems: [],
        missingInfo: ['Confirm property address.', 'client/customer name', 'inspector name/company', 'inspection summary findings'],
        intelligence: buildInspectionIntelligenceDraft({
          fileName: inspectionFiles[0].name,
          reportType: 'Inspection report',
          propertyAddress: '',
          city: '',
          state: '',
          inspectionDate: '',
          inspectorName: '',
          inspectorCompany: '',
          findings: [],
          missingInfo: ['Confirm property address.', 'client/customer name', 'inspector name/company', 'inspection summary findings'],
        }),
        status: 'Needs Review',
      })
      setPropertyLookupStatus('error')
      setPropertyLookupMessage('Could not read enough text from the inspection PDF. Missing Info: Confirm property address.')
    } finally {
      setInspectionReading(false)
    }
  }


  async function analyzeIntake() {
    if (!intakeText.trim() && !intakeScreenshotFile) {
      alert('Paste a message or upload a screenshot first.')
      return
    }

    if (intakeScreenshotFile && intakeScreenshotFile.size > 7 * 1024 * 1024) {
      alert('Screenshot is too large. Please upload an image under 7 MB.')
      return
    }

    setIntakeAnalyzing(true)

    try {
      let imageDataUrl = ''
      if (intakeScreenshotFile) {
        imageDataUrl = await fileToDataUrl(intakeScreenshotFile)
      }

      if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
        const fallback = localIntakeFallback(intakeText)
        setIntakeDraft(fallback)
        alert('Agent key is missing. I created a local draft, but AI screenshot reading requires the Railway agent key.')
        return
      }

      const response = await fetch(`${AGENT_API_URL}/analyze-intake`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          text: intakeText,
          imageDataUrl,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'AI intake analysis failed.')
      }

      setIntakeDraft(result.draft || result)
    } catch (error: any) {
      console.error(error)
      const fallback = localIntakeFallback(intakeText)
      setIntakeDraft(fallback)
      alert(`${error?.message || 'AI intake failed.'} I created a local draft instead.`)
    } finally {
      setIntakeAnalyzing(false)
    }
  }

  function applyIntakeDraftToNewRequest() {
    if (!intakeDraft) return

    const nextDescription = intakeDraft.description || intakeText || ''

    setRequesterName(intakeDraft.requesterName || requesterName || '')
    setEmail(intakeDraft.email || email || '')
    setPhone(intakeDraft.phone || phone || '')
    setWorkType(getBestWorkType(intakeDraft.workType || '', nextDescription))
    setPropertyAddress(intakeDraft.propertyAddress || '')
    setCity(intakeDraft.city || '')
    setStateValue(intakeDraft.state || '')
    setZip(intakeDraft.zip || '')
    setUrgency(intakeDraft.urgency || 'Standard')
    setOccupancy(intakeDraft.occupancy || 'Unknown')
    setTimeline(intakeDraft.timeline || '')
    setDescription(nextDescription)

    if (intakeScreenshotFile) {
      setPhotoFiles([intakeScreenshotFile])
    }

    setSuccessMessage('AI intake draft copied into the request form. Review it, add anything missing, then submit.')
    setActiveTab('new')
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      alert('Copied.')
    } catch {
      alert(value)
    }
  }

  async function pullPropertyInfo() {
    setPropertyLookupMessage('')
    setPropertyLookupStatus('idle')
    setPropertyLookupLoading(true)

    try {
      const facts = await lookupPropertyFacts(propertyAddress, city, stateValue, zip)
      const lookupStatus = facts.lookupStatus || (facts.source === 'api' ? 'data_found' : 'error')
      setPropertyFacts(facts)
      setPropertyType(facts.propertyType || propertyType)
      setJurisdiction(facts.jurisdiction || jurisdiction || propertyResearchPack.jurisdiction)
      setZoning(facts.zoning || zoning)
      setParcelNumber(facts.parcelNumber || parcelNumber)
      setVerificationNotes(facts.verificationNotes || verificationNotes)
      setPropertyLookupStatus(lookupStatus)
      setPropertyLookupMessage(
        lookupStatus === 'data_found'
          ? `data found — property info pulled with ${facts.confidence} confidence.`
          : `${propertyLookupStatusLabel(lookupStatus)} — ${facts.notes || 'Manual entry still works.'}`
      )
    } catch (error: any) {
      setPropertyLookupStatus('error')
      setPropertyLookupMessage(error?.message || 'Property lookup failed.')
    } finally {
      setPropertyLookupLoading(false)
    }
  }

  async function refreshLeadPropertyProfile(lead: WorkRequest, force = false) {
    if (!lead.id || !lead.propertyAddress.trim()) return
    if (!force && (propertyProfilesByLeadId[lead.id] || propertyProfileLoadingByLeadId[lead.id])) return

    const functionUrl = `${supabaseUrl}/functions/v1/property-lookup`
    const requestBody = {
      address_line_1: lead.propertyAddress,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      address1: lead.propertyAddress,
      address2: [lead.city, [lead.state, lead.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    }

    setPropertyProfileLoadingByLeadId((prev) => ({ ...prev, [lead.id]: true }))
    setPropertyProfileErrorsByLeadId((prev) => {
      const next = { ...prev }
      delete next[lead.id]
      return next
    })

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase frontend env vars are missing.')
      }

      console.info('[lead property-lookup] calling function', { leadId: lead.id, url: functionUrl })
      console.info('[lead property-lookup] request body', requestBody)
      console.info('[lead property-lookup] env', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      })

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(requestBody),
      })

      const responseText = await response.text()
      let data: any = null

      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch {
        data = null
      }

      console.info('[lead property-lookup] raw response', {
        leadId: lead.id,
        status: response.status,
        ok: response.ok,
        data,
        raw: responseText,
      })

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Function returned ${response.status}.`)
      }

      if (data?.status !== 'data_found' || !data?.property) {
        throw new Error(data?.message || 'Property lookup returned no data.')
      }

      const property = data.property
      setPropertyProfilesByLeadId((prev) => ({
        ...prev,
        [lead.id]: {
          beds: property.bedrooms || property.beds,
          baths: property.bathrooms || property.baths,
          sqft: property.squareFeet || property.sqft,
          yearBuilt: property.yearBuilt,
          propertyType: property.propertyType,
          jurisdiction: property.jurisdiction,
          parcelNumber: property.parcelNumber,
          raw: data,
        },
      }))
    } catch (error: any) {
      console.error('[lead property-lookup] failed', { leadId: lead.id, error })
      setPropertyProfileErrorsByLeadId((prev) => ({
        ...prev,
        [lead.id]: error?.message || 'Property lookup failed.',
      }))
    } finally {
      setPropertyProfileLoadingByLeadId((prev) => ({ ...prev, [lead.id]: false }))
    }
  }

  function getRequestLabel(leadId?: string | null) {
    if (!leadId) return 'No linked job yet'
    const request = requests.find((item) => item.id === leadId)
    if (!request) return leadId
    return request.propertyAddress || request.description.slice(0, 60) || leadId
  }

  function getLinkedRequest(leadId?: string | null) {
    return leadId ? requests.find((item) => item.id === leadId) || null : null
  }

  function titleizeMessageType(value?: string | null) {
    const normalized = (value || '').replace(/_/g, ' ').trim()
    if (!normalized) return 'Message Draft'
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function getMessagePurpose(log: MessageLog) {
    if (log.message_type === 'missing_info_request') return 'Missing Info Request'
    if (log.message_type === 'estimate_review_request') return 'Estimate Review Request'
    if (log.message_type === 'contractor_walkthrough_request') return 'Contractor Walkthrough Request'
    if (log.message_type === 'seller_summary_draft') return 'Seller Summary Draft'
    return titleizeMessageType(log.message_type)
  }

  function getMessageWorkflowState(log: MessageLog, request: WorkRequest | null) {
    if (log.status === 'sent') return 'Sent'
    if (log.message_type === 'missing_info_request' || request?.status === 'needs_info') return 'Needs Info'
    if (log.message_type === 'seller_summary_draft') return 'Seller Summary'
    if (log.message_type === 'contractor_walkthrough_request') return 'Contractor Review'
    return 'Estimate Draft'
  }

  function getMessagePreview(message: string) {
    const compact = message.replace(/\s+/g, ' ').trim()
    if (compact.length <= 180) return compact
    return `${compact.slice(0, 177)}...`
  }

  async function loadMessageCenter() {
    setMessageLoading(true)

    try {
      const [{ data: logs, error: logsError }, { data: missingRows, error: missingError }] = await Promise.all([
        supabase.from('message_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('missing_info_requests').select('*').order('created_at', { ascending: false }),
      ])

      if (logsError) throw logsError
      if (missingError) throw missingError

      setMessageLogs((logs || []) as MessageLog[])
      setMissingInfoRequests((missingRows || []) as MissingInfoRequest[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load message center. Make sure message_logs and missing_info_requests tables exist.')
    } finally {
      setMessageLoading(false)
    }
  }

  function getMissingInfoItems(request: WorkRequest) {
    const text = [request.workType, request.description, request.timeline, request.urgency].join(' ').toLowerCase()
    const items: string[] = []

    if (!request.propertyAddress || !request.city || !request.state || !request.zip) items.push('property address')
    if (request.photos.length === 0 && !text.includes('photo') && !text.includes('picture')) items.push('photos')
    if (!request.timeline && !text.includes('deadline') && !text.includes('asap') && !text.includes('urgent')) items.push('deadline')
    if ((text.includes('inspection') || text.includes('buyer') || text.includes('seller') || text.includes('roof')) && !text.includes('report')) {
      items.push('inspection report')
    }
    if (!text.includes('access') && !text.includes('lockbox') && !text.includes('vacant') && !text.includes('occupied')) {
      items.push('access instructions')
    }
    if (!request.description || request.description.trim().length < 35) items.push('scope clarity')

    return [...new Set(items)]
  }

  function buildMissingInfoMessage(request: WorkRequest, missingItems: string[]) {
    const greeting = request.requesterName ? `Hi ${request.requesterName},` : 'Hi,'
    const scope = request.workType ? request.workType.toLowerCase() : 'work'
    const needed = missingItems.length
      ? missingItems.join(', ')
      : 'any photos, deadline, access instructions, and inspection notes'

    return `${greeting} thanks — I have the ${scope} request started for ${
      request.propertyAddress || 'the property'
    }. Please send ${needed} so we can prepare a more accurate estimate. I’ll review it before any proposal or estimate is sent.`
  }

  async function saveIntakeReplyDraft() {
    if (!intakeDraft?.suggestedReply) {
      alert('Analyze an intake message first so there is a reply draft to save.')
      return
    }

    setMessageSavingId('intake-draft')

    try {
      const { error } = await supabase.from('message_logs').insert({
        lead_id: null,
        direction: 'outbound',
        channel: 'manual',
        recipient_name: intakeDraft.requesterName || '',
        recipient_email: intakeDraft.email || '',
        recipient_phone: intakeDraft.phone || '',
        message_type: 'missing_info_request',
        message_body: intakeDraft.suggestedReply,
        ai_generated: true,
        auto_sent: false,
        human_reviewed: false,
        human_approved: false,
        status: 'draft',
        notes: `Saved from AI Intake. Missing info: ${(intakeDraft.missingInfo || []).join(', ') || 'not listed'}`,
      })

      if (error) throw error

      await loadMessageCenter()
      alert('Reply draft saved to Message Center.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save reply draft.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function generateMissingInfoRequest(request: WorkRequest) {
    const missingItems = getMissingInfoItems(request)
    const messageBody = buildMissingInfoMessage(request, missingItems)

    setMessageSavingId(request.id)

    try {
      await ensureLeadExists(request)

      const missingPayload = {
        lead_id: request.id,
        missing_address: missingItems.includes('property address'),
        missing_photos: missingItems.includes('photos'),
        missing_inspection_report: missingItems.includes('inspection report'),
        missing_deadline: missingItems.includes('deadline'),
        missing_access_info: missingItems.includes('access instructions'),
        missing_scope_clarity: missingItems.includes('scope clarity'),
        generated_message: messageBody,
        status: 'draft',
        auto_send_allowed: missingItems.length > 0 && missingItems.every((item) =>
          ['property address', 'photos', 'inspection report', 'deadline', 'access instructions', 'scope clarity'].includes(item)
        ),
        human_reviewed: false,
      }

      const { error: missingError } = await supabase
        .from('missing_info_requests')
        .insert(missingPayload)

      if (missingError) throw missingError

      const { error: logError } = await supabase.from('message_logs').insert({
        lead_id: request.id,
        direction: 'outbound',
        channel: 'manual',
        recipient_name: request.requesterName,
        recipient_email: request.email,
        recipient_phone: request.phone,
        message_type: 'missing_info_request',
        message_body: messageBody,
        ai_generated: true,
        auto_sent: false,
        human_reviewed: false,
        human_approved: false,
        status: 'draft',
        notes: `Missing info requested: ${missingItems.join(', ') || 'general clarification'}`,
      })

      if (logError) throw logError

      if (missingItems.length > 0) {
        updateStatus(request.id, 'needs_info')
        await supabase.from('leads').update({ status: 'needs_info' }).eq('id', request.id)
      }

      await loadMessageCenter()
      setActiveTab('messages')
      alert('Missing-info request draft created. Review before sending.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not create missing-info request.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function sendMessageEmail(log: MessageLog) {
    if (!log.recipient_email) {
      alert('This message does not have a recipient email. Add an email to the linked request first.')
      return
    }

    if (!confirm(`Send this message by email to ${log.recipient_email}?`)) return

    setMessageSavingId(log.id)

    try {
      const response = await fetch(`${AGENT_API_URL}/send-message-email`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          messageLogId: log.id,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'Email failed to send.')
      }

      await loadMessageCenter()
      alert('Email sent and message log updated.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not send email.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function markMessageLog(log: MessageLog, nextStatus: 'draft' | 'approved' | 'sent') {
    setMessageSavingId(log.id)

    try {
      const patch: Partial<MessageLog> = {
        status: nextStatus,
        human_reviewed: nextStatus === 'approved' || nextStatus === 'sent',
        human_approved: nextStatus === 'approved' || nextStatus === 'sent',
        auto_sent: false,
      }

      const { error } = await supabase.from('message_logs').update(patch).eq('id', log.id)

      if (error) throw error

      await loadMessageCenter()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update message log.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function loadRequestsFromSupabase(autoInterpretEvidence = false) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = await attachFilesToRequests((data || []).map(mapLeadRowToWorkRequest))
      setRequests(mapped)
      if (autoInterpretEvidence && hasAdminConsoleAccess) {
        void autoInterpretEvidenceForRequests(mapped)
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load requests from Supabase.')
    }
  }

  async function autoInterpretEvidenceForRequests(items: WorkRequest[]) {
    for (const request of items) {
      const files = getUniqueUploadedFiles(request)
      if (!files.length) continue

      const hasCurrentWorkGroups = getInspectionWorkGroups(request).length > 0
      const hasCurrentInterpretation = hasCurrentWorkGroups || Boolean(request.inspectionIntelligence?.repairItems?.length)
      if (!hasCurrentInterpretation) {
        await runFirstPassEvidenceInterpretation(request, files)
      }

      for (const file of files) {
        const mode = isPdfEvidence(file) ? 'full_pdf' : isImageEvidence(file) ? 'image' : 'file'
        const key = getEvidenceKey(file, mode)
        if (evidenceInspectionStatusByKey[key]) continue
        if (getEvidenceFindingsForFile(request, file).length > 0) continue
        setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [key]: 'queued_for_interpretation' }))
        await inspectEvidenceFile(request, file, mode)
      }
    }
  }

  async function loadArchivedRequestsFromSupabase() {
    setArchivedLoading(true)
  
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('archived', true)
        .order('archived_at', { ascending: false })
  
      if (error) {
        console.error('Archived leads load error:', error)
        setArchivedRequests([])
        return
      }
  
      const mapped = await attachFilesToRequests((data || []).map(mapLeadRowToWorkRequest))
      setArchivedRequests(mapped)
    } catch (error: any) {
      console.error('Archived leads fetch failed:', error)
      setArchivedRequests([])
    } finally {
      setArchivedLoading(false)
    }
  }

  async function restoreArchivedLead(request: WorkRequest) {
    const confirmed = window.confirm(
      `Restore this archived lead?\n\n${request.propertyAddress || 'Untitled lead'}\n\nIt will return to the active Dashboard.`
    )

    if (!confirmed) return

    setRestoringId(request.id)

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          archived: false,
          archived_at: null,
          archive_reason: null,
        })
        .eq('id', request.id)

      if (error) throw error

      setArchivedRequests((prev) => prev.filter((item) => item.id !== request.id))
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not restore archived lead.')
      await loadArchivedRequestsFromSupabase()
    } finally {
      setRestoringId(null)
    }
  }

  async function uploadRequestFiles(
    files: File[],
    folder: 'photos' | 'documents',
    type: 'photo' | 'document',
    leadId?: string
  ) {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const path = `${folder}/${leadId || 'unlinked'}/${Date.now()}-${safeFileName(file.name)}`

      const { error } = await supabase.storage
        .from(REQUEST_FILES_BUCKET)
        .upload(path, file)

      if (error) throw error

      const { data: publicUrlData } = supabase.storage
        .from(REQUEST_FILES_BUCKET)
        .getPublicUrl(path)

      if (leadId) {
        const { data: fileRow, error: fileInsertError } = await supabase
          .from('files')
          .insert({
            lead_id: leadId,
            file_url: publicUrlData.publicUrl,
            file_name: file.name,
            storage_bucket: REQUEST_FILES_BUCKET,
            storage_path: path,
            file_type: type,
            mime_type: file.type || null,
            file_size: file.size,
          })
          .select('id, created_at, file_name, file_url, storage_bucket, storage_path, file_type, mime_type, file_size')
          .single()

        if (fileInsertError) {
          console.warn('File uploaded, but file database row was not saved:', fileInsertError)
        }

        if (fileRow?.id) {
          const savedFile = mapFileRowToStoredFile(fileRow)
          const [hydratedFile] = await attachPreviewUrls([savedFile])
          uploaded.push(hydratedFile)
          continue
        }
      }

      const fallbackFile: StoredFile = {
        name: file.name,
        path,
        url: publicUrlData.publicUrl,
        bucket: REQUEST_FILES_BUCKET,
        type,
        createdAt: new Date().toISOString(),
        source: 'local',
      }

      const [hydratedFallback] = await attachPreviewUrls([fallbackFile])
      uploaded.push({
        ...fallbackFile,
        previewUrl: hydratedFallback.previewUrl,
      })
    }

    return uploaded
  }

  async function createRequestFileUrl(file: StoredFile, download = false) {
    return resolveStoredFileUrl(file, download)
  }

  async function openRequestFile(file: StoredFile, download = false) {
    try {
      const signedUrl = await createRequestFileUrl(file, download)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error(error)
      alert('Could not open file. Check Supabase storage bucket/policies.')
    }
  }

  async function ensureRequestProperty(
    leadId: string,
    address: string,
    cityValue: string,
    stateCode: string,
    zipCode: string
  ) {
    if (!leadId || !address.trim()) return null

    const { data, error } = await supabase.rpc('upsert_property_for_lead', {
      p_lead_id: leadId,
      p_address: address.trim(),
      p_city: cityValue.trim(),
      p_state: stateCode.trim(),
      p_zip: zipCode.trim(),
    })

    if (error) {
      console.warn('Property record could not be linked. Run the dependable request foundation migration.', error)
      return null
    }

    return data as string | number | null
  }

  async function savePhotoFieldMemory(request: WorkRequest, file: StoredFile) {
    const photoDescription = window.prompt('What did you verify from this photo or field note?', file.name)
    if (!photoDescription?.trim()) return

    const fieldConsequence = window.prompt('What should future estimates remember from this?', 'Include access, protection, cleanup, or hidden labor if similar.')
    if (!fieldConsequence?.trim()) return

    const requiredLineItems = window
      .prompt('Required line items to remember? Separate with commas.', '')
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) || []
    const riskFlags = window
      .prompt('Risk flags to remember? Separate with commas.', '')
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) || []

    const record = {
      property_id: getRequestPropertyId(request),
      work_request_id: request.id,
      file_id: file.id || file.path || file.name,
      photo_description: photoDescription.trim(),
      trade_category: request.workType || 'General repair',
      work_phase: 'field_review',
      equipment_seen: '',
      field_consequence: fieldConsequence.trim(),
      estimate_impact: fieldConsequence.trim(),
      required_line_items: requiredLineItems,
      risk_flags: riskFlags,
      human_verified: true,
      follow_up_lesson: fieldConsequence.trim(),
      reviewed_at: new Date().toISOString(),
    }

    try {
      const { error } = await supabase.from('photo_field_memory').insert(record)
      if (error) throw error
      alert('Saved as verified field memory.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save field memory. Run the human-verified learning migration first.')
    }
  }

  function getSiteMediaSourceFileLabel(request: WorkRequest, sourceFileId?: string | null) {
    if (!sourceFileId) return 'Manual / no file linked'
    const file = [...request.photos, ...request.documents].find((item) => item.id === sourceFileId)
    return file?.name || 'Uploaded file'
  }

  function getApprovedSiteMediaFindings(request: WorkRequest | null | undefined) {
    if (!request) return []
    return (siteMediaFindingsByRequest[request.id] || []).filter((finding) =>
      isHumanVerifiedStatus(finding.review_status)
    )
  }

  async function loadSiteMediaIntelligence(request: WorkRequest, quiet = true) {
    if (!request.id) return
    setSiteMediaLoadingByRequest((prev) => ({ ...prev, [request.id]: true }))

    try {
      const [{ data: analysisData, error: analysisError }, { data: findingData, error: findingError }] = await Promise.all([
        supabase
          .from('property_media_analysis')
          .select('*')
          .eq('lead_id', request.id)
          .order('analyzed_at', { ascending: false }),
        supabase
          .from('property_media_findings')
          .select('*')
          .eq('lead_id', request.id)
          .order('created_at', { ascending: false }),
      ])

      if (analysisError) throw analysisError
      if (findingError) throw findingError

      setSiteMediaAnalysesByRequest((prev) => ({
        ...prev,
        [request.id]: (analysisData || []) as PropertyMediaAnalysis[],
      }))
      setSiteMediaFindingsByRequest((prev) => ({
        ...prev,
        [request.id]: (findingData || []) as PropertyMediaFinding[],
      }))

      const findingIds = (findingData || []).map((finding: any) => finding.id).filter(Boolean)
      if (findingIds.length) {
        await loadAgentResearchTasksForFindings(findingIds)
      }
      await loadAgentResearchTasksForRequest(request.id)
    } catch (error: any) {
      console.warn('Site media intelligence could not be loaded.', error)
      if (!quiet) alert(error?.message || 'Could not load Site Media Intelligence. Run the migration first.')
      setSiteMediaAnalysesByRequest((prev) => ({ ...prev, [request.id]: prev[request.id] || [] }))
      setSiteMediaFindingsByRequest((prev) => ({ ...prev, [request.id]: prev[request.id] || [] }))
    } finally {
      setSiteMediaLoadingByRequest((prev) => ({ ...prev, [request.id]: false }))
    }
  }

  async function ensureSiteMediaAnalysis(request: WorkRequest, file?: StoredFile | null) {
    const sourceFileId = asNullableUuid(file?.id || '')
    const existing = (siteMediaAnalysesByRequest[request.id] || []).find((analysis) =>
      sourceFileId ? analysis.source_file_id === sourceFileId : !analysis.source_file_id
    )
    if (existing) return existing

    const record = {
      property_id: getLinkedPropertyId(request),
      lead_id: asNullableUuid(request.id),
      source_type: file?.type === 'document' ? 'other' : 'uploaded_photo',
      source_url: file?.url || null,
      source_file_id: sourceFileId,
      missing_info: 'Needs human verification.',
      confidence: 'low' as PropertyMediaConfidence,
      review_status: 'ai_draft' as PropertyMediaReviewStatus,
      admin_notes: 'Created from uploaded property media. No outside image source used.',
    }

    const { data, error } = await supabase
      .from('property_media_analysis')
      .insert(record)
      .select()
      .single()

    if (error) throw error

    const saved = data as PropertyMediaAnalysis
    setSiteMediaAnalysesByRequest((prev) => ({
      ...prev,
      [request.id]: [saved, ...(prev[request.id] || [])],
    }))
    return saved
  }

  function updateLocalSiteMediaFinding(id: string, changes: Partial<PropertyMediaFinding>) {
    setSiteMediaFindingsByRequest((prev) => {
      const next: Record<string, PropertyMediaFinding[]> = {}
      Object.entries(prev).forEach(([requestId, findings]) => {
        next[requestId] = findings.map((finding) =>
          finding.id === id ? { ...finding, ...changes } : finding
        )
      })
      return next
    })
  }

  function getAgentResearchDraft(finding: PropertyMediaFinding): AgentResearchQuestionDraft {
    const existing = agentResearchDraftsByFinding[finding.id]
    if (existing) return existing

    const sprinklerQuestion = 'Verify whether this sprinkler/fire protection item refers to a unit-level system, whole-building system, missing sprinkler heads, inspection requirement, or documentation issue.'
    const isSprinkler = /sprinkler|fire protection|fire suppression/i.test(`${finding.observation} ${finding.safety_notes} ${finding.admin_notes}`)

    return {
      question: isSprinkler ? sprinklerQuestion : '',
      question_type: isSprinkler ? 'permit / inspection' : 'missing info',
      research_scope: 'Uploaded files + property data',
      research_categories: getSourceResearchDefaults(isSprinkler ? 'permit / inspection' : 'missing info', `${finding.observation} ${finding.safety_notes} ${finding.admin_notes}`),
    }
  }

  function updateAgentResearchDraft(findingId: string, changes: Partial<AgentResearchQuestionDraft>) {
    setAgentResearchDraftsByFinding((prev) => ({
      ...prev,
      [findingId]: {
        question: prev[findingId]?.question || '',
        question_type: prev[findingId]?.question_type || 'missing info',
        research_scope: prev[findingId]?.research_scope || 'Uploaded files + property data',
        research_categories: prev[findingId]?.research_categories || ['Property history'],
        ...changes,
      },
    }))
  }

  function getNoteResearchDraft(note: AdminNote): SourceResearchSetupDraft {
    return noteResearchDraftsByNote[note.id] || {
      question: note.body,
      question_type: 'property-specific',
      research_scope: 'Uploaded files + property data',
      research_categories: getSourceResearchDefaults('property-specific', note.body),
    }
  }

  function openNoteResearchSetup(note: AdminNote) {
    setNoteResearchDraftsByNote((prev) => ({
      ...prev,
      [note.id]: prev[note.id] || {
        question: note.body,
        question_type: 'property-specific',
        research_scope: 'Uploaded files + property data',
        research_categories: getSourceResearchDefaults('property-specific', note.body),
      },
    }))
    setOpenNoteResearchByNote((prev) => ({ ...prev, [note.id]: true }))
  }

  function updateNoteResearchDraft(noteId: string, changes: Partial<SourceResearchSetupDraft>) {
    setNoteResearchDraftsByNote((prev) => ({
      ...prev,
      [noteId]: {
        question: prev[noteId]?.question || '',
        question_type: prev[noteId]?.question_type || 'property-specific',
        research_scope: prev[noteId]?.research_scope || 'Uploaded files + property data',
        research_categories: prev[noteId]?.research_categories || ['Property history'],
        ...changes,
      },
    }))
  }

  function setSourceResearchMessage(requestId: string, message: string) {
    console.info('[Source Research Agent]', message)
    setSourceResearchMessagesByRequest((prev) => ({ ...prev, [requestId]: message }))
  }

  async function loadAgentResearchTasksForFindings(findingIds: string[]) {
    if (!findingIds.length) return

    try {
      const { data: tasks, error } = await supabase
        .from('agent_research_tasks')
        .select('*')
        .in('finding_id', findingIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const taskRows = (tasks || []) as AgentResearchTask[]
      const taskIds = taskRows.map((task) => task.id).filter(Boolean)
      let sourceRows: AgentResearchSource[] = []

      if (taskIds.length) {
        const { data: sources, error: sourceError } = await supabase
          .from('agent_research_sources')
          .select('*')
          .in('research_task_id', taskIds)
          .order('created_at', { ascending: false })

        if (sourceError) throw sourceError
        sourceRows = (sources || []) as AgentResearchSource[]
      }

      setAgentResearchTasksByFinding((prev) => {
        const next = { ...prev }
        findingIds.forEach((findingId) => {
          next[findingId] = taskRows.filter((task) => task.finding_id === findingId)
        })
        return next
      })

      setAgentResearchSourcesByTask((prev) => {
        const next = { ...prev }
        taskIds.forEach((taskId) => {
          next[taskId] = sourceRows.filter((source) => source.research_task_id === taskId)
        })
        return next
      })
    } catch (error) {
      console.warn('Agent research tasks could not be loaded. Run the Agent Research Tasks migration.', error)
    }
  }

  async function loadAgentResearchTasksForRequest(requestId: string) {
    if (!requestId) return

    try {
      const { data: tasks, error } = await supabase
        .from('agent_research_tasks')
        .select('*')
        .eq('lead_id', requestId)
        .is('finding_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const taskRows = (tasks || []) as AgentResearchTask[]
      if (!taskRows.length) {
        setSourceResearchMessage(requestId, 'No source research tasks fetched for this request yet.')
      }
      const taskIds = taskRows.map((task) => task.id).filter(Boolean)
      let sourceRows: AgentResearchSource[] = []

      if (taskIds.length) {
        const { data: sources, error: sourceError } = await supabase
          .from('agent_research_sources')
          .select('*')
          .in('research_task_id', taskIds)
          .order('created_at', { ascending: false })

        if (sourceError) throw sourceError
        sourceRows = (sources || []) as AgentResearchSource[]
      }

      setAgentResearchTasksByRequest((prev) => ({ ...prev, [requestId]: taskRows }))
      setAgentResearchSourcesByTask((prev) => {
        const next = { ...prev }
        taskIds.forEach((taskId) => {
          next[taskId] = sourceRows.filter((source) => source.research_task_id === taskId)
        })
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request-level source research tasks could not be loaded.'
      console.warn('Request-level source research tasks could not be loaded. Run the Agent Research Tasks migration.', error)
      setSourceResearchMessage(requestId, `Task fetch error: ${message}`)
    }
  }

  async function addAgentResearchTask(request: WorkRequest, finding: PropertyMediaFinding) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to add research questions.')
      return
    }

    const draft = getAgentResearchDraft(finding)
    if (!draft.question.trim()) {
      alert('Add a research question first.')
      return
    }

    setAgentResearchSavingId(`new-${finding.id}`)
    try {
      const record = {
        property_id: getLinkedPropertyId(request),
        lead_id: asNullableUuid(request.id),
        finding_id: finding.id,
        question: draft.question.trim(),
        question_type: draft.question_type,
        research_scope: draft.research_scope,
        research_categories: normalizeResearchCategories(draft.research_categories, getSourceResearchDefaults(draft.question_type, draft.question)),
        status: 'queued' as AgentResearchTaskStatus,
        confidence: 'low' as PropertyMediaConfidence,
        missing_information: 'Run research to draft an answer from uploaded files and property context.',
        recommended_next_action: 'Run Research, then review the draft answer before using it.',
        online_search_requested: researchCategoriesRequestOnline(normalizeResearchCategories(draft.research_categories), draft.research_scope),
        online_search_performed: false,
        internal_memory_used: false,
        official_sources_used: false,
        supplier_sources_used: false,
        source_quality: getPrimarySourceQuality(normalizeResearchCategories(draft.research_categories, getSourceResearchDefaults(draft.question_type, draft.question))),
        answer_status: 'needs_review',
        source_priority: 'linked media finding -> uploaded files -> property record -> admin notes',
        verified_for_memory: false,
        created_by: currentUserId,
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .insert(record)
        .select()
        .single()

      if (error) throw error

      const saved = data as AgentResearchTask
      setAgentResearchTasksByFinding((prev) => ({
        ...prev,
        [finding.id]: [saved, ...(prev[finding.id] || [])],
      }))
      setAgentResearchDraftsByFinding((prev) => ({ ...prev, [finding.id]: { ...draft, question: '' } }))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save research question. Run the Agent Research Tasks migration first.')
    } finally {
      setAgentResearchSavingId(null)
    }
  }

  async function addEvidenceResearchTask(request: WorkRequest, file: StoredFile) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to add research questions.')
      return
    }

    const draft = getEvidenceResearchDraft(file)
    if (!draft.question.trim()) {
      alert('Add a research question first.')
      return
    }

    const key = getEvidenceKey(file)
    setAgentResearchSavingId(`evidence-${key}`)
    try {
      const record = {
        property_id: getLinkedPropertyId(request),
        lead_id: asNullableUuid(request.id),
        finding_id: null,
        source_file_id: asNullableUuid(file.id || ''),
        evidence_id: file.id || file.path || file.name,
        question: draft.question.trim(),
        question_type: draft.question_type,
        research_scope: draft.research_scope,
        research_categories: normalizeResearchCategories(draft.research_categories, getSourceResearchDefaults(draft.question_type, draft.question)),
        status: 'queued' as AgentResearchTaskStatus,
        confidence: 'low' as PropertyMediaConfidence,
        missing_information: 'Run research to draft an answer from this linked evidence file/page/image.',
        recommended_next_action: 'Inspect the linked evidence first, then run research and review the draft answer.',
        online_search_requested: researchCategoriesRequestOnline(normalizeResearchCategories(draft.research_categories), draft.research_scope),
        online_search_performed: false,
        internal_memory_used: false,
        official_sources_used: false,
        supplier_sources_used: false,
        source_quality: getPrimarySourceQuality(normalizeResearchCategories(draft.research_categories, getSourceResearchDefaults(draft.question_type, draft.question))),
        answer_status: 'needs_review',
        source_priority: 'linked evidence item -> extracted text -> related uploaded files -> property record -> admin notes',
        verified_for_memory: false,
        created_by: currentUserId,
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      const saved = data as AgentResearchTask
      setAgentResearchTasksByRequest((prev) => ({
        ...prev,
        [request.id]: [saved, ...(prev[request.id] || [])],
      }))
      setEvidenceResearchDraftsByKey((prev) => ({ ...prev, [key]: { ...draft, question: '', research_categories: ['Property history'] } }))
      alert('Research question saved. It is linked to this evidence file.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save evidence research question. Run the Agent Research Tasks migration first.')
    } finally {
      setAgentResearchSavingId(null)
    }
  }

  function getResearchContextEvidence(request: WorkRequest, finding: PropertyMediaFinding, task: AgentResearchTask) {
    const lowerQuestion = task.question.toLowerCase()
    const uploadedMatches = [...request.documents, ...request.photos]
      .filter((file) => lowerQuestion.split(/\s+/).some((word) => word.length > 4 && file.name.toLowerCase().includes(word)))
      .slice(0, 4)
    const propertyBits = [
      request.propertyAddress,
      request.propertyFacts?.jurisdiction ? `Jurisdiction: ${request.propertyFacts.jurisdiction}` : '',
      request.propertyFacts?.propertyType ? `Property type: ${request.propertyFacts.propertyType}` : '',
      request.propertyFacts?.yearBuilt ? `Year built: ${request.propertyFacts.yearBuilt}` : '',
      request.inspectionExtractionSummary,
    ].filter(Boolean)
    const adminBits = [
      finding.observation,
      finding.safety_notes,
      finding.access_notes,
      finding.admin_notes,
      ...(request.adminNotes || []).map((note) => `${note.noteType}: ${note.body}`),
    ].filter(Boolean)

    return { uploadedMatches, propertyBits, adminBits }
  }

  function buildAgentResearchDraftAnswer(request: WorkRequest, finding: PropertyMediaFinding, task: AgentResearchTask) {
    const { uploadedMatches, propertyBits, adminBits } = getResearchContextEvidence(request, finding, task)
    const allowsProperty = !['Uploaded files only', 'Uploaded evidence only'].includes(task.research_scope)
    const categories = normalizeResearchCategories(task.research_categories, getSourceResearchDefaults(task.question_type, task.question))
    const allowsOnline = researchCategoriesRequestOnline(categories, task.research_scope)
    const requestsInternalMemory = categories.includes('Internal Shelter Prep memory') || categories.includes('Property history') || task.research_scope === 'Shelter Prep memory' || task.research_scope === 'Property database'
    const internalMemoryUsed = allowsProperty && requestsInternalMemory && (propertyBits.length > 0 || adminBits.length > 0)
    const officialSourcesRequested = categories.some((category) => ['Building code / jurisdiction', 'Safety guidance', 'Permit / inspection requirements'].includes(category))
    const supplierSourcesRequested = categories.some((category) => ['Parts / materials', 'Product / manufacturer documentation', 'Supplier references'].includes(category))
    const sourceQuality = getPrimarySourceQuality(categories)
    const isSprinkler = /sprinkler|fire protection|fire suppression/i.test(`${task.question} ${finding.observation} ${finding.safety_notes}`)
    const evidenceParts = [
      uploadedMatches.length ? `Uploaded evidence names reviewed: ${uploadedMatches.map((file) => file.name).join(', ')}.` : '',
      adminBits.length ? `Finding/admin context: ${adminBits.slice(0, 3).join(' ')}` : '',
      allowsProperty && propertyBits.length ? `Property context: ${propertyBits.join(' ')}` : '',
    ].filter(Boolean)

    const missingInfo = isSprinkler
      ? 'Confirm sprinkler head count, locations, system ownership/control, fire panel or inspection tags, and whether the report shows missing, painted, obstructed, or sealed heads.'
      : 'Confirm exact location, quantity, source page/photo, and whether a contractor or jurisdiction reviewer has verified the condition.'
    const onlineGuardrail = allowsOnline
      ? 'Online research was requested, but no live source search has been performed yet. This draft uses uploaded/property/admin-note context only.'
      : 'Online resources were not used because this task scope does not allow them.'
    const requestedSources = categories.length ? `Requested source categories: ${categories.join(', ')}.` : ''

    return {
      answer: isSprinkler
        ? `Draft answer: current uploaded/property context is not enough to determine whether this is a unit-level sprinkler system, whole-building system, missing-head issue, inspection requirement, or documentation issue. Treat it as a fire protection documentation/safety question until close-up photos, head count, tags, and panel/system context are reviewed. ${onlineGuardrail}`
        : `Draft answer: the available uploaded evidence and property context identify a review question, but they do not provide enough verified detail for a final answer. ${onlineGuardrail}`,
      confidence: evidenceParts.length >= 2 ? 'medium' as PropertyMediaConfidence : 'low' as PropertyMediaConfidence,
      evidenceSummary: [requestedSources, ...evidenceParts].filter(Boolean).join(' ') || 'No strong evidence found in uploaded files, media findings, property facts, or admin notes.',
      missingInformation: missingInfo,
      recommendedNextAction: isSprinkler
        ? 'Ask for close-up photos of every sprinkler head, wide ceiling/room photos, head count, fire inspection tags, and fire panel/system photos; route to Fire Marshal or licensed fire suppression specialist before final guidance.'
        : `Gather missing evidence and route to the right trade/admin reviewer. ${onlineGuardrail}`,
      onlineSearchRequested: allowsOnline,
      onlineSearchPerformed: false,
      internalMemoryUsed,
      officialSourcesUsed: false,
      supplierSourcesUsed: false,
      sourceQuality,
      sourcePriority: [
        'linked evidence item',
        'extracted text from that evidence',
        'related uploaded files',
        'full property record',
        'admin notes',
        'prior verified findings',
        'Shelter Prep memory',
        allowsOnline ? 'official/primary online sources allowed but not performed in this local draft' : 'online sources not allowed',
      ].join(' -> '),
      sources: [
        ...uploadedMatches.map((file): Omit<AgentResearchSource, 'id' | 'research_task_id' | 'created_at'> => ({
          source_title: file.name,
          source_url: file.url || null,
          source_type: 'uploaded_file',
          source_category: 'Property history',
          source_quality: 'unknown',
          source_publisher: null,
          source_excerpt: `Uploaded ${file.type} attached to this request.`,
          source_date_accessed: new Date().toISOString(),
          relevance_note: 'Linked uploaded evidence was searched before external sources.',
          excerpt: `Uploaded ${file.type} attached to this request.`,
          confidence: 'medium',
        })),
        ...(allowsProperty && propertyBits.length ? [{
          source_title: 'Property/request record',
          source_url: null,
          source_type: 'property_record' as AgentResearchSourceType,
          source_category: 'Property history' as AgentResearchCategory,
          source_quality: 'internal_memory' as AgentResearchSourceQuality,
          source_publisher: 'Shelter Prep',
          source_excerpt: propertyBits.join(' '),
          source_date_accessed: new Date().toISOString(),
          relevance_note: 'Property facts were used as internal context.',
          excerpt: propertyBits.join(' '),
          confidence: 'medium' as PropertyMediaConfidence,
        }] : []),
        ...(adminBits.length ? [{
          source_title: 'Media finding and admin notes',
          source_url: null,
          source_type: 'manual' as AgentResearchSourceType,
          source_category: 'Property history' as AgentResearchCategory,
          source_quality: 'internal_memory' as AgentResearchSourceQuality,
          source_publisher: 'Shelter Prep',
          source_excerpt: adminBits.slice(0, 4).join(' '),
          source_date_accessed: new Date().toISOString(),
          relevance_note: 'Admin notes and finding text were used as human-entered context.',
          excerpt: adminBits.slice(0, 4).join(' '),
          confidence: 'medium' as PropertyMediaConfidence,
        }] : []),
      ],
    }
  }

  function updateLocalAgentResearchTask(taskId: string, changes: Partial<AgentResearchTask>) {
    setAgentResearchTasksByFinding((prev) => {
      const next: Record<string, AgentResearchTask[]> = {}
      Object.entries(prev).forEach(([findingId, tasks]) => {
        next[findingId] = tasks.map((task) => task.id === taskId ? { ...task, ...changes } : task)
      })
      return next
    })
    setAgentResearchTasksByRequest((prev) => {
      const next: Record<string, AgentResearchTask[]> = {}
      Object.entries(prev).forEach(([requestId, tasks]) => {
        next[requestId] = tasks.map((task) => task.id === taskId ? { ...task, ...changes } : task)
      })
      return next
    })
  }

  async function runAgentResearchTask(request: WorkRequest, finding: PropertyMediaFinding, task: AgentResearchTask) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to run research.')
      return
    }

    setAgentResearchSavingId(task.id)
    updateLocalAgentResearchTask(task.id, { status: 'researching' })

    try {
      const draft = buildAgentResearchDraftAnswer(request, finding, task)
      const patch = {
        status: 'needs_review' as AgentResearchTaskStatus,
        answer_draft: draft.answer,
        confidence: draft.confidence,
        evidence_summary: draft.evidenceSummary,
        missing_information: draft.missingInformation,
        recommended_next_action: draft.recommendedNextAction,
        research_categories: normalizeResearchCategories(task.research_categories, getSourceResearchDefaults(task.question_type, task.question)),
        online_search_requested: draft.onlineSearchRequested,
        online_search_performed: draft.onlineSearchPerformed,
        internal_memory_used: draft.internalMemoryUsed,
        official_sources_used: draft.officialSourcesUsed,
        supplier_sources_used: draft.supplierSourcesUsed,
        source_quality: draft.sourceQuality,
        answer_status: 'needs_review',
        source_priority: draft.sourcePriority,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .update(patch)
        .eq('id', task.id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('agent_research_sources').delete().eq('research_task_id', task.id)
      const sourceRows = draft.sources.map((source) => ({
        research_task_id: task.id,
        ...source,
      }))
      let savedSources: AgentResearchSource[] = []
      if (sourceRows.length) {
        const { data: sources, error: sourceError } = await supabase
          .from('agent_research_sources')
          .insert(sourceRows)
          .select()

        if (sourceError) throw sourceError
        savedSources = (sources || []) as AgentResearchSource[]
      }

      updateLocalAgentResearchTask(task.id, data as AgentResearchTask)
      setAgentResearchSourcesByTask((prev) => ({ ...prev, [task.id]: savedSources }))
    } catch (error: any) {
      console.error(error)
      updateLocalAgentResearchTask(task.id, { status: 'draft' })
      alert(error?.message || 'Could not run research.')
    } finally {
      setAgentResearchSavingId(null)
    }
  }

  async function markFindingNeedsMoreInfo(request: WorkRequest, finding: PropertyMediaFinding) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to request research.')
      return
    }

    const prompt = window.prompt('What should the agent try to find?', 'Find the missing evidence needed to verify this finding.')
    if (!prompt?.trim()) return

    const scopeInput = window.prompt(
      'Research scope: Uploaded evidence only, Property database, Shelter Prep memory, Official/code resources, Supplier/material resources, or General web allowed',
      'Uploaded evidence only'
    ) || 'Uploaded evidence only'
    const scope = AGENT_RESEARCH_SCOPES.includes(scopeInput as AgentResearchScope)
      ? scopeInput as AgentResearchScope
      : 'Uploaded evidence only'
    const categories = getSourceResearchDefaults('missing info', `${prompt} ${finding.observation} ${finding.safety_notes}`)

    setSiteMediaSavingId(finding.id)
    try {
      await saveSiteMediaFinding(finding, { review_status: 'needs_more_info' })
      const record = {
        property_id: getLinkedPropertyId(request),
        lead_id: asNullableUuid(request.id),
        finding_id: finding.id,
        source_file_id: asNullableUuid(finding.source_file_id || ''),
        question: prompt.trim(),
        question_type: 'missing info' as AgentResearchQuestionType,
        research_scope: scope,
        research_categories: categories,
        status: 'queued' as AgentResearchTaskStatus,
        confidence: 'low' as PropertyMediaConfidence,
        needs_more_info_prompt: prompt.trim(),
        missing_information: prompt.trim(),
        recommended_next_action: 'Run Research, then review the draft answer and sources before using it.',
        online_search_requested: researchCategoriesRequestOnline(categories, scope),
        online_search_performed: false,
        internal_memory_used: false,
        official_sources_used: false,
        supplier_sources_used: false,
        source_quality: getPrimarySourceQuality(categories),
        answer_status: 'needs_review',
        source_priority: 'linked evidence item -> extracted text -> related uploaded files -> property record -> admin notes -> verified internal memory -> allowed official/online sources',
        verified_for_memory: false,
        created_by: currentUserId,
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      const saved = data as AgentResearchTask
      setAgentResearchTasksByFinding((prev) => ({
        ...prev,
        [finding.id]: [saved, ...(prev[finding.id] || [])],
      }))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not create Needs More Info research task.')
    } finally {
      setSiteMediaSavingId(null)
    }
  }

  function buildAdminNoteFinding(note: AdminNote): PropertyMediaFinding {
    return {
      id: `admin-note-${note.id}`,
      finding_type: 'property-specific',
      observation: note.body,
      field_consequence: 'Admin note research question. Needs source-backed draft answer before use.',
      estimate_impact: '',
      access_notes: '',
      safety_notes: '',
      confidence: 'low',
      source_file_id: null,
      review_status: 'needs_review',
      admin_notes: `${note.noteType} note by ${note.authorLabel || 'Admin'}`,
    }
  }

  async function askAgentToResearchAdminNote(request: WorkRequest, note: AdminNote) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to request source research.')
      return
    }

    const draft = getNoteResearchDraft(note)
    if (!draft.question.trim()) {
      setSourceResearchMessage(request.id, 'Task creation error: add a research question before running research.')
      return
    }
    const categories = normalizeResearchCategories(draft.research_categories, getSourceResearchDefaults(draft.question_type, draft.question))
    const scope = draft.research_scope

    setRequestSavingId(request.id)
    setAgentResearchSavingId(`note-${note.id}`)
    setSourceResearchMessage(request.id, 'Creating source research task...')
    try {
      const record = {
        property_id: getLinkedPropertyId(request),
        lead_id: asNullableUuid(request.id),
        finding_id: null,
        note_id: note.id,
        evidence_id: `admin-note:${note.id}`,
        question: draft.question.trim(),
        question_type: draft.question_type,
        research_scope: scope,
        research_categories: categories,
        status: 'queued' as AgentResearchTaskStatus,
        confidence: 'low' as PropertyMediaConfidence,
        needs_more_info_prompt: draft.question.trim(),
        missing_information: 'Run research to draft a source-backed answer from the selected source categories.',
        recommended_next_action: 'Run Research, then review source quality before verification.',
        online_search_requested: researchCategoriesRequestOnline(categories, scope),
        online_search_performed: false,
        internal_memory_used: false,
        official_sources_used: false,
        supplier_sources_used: false,
        source_quality: getPrimarySourceQuality(categories),
        answer_status: 'needs_review',
        source_priority: 'linked admin note -> property record -> uploaded evidence -> internal memory -> allowed official/manufacturer/supplier/web sources',
        verified_for_memory: false,
        created_by: currentUserId,
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      const saved = data as AgentResearchTask
      setAgentResearchTasksByRequest((prev) => ({
        ...prev,
        [request.id]: [saved, ...(prev[request.id] || [])],
      }))
      setOpenNoteResearchByNote((prev) => ({ ...prev, [note.id]: false }))
      setSourceResearchMessage(request.id, `Source research task created for note ${note.id}. Running draft research...`)
      await runRequestAgentResearchTask(request, saved)
    } catch (error: any) {
      const message = error?.message || 'Could not create source research task.'
      console.error('[Source Research Agent] Supabase insert/select error:', error)
      setSourceResearchMessage(request.id, `Supabase insert/select error: ${message}`)
      alert(message)
    } finally {
      setRequestSavingId(null)
      setAgentResearchSavingId(null)
    }
  }

  async function runRequestAgentResearchTask(request: WorkRequest, task: AgentResearchTask) {
    const linkedNote = (request.adminNotes || []).find((note) => note.id === task.note_id)
    if (!task.note_id && !task.finding_id && !task.evidence_id) {
      setSourceResearchMessage(request.id, `Missing note_id/finding_id/evidence_id linkage for task ${task.id}. Using task question as fallback context.`)
    }
    const finding = buildAdminNoteFinding(linkedNote || {
      id: task.id,
      body: task.question,
      noteType: 'internal',
      createdAt: task.created_at || new Date().toISOString(),
      authorLabel: 'Admin',
    })
    await runAgentResearchTask(request, finding, task)
  }

  function getWorkGroupResearchTasks(request: WorkRequest, group: InspectionRepairBundleDraft) {
    return (agentResearchTasksByRequest[request.id] || [])
      .filter((task) => task.evidence_id === `work-group:${group.id}` && task.status !== 'rejected')
  }

  function getBestWorkGroupResearchTask(request: WorkRequest, group: InspectionRepairBundleDraft) {
    const tasks = getWorkGroupResearchTasks(request, group)
      .slice()
      .sort((a, b) => Date.parse(b.updated_at || b.created_at || '') - Date.parse(a.updated_at || a.created_at || ''))
    return tasks.find((task) => task.answer_draft) || tasks[0] || null
  }

  function buildWilsonvilleFireSuppressionSources(): Array<Omit<AgentResearchSource, 'id' | 'research_task_id' | 'created_at'>> {
    const accessed = new Date().toISOString()
    return [
      {
        source_title: 'Tualatin Valley Fire & Rescue Fire Marshal’s Office',
        source_url: 'https://www.tvfr.gov/129/Fire-Marshals-Office',
        source_type: 'building_code',
        source_category: 'Safety guidance',
        source_quality: 'official',
        source_publisher: 'Tualatin Valley Fire & Rescue',
        source_excerpt: 'TVF&R Fire Marshal’s Office oversees fire code enforcement, new construction review, fire investigations, and prevention education.',
        source_date_accessed: accessed,
        relevance_note: 'Likely fire authority/fire marshal resource for Wilsonville fire protection questions.',
        excerpt: 'Official fire authority resource for fire code enforcement and fire prevention questions.',
        confidence: 'medium',
      },
      {
        source_title: 'City of Wilsonville Building - Plumbing - Mechanical - Fire Permits',
        source_url: 'https://www.wilsonvilleoregon.gov/building/page/building-plumbing-mechanical-fire-permits',
        source_type: 'building_code',
        source_category: 'Permit / inspection requirements',
        source_quality: 'official',
        source_publisher: 'City of Wilsonville',
        source_excerpt: 'City page for building, plumbing, mechanical, and fire permit resources and forms.',
        source_date_accessed: accessed,
        relevance_note: 'Official local permit desk starting point for fire sprinkler permit or inspection requirements.',
        excerpt: 'Official Wilsonville permit resource for building, plumbing, mechanical, and fire permits.',
        confidence: 'medium',
      },
      {
        source_title: 'Wilsonville Fire Sprinkler Affidavit',
        source_url: 'https://www.wilsonvilleoregon.gov/sites/default/files/fileattachments/building/page/96530/fire_sprinkler_affidavit_fillable_1.22.24.pdf',
        source_type: 'building_code',
        source_category: 'Permit / inspection requirements',
        source_quality: 'official',
        source_publisher: 'City of Wilsonville Building Department',
        source_excerpt: 'Fire sprinkler affidavit lists City Hall contact: 29799 SW Town Center Loop East, Wilsonville, OR 97070; (503) 682-4960 #1; permits@ci.wilsonville.or.us.',
        source_date_accessed: accessed,
        relevance_note: 'Official city form with permit contact details relevant to sprinkler affidavits and building department routing.',
        excerpt: 'Building Department contact: 29799 SW Town Center Loop East, Wilsonville, OR 97070; (503) 682-4960 #1; permits@ci.wilsonville.or.us.',
        confidence: 'medium',
      },
      {
        source_title: 'TVF&R New Construction and Service Provider Permits',
        source_url: 'https://www.tvfr.gov/376/New-Construction-and-Service-Provider-Pe',
        source_type: 'building_code',
        source_category: 'Permit / inspection requirements',
        source_quality: 'official',
        source_publisher: 'Tualatin Valley Fire & Rescue',
        source_excerpt: 'TVF&R permit resource for new construction and service providers, including Wilsonville in the listed jurisdictions.',
        source_date_accessed: accessed,
        relevance_note: 'Fire district permit/service provider context for fire sprinkler questions.',
        excerpt: 'Official TVF&R permit and service provider resource for fire-related construction and provider coordination.',
        confidence: 'medium',
      },
    ]
  }

  function buildGenericWorkGroupSources(request: WorkRequest, group: InspectionRepairBundleDraft): Array<Omit<AgentResearchSource, 'id' | 'research_task_id' | 'created_at'>> {
    const accessed = new Date().toISOString()
    const lower = `${group.title} ${group.recommended_trade} ${group.system_category}`.toLowerCase()
    const city = request.city || request.inspectionIntelligence?.city || ''
    const permitUrl = /wilsonville/i.test(city)
      ? 'https://www.wilsonvilleoregon.gov/building/page/building-plumbing-mechanical-fire-permits'
      : null
    const category: AgentResearchCategory = /electrical/i.test(lower)
      ? 'Permit / inspection requirements'
      : /roof|plumb/i.test(lower)
        ? 'Building code / jurisdiction'
        : 'Property history'

    return [
      {
        source_title: city ? `${city} permit/building department resource` : 'Local permit/building department resource',
        source_url: permitUrl,
        source_type: permitUrl ? 'building_code' : 'manual',
        source_category: category,
        source_quality: permitUrl ? 'official' : 'unknown',
        source_publisher: city ? `City of ${city}` : 'Local building department',
        source_excerpt: permitUrl
          ? 'Official local permit page. Confirm whether this work needs permit, inspection, or department guidance.'
          : 'Local building/permitting resource should be confirmed by admin for this jurisdiction.',
        source_date_accessed: accessed,
        relevance_note: 'Local permit or inspection requirements may affect scope, sequencing, and contractor routing.',
        excerpt: permitUrl
          ? 'Official local permit page for permit/inspection routing.'
          : 'No live official URL was available in the local template; admin should confirm the jurisdiction resource.',
        confidence: permitUrl ? 'medium' : 'low',
      },
      {
        source_title: `${group.recommended_trade || 'Trade'} contractor verification`,
        source_url: null,
        source_type: 'manual',
        source_category: /electrical|plumb|roof/i.test(lower) ? 'Safety guidance' : 'Property history',
        source_quality: 'unknown',
        source_publisher: 'Shelter Prep local draft',
        source_excerpt: 'Use licensed trade review to verify visible evidence, hidden conditions, quantities, and repair-vs-replace path before pricing.',
        source_date_accessed: accessed,
        relevance_note: 'Trade verification is the safest next source when uploaded evidence is incomplete.',
        excerpt: 'Trade verification needed before final scope, pricing, or report language.',
        confidence: 'low',
      },
    ]
  }

  function buildWorkGroupResearchDraft(request: WorkRequest, group: InspectionRepairBundleDraft, task: AgentResearchTask) {
    const text = `${group.title} ${group.system_category} ${group.recommended_trade} ${group.evidence_summary} ${task.question}`.toLowerCase()
    const isWilsonvilleFire = /fire|sprinkler|suppression/.test(text) && /wilsonville|11134\s+sw\s+berlin/i.test(`${request.propertyAddress} ${request.city} ${request.inspectionIntelligence?.propertyAddress} ${request.inspectionIntelligence?.city}`)
    const sources = isWilsonvilleFire ? buildWilsonvilleFireSuppressionSources() : buildGenericWorkGroupSources(request, group)
    const bestResources = sources.slice(0, 3).map((source, index) => `${index + 1}. ${source.source_title}${source.source_url ? ` (${source.source_url})` : ''}`)
    const liveSearchNotice = 'Live online source search not performed. This draft uses approved local resource templates plus uploaded/property context.'

    const nextSteps = isWilsonvilleFire
      ? [
          'Contact TVF&R Fire Marshal’s Office about painted sprinkler heads and ask what documentation or correction path they require.',
          'Contact Wilsonville Building Department / permits desk about fire sprinkler permit, affidavit, or inspection requirements: 29799 SW Town Center Loop East, Wilsonville, OR 97070; (503) 682-4960 #1; permits@ci.wilsonville.or.us.',
          'Request seller/HOA/building manager sprinkler system documentation, latest inspection/service records, head count, and photos of every sprinkler head.',
        ]
      : [
          `Confirm the local permit/inspection path for ${group.recommended_trade || group.system_category}.`,
          `Ask a qualified ${group.likely_contractor_type || group.recommended_trade || 'trade contractor'} to verify the condition, location, and repair-vs-replace scope.`,
          'Request missing evidence: source page/photo, quantities, affected locations, and any prior service or permit records.',
        ]

    return {
      answer: [
        `Research Draft (${getLearningDisplayName(task.status)}):`,
        `What we know: ${group.evidence_summary || group.summary}`,
        `Best resources: ${bestResources.join(' ')}`,
        `Best next 3 steps: ${nextSteps.map((step, index) => `${index + 1}. ${step}`).join(' ')}`,
        liveSearchNotice,
      ].join('\n\n'),
      confidence: sources.some((source) => source.source_quality === 'official') ? 'medium' as PropertyMediaConfidence : 'low' as PropertyMediaConfidence,
      evidenceSummary: `Work group: ${group.title}. Source evidence: ${group.source_page || 'uploaded evidence'}. ${group.evidence_summary || group.summary}`,
      missingInformation: (group.missing_information || []).join(' ') || 'Confirm source evidence, location, quantity, and trade verification.',
      recommendedNextAction: nextSteps.join(' '),
      onlineSearchRequested: Boolean(task.online_search_requested),
      onlineSearchPerformed: false,
      internalMemoryUsed: true,
      officialSourcesUsed: sources.some((source) => source.source_quality === 'official'),
      supplierSourcesUsed: sources.some((source) => source.source_quality === 'supplier'),
      sourceQuality: sources.some((source) => source.source_quality === 'official') ? 'official' as AgentResearchSourceQuality : getPrimarySourceQuality(normalizeResearchCategories(task.research_categories, getSourceResearchDefaults(task.question_type, task.question))),
      sourcePriority: 'linked work group -> uploaded evidence/property context -> approved local resource templates -> official online source search when backend is available',
      sources,
    }
  }

  async function runWorkGroupResearchTask(request: WorkRequest, group: InspectionRepairBundleDraft, task: AgentResearchTask) {
    setAgentResearchSavingId(task.id)
    updateLocalAgentResearchTask(task.id, { status: 'researching' })

    try {
      const draft = buildWorkGroupResearchDraft(request, group, task)
      const patch = {
        status: 'needs_review' as AgentResearchTaskStatus,
        answer_draft: draft.answer,
        confidence: draft.confidence,
        evidence_summary: draft.evidenceSummary,
        missing_information: draft.missingInformation,
        recommended_next_action: draft.recommendedNextAction,
        online_search_requested: draft.onlineSearchRequested,
        online_search_performed: draft.onlineSearchPerformed,
        internal_memory_used: draft.internalMemoryUsed,
        official_sources_used: draft.officialSourcesUsed,
        supplier_sources_used: draft.supplierSourcesUsed,
        source_quality: draft.sourceQuality,
        answer_status: 'needs_review',
        source_priority: draft.sourcePriority,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .update(patch)
        .eq('id', task.id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('agent_research_sources').delete().eq('research_task_id', task.id)
      const { data: sources, error: sourceError } = await supabase
        .from('agent_research_sources')
        .insert(draft.sources.map((source) => ({ research_task_id: task.id, ...source })))
        .select()

      if (sourceError) throw sourceError

      updateLocalAgentResearchTask(task.id, data as AgentResearchTask)
      setAgentResearchSourcesByTask((prev) => ({ ...prev, [task.id]: (sources || []) as AgentResearchSource[] }))
      setSourceResearchMessage(request.id, `Research draft created for ${group.title}. Needs Human Review.`)
    } catch (error: any) {
      console.error('[Work Group Research] Draft/update error:', error)
      updateLocalAgentResearchTask(task.id, { status: 'draft' })
      setSourceResearchMessage(request.id, `Task creation error: ${error?.message || 'Could not draft source research.'}`)
      alert(error?.message || 'Could not draft source research.')
    } finally {
      setAgentResearchSavingId(null)
    }
  }

  async function saveVerifiedFindingToMemory(request: WorkRequest, finding: PropertyMediaFinding) {
    if (!isHumanVerifiedStatus(finding.review_status)) {
      alert('Human Verify this finding before saving it to memory.')
      return
    }
    if (!canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admin or owner can save verified findings to memory.')
      return
    }

    setSiteMediaSavingId(finding.id)
    try {
      const record = {
        property_id: getRequestPropertyId(request),
        work_request_id: request.id,
        file_id: finding.source_file_id || finding.id,
        photo_description: finding.observation,
        trade_category: finding.finding_type || request.workType || 'General repair',
        work_phase: 'evidence_interpretation',
        equipment_seen: '',
        field_consequence: finding.field_consequence || finding.observation,
        estimate_impact: finding.estimate_impact || 'Verified finding saved for future review context.',
        required_line_items: [],
        risk_flags: [finding.safety_notes, finding.access_notes].filter(Boolean),
        human_verified: true,
        follow_up_lesson: finding.admin_notes || finding.field_consequence || finding.observation,
        reviewed_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('photo_field_memory').insert(record)
      if (error) throw error
      updateLocalSiteMediaFinding(finding.id, { review_status: 'human_verified' })
      alert('Verified finding saved to field memory.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save verified finding to memory.')
    } finally {
      setSiteMediaSavingId(null)
    }
  }

  async function saveAgentResearchTask(task: AgentResearchTask, changes: Partial<AgentResearchTask> = {}) {
    const next = { ...task, ...changes }
    const statusChanged = Boolean(changes.status)
    const verifying = next.status === 'human_verified' || next.status === 'rejected'

    if (verifying && !canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admin or owner can verify or reject research answers.')
      return
    }

    setAgentResearchSavingId(task.id)
    try {
      const patch = {
        question: next.question,
        question_type: next.question_type,
        research_scope: next.research_scope,
        research_categories: normalizeResearchCategories(next.research_categories, getSourceResearchDefaults(next.question_type, next.question)),
        status: next.status,
        answer_draft: next.answer_draft || '',
        confidence: next.confidence || 'low',
        evidence_summary: next.evidence_summary || '',
        missing_information: next.missing_information || '',
        recommended_next_action: next.recommended_next_action || '',
        needs_more_info_prompt: next.needs_more_info_prompt || '',
        online_search_requested: Boolean(next.online_search_requested),
        online_search_performed: Boolean(next.online_search_performed),
        internal_memory_used: Boolean(next.internal_memory_used),
        official_sources_used: Boolean(next.official_sources_used),
        supplier_sources_used: Boolean(next.supplier_sources_used),
        source_quality: next.source_quality || getPrimarySourceQuality(normalizeResearchCategories(next.research_categories, getSourceResearchDefaults(next.question_type, next.question))),
        answer_status: next.answer_status || next.status,
        source_priority: next.source_priority || '',
        verified_for_memory: Boolean(next.verified_for_memory),
        ...(statusChanged && verifying ? { reviewed_by: currentUserId, reviewed_at: new Date().toISOString() } : {}),
        ...(statusChanged && next.status === 'needs_review' ? { reviewed_by: null, reviewed_at: null } : {}),
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .update(patch)
        .eq('id', task.id)
        .select()
        .single()

      if (error) throw error
      updateLocalAgentResearchTask(task.id, data as AgentResearchTask)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save research task.')
    } finally {
      setAgentResearchSavingId(null)
    }
  }

  async function addManualSiteMediaFinding(request: WorkRequest, file?: StoredFile | null) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to add site media findings.')
      return
    }

    setSiteMediaSavingId(`new-${request.id}`)
    try {
      const analysis = await ensureSiteMediaAnalysis(request, file)
      const record = {
        property_media_analysis_id: analysis.id,
        property_id: analysis.property_id ?? getLinkedPropertyId(request),
        lead_id: analysis.lead_id ?? asNullableUuid(request.id),
        finding_type: 'access',
        observation: file
          ? `Review uploaded media: ${file.name}. Needs human verification.`
          : 'Manual site media finding. Needs human verification.',
        field_consequence: 'Needs human verification.',
        estimate_impact: 'Use as estimate note only until reviewed.',
        access_notes: '',
        safety_notes: '',
        confidence: 'low' as PropertyMediaConfidence,
        source_file_id: analysis.source_file_id ?? asNullableUuid(file?.id || ''),
        review_status: 'needs_review' as PropertyMediaReviewStatus,
        admin_notes: 'Draft finding created from existing uploaded media only.',
      }

      const { data, error } = await supabase
        .from('property_media_findings')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      const saved = data as PropertyMediaFinding
      setSiteMediaFindingsByRequest((prev) => ({
        ...prev,
        [request.id]: [saved, ...(prev[request.id] || [])],
      }))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not add site media finding. Run the Site Media Intelligence migration first.')
    } finally {
      setSiteMediaSavingId(null)
    }
  }

  async function saveSiteMediaFinding(finding: PropertyMediaFinding, changes: Partial<PropertyMediaFinding> = {}) {
    const next = { ...finding, ...changes }
    const statusChanged = Boolean(changes.review_status)
    const approving = isHumanVerifiedStatus(next.review_status) || next.review_status === 'rejected'

    if (approving && !canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admin or owner can approve, reject, or verify site media findings.')
      return
    }

    if (!approving && !canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to edit site media findings.')
      return
    }

    setSiteMediaSavingId(finding.id)
    try {
      const patch = {
        finding_type: next.finding_type,
        observation: next.observation,
        field_consequence: next.field_consequence,
        estimate_impact: next.estimate_impact,
        access_notes: next.access_notes,
        safety_notes: next.safety_notes,
        confidence: next.confidence,
        source_file_id: asNullableUuid(next.source_file_id || ''),
        review_status: next.review_status,
        admin_notes: next.admin_notes,
        ...(statusChanged && approving ? { reviewed_at: new Date().toISOString(), reviewed_by: currentUserId } : {}),
        ...(statusChanged && next.review_status === 'needs_review' ? { reviewed_at: null, reviewed_by: null } : {}),
      }

      const { data, error } = await supabase
        .from('property_media_findings')
        .update(patch)
        .eq('id', finding.id)
        .select()
        .single()

      if (error) throw error
      updateLocalSiteMediaFinding(finding.id, data as PropertyMediaFinding)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save site media finding.')
    } finally {
      setSiteMediaSavingId(null)
    }
  }

  function loadLocalPropertyAgentOutputs(request: WorkRequest) {
    try {
      return JSON.parse(
        window.localStorage.getItem(getPropertyAgentOutputStorageKey(request.id)) || '[]'
      ) as PropertyAgentResult[]
    } catch {
      return []
    }
  }

  function saveLocalPropertyAgentOutputs(request: WorkRequest, outputs: PropertyAgentResult[]) {
    window.localStorage.setItem(getPropertyAgentOutputStorageKey(request.id), JSON.stringify(outputs))
  }

  async function savePropertyAgentOutputs(request: WorkRequest, outputs: PropertyAgentResult[]) {
    saveLocalPropertyAgentOutputs(request, outputs)
    setPropertyAgentOutputsByRequest((prev) => ({ ...prev, [request.id]: outputs }))

    try {
      const rows = outputs.map((output) => ({
        property_id: output.property_id,
        work_request_id: output.work_request_id,
        repair_item_id: output.repair_item_id || null,
        agent_name: output.agent_name,
        input_summary: output.input_summary,
        output_json: output.output_json,
        assumptions: output.assumptions,
        confidence: output.confidence,
        missing_info: output.missing_info,
        audit_notes: output.audit_notes,
        status: output.status,
        reviewed_at: output.reviewed_at || null,
        reviewed_by: output.reviewed_by || null,
      }))

      const { error } = await supabase.from('property_intelligence_agent_outputs').insert(rows)
      if (error) throw error
    } catch (error) {
      console.warn('Property intelligence agent outputs saved locally only.', error)
    }
  }

  async function loadOrCreatePropertyAgentOutputs(request: WorkRequest) {
    if (propertyAgentOutputsByRequest[request.id]?.length) return propertyAgentOutputsByRequest[request.id]

    try {
      const { data, error } = await supabase
        .from('property_intelligence_agent_outputs')
        .select('*')
        .eq('work_request_id', request.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const rows = (data || []) as PropertyAgentResult[]
      if (rows.length) {
        setPropertyAgentOutputsByRequest((prev) => ({ ...prev, [request.id]: rows }))
        saveLocalPropertyAgentOutputs(request, rows)
        return rows
      }
    } catch (error) {
      console.warn('Property intelligence agent output table unavailable; using local outputs.', error)
    }

    const localRows = loadLocalPropertyAgentOutputs(request)
    if (localRows.length) {
      setPropertyAgentOutputsByRequest((prev) => ({ ...prev, [request.id]: localRows }))
      return localRows
    }

    const drafts = buildPropertyAgentDrafts(request)
    await savePropertyAgentOutputs(request, drafts)
    return drafts
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMessage('')

    const hasMedia = photoFiles.length > 0 || documentFiles.length > 0
    const trimmedDescription = description.trim()
    const safeDescription = trimmedDescription || (hasMedia ? 'Needs review from uploaded media.' : '')

    if (!propertyAddress.trim()) {
      alert('Add the property address to start.')
      return
    }

    if (!safeDescription) {
      alert('Add a short note or attach photos, video, or an inspection report.')
      return
    }

    setSubmitting(true)
    setLocalEvidenceStatus('uploading')

    try {
      const { data: leadRow, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: requesterName,
          email,
          phone,
          address: propertyAddress,
          city,
          state: stateValue,
          zip,
          description: safeDescription,
          status: 'new',
        })
        .select('id, created_at, property_id')
        .single()

      if (leadError) throw leadError

      const verifiedPropertyFacts = {
        ...propertyFacts,
        propertyType,
        jurisdiction: jurisdiction || propertyResearchPack.jurisdiction,
        zoning,
        parcelNumber,
        verified: true,
        verificationNotes,
        inspectionIntelligence: inspectionReportDraft?.intelligence || null,
      }

      const propertyRecordId = await ensureRequestProperty(
        leadRow.id,
        propertyAddress,
        city,
        stateValue,
        zip
      )

      const { error: propertyUpdateError } = await supabase
        .from('leads')
        .update({
          property_id: propertyRecordId || leadRow.property_id || null,
          property_facts: verifiedPropertyFacts,
          property_verified: true,
          property_jurisdiction: verifiedPropertyFacts.jurisdiction,
          property_type: propertyType,
          zoning,
          parcel_number: parcelNumber,
        })
        .eq('id', leadRow.id)

      if (propertyUpdateError) {
        console.warn('Lead saved, but property intelligence fields were not saved:', propertyUpdateError)
      }

      const photos = await uploadRequestFiles(photoFiles, 'photos', 'photo', leadRow.id)
      const documents = await uploadRequestFiles(documentFiles, 'documents', 'document', leadRow.id)

      const newRequest: WorkRequest = {
        id: leadRow?.id || makeId(),
        propertyId: propertyRecordId || leadRow?.property_id || null,
        createdAt: leadRow?.created_at
          ? new Date(leadRow.created_at).toLocaleString()
          : new Date().toLocaleString(),
        requesterName,
        email,
        phone,
        workType,
        propertyAddress,
        city,
        state: stateValue,
        zip,
        urgency,
        occupancy,
        timeline,
        propertyFacts: verifiedPropertyFacts,
        description: safeDescription,
        photos,
        documents,
        status: 'new',
        inspectionIntelligence: inspectionReportDraft?.intelligence || null,
      }

      setRequests((prev) => [newRequest, ...prev])
      void savePropertyAgentOutputs(newRequest, buildPropertyAgentDrafts(newRequest))
      if (hasAdminConsoleAccess) {
        void autoInterpretEvidenceForRequests([newRequest])
      }
      setSuccessMessage('Request submitted. Shelter Prep will review and follow up.')
      resetForm()
    } catch (error: any) {
      console.error(error)
      setLocalEvidenceStatus('failed')
      alert(error?.message || 'Upload failed. Check Supabase storage bucket/policies.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: RequestStatus) {
    try {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)

      if (error) throw error
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update lead status.')
      await loadRequestsFromSupabase()
    }
  }

  function createRequestEditDraft(request: WorkRequest): RequestEditDraft {
    return {
      propertyAddress: request.propertyAddress || '',
      bedrooms: request.propertyFacts?.bedrooms || '',
      bathrooms: request.propertyFacts?.bathrooms || '',
      squareFeet: request.propertyFacts?.squareFeet || '',
      yearBuilt: request.propertyFacts?.yearBuilt || '',
      propertyType: request.propertyFacts?.propertyType || '',
      jurisdiction: request.propertyFacts?.jurisdiction || '',
      workType: request.workType || '',
      description: request.description || '',
      status: request.status,
      urgency: request.urgency || 'Standard',
      occupancy: request.occupancy || 'Unknown',
      scopeInterpretation: request.scopeInterpretation || '',
      missingInformation: request.missingInformation || '',
      internalNotes: request.internalNotes || '',
      agentFacingNotes: request.agentFacingNotes || '',
      contractorFacingNotes: request.contractorFacingNotes || '',
    }
  }

  function startEditingRequest(request: WorkRequest) {
    if (!hasAdminConsoleAccess) return
    setEditingRequestId(request.id)
    setRequestEditDrafts((prev) => ({ ...prev, [request.id]: createRequestEditDraft(request) }))
  }

  function updateRequestEditDraft(requestId: string, changes: Partial<RequestEditDraft>) {
    setRequestEditDrafts((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || createRequestEditDraft(requests.find((request) => request.id === requestId) || {
          id: requestId,
          createdAt: '',
          requesterName: '',
          email: '',
          phone: '',
          workType: '',
          propertyAddress: '',
          city: '',
          state: '',
          zip: '',
          urgency: 'Standard',
          occupancy: 'Unknown',
          timeline: '',
          description: '',
          photos: [],
          documents: [],
          status: 'new',
        })),
        ...changes,
      },
    }))
  }

  function buildPropertyFactsForRequest(
    request: WorkRequest,
    draft: RequestEditDraft,
    extraFacts: Record<string, unknown> = {}
  ): PropertyFacts & Record<string, unknown> {
    const currentFacts = {
      ...emptyPropertyFacts(),
      ...(request.propertyFacts || {}),
    } as PropertyFacts & Record<string, unknown>

    return {
      ...currentFacts,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      squareFeet: draft.squareFeet,
      yearBuilt: draft.yearBuilt,
      propertyType: draft.propertyType,
      jurisdiction: draft.jurisdiction,
      verified: currentFacts.verified ?? true,
      operationalRecord: {
        workType: draft.workType,
        description: draft.description,
        urgency: draft.urgency,
        occupancy: draft.occupancy,
        scopeInterpretation: draft.scopeInterpretation,
        missingInformation: draft.missingInformation,
        internalNotes: draft.internalNotes,
        agentFacingNotes: draft.agentFacingNotes,
        contractorFacingNotes: draft.contractorFacingNotes,
      },
      inspectionIntelligence: request.inspectionIntelligence || null,
      inspectionProcessingStatus: request.inspectionProcessingStatus || 'uploaded',
      inspectionExtractionSummary: request.inspectionExtractionSummary || '',
      inspectionExtractionMessage: request.inspectionExtractionMessage || '',
      adminNotes: request.adminNotes || [],
      ...extraFacts,
    }
  }

  async function saveRequestEdits(request: WorkRequest) {
    if (!hasAdminConsoleAccess) {
      alert('Sign in as admin/owner before editing protected property records.')
      return
    }

    const draft = requestEditDrafts[request.id] || createRequestEditDraft(request)
    setRequestSavingId(request.id)

    const propertyFactsPatch = buildPropertyFactsForRequest(request, draft)
    const updatedRequest: WorkRequest = {
      ...request,
      propertyAddress: draft.propertyAddress,
      workType: draft.workType,
      description: draft.description,
      status: draft.status,
      urgency: draft.urgency,
      occupancy: draft.occupancy,
      propertyFacts: propertyFactsPatch,
      scopeInterpretation: draft.scopeInterpretation,
      missingInformation: draft.missingInformation,
      internalNotes: draft.internalNotes,
      agentFacingNotes: draft.agentFacingNotes,
      contractorFacingNotes: draft.contractorFacingNotes,
    }

    try {
      setRequests((prev) => prev.map((item) => (item.id === request.id ? updatedRequest : item)))

      const { error } = await supabase
        .from('leads')
        .update({
          address: draft.propertyAddress,
          description: draft.description,
          status: draft.status,
          property_facts: propertyFactsPatch,
          property_verified: true,
          property_jurisdiction: draft.jurisdiction,
          property_type: draft.propertyType,
        })
        .eq('id', request.id)

      if (error) throw error

      await persistScopeInterpretation(request, draft)
      setEditingRequestId(null)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save property/request edits.')
      await loadRequestsFromSupabase()
    } finally {
      setRequestSavingId(null)
    }
  }

  async function persistScopeInterpretation(request: WorkRequest, draft: RequestEditDraft) {
    try {
      await supabase.from('scope_interpretations').insert({
        lead_id: asNullableUuid(request.id),
        property_id: getLinkedPropertyId(request),
        scope_interpretation: draft.scopeInterpretation,
        missing_information: draft.missingInformation,
        internal_notes: draft.internalNotes,
        agent_facing_notes: draft.agentFacingNotes,
        contractor_facing_notes: draft.contractorFacingNotes,
        human_review_status: 'needs_review',
      })
    } catch (error) {
      console.warn('scope_interpretations table unavailable; saved scope notes on lead property_facts.', error)
    }
  }

  function updateAdminNoteDraft(requestId: string, changes: Partial<AdminNoteDraft>) {
    setAdminNoteDrafts((prev) => ({
      ...prev,
      [requestId]: {
        noteType: prev[requestId]?.noteType || 'internal',
        body: prev[requestId]?.body || '',
        ...changes,
      },
    }))
  }

  async function saveAdminNote(request: WorkRequest) {
    if (!hasAdminConsoleAccess) {
      alert('Sign in as admin/owner before adding admin notes.')
      return
    }

    const draft = adminNoteDrafts[request.id] || { noteType: 'internal' as AdminNoteType, body: '' }
    if (!draft.body.trim()) return

    const now = new Date().toISOString()
    const nextNote: AdminNote = {
      id: makeId(),
      body: draft.body.trim(),
      noteType: draft.noteType,
      createdAt: now,
      authorLabel: currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'admin' ? 'Admin' : 'Admin reviewer',
    }
    const nextNotes = [nextNote, ...(request.adminNotes || [])]
    const draftForFacts = requestEditDrafts[request.id] || createRequestEditDraft(request)
    const propertyFactsPatch = buildPropertyFactsForRequest(
      { ...request, adminNotes: nextNotes },
      draftForFacts,
      { adminNotes: nextNotes }
    )

    setRequestSavingId(request.id)
    try {
      setRequests((prev) => prev.map((item) => (
        item.id === request.id ? { ...item, adminNotes: nextNotes, propertyFacts: propertyFactsPatch } : item
      )))
      setAdminNoteDrafts((prev) => ({ ...prev, [request.id]: { noteType: draft.noteType, body: '' } }))

      const { error } = await supabase
        .from('leads')
        .update({ property_facts: propertyFactsPatch })
        .eq('id', request.id)

      if (error) throw error

      try {
        await supabase.from('admin_notes').insert({
          lead_id: asNullableUuid(request.id),
          property_id: getLinkedPropertyId(request),
          note_type: draft.noteType,
          body: nextNote.body,
          author_label: nextNote.authorLabel,
        })
      } catch (noteError) {
        console.warn('admin_notes table unavailable; saved note on lead property_facts.', noteError)
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save admin note.')
      await loadRequestsFromSupabase()
    } finally {
      setRequestSavingId(null)
    }
  }

  async function updateAdminNote(request: WorkRequest, noteId: string, changes: Partial<AdminNote>) {
    if (!hasAdminConsoleAccess) return

    const nextNotes = (request.adminNotes || []).map((note) =>
      note.id === noteId ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note
    )
    const draftForFacts = requestEditDrafts[request.id] || createRequestEditDraft(request)
    const propertyFactsPatch = buildPropertyFactsForRequest(
      { ...request, adminNotes: nextNotes },
      draftForFacts,
      { adminNotes: nextNotes }
    )

    setRequestSavingId(request.id)
    try {
      setRequests((prev) => prev.map((item) => (
        item.id === request.id ? { ...item, adminNotes: nextNotes, propertyFacts: propertyFactsPatch } : item
      )))

      const { error } = await supabase
        .from('leads')
        .update({ property_facts: propertyFactsPatch })
        .eq('id', request.id)

      if (error) throw error
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update admin note.')
      await loadRequestsFromSupabase()
    } finally {
      setRequestSavingId(null)
    }
  }

  function isPdfEvidence(file: StoredFile) {
    return /\.pdf$/i.test(file.name || file.path || '') || /application\/pdf/i.test(file.path || '')
  }

  function isImageEvidence(file: StoredFile) {
    return file.type === 'photo' || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || file.path || '')
  }

  function getEvidenceKey(file: StoredFile, suffix = '') {
    return `${file.id || file.path || file.name}${suffix ? `:${suffix}` : ''}`
  }

  function getEvidenceFindingsForFile(request: WorkRequest, file: StoredFile) {
    const sourceId = file.id || ''
    const fileNeedle = `${file.name} ${file.path}`.toLowerCase()
    return (siteMediaFindingsByRequest[request.id] || []).filter((finding) => {
      if (isRejectedFinding(finding)) return false
      const sourceMatch = Boolean(sourceId && finding.source_file_id === sourceId)
      const noteMatch = fileNeedle && finding.admin_notes?.toLowerCase().includes(file.name.toLowerCase())
      return sourceMatch || noteMatch
    })
  }

  function getEvidenceInterpretationMessage(status: EvidenceInspectionStatus, findingsCount: number) {
    if (status === 'failed') return 'Interpretation failed. Upload clearer evidence or manually add findings.'
    if (status === 'uploaded') return 'Not interpreted yet.'
    if (status === 'queued_for_interpretation' && findingsCount === 0) return 'No findings drafted yet. Run Inspect this file or mark Needs More Info.'
    if (status === 'interpreting') return 'Interpreting evidence...'
    if (findingsCount === 0) return 'No findings drafted yet. Run Inspect this file or mark Needs More Info.'
    return `${findingsCount} AI Draft finding${findingsCount === 1 ? '' : 's'} linked to this evidence.`
  }

  function getEvidenceType(file: StoredFile, mode: 'full_pdf' | 'page' | 'range' | 'image' | 'file' = 'file'): EvidenceType {
    const lower = `${file.name} ${file.path}`.toLowerCase()
    if (mode === 'page' || mode === 'range') return 'inspection_page'
    if (isImageEvidence(file)) return lower.includes('screenshot') ? 'screenshot' : 'photo'
    if (lower.includes('invoice')) return 'invoice'
    if (lower.includes('disclosure')) return 'seller_disclosure'
    if (isPdfEvidence(file)) return 'full_inspection_report'
    return 'manual'
  }

  function getEvidenceResearchDraft(file: StoredFile): EvidenceResearchDraft {
    const key = getEvidenceKey(file)
    return evidenceResearchDraftsByKey[key] || {
      question: '',
      question_type: 'property-specific',
      research_scope: 'Uploaded files only',
      research_categories: ['Property history'],
    }
  }

  function updateEvidenceResearchDraft(file: StoredFile, changes: Partial<EvidenceResearchDraft>) {
    const key = getEvidenceKey(file)
    setEvidenceResearchDraftsByKey((prev) => ({
      ...prev,
      [key]: {
        question: prev[key]?.question || '',
        question_type: prev[key]?.question_type || 'property-specific',
        research_scope: prev[key]?.research_scope || 'Uploaded files only',
        research_categories: prev[key]?.research_categories || ['Property history'],
        ...changes,
      },
    }))
  }

  function parsePageRange(input: string) {
    const clean = input.trim()
    const range = clean.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Math.max(1, Number(range[1]))
      const end = Math.max(start, Number(range[2]))
      return { label: `pages ${start}-${end}`, pageNumber: null as number | null, pageRange: `${start}-${end}` }
    }
    const page = Math.max(1, Number(clean.replace(/[^\d]/g, '') || 1))
    return { label: `page ${page}`, pageNumber: page, pageRange: null as string | null }
  }

  function estimatePdfPageCount(raw: string) {
    const matches = raw.match(/\/Type\s*\/Page\b/g)
    if (matches?.length) return matches.length
    return null
  }

  async function extractStoredPdfEvidenceText(file: StoredFile, pageLabel = '') {
    const signedUrl = await resolveStoredFileUrl(file)
    const response = await fetch(signedUrl)
    if (!response.ok) throw new Error(`Could not download PDF for evidence inspection (${response.status}).`)
    const blob = await response.blob()
    const raw = await blob.slice(0, Math.min(blob.size, INSPECTION_FRONT_PAGE_MAX_BYTES)).text()
    const literalStrings = Array.from(raw.matchAll(/\(([^()]{3,})\)/g))
      .map((match) => match[1])
      .join(' ')
    const arrayStrings = Array.from(raw.matchAll(/\[((?:\s*\([^()]{2,}\)\s*){2,})\]/g))
      .map((match) => Array.from(match[1].matchAll(/\(([^()]{2,})\)/g)).map((item) => item[1]).join(' '))
      .join(' ')
    const pageCount = estimatePdfPageCount(raw)
    const text = normalizeInspectionReportText(`${literalStrings} ${arrayStrings} ${raw.slice(0, 12000)}`).slice(0, 24000)
    const warning = [
      pageLabel ? `Requested ${pageLabel}.` : '',
      pageCount ? `Estimated PDF page count: ${pageCount}.` : 'Page count could not be confirmed.',
      'Partial extraction only. Some findings may be missing.',
      text.length < 120 ? 'Low readable text. Try inspecting page images or upload clearer pages.' : '',
    ].filter(Boolean).join(' ')

    return { text, pageCount, warning, payloadBytes: Math.min(blob.size, INSPECTION_FRONT_PAGE_MAX_BYTES) }
  }

  function getInspectionStatusLabel(status?: InspectionProcessingStatus) {
    const labels: Record<InspectionProcessingStatus, string> = {
      uploaded: 'Uploaded',
      extracting_pdf: 'Extracting PDF',
      inspection_review_drafted: 'Inspection Review Drafted',
      needs_human_review: 'Needs Human Review',
      human_verified: 'Human Verified',
      extraction_failed: 'Extraction Failed',
    }
    return labels[status || 'uploaded']
  }

  function buildInspectionDraftFromExtractedText(params: {
    fileName: string
    text: string
    payloadBytes: number
    request?: WorkRequest
  }): InspectionReportDraft {
    const address = extractInspectionAddress(params.text)
    const clientName = firstMatch(params.text, [
      /(?:Client|Customer|Prepared\s+For|Report\s+Prepared\s+For)\s*:?\s*([A-Z][A-Za-z .'-]{2,80})/i,
    ])
    const inspectorCombined = firstMatch(params.text, [
      /(?:Inspector|Inspected\s+By)\s*:?\s*([A-Z][A-Za-z .'-]{2,80}(?:\s*\/\s*[A-Z][A-Za-z0-9 .,&'-]{2,100})?)/i,
    ])
    const companyFromInspector = inspectorCombined.includes('/')
      ? inspectorCombined.split('/').slice(1).join('/').trim()
      : ''
    const inspectorName = inspectorCombined.includes('/')
      ? inspectorCombined.split('/')[0].trim()
      : inspectorCombined
    const inspectorCompany = companyFromInspector || firstMatch(params.text, [
      /(?:Company|Inspection\s+Company)\s*:?\s*([A-Z][A-Za-z0-9 .,&'-]{2,100})/i,
      /\b([A-Z][A-Za-z0-9 .,&'-]{2,80}\s+(?:Home\s+Inspections|Inspections|Inspection\s+Services|Inspection\s+LLC|Inspections\s+LLC))\b/,
    ])
    const reportType = firstMatch(params.text, [
      /\b(Home\s+Inspection\s+Report|Property\s+Inspection\s+Report|Inspection\s+Report|Pre[-\s]?Listing\s+Inspection|Buyer\s+Inspection)\b/i,
    ]) || 'Inspection report'
    const inspectionDate = extractInspectionDate(params.text)
    const summaryItems = extractInspectionFindings(params.text)
    const missingInfo = [
      !address.propertyAddress && !params.request?.propertyAddress ? 'Confirm property address.' : '',
      !inspectionDate ? 'inspection date' : '',
      !clientName ? 'client/customer name' : '',
      !inspectorName && !inspectorCompany ? 'inspector name/company' : '',
      !summaryItems.length ? 'inspection summary findings' : '',
    ].filter(Boolean)
    const intelligence = buildInspectionIntelligenceDraft({
      fileName: params.fileName,
      reportType,
      propertyAddress: address.propertyAddress || params.request?.propertyAddress || '',
      city: address.city || params.request?.city || '',
      state: address.state || params.request?.state || '',
      inspectionDate,
      inspectorName,
      inspectorCompany,
      findings: summaryItems,
      missingInfo,
      propertyId: params.request?.propertyId || null,
    })

    return {
      fileName: params.fileName,
      frontPagePayloadBytes: params.payloadBytes,
      propertyAddress: address.propertyAddress || params.request?.propertyAddress || '',
      city: address.city || params.request?.city || '',
      state: address.state || params.request?.state || '',
      inspectionDate,
      clientName,
      inspectorName,
      inspectorCompany,
      reportType,
      summaryItems,
      missingInfo,
      intelligence,
      status: missingInfo.length ? 'Needs Review' : 'AI Draft',
    }
  }

  async function persistInspectionExtraction(params: {
    request: WorkRequest
    file: StoredFile
    status: InspectionProcessingStatus
    extractedText?: string
    extractionSummary: string
    payloadBytes?: number
  }) {
    try {
      await supabase.from('inspection_extractions').insert({
        lead_id: asNullableUuid(params.request.id),
        property_id: getLinkedPropertyId(params.request),
        source_file_id: asNullableUuid(params.file.id || ''),
        file_name: params.file.name,
        status: params.status,
        payload_bytes: params.payloadBytes || null,
        extracted_text: params.extractedText?.slice(0, 24000) || null,
        extraction_summary: params.extractionSummary,
        human_review_status: params.status === 'extraction_failed' ? 'needs_review' : 'ai_draft',
      })
    } catch (error) {
      console.warn('inspection_extractions table unavailable; saved extraction on lead property_facts.', error)
    }
  }

  async function saveInspectionStateToLead(
    request: WorkRequest,
    updates: Partial<WorkRequest>,
    extraFacts: Record<string, unknown> = {}
  ) {
    const nextRequest = { ...request, ...updates }
    const propertyFactsPatch = {
      ...emptyPropertyFacts(),
      ...(request.propertyFacts || {}),
      inspectionIntelligence: nextRequest.inspectionIntelligence || null,
      inspectionProcessingStatus: nextRequest.inspectionProcessingStatus || 'uploaded',
      inspectionExtractionSummary: nextRequest.inspectionExtractionSummary || '',
      inspectionExtractionMessage: nextRequest.inspectionExtractionMessage || '',
      operationalRecord: {
        ...getOperationalRecord((request.propertyFacts || {}) as Record<string, any>),
        scopeInterpretation: nextRequest.scopeInterpretation || '',
        missingInformation: nextRequest.missingInformation || '',
        internalNotes: nextRequest.internalNotes || '',
        agentFacingNotes: nextRequest.agentFacingNotes || '',
        contractorFacingNotes: nextRequest.contractorFacingNotes || '',
      },
      adminNotes: nextRequest.adminNotes || [],
      ...extraFacts,
    }

    setRequests((prev) => prev.map((item) => (
      item.id === request.id ? { ...nextRequest, propertyFacts: propertyFactsPatch } : item
    )))

    const leadPatch: Record<string, unknown> = { property_facts: propertyFactsPatch }
    if (nextRequest.propertyAddress) leadPatch.address = nextRequest.propertyAddress
    if (nextRequest.city) leadPatch.city = nextRequest.city
    if (nextRequest.state) leadPatch.state = nextRequest.state
    if (nextRequest.zip) leadPatch.zip = nextRequest.zip

    const { error } = await supabase
      .from('leads')
      .update(leadPatch)
      .eq('id', request.id)

    if (error) throw error
  }

  async function processInspectionPdf(request: WorkRequest, file: StoredFile) {
    if (!hasAdminConsoleAccess) {
      alert('Sign in as admin/owner before processing inspection PDFs.')
      return
    }

    setPdfProcessingByRequest((prev) => ({ ...prev, [request.id]: 'extracting_pdf' }))
    await saveInspectionStateToLead(request, {
      inspectionProcessingStatus: 'extracting_pdf',
      inspectionExtractionMessage: `Extracting PDF text from ${file.name}.`,
    })

    try {
      const signedUrl = await resolveStoredFileUrl(file)
      const response = await fetch(signedUrl)
      if (!response.ok) throw new Error(`Could not download PDF for extraction (${response.status}).`)
      const blob = await response.blob()
      const pdfFile = new File([blob], file.name, { type: 'application/pdf' })
      const { text, payloadBytes } = await readInspectionPdfText(pdfFile)
      const extractedText = text.trim()

      if (!extractedText || extractedText.length < 20) {
        throw new Error('PDF text could not be extracted. Upload clearer PDF, images, or manually add findings.')
      }

      const draft = buildInspectionDraftFromExtractedText({
        fileName: file.name,
        text: extractedText,
        payloadBytes,
        request,
      })
      const status: InspectionProcessingStatus = draft.intelligence.repairItems.length
        ? 'needs_human_review'
        : 'inspection_review_drafted'
      const extractionSummary = draft.intelligence.executiveSummary

      await saveInspectionStateToLead(request, {
        propertyAddress: draft.propertyAddress || request.propertyAddress,
        city: draft.city || request.city,
        state: draft.state || request.state,
        inspectionIntelligence: draft.intelligence,
        inspectionProcessingStatus: status,
        inspectionExtractionSummary: extractionSummary,
        inspectionExtractionMessage: draft.missingInfo.length
          ? `Missing Info: ${draft.missingInfo.join(', ')}`
          : 'Inspection Review Drafted. Admin review required.',
      })
      await persistInspectionExtraction({
        request,
        file,
        status,
        extractedText,
        extractionSummary,
        payloadBytes,
      })
      setPdfProcessingByRequest((prev) => ({ ...prev, [request.id]: status }))
    } catch (error: any) {
      const message = error?.message || 'PDF text could not be extracted. Upload clearer PDF, images, or manually add findings.'
      await saveInspectionStateToLead(request, {
        inspectionProcessingStatus: 'extraction_failed',
        inspectionExtractionMessage: message,
      })
      await persistInspectionExtraction({
        request,
        file,
        status: 'extraction_failed',
        extractionSummary: message,
      })
      setPdfProcessingByRequest((prev) => ({ ...prev, [request.id]: 'extraction_failed' }))
      alert(message)
    }
  }

  async function processInspectionPdfsForRequest(request: WorkRequest) {
    const pdfs = request.documents.filter(isPdfEvidence)
    if (!pdfs.length) {
      alert('No uploaded PDF evidence is attached to this request.')
      return
    }

    await processInspectionPdf(request, pdfs[0])
  }

  async function runFirstPassEvidenceInterpretation(request: WorkRequest, files = getUniqueUploadedFiles(request)) {
    if (!hasAdminConsoleAccess || !files.length) return

    const pdf = files.find(isPdfEvidence)
    if (pdf) {
      await saveInspectionStateToLead(request, {
        inspectionProcessingStatus: 'extracting_pdf',
        inspectionExtractionMessage: 'Media uploaded. Interpretation pending.',
      })
      await processInspectionPdf(request, pdf)
      return
    }

    const findings = files.slice(0, 6).map((file) => {
      const category = getEvidenceCategory(file.name, '', file.type)
      if (category === 'photo') {
        return `${file.name}: uploaded photo evidence needs repair review, trade routing, missing information, and human verification before scope or pricing.`
      }
      if (category === 'video') {
        return `${file.name}: uploaded video evidence needs repair review, trade routing, missing information, and human verification before scope or pricing.`
      }
      return `${file.name}: uploaded document evidence needs repair review, trade routing, missing information, and human verification before scope or pricing.`
    })

    const intelligence = buildInspectionIntelligenceDraft({
      fileName: files[0]?.name || `uploaded-evidence-${request.id}`,
      reportType: 'Uploaded evidence review',
      propertyAddress: request.propertyAddress,
      city: request.city,
      state: request.state,
      inspectionDate: '',
      inspectorName: '',
      inspectorCompany: '',
      findings,
      missingInfo: ['Review uploaded evidence and confirm exact work area, trade, quantity, and source file.'],
      propertyId: request.propertyId || getRequestPropertyId(request),
    })

    await saveInspectionStateToLead(request, {
      inspectionIntelligence: intelligence,
      inspectionProcessingStatus: 'needs_human_review',
      inspectionExtractionSummary: intelligence.executiveSummary,
      inspectionExtractionMessage: 'First-pass media interpretation drafted work groups. Needs Human Review.',
    })
  }

  async function persistEvidenceItem(params: {
    request: WorkRequest
    file: StoredFile
    mode: 'full_pdf' | 'page' | 'range' | 'image' | 'file'
    status: EvidenceInspectionStatus
    pageNumber?: number | null
    pageRange?: string | null
    extractedText?: string
    extractionWarning?: string
  }) {
    try {
      await supabase.from('evidence_items').insert({
        property_id: getLinkedPropertyId(params.request),
        lead_id: asNullableUuid(params.request.id),
        file_id: asNullableUuid(params.file.id || ''),
        source_file_id: asNullableUuid(params.file.id || ''),
        storage_bucket: params.file.bucket || REQUEST_FILES_BUCKET,
        storage_path: params.file.path || '',
        file_name: params.file.name,
        file_type: params.file.type,
        mime_type: null,
        evidence_type: getEvidenceType(params.file, params.mode),
        page_number: params.pageNumber || null,
        page_range: params.pageRange || null,
        inspection_status: params.status,
        extraction_status: params.extractedText ? 'extracted' : params.status === 'failed' ? 'failed' : 'not_extracted',
        extracted_text: params.extractedText?.slice(0, 24000) || null,
        extracted_text_char_count: params.extractedText?.length || 0,
        extraction_warning: params.extractionWarning || null,
      })
    } catch (error) {
      console.warn('evidence_items table unavailable; evidence inspection finding still saved in property_media_findings.', error)
    }
  }

  async function createEvidenceFinding(params: {
    request: WorkRequest
    file: StoredFile
    observation: string
    findingType: string
    confidence: PropertyMediaConfidence
    fieldConsequence: string
    estimateImpact: string
    accessNotes?: string
    safetyNotes?: string
    adminNotes: string
  }) {
    const analysis = await ensureSiteMediaAnalysis(params.request, params.file)
    const record = {
      property_media_analysis_id: analysis.id,
      property_id: analysis.property_id ?? getLinkedPropertyId(params.request),
      lead_id: analysis.lead_id ?? asNullableUuid(params.request.id),
      finding_type: params.findingType,
      observation: params.observation,
      field_consequence: params.fieldConsequence,
      estimate_impact: params.estimateImpact,
      access_notes: params.accessNotes || '',
      safety_notes: params.safetyNotes || '',
      confidence: params.confidence,
      source_file_id: analysis.source_file_id ?? asNullableUuid(params.file.id || ''),
      review_status: 'needs_review' as PropertyMediaReviewStatus,
      admin_notes: params.adminNotes,
    }

    const { data, error } = await supabase
      .from('property_media_findings')
      .insert(record)
      .select()
      .single()

    if (error) throw error
    const saved = data as PropertyMediaFinding
    setSiteMediaFindingsByRequest((prev) => ({
      ...prev,
      [params.request.id]: [saved, ...(prev[params.request.id] || [])],
    }))
    return saved
  }

  async function inspectEvidenceFile(
    request: WorkRequest,
    file: StoredFile,
    mode: 'full_pdf' | 'page' | 'range' | 'image' | 'file' = 'file',
    pageInput = ''
  ) {
    if (!hasAdminConsoleAccess) {
      alert('Sign in as admin/owner before inspecting evidence.')
      return
    }

    const page = mode === 'page' || mode === 'range' ? parsePageRange(pageInput || '1') : { label: '', pageNumber: null, pageRange: null }
    const evidenceKey = getEvidenceKey(file, page.label || mode)
    setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [evidenceKey]: 'interpreting' }))

    try {
      if (isPdfEvidence(file)) {
        const { text, warning, pageCount } = await extractStoredPdfEvidenceText(file, page.label)
        const findings = extractInspectionFindings(text)
        const sourceLabel = `${file.name}${page.label ? ` - ${page.label}` : mode === 'full_pdf' ? ' - full PDF' : ''}`

        await persistEvidenceItem({
          request,
          file,
          mode,
          status: findings.length ? 'needs_admin_review' : 'interpretation_drafted',
          pageNumber: page.pageNumber,
          pageRange: page.pageRange,
          extractedText: text,
          extractionWarning: warning,
        })

        if (!findings.length) {
          await createEvidenceFinding({
            request,
            file,
            findingType: 'inspection_context',
            observation: `${sourceLabel}: no clear findings were extracted from readable text. ${warning}`,
            fieldConsequence: 'Needs human review of this evidence object before assuming the page has no findings.',
            estimateImpact: 'No pricing impact should be inferred until a clearer page/image or manual finding is reviewed.',
            confidence: text.length < 120 ? 'low' : 'medium',
            adminNotes: `Evidence-Level Inspection Intelligence. Source: ${sourceLabel}. ${warning}`,
          })
        } else {
          for (const finding of findings) {
            await createEvidenceFinding({
              request,
              file,
              findingType: /safety|hazard|sprinkler|fire|electrical/i.test(finding) ? 'safety' : 'inspection_context',
              observation: `${sourceLabel}: ${finding}`,
              fieldConsequence: 'AI Draft evidence finding from uploaded PDF text. Needs verification against the actual page/image and inspection context.',
              estimateImpact: 'May affect scope, trade routing, and repair-vs-credit discussion after admin review.',
              safetyNotes: /safety|hazard|sprinkler|fire|electrical/i.test(finding) ? 'Possible safety concern. Needs qualified review.' : '',
              confidence: text.length < 120 ? 'low' : 'medium',
              adminNotes: `Source file/page: ${sourceLabel}. ${warning}${pageCount ? ` Page count estimate: ${pageCount}.` : ''}`,
            })
          }
        }

        setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [evidenceKey]: 'needs_admin_review' }))
        return
      }

      if (isImageEvidence(file)) {
        await persistEvidenceItem({
          request,
          file,
          mode: 'image',
          status: 'needs_admin_review',
          extractionWarning: 'Image evidence inspection created a visual-review draft. Hidden conditions are not inferred as fact.',
        })
        await createEvidenceFinding({
          request,
          file,
          findingType: 'inspection_context',
          observation: `${file.name}: uploaded image evidence needs visual review. It appears to show property/media context, but visible conditions must be verified by admin before scope or pricing decisions.`,
          fieldConsequence: 'Possible visual evidence for scope, access, safety, material, or condition review. Needs human verification.',
          estimateImpact: 'Use as an estimate note only after admin labels the visible condition and confirms trade relevance.',
          accessNotes: 'Review access, staging, surrounding surfaces, and photo angle before relying on this image.',
          safetyNotes: 'Do not infer hidden damage. Use possible/appears language until verified.',
          confidence: 'low',
          adminNotes: `Evidence-Level Inspection Intelligence. Source image: ${file.name}. AI Draft visual observation only.`,
        })
        setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [evidenceKey]: 'needs_admin_review' }))
        return
      }

      await createEvidenceFinding({
        request,
        file,
        findingType: 'inspection_context',
        observation: `${file.name}: uploaded evidence file is linked for manual inspection.`,
        fieldConsequence: 'Manual evidence review required.',
        estimateImpact: 'No estimate impact until admin reviews the file.',
        confidence: 'low',
        adminNotes: `Evidence-Level Inspection Intelligence. Source file: ${file.name}.`,
      })
      setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [evidenceKey]: 'needs_admin_review' }))
    } catch (error: any) {
      console.error(error)
      await persistEvidenceItem({
        request,
        file,
        mode,
        status: 'failed',
        pageNumber: page.pageNumber,
        pageRange: page.pageRange,
        extractionWarning: error?.message || 'Evidence inspection failed.',
      })
      setEvidenceInspectionStatusByKey((prev) => ({ ...prev, [evidenceKey]: 'failed' }))
      alert(error?.message || 'Could not inspect this evidence file.')
    }
  }

  async function updateInspectionFinding(
    request: WorkRequest,
    itemId: string,
    changes: Partial<InspectionRepairItemDraft>
  ) {
    if (!hasAdminConsoleAccess || !request.inspectionIntelligence) return

    const nextIntelligence: InspectionIntelligenceDraft = {
      ...request.inspectionIntelligence,
      humanReviewStatus: 'needs_review',
      repairItems: request.inspectionIntelligence.repairItems.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item
      ),
    }

    const nextStatus: InspectionProcessingStatus = nextIntelligence.repairItems.every((item) => item.status === 'approved' || item.status === 'rejected')
      ? 'human_verified'
      : 'needs_human_review'

    setInspectionFindingSavingId(itemId)
    try {
      await saveInspectionStateToLead(request, {
        inspectionIntelligence: nextIntelligence,
        inspectionProcessingStatus: nextStatus,
        inspectionExtractionMessage: nextStatus === 'human_verified'
          ? 'Human Verified'
          : 'Needs Human Review',
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save inspection finding review.')
      await loadRequestsFromSupabase()
    } finally {
      setInspectionFindingSavingId(null)
    }
  }

  async function updateInspectionBundle(
    request: WorkRequest,
    bundleId: string,
    changes: Partial<InspectionRepairBundleDraft>
  ) {
    if (!hasAdminConsoleAccess || !request.inspectionIntelligence) return

    const updateBundles = (bundles: InspectionRepairBundleDraft[] = []) =>
      bundles.map((bundle) =>
        bundle.id === bundleId ? { ...bundle, ...changes } : bundle
      )
    const existingWorkGroups = request.inspectionIntelligence.workGroups || request.inspectionIntelligence.repairBundles || []
    const nextIntelligence: InspectionIntelligenceDraft = {
      ...request.inspectionIntelligence,
      humanReviewStatus: 'needs_review',
      repairBundles: updateBundles(request.inspectionIntelligence.repairBundles),
      workGroups: updateBundles(existingWorkGroups),
    }
    const activeGroups = (nextIntelligence.workGroups || nextIntelligence.repairBundles || [])
      .filter((bundle) => bundle.status !== 'rejected')
    const nextStatus: InspectionProcessingStatus = activeGroups.length > 0 && activeGroups.every((bundle) => isHumanVerifiedStatus(bundle.status))
      ? 'human_verified'
      : 'needs_human_review'

    setInspectionFindingSavingId(bundleId)
    try {
      await saveInspectionStateToLead(request, {
        inspectionIntelligence: nextIntelligence,
        inspectionProcessingStatus: nextStatus,
        inspectionExtractionMessage: nextStatus === 'human_verified' ? 'Human Verified' : 'Needs Human Review',
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save work group review.')
      await loadRequestsFromSupabase()
    } finally {
      setInspectionFindingSavingId(null)
    }
  }

  async function generateInspectionWorkGroups(request: WorkRequest) {
    if (!hasAdminConsoleAccess || !request.inspectionIntelligence) return

    const intelligence = request.inspectionIntelligence
    const propertyId = request.propertyId || getRequestPropertyId(request)
    const workGroups = isBerlinAveRequest(request)
      ? buildBerlinAveWorkGroups(intelligence.id || `inspection-${request.id}`, propertyId)
      : buildRepairBundles(intelligence.repairItems || [], propertyId)

    if (!workGroups.length) {
      alert('No readable inspection findings were available to generate work groups.')
      return
    }

    const nextIntelligence: InspectionIntelligenceDraft = {
      ...intelligence,
      humanReviewStatus: 'needs_review',
      repairBundles: workGroups,
      workGroups,
      tradeScopes: workGroups.map((bundle) => `${bundle.recommended_trade}: ${bundle.summary} Confirm ${bundle.finding_ids.length} finding${bundle.finding_ids.length === 1 ? '' : 's'} before pricing.`),
      priorityRoadmap: workGroups.map((bundle, index) => `${index + 1}. ${bundle.title}: ${bundle.priority}. ${bundle.risk_explanation}`),
      estimateLow: workGroups.reduce((sum, bundle) => sum + bundle.estimate_low, 0),
      estimateHigh: workGroups.reduce((sum, bundle) => sum + bundle.estimate_high, 0),
    }

    setInspectionFindingSavingId(`work-groups-${request.id}`)
    try {
      await saveInspectionStateToLead(request, {
        inspectionIntelligence: nextIntelligence,
        inspectionProcessingStatus: 'needs_human_review',
        inspectionExtractionMessage: 'Work groups generated from findings. Needs Human Review.',
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not generate work groups from findings.')
      await loadRequestsFromSupabase()
    } finally {
      setInspectionFindingSavingId(null)
    }
  }

  async function requestResearchForWorkGroup(
    request: WorkRequest,
    group: InspectionRepairBundleDraft,
    status: InspectionDraftStatus = 'research_requested'
  ) {
    if (!canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to request research.')
      return
    }

    const prompt = window.prompt(
      'What should the agent try to prove or find?',
      status === 'needs_more_info'
        ? `Find missing evidence needed to verify ${group.title}.`
        : `Research source context for ${group.title}: ${group.recommended_next_action || group.summary}`
    )
    if (!prompt?.trim()) return

    const files = getUniqueUploadedFiles(request)
    const linkedFile = files.find((file) => group.source_page && group.source_page.toLowerCase().includes(file.name.toLowerCase())) || files[0]
    const categories = normalizeResearchCategories(
      (group.resource_categories || []).filter((category): category is AgentResearchCategory =>
        AGENT_RESEARCH_CATEGORIES.includes(category as AgentResearchCategory)
      ),
      getSourceResearchDefaults(group.safety_concern ? 'safety' : 'property-specific', `${group.title} ${group.evidence_summary} ${group.recommended_next_action}`)
    )
    const scope: AgentResearchScope = categories.some((category) => ['Building code / jurisdiction', 'Safety guidance', 'Permit / inspection requirements'].includes(category))
      ? 'Official/code resources'
      : 'Uploaded files + property data'

    setInspectionFindingSavingId(group.id)
    setAgentResearchSavingId(`work-group-${group.id}`)
    try {
      const record = {
        property_id: getLinkedPropertyId(request),
        lead_id: asNullableUuid(request.id),
        finding_id: null,
        source_file_id: asNullableUuid(linkedFile?.id || ''),
        evidence_id: `work-group:${group.id}`,
        question: prompt.trim(),
        question_type: group.safety_concern ? 'safety' as AgentResearchQuestionType : 'property-specific' as AgentResearchQuestionType,
        research_scope: scope,
        research_categories: categories,
        status: 'queued' as AgentResearchTaskStatus,
        confidence: 'low' as PropertyMediaConfidence,
        needs_more_info_prompt: prompt.trim(),
        missing_information: prompt.trim(),
        recommended_next_action: 'Run Research, then admin must review sources and draft answer before verification.',
        online_search_requested: researchCategoriesRequestOnline(categories, scope),
        online_search_performed: false,
        internal_memory_used: false,
        official_sources_used: false,
        supplier_sources_used: false,
        source_quality: getPrimarySourceQuality(categories),
        answer_status: 'needs_review',
        source_priority: 'linked work group -> source evidence file/page/image -> extracted text -> property record -> admin notes -> allowed source categories',
        verified_for_memory: false,
        created_by: currentUserId,
      }

      const { data, error } = await supabase
        .from('agent_research_tasks')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      const saved = data as AgentResearchTask
      setAgentResearchTasksByRequest((prev) => ({
        ...prev,
        [request.id]: [saved, ...(prev[request.id] || [])],
      }))
      setSourceResearchMessage(request.id, `Research task created for ${group.title}. Drafting source-backed answer...`)
      await updateInspectionBundle(request, group.id, { status })
      await runWorkGroupResearchTask(request, group, saved)
    } catch (error: any) {
      console.error('[Work Group Research] Supabase insert/select error:', error)
      setSourceResearchMessage(request.id, `Supabase insert/select error: ${error?.message || 'Could not create work group research task.'}`)
      alert(error?.message || 'Could not create work group research task.')
    } finally {
      setInspectionFindingSavingId(null)
      setAgentResearchSavingId(null)
    }
  }

  async function archiveLead(request: WorkRequest) {
    const confirmed = window.confirm(
      `Archive this lead?

${request.propertyAddress || 'Untitled lead'}

This will hide it from the dashboard without deleting linked estimates, files, messages, or research.`
    )

    if (!confirmed) return

    try {
      setRequests((prev) => prev.filter((item) => item.id !== request.id))

      const { error } = await supabase
        .from('leads')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) throw error

      if (activeTab === 'archived') {
        await loadArchivedRequestsFromSupabase()
      }

      if (selectedEstimateRequest?.id === request.id) {
        setSelectedEstimateRequest(null)
        setEstimateItems([])
        setEstimateResearchRows([])
        setEstimateIntelligence(null)
        setJobExecutionSteps([])
        setAiResearchDrafts([])
        setPropertyAgentOutputsByRequest((prev) => {
          const next = { ...prev }
          delete next[request.id]
          return next
        })
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not archive lead.')
      await loadRequestsFromSupabase()
    }
  }

  async function runAiEstimate(request: WorkRequest) {
    setAiLoadingId(request.id)

    try {
      const { data, error } = await supabase.functions.invoke('ai-estimator', {
        body: {
          projectType: request.workType,
          location: `${request.city}, ${request.state} ${request.zip}`,
          scope: request.description,
          timeline: request.timeline,
          notes: `Urgency: ${request.urgency}. Occupancy: ${request.occupancy}. Address: ${request.propertyAddress}`,
          files: [...request.photos, ...request.documents],
        },
      })
      
      if (error) {
        console.error(error)
        alert('AI error: ' + error.message)
        return
      }

      const estimate: AiEstimate = data?.estimate || {
        projectSummary: data?.summary || 'AI estimate completed.',
        lowPrice: data?.lowEstimate || 0,
        standardPrice: data?.standardEstimate || data?.highEstimate || 0,
        premiumPrice: data?.premiumEstimate || data?.highEstimate || 0,
        pricingRationale: data?.pricingRationale || '',
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, status: 'estimate_ready', aiEstimate: estimate }
            : r
        )
      )

      alert(estimate.projectSummary || 'AI estimate completed.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI estimator failed.')
    } finally {
      setAiLoadingId(null)
    }
  }
  
  
  // PASTE SELLER PREP FUNCTION HERE
  async function runSellerPrepAnalysis(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create Seller Prep Intelligence: buyer impact score, inspection risk score, repair-vs-credit recommendation, and seller net impact. Continue?'
    )
  
    if (!confirmStart) return
  
    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }
  
    setSellerPrepLoadingId(request.id)

    try {
      const response = await fetch(`${AGENT_API_URL}/run-seller-prep-analysis`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType || '',
          zip: request.zip || '',
          request,
        }),
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result.error || 'Seller Prep analysis failed.')
      }
  
      alert(
        `Seller Prep analysis created. Items: ${result.itemCount || 0}. Human review required.`
      )
  
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Seller Prep analysis failed.')
    } finally {
      setSellerPrepLoadingId(null)
    }
  }


  function formatSellerPrepMoney(value: any) {
    const number = Number(value || 0)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(number)
  }

  function cleanSellerPrepText(value: any) {
    return escapeHtml(value)
  }

  function sellerPrepLabel(value: any) {
    return String(value || 'needs_human_review')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function printSellerPrepReport() {
    if (!sellerPrepReview) {
      alert('Open a Seller Prep Review first.')
      return
    }

    const analysis = sellerPrepReview.analysis || {}
    const items = sellerPrepReview.items || []

    const itemRows = items
      .map(
        (item: any) => `
          <div class="item">
            <h3>${cleanSellerPrepText(item.repair_item)}</h3>
            <p>${cleanSellerPrepText(item.scope_summary || 'No scope summary.')}</p>
            <div class="grid">
              <div><strong>Trade:</strong> ${cleanSellerPrepText(item.trade_category || 'General')}</div>
              <div><strong>Cost Range:</strong> ${formatSellerPrepMoney(item.estimated_cost_low)} - ${formatSellerPrepMoney(item.estimated_cost_high)}</div>
              <div><strong>Buyer Impact:</strong> ${item.buyer_impact_score || 0}/10</div>
              <div><strong>Inspection Risk:</strong> ${item.inspection_risk_score || 0}/10</div>
              <div><strong>Value / Negotiation Impact:</strong> ${formatSellerPrepMoney(item.estimated_value_impact_low)} - ${formatSellerPrepMoney(item.estimated_value_impact_high)}</div>
              <div><strong>Seller Net Impact:</strong> ${formatSellerPrepMoney(item.seller_net_impact_low)} - ${formatSellerPrepMoney(item.seller_net_impact_high)}</div>
              <div><strong>Recommendation:</strong> ${sellerPrepLabel(item.recommendation)}</div>
              <div><strong>Confidence:</strong> ${sellerPrepLabel(item.confidence)}</div>
            </div>
          </div>
        `
      )
      .join('')

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Seller Prep Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #123225; padding: 36px; line-height: 1.45; }
            .brand { letter-spacing: 8px; color: #06542d; font-size: 28px; font-weight: 800; margin-bottom: 4px; }
            .subbrand { letter-spacing: 5px; font-size: 12px; font-weight: 700; margin-bottom: 28px; }
            .summary { background: #e8f5eb; border: 1px solid #b7dfc1; border-radius: 14px; padding: 18px; margin: 18px 0; }
            .warning { background: #fff7df; border: 1px solid #eed38a; color: #6b4a00; border-radius: 14px; padding: 14px; margin: 18px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
            .item { border: 1px solid #ddd; border-radius: 14px; padding: 16px; margin: 14px 0; page-break-inside: avoid; }
            h1, h2, h3 { color: #06542d; }
            .footer { margin-top: 32px; font-size: 12px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }
            @media print { button { display: none; } body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="brand">SHELTER PREP</div>
          <div class="subbrand">HOME SERVICES</div>
          <h1>Seller Prep Report</h1>
          <p><strong>Powered by AI. Approved by humans.</strong></p>
          <div class="summary">
            <h2>Property Summary</h2>
            <p><strong>Address:</strong> ${cleanSellerPrepText(analysis.property_address || 'Not provided')}</p>
            <p><strong>Total Repair Range:</strong> ${formatSellerPrepMoney(analysis.total_repair_low)} - ${formatSellerPrepMoney(analysis.total_repair_high)}</p>
            <p><strong>Possible Value / Negotiation Impact:</strong> ${formatSellerPrepMoney(analysis.total_value_impact_low)} - ${formatSellerPrepMoney(analysis.total_value_impact_high)}</p>
            <p><strong>Seller Net Impact:</strong> ${formatSellerPrepMoney(analysis.seller_net_low)} - ${formatSellerPrepMoney(analysis.seller_net_high)}</p>
            <p><strong>Average Buyer Impact:</strong> ${analysis.average_buyer_impact_score || 0}/10</p>
            <p><strong>Average Inspection Risk:</strong> ${analysis.average_inspection_risk_score || 0}/10</p>
          </div>
          <div class="warning">AI-assisted analysis only. Human review is required before sending, approving, ordering materials, submitting proposals, or making final recommendations.</div>
          <h2>Agent Summary</h2>
          <p>${cleanSellerPrepText(analysis.agent_summary || 'No agent summary available.')}</p>
          <h2>Seller Summary</h2>
          <p>${cleanSellerPrepText(analysis.seller_summary || 'No seller summary available.')}</p>
          <h2>Repair Items</h2>
          ${itemRows || '<p>No seller prep items found.</p>'}
          <div class="footer">Shelter Prep report. AI-assisted draft. Human review required.</div>
          <script>window.onload = function () { window.print() }</script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Please allow popups, then try again.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  async function openSellerPrepReview(request: WorkRequest) {
    setSellerPrepLoadingId(request.id)
  
    try {
      const { data: analyses, error: analysisError } = await supabase
        .from('seller_prep_analyses')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: false })
        .limit(1)
  
      if (analysisError) throw analysisError
  
      const analysis = analyses?.[0]
  
      if (!analysis) {
        alert('No Seller Prep analysis found yet. Click Run Seller Prep Analysis first.')
        return
      }
      const { data: items, error: itemsError } = await supabase
        .from('seller_prep_items')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('sort_order', { ascending: true })
  
      if (itemsError) throw itemsError
  
      setSellerPrepReview({
        analysis,
        items: items || [],
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not open Seller Prep Review.')
    } finally {
      setSellerPrepLoadingId(null)
    }
  }

  function buildSellerPrepDraft(request: WorkRequest) {
    const intelligence = buildEstimateIntelligence({
      id: request.id,
      workType: request.workType,
      description: request.description,
      urgency: request.urgency,
      occupancy: request.occupancy,
      timeline: request.timeline,
      city: request.city,
      state: request.state,
      zip: request.zip,
      propertyFacts: request.propertyFacts,
      photoCount: request.photos.length,
      documentCount: request.documents.length,
    })

    const missing = getMissingInfoItems(request)
    const highRisk = normalizeLaborText([request.description, request.workType].join(' '))
    const baseItems = intelligence.draftItems.slice(0, 4).map((item, index) => {
      const total = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      const mustFix =
        highRisk.includes('inspection') ||
        highRisk.includes('roof') ||
        highRisk.includes('leak') ||
        highRisk.includes('electrical') ||
        highRisk.includes('plumb')

      return {
        id: makeId(),
        analysis_id: '',
        repair_item: item.itemName.replace(/\s*\([^)]*\)\s*$/, ''),
        trade_category: intelligence.tradeBreakdown[index] || intelligence.primaryTrade,
        estimated_low: Math.round(total * 0.9),
        estimated_high: Math.round(total * 1.25 + intelligence.laborSubtotal / Math.max(intelligence.draftItems.length, 1)),
        buyer_impact_score: mustFix ? 8 : index === 0 ? 7 : 5,
        inspection_risk_score: mustFix ? 8 : missing.length ? 6 : 4,
        recommendation: mustFix ? 'must_fix' : index % 2 === 0 ? 'optional' : 'buyer_credit_candidate',
        missing_info: missing.join(', ') || 'None obvious',
        ai_notes: `Rule-based V1 draft. Quantity basis: ${intelligence.quantityBasis.join('; ')}`,
        human_review_status: 'needs_review',
      } satisfies SellerPrepItemV1
    })

    const items = baseItems.length
      ? baseItems
      : [
          {
            id: makeId(),
            analysis_id: '',
            repair_item: request.workType || 'General seller prep repair',
            trade_category: 'General Repair',
            estimated_low: Math.round(intelligence.suggestedLow),
            estimated_high: Math.round(intelligence.suggestedHigh),
            buyer_impact_score: 6,
            inspection_risk_score: missing.length ? 6 : 4,
            recommendation: 'needs_human_review',
            missing_info: missing.join(', ') || 'None obvious',
            ai_notes: 'Rule-based V1 fallback item. Human review required.',
            human_review_status: 'needs_review',
          },
        ]

    const totalLow = items.reduce((sum, item) => sum + Number(item.estimated_low || 0), 0)
    const totalHigh = items.reduce((sum, item) => sum + Number(item.estimated_high || 0), 0)
    const analysis: SellerPrepAnalysisV1 = {
      id: makeId(),
      lead_id: request.id,
      property_address: request.propertyAddress,
      summary: `${request.workType} seller-prep draft for ${request.propertyAddress || 'the property'}. Review ${items.length} item(s), missing info, likely buyer impact, and inspection risk before sharing.`,
      total_low_estimate: totalLow,
      total_high_estimate: totalHigh,
      seller_net_impact:
        totalHigh > 0
          ? `Draft prep range is ${money(totalLow)} - ${money(totalHigh)}. Must-fix items may reduce buyer credits or inspection friction, but human review is required before recommendations.`
          : 'No priced seller-prep range yet. Add details and review manually.',
      confidence: missing.length ? 'medium_with_missing_info' : 'medium_rule_based',
      human_review_status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return { analysis, items }
  }

  async function runSellerPrepDraftV1(request: WorkRequest) {
    const { analysis, items } = buildSellerPrepDraft(request)
    setSellerPrepAnalysisV1(analysis)
    setSellerPrepItemsV1(items)
    setSellerPrepSelectedId(request.id)
    setActiveTab('sellerPrep')

    try {
      const { data: savedAnalysis, error: analysisError } = await supabase
        .from('seller_prep_analyses')
        .insert({
          lead_id: request.id,
          property_address: request.propertyAddress,
          summary: analysis.summary,
          total_low_estimate: analysis.total_low_estimate,
          total_high_estimate: analysis.total_high_estimate,
          seller_net_impact: analysis.seller_net_impact,
          confidence: analysis.confidence,
          human_review_status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (analysisError) throw analysisError

      const nextItems = items.map((item) => ({
        analysis_id: savedAnalysis.id,
        repair_item: item.repair_item,
        trade_category: item.trade_category,
        estimated_low: item.estimated_low,
        estimated_high: item.estimated_high,
        buyer_impact_score: item.buyer_impact_score,
        inspection_risk_score: item.inspection_risk_score,
        recommendation: item.recommendation,
        missing_info: item.missing_info,
        ai_notes: item.ai_notes,
        human_review_status: 'needs_review',
      }))

      const { data: savedItems, error: itemsError } = await supabase
        .from('seller_prep_items')
        .insert(nextItems)
        .select()

      if (itemsError) throw itemsError

      setSellerPrepAnalysisV1(savedAnalysis as SellerPrepAnalysisV1)
      setSellerPrepItemsV1((savedItems || []) as SellerPrepItemV1[])
      alert('Seller Prep draft saved. Human approval is required before final report/send.')
    } catch (error: any) {
      console.error(error)
      alert(
        `${error?.message || 'Could not save Seller Prep draft to Supabase.'} Showing local draft only. Run the Seller Prep migration if needed.`
      )
    }
  }

  async function loadSellerPrepDraftForRequest(request: WorkRequest) {
    setSellerPrepSelectedId(request.id)
    setActiveTab('sellerPrep')

    const { data: analyses, error } = await supabase
      .from('seller_prep_analyses')
      .select('*')
      .eq('lead_id', request.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !analyses?.[0]) {
      runSellerPrepDraftV1(request)
      return
    }

    const analysis = analyses[0] as SellerPrepAnalysisV1
    const { data: items, error: itemsError } = await supabase
      .from('seller_prep_items')
      .select('*')
      .eq('analysis_id', analysis.id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      alert(itemsError.message)
      return
    }

    setSellerPrepAnalysisV1(analysis)
    setSellerPrepItemsV1((items || []) as SellerPrepItemV1[])
  }

  function updateSellerPrepItemLocal(id: string, changes: Partial<SellerPrepItemV1>) {
    setSellerPrepItemsV1((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }

  async function saveSellerPrepItem(item: SellerPrepItemV1) {
    setSellerPrepSavingId(item.id)

    try {
      const { data, error } = await supabase
        .from('seller_prep_items')
        .update({
          estimated_low: Number(item.estimated_low || 0),
          estimated_high: Number(item.estimated_high || 0),
          recommendation: item.recommendation || 'needs_human_review',
          human_review_status: item.human_review_status || 'needs_review',
          missing_info: item.missing_info || '',
          ai_notes: item.ai_notes || '',
        })
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      updateSellerPrepItemLocal(item.id, data as SellerPrepItemV1)
    } catch (error: any) {
      alert(error?.message || 'Could not save Seller Prep item.')
    } finally {
      setSellerPrepSavingId(null)
    }
  }

  async function markSellerPrepAnalysisApproved() {
    if (!sellerPrepAnalysisV1) return
    const unapproved = sellerPrepItemsV1.some((item) => !isHumanVerifiedStatus(item.human_review_status))

    if (unapproved) {
      alert('Human verify or reject each Seller Prep item before marking the analysis human verified.')
      return
    }

    const { data, error } = await supabase
      .from('seller_prep_analyses')
      .update({ human_review_status: 'human_verified', updated_at: new Date().toISOString() })
      .eq('id', sellerPrepAnalysisV1.id)
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    setSellerPrepAnalysisV1(data as SellerPrepAnalysisV1)
  }

  async function saveSellerPrepItemAsPricingMemory(item: SellerPrepItemV1) {
    const selected = requests.find((request) => request.id === sellerPrepSelectedId)

    if (!isHumanVerifiedStatus(item.human_review_status)) {
      alert('Approve the Seller Prep item before saving it as pricing memory.')
      return
    }

    const verifiedPrice = Number(item.estimated_high || item.estimated_low || 0)
    if (verifiedPrice <= 0) {
      alert('Add a verified estimate amount before saving pricing memory.')
      return
    }

    const { error } = await supabase.from('pricing_memory_entries').insert({
      item_name: item.repair_item,
      category: item.recommendation || 'seller_prep',
      trade: item.trade_category || '',
      repair_type: item.repair_item,
      description: item.ai_notes || '',
      city: selected?.city || '',
      state: selected?.state || '',
      zip: selected?.zip || '',
      property_type: selected?.propertyFacts?.propertyType || '',
      unit: 'project',
      verified_price: verifiedPrice,
      unit_cost: verifiedPrice,
      total_cost: verifiedPrice,
      source: 'seller_prep_human_verified',
      confidence_level: 'medium',
      human_verified: true,
      notes: `Saved from Seller Prep item ${item.id}. Human verified before pricing memory.`,
      last_checked: new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Saved as verified pricing memory.')
    await loadPricingMemoryEntries()
  }

  async function ensureLeadExists(request: WorkRequest) {
    const { data: existing, error: selectError } = await supabase
      .from('leads')
      .select('id, property_id')
      .eq('id', request.id)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing?.id) {
      if (!existing.property_id) {
        const propertyRecordId = await ensureRequestProperty(
          request.id,
          request.propertyAddress,
          request.city,
          request.state,
          request.zip
        )
        if (propertyRecordId) {
          setRequests((prev) =>
            prev.map((item) => (item.id === request.id ? { ...item, propertyId: propertyRecordId } : item))
          )
        }
      }
      return
    }

    const { error: insertError } = await supabase.from('leads').insert({
      id: request.id,
      name: request.requesterName,
      email: request.email,
      phone: request.phone,
      address: request.propertyAddress,
      city: request.city,
      state: request.state,
      zip: request.zip,
      description: request.description,
      status: request.status,
    })

    if (insertError) throw insertError
    const propertyRecordId = await ensureRequestProperty(
      request.id,
      request.propertyAddress,
      request.city,
      request.state,
      request.zip
    )
    if (propertyRecordId) {
      setRequests((prev) =>
        prev.map((item) => (item.id === request.id ? { ...item, propertyId: propertyRecordId } : item))
      )
    }
  }

  async function researchMaterials(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create an AI material research draft only. Human review is required before any estimate, proposal, purchase order, email, or submission is sent.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setResearchingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/research-materials`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          zip: request.zip,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'AI material research failed.')
      }

      alert(
        `AI research draft created. ${result.itemCount || 0} estimate items saved. Human review required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI material research failed.')
    } finally {
      setResearchingId(null)
    }
  }


  async function generateRoughMaterialList(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create a rough material list with draft quantities and prices. Human review is required before any estimate, proposal, purchase order, email, submission, or material order.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setMaterialListLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/generate-material-list`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'Rough material list failed.')
      }

      alert(
        `Rough material list created. ${result.itemCount || 0} priced material items saved to Estimate Review. Human review required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Rough material list failed.')
    } finally {
      setMaterialListLoadingId(null)
    }
  }


  async function generateAiTakeoff(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create a rough AI quantity takeoff for sqft, linear feet, cubic yards, gallons, bundles, sheets, and draft material quantities. Human/site verification is required before any estimate, proposal, purchase order, email, submission, or material order.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setTakeoffLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/generate-takeoff`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'AI takeoff failed.')
      }

      alert(
        `AI quantity takeoff created. ${result.measurementCount || 0} measurements and ${result.itemCount || 0} priced material items saved. Open Estimate Review to review/edit/approve. Human verification required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI takeoff failed.')
    } finally {
      setTakeoffLoadingId(null)
    }
  }

  async function buildMaterialEstimate(request: WorkRequest) {
    const classification = classifyMaterialListComplexity(request)
    const classificationSummary = `${materialComplexityLabel(classification.level)} (${classification.confidence} confidence): ${classification.reason}`

    if (classification.level === 'unknown_needs_review') {
      alert(
        [
          'Material list is draft unless human verified.',
          classificationSummary,
          '',
          'Follow-up questions before material takeoff:',
          ...(classification.missingInfo.length ? classification.missingInfo : ['Add dimensions, photos, and scope detail before material takeoff.']),
        ].join('\n')
      )
      return
    }

    const confirmStart = window.confirm(
      [
        'Material list is draft unless human verified.',
        classificationSummary,
        '',
        classification.level === 'large_complex'
          ? 'Large/complex scope: this will create material categories, assumptions, missing measurements, likely trade packages, and a review checklist. It will not pretend precise quantities.'
          : classification.level === 'medium_defined'
            ? 'Medium/defined scope: this will create draft material ranges, quantity assumptions, and missing-info flags.'
            : 'Small/simple scope: this will create a detailed draft material list with admin review still required.',
      ].join('\n')
    )

    if (!confirmStart) return

    setMaterialEstimateLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const { data: memoryRows, error: memoryError } = await supabase
        .from('pricing_memory_entries')
        .select('*')
        .eq('human_verified', true)
        .order('last_checked', { ascending: false })

      if (memoryError) throw memoryError
      const humanPricingMatches = await loadVerifiedPricingMemory(request)
      const mappedHumanPricingMemory: PricingMemoryEntry[] = humanPricingMatches.map((memory) => ({
        id: memory.id,
        created_at: memory.reviewed_at || null,
        item_name: memory.item_name || null,
        category: memory.work_type || 'Material',
        unit: memory.unit || 'unit',
        verified_price: memory.human_approved_price || null,
        zip: memory.zip || null,
        source: memory.source || 'human_pricing_memory',
        human_verified: true,
        notes: memory.admin_notes || 'Based on verified memory from similar jobs.',
        last_checked: memory.reviewed_at || null,
      }))

      const sourceText = [request.workType, request.description].join(' ').toLowerCase()
      const memoryEntries = [
        ...mappedHumanPricingMemory,
        ...((memoryRows || []) as PricingMemoryEntry[]),
      ]

      const deckDraftLines = sourceText.includes('deck') && classification.level !== 'large_complex'
        ? buildDeckMaterialEstimateLines(request, memoryEntries)
        : []
      const intelligence = buildEstimateIntelligence({
        id: request.id,
        workType: request.workType,
        description: request.description,
        urgency: request.urgency,
        occupancy: request.occupancy,
        timeline: request.timeline,
        city: request.city,
        state: request.state,
        zip: request.zip,
        propertyFacts: request.propertyFacts,
        photoCount: request.photos.length,
        documentCount: request.documents.length,
      })

      const inserts = deckDraftLines.map((line) => ({
        property_id: getRequestPropertyId(request),
        job_id: request.id,
        request_id: request.id,
        repair_item_id: getDefaultRepairItemId(request, line.materialName),
        lead_id: request.id,
        item_name: line.materialName,
        category: line.category,
        source: line.source,
        source_url: line.sourceUrl,
        quantity: line.packagesNeeded,
        unit_price: line.packagePrice,
        original_unit_price: line.packagePrice,
        total_price: line.extendedTotal,
        required_quantity: line.requiredQuantity,
        required_unit: line.requiredUnit,
        package_size: line.packageSize,
        package_unit: line.packageUnit,
        package_coverage: line.packageCoverage,
        package_coverage_unit: line.packageCoverageUnit,
        packages_needed: line.packagesNeeded,
        package_price: line.packagePrice,
        extended_total: line.extendedTotal,
        quantity_reason: line.quantityReason,
        scope_source: 'current_request_scope',
        relevance_reason: `${request.workType || 'Deck'} scope: ${line.category}`,
        source_status: line.sourceStatus,
        review_status: line.reviewStatus,
        confidence: line.confidence,
        material_complexity: classification.level,
        quantity_low: Math.max(0, Math.floor(Number(line.requiredQuantity || line.packagesNeeded || 1) * 0.9 * 100) / 100),
        quantity_high: Math.ceil(Number(line.requiredQuantity || line.packagesNeeded || 1) * 1.15 * 100) / 100,
        required_optional: 'required',
        admin_editable: true,
        material_review_notes: [
          'Material list is draft unless human verified.',
          classificationSummary,
          ...classification.missingInfo,
        ].join('\n'),
        human_approved: false,
      }))

      if (inserts.length === 0 && classification.level !== 'large_complex') {
        inserts.push(...intelligence.draftItems.map((item) => {
          const quantity = Number(item.quantity || 1)
          const low = classification.level === 'small_simple' ? quantity : Math.max(0, Math.floor(quantity * 0.8 * 100) / 100)
          const high = classification.level === 'small_simple' ? quantity : Math.ceil(quantity * 1.25 * 100) / 100
          return {
            property_id: getRequestPropertyId(request),
            job_id: request.id,
            request_id: request.id,
            repair_item_id: getDefaultRepairItemId(request, item.itemName),
            lead_id: request.id,
            item_name: item.itemName,
            category: item.unit === 'allowance' ? 'Material allowance' : 'Material',
            source: item.source,
            source_url: null,
            quantity: high,
            unit_price: item.unitPrice,
            original_unit_price: item.unitPrice,
            total_price: high * item.unitPrice,
            required_quantity: quantity,
            required_unit: item.unit,
            package_size: null,
            package_unit: item.unit,
            package_coverage: null,
            package_coverage_unit: null,
            packages_needed: high,
            package_price: item.unitPrice,
            extended_total: high * item.unitPrice,
            quantity_reason: classification.level === 'small_simple'
              ? 'Small/simple scope: detailed draft quantity generated from scope text. Admin review still required.'
              : 'Medium/defined scope: quantity range generated from scope text and available media. Missing info may change takeoff.',
            scope_source: 'material_complexity_classifier',
            relevance_reason: `${classification.level}: ${item.itemName} included for ${request.workType || 'current scope'}.`,
            source_status: classification.level === 'small_simple' ? 'draft_detailed_takeoff' : 'draft_range_takeoff',
            review_status: 'needs_review',
            confidence: item.confidence,
            material_complexity: classification.level,
            quantity_low: low,
            quantity_high: high,
            required_optional: 'required',
            admin_editable: true,
            material_review_notes: [
              'Material list is draft unless human verified.',
              classificationSummary,
              ...classification.missingInfo,
            ].join('\n'),
            human_approved: false,
          }
        }))
      }

      if (classification.level === 'large_complex') {
        inserts.push(...classification.tradePackages.map((tradePackage, index) => ({
          property_id: getRequestPropertyId(request),
          job_id: request.id,
          request_id: request.id,
          repair_item_id: getDefaultRepairItemId(request, tradePackage),
          lead_id: request.id,
          item_name: `${tradePackage} material package - needs measured takeoff`,
          category: 'Material category',
          source: 'Shelter Prep complexity classifier',
          source_url: null,
          quantity: 1,
          unit_price: 0,
          original_unit_price: 0,
          total_price: 0,
          required_quantity: 1,
          required_unit: 'package',
          package_size: null,
          package_unit: 'package',
          package_coverage: null,
          package_coverage_unit: null,
          packages_needed: 1,
          package_price: 0,
          extended_total: 0,
          quantity_reason: 'Large/complex scope: category only. Do not use as precise material quantity.',
          scope_source: 'material_complexity_classifier',
          relevance_reason: `Large/complex scope likely needs ${tradePackage} materials; measured takeoff required before estimating.`,
          source_status: 'category_review_only',
          review_status: 'needs_review',
          confidence: index === 0 ? classification.confidence : 'low',
          material_complexity: classification.level,
          quantity_low: null,
          quantity_high: null,
          required_optional: 'review',
          admin_editable: true,
          material_review_notes: [
            'Material list is draft unless human verified.',
            classificationSummary,
            'Assumptions:',
            ...classification.reviewChecklist,
            'Missing measurements:',
            ...(classification.missingInfo.length ? classification.missingInfo : ['Measured takeoff required before detailed material list.']),
          ].join('\n'),
          human_approved: false,
        })))
      }

      const { data, error } = await supabase
        .from('estimate_items')
        .insert(inserts)
        .select()

      if (error) {
        const message = String(error.message || '')
        const isSchemaMismatch =
          message.includes('column') ||
          message.includes('schema cache') ||
          message.includes('Could not find')

        if (isSchemaMismatch) {
          const localItems = inserts.map((item) => ({
            ...item,
            id: makeId(),
            created_at: new Date().toISOString(),
          })) as EstimateItem[]

          setActiveTab('estimates')
          setSelectedEstimateRequest(request)
          setEstimateItems(localItems)
          setEstimateResearchRows([])
          setEstimateIntelligence(null)
          await loadVerifiedPricingMemory(request)
          await loadVerifiedFieldMemory(request)
          await applyBestLaborRateForRequest(request, false)

          alert(
            'Material estimate built as a local draft because Supabase is missing material package/classification columns. Apply the material package and material complexity migrations to save these rows to the database.'
          )
          return
        }
        throw error
      }

      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      setEstimateItems((data || []) as EstimateItem[])
      setEstimateResearchRows([])
      setEstimateIntelligence(null)
      await loadVerifiedPricingMemory(request)
      await loadVerifiedFieldMemory(request)
      await applyBestLaborRateForRequest(request, false)

      alert(
        `Material estimate built with ${inserts.length} review line(s). ${classificationSummary}. Material list is draft unless human verified.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not build material estimate.')
    } finally {
      setMaterialEstimateLoadingId(null)
    }
  }

  async function autoProcessLead(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will auto-process the lead: AI intake review, quantity takeoff, material pricing, missing-info draft, and status update. It will NOT send emails, submit proposals, order materials, or approve estimates. Human review is still required.'
    )
  
    if (!confirmStart) return
  
    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }
  
    setAutoWorkflowLoadingId(request.id)
  
    try {
      await ensureLeadExists(request)
  
      const response = await fetch(`${AGENT_API_URL}/auto-process-lead`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })
  
      const result = await response.json().catch(() => ({}))
  
      if (!response.ok) {
        throw new Error(result?.error || 'Auto workflow failed.')
      }
  
      alert(
        `Auto workflow complete. Status: ${
          result.nextStatus || 'review'
        }. ${result.itemCount || 0} draft items created. ${
          result.missingInfo?.length || 0
        } missing-info items found. Human review required.`
      )
  
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Auto workflow failed.')
    } finally {
      setAutoWorkflowLoadingId(null)
    }
  }

  async function applyBestLaborRateForRequest(request: WorkRequest, showAlert = true) {
    try {
      const { data, error } = await supabase
        .from('labor_rates')
        .select('*')
        .eq('human_verified', true)
        .gt('typical_rate', 0)
        .order('last_checked', { ascending: false })

      if (error) throw error

      const rates = ((data || []) as LaborRate[]).filter((rate) =>
        Number(rate.typical_rate || 0) > 0
      )

      const scored = rates
        .map((rate) => ({ rate, score: scoreLaborRateForRequest(rate, request) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)

      const best = scored[0]?.rate || null

      if (!best) {
        const draft = buildCuratedLaborDraftForRequest(request, null)
        const totals = curatedLaborTotal(
          Number(draft.laborHoursLow || 0),
          Number(draft.laborHoursHigh || 0),
          Number(draft.hourlyRateLow || 0),
          Number(draft.hourlyRateHigh || 0),
          Number(draft.accessMultiplier || 1),
          Number(draft.setupCleanupHours || 0)
        )
        setAppliedLaborRate(null)
        setCuratedLaborDraft(draft)
        setEstimateLaborUnits(draft.laborHoursHigh)
        setEstimateMinimumCharge('0')
        setEstimateTripCharge('0')
        setEstimateDisposalFee('0')
        setEstimateLaborCost(String(totals.standard))
        setEstimateLaborMessage(
          'Curated labor estimate. Admin approval required. No verified Shelter Prep labor memory matched, so the draft uses benchmark and public wage references.'
        )

        if (showAlert) {
          alert('No verified labor memory matched. A curated draft was created from benchmark/public wage references. Admin approval is required.')
        }

        return null
      }

      const defaultUnits = getDefaultLaborUnits(best, request)
      const minimum = Number(best.minimum_charge || 0)
      const trip = Number(best.trip_charge || 0)
      const disposal = Number(best.disposal_fee || 0)
      const calculatedTotal = calculateLaborTotalFromRate(
        best,
        String(defaultUnits),
        String(minimum),
        String(trip),
        String(disposal)
      )
      const draft = buildCuratedLaborDraftForRequest(request, best, defaultUnits)
      const draftTotals = curatedLaborTotal(
        Number(draft.laborHoursLow || 0),
        Number(draft.laborHoursHigh || 0),
        Number(draft.hourlyRateLow || 0),
        Number(draft.hourlyRateHigh || 0),
        Number(draft.accessMultiplier || 1),
        Number(draft.setupCleanupHours || 0)
      )

      setAppliedLaborRate(best)
      setCuratedLaborDraft(draft)
      setEstimateLaborUnits(String(defaultUnits))
      setEstimateMinimumCharge(String(minimum))
      setEstimateTripCharge(String(trip))
      setEstimateDisposalFee(String(disposal))
      setEstimateLaborCost(String(draftTotals.standard || calculatedTotal))
      setEstimateLaborMessage(
        `Curated labor estimate. Admin approval required. Prioritized verified labor memory: ${best.trade}${best.job_type ? ` / ${best.job_type}` : ''}.`
      )

      return best
    } catch (error: any) {
      console.error(error)
      setEstimateLaborMessage(error?.message || 'Could not load labor rates.')

      if (showAlert) {
        alert(error?.message || 'Could not load labor rates.')
      }

      return null
    }
  }

  function loadLocalJobScopeSteps(request: WorkRequest) {
    try {
      return JSON.parse(
        window.localStorage.getItem(getJobScopeStorageKey(request.id)) || '[]'
      ) as JobExecutionStep[]
    } catch {
      return []
    }
  }

  function saveLocalJobScopeSteps(request: WorkRequest, steps: JobExecutionStep[]) {
    window.localStorage.setItem(
      getJobScopeStorageKey(request.id),
      JSON.stringify(sortJobExecutionSteps(steps))
    )
  }

  async function loadVerifiedJobStepMemory(request: WorkRequest) {
    try {
      const { data, error } = await supabase
        .from('job_execution_step_learning')
        .select('*')
        .in('status', ['approved', 'edited', 'added_by_human'])
        .order('reviewed_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const matches = ((data || []) as JobExecutionStepLearningRecord[])
        .filter((record) => jobScopeMemoryMatchesCurrentRequest(record, request))
        .slice(0, 6)
      setMatchedJobStepMemory(matches)
      return matches
    } catch (error) {
      console.warn('Verified job step memory unavailable; continuing without learned scope context.', error)
      setMatchedJobStepMemory([])
      return []
    }
  }

  async function loadVerifiedPricingMemory(request: WorkRequest) {
    try {
      const { data, error } = await supabase
        .from('human_pricing_memory')
        .select('*')
        .eq('human_verified', true)
        .order('reviewed_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const matches = ((data || []) as HumanPricingMemory[])
        .filter((record) => pricingMemoryMatchesCurrentRequest(record, request))
        .slice(0, 8)
      setMatchedPricingMemory(matches)
      return matches
    } catch (error) {
      console.warn('Human pricing memory unavailable; continuing without pricing memory context.', error)
      setMatchedPricingMemory([])
      return []
    }
  }

  async function loadVerifiedFieldMemory(request: WorkRequest) {
    try {
      const { data, error } = await supabase
        .from('photo_field_memory')
        .select('*')
        .eq('human_verified', true)
        .order('reviewed_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const requestText = normalizeJobScopeTokenText([
        request.workType,
        request.description,
        request.propertyFacts?.propertyType || '',
        request.occupancy,
      ].join(' '))
      const requestTokens = requestText.split(' ').filter((word) => word.length > 4)
      const matches = ((data || []) as PhotoFieldMemory[])
        .filter((record) => {
          const memoryText = normalizeJobScopeTokenText([
            record.trade_category,
            record.photo_description,
            record.field_consequence,
            record.estimate_impact,
            record.follow_up_lesson,
            ...(record.required_line_items || []),
            ...(record.risk_flags || []),
          ].join(' '))
          const matchedTokens = requestTokens.filter((word) => memoryText.includes(word))
          return matchedTokens.length >= Math.min(2, requestTokens.length || 2)
        })
        .slice(0, 4)
      setMatchedFieldMemory(matches)
      return matches
    } catch (error) {
      console.warn('Photo/field memory unavailable; continuing without field memory context.', error)
      setMatchedFieldMemory([])
      return []
    }
  }

  function refreshJobScopeLaborTotals(steps: JobExecutionStep[]) {
    const approvedSteps = steps.filter((step) => isHumanVerifiedStatus(step.status))
    const activeSteps = steps.filter((step) => step.status !== 'rejected')
    const sourceSteps = approvedSteps.length ? approvedSteps : activeSteps
    const highHours = sourceSteps.reduce((sum, step) => sum + Number(step.estimated_hours_high || 0), 0)

    if (approvedSteps.length > 0 && highHours > 0) {
      setEstimateLaborUnits(String(Math.round(highHours * 100) / 100))
      setJobScopeMessage(
        `Approved job scope is feeding ${Math.round(highHours * 100) / 100} labor hours into the estimate summary.`
      )
    }
  }

  async function loadJobExecutionScope(request: WorkRequest, createDraftIfMissing = true) {
    const learnedRecords = await loadVerifiedJobStepMemory(request)

    try {
      const { data, error } = await supabase
        .from('job_execution_steps')
        .select('*')
        .eq('job_request_id', request.id)
        .order('step_number', { ascending: true })

      if (error) throw error

      const rows = sortJobExecutionSteps((data || []) as JobExecutionStep[])
      if (rows.length) {
        setJobExecutionSteps(rows)
        setJobScopeMessage('Loaded saved job execution scope. Human approval is still required for draft steps.')
        refreshJobScopeLaborTotals(rows)
        return
      }
    } catch (error) {
      console.warn('Job execution scope table unavailable; using local scope storage.', error)
    }

    const localRows = sortJobExecutionSteps(loadLocalJobScopeSteps(request))
    if (localRows.length) {
      setJobExecutionSteps(localRows)
      setJobScopeMessage('Loaded locally saved job execution scope. Add the database table when ready to sync across devices.')
      refreshJobScopeLaborTotals(localRows)
      return
    }

    if (!createDraftIfMissing) {
      setJobExecutionSteps([])
      return
    }

    const draftSteps = buildJobExecutionSteps(request, learnedRecords)
    setJobExecutionSteps(draftSteps)
    saveLocalJobScopeSteps(request, draftSteps)
    setJobScopeMessage('AI-generated draft steps created locally. Review, edit, and approve before final estimate/proposal.')
    refreshJobScopeLaborTotals(draftSteps)
  }

  async function generateJobExecutionScope(request: WorkRequest) {
    const draftSteps = buildJobExecutionSteps(request, await loadVerifiedJobStepMemory(request))
    setJobExecutionSteps(draftSteps)
    saveLocalJobScopeSteps(request, draftSteps)
    setJobScopeMessage('New AI-generated job execution draft created. Human approval required before final use.')

    try {
      await ensureLeadExists(request)
      const { error } = await supabase.from('job_execution_steps').insert(draftSteps)
      if (error) throw error
    } catch (error) {
      console.warn('Job execution scope was saved locally only.', error)
    }
  }

  function updateLocalJobExecutionStep(id: string, changes: Partial<JobExecutionStep>) {
    setJobExecutionSteps((prev) => {
      const next = sortJobExecutionSteps(
        prev.map((step) => (step.id === id ? { ...step, ...changes } : step))
      )
      if (selectedEstimateRequest) saveLocalJobScopeSteps(selectedEstimateRequest, next)
      refreshJobScopeLaborTotals(next)
      return next
    })
  }

  function addManualJobExecutionStep() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const nextStep: JobExecutionStep = {
      id: makeId(),
      created_at: new Date().toISOString(),
      property_id: getRequestPropertyId(selectedEstimateRequest),
      job_request_id: selectedEstimateRequest.id,
      repair_item_id: getDefaultRepairItemId(selectedEstimateRequest, selectedEstimateRequest.workType),
      step_number: jobExecutionSteps.length + 1,
      title: 'Manual scope step',
      labor_scope: 'Describe the labor needed for this step.',
      trade: selectedEstimateRequest.workType || 'General labor',
      estimated_hours_low: 1,
      estimated_hours_high: 2,
      materials_tools: '',
      equipment: '',
      safety_notes: '',
      access_notes: '',
      cleanup_notes: '',
      disposal_needed: false,
      confidence: 'human_added',
      status: 'needs_review',
      admin_notes: '',
    }

    const nextSteps = sortJobExecutionSteps([...jobExecutionSteps, nextStep])
    setJobExecutionSteps(nextSteps)
    saveLocalJobScopeSteps(selectedEstimateRequest, nextSteps)
    setJobScopeMessage('Manual job step added. Edit it, then approve when ready.')
    void saveJobExecutionStep(nextStep, 'added', false)
  }

  async function recordJobStepLearning(
    step: JobExecutionStep,
    action: JobExecutionStepAction,
    confidenceBefore = step.confidence
  ) {
    const request = selectedEstimateRequest
    const status =
      action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : action === 'added' ? 'added_by_human' : 'edited'
    const record: JobExecutionStepLearningRecord = {
      property_id: step.property_id || getRequestPropertyId(request),
      work_request_id: step.job_request_id || request?.id || null,
      repair_item_id: step.repair_item_id || getDefaultRepairItemId(request, step.title),
      work_type: request?.workType || step.trade || 'General repair',
      repair_context: getCurrentScopeReason(request),
      repair_description_context: getCurrentScopeReason(request),
      step_title: step.title,
      labor_scope: step.labor_scope,
      trade: step.trade,
      ai_hours_low: Number(step.estimated_hours_low || 0),
      ai_hours_high: Number(step.estimated_hours_high || 0),
      approved_hours_low: action === 'rejected' ? null : Number(step.estimated_hours_low || 0),
      approved_hours_high: action === 'rejected' ? null : Number(step.estimated_hours_high || 0),
      approved_hours: action === 'rejected' ? null : Number(step.estimated_hours_high || 0),
      materials_tools: step.materials_tools,
      equipment: step.equipment,
      access_notes: step.access_notes,
      safety_notes: step.safety_notes,
      cleanup_notes: step.cleanup_notes,
      disposal_needed: step.disposal_needed,
      rejected_reason: action === 'rejected' ? step.admin_notes || 'Rejected by admin' : null,
      admin_notes: step.admin_notes || null,
      status,
      confidence_before: confidenceBefore || 'ai_draft',
      confidence_after: step.confidence || (action === 'rejected' ? 'human_rejected' : 'human_reviewed'),
      reviewed_at: new Date().toISOString(),
    }

    try {
      const { error } = await supabase.from('job_execution_step_learning').insert(record)
      if (error) throw error
      if (request) await loadVerifiedJobStepMemory(request)
    } catch (error) {
      console.warn('Job step learning table unavailable; learning record was not saved.', error)
    }
  }

  async function saveJobExecutionStep(
    step: JobExecutionStep,
    action: JobExecutionStepAction = 'edited',
    logLearning = true,
    confidenceBeforeOverride?: string
  ) {
    if (!selectedEstimateRequest) return

    setJobStepSavingId(step.id)
    const confidenceBefore = confidenceBeforeOverride || step.confidence
    const normalized: JobExecutionStep = {
      ...step,
      property_id: step.property_id || getRequestPropertyId(selectedEstimateRequest),
      job_request_id: step.job_request_id || selectedEstimateRequest.id,
      repair_item_id: step.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, step.title),
      estimated_hours_low: Number(step.estimated_hours_low || 0),
      estimated_hours_high: Number(step.estimated_hours_high || 0),
    }

    try {
      const { data, error } = await supabase
        .from('job_execution_steps')
        .upsert(normalized)
        .select()
        .single()

      if (error) throw error

      const savedStep = data as JobExecutionStep
      const nextSteps = sortJobExecutionSteps(
        jobExecutionSteps.map((existing) => (existing.id === savedStep.id ? savedStep : existing))
      )
      setJobExecutionSteps(nextSteps)
      saveLocalJobScopeSteps(selectedEstimateRequest, nextSteps)
      refreshJobScopeLaborTotals(nextSteps)

      if (logLearning) await recordJobStepLearning(savedStep, action, confidenceBefore)
      setJobScopeMessage('Job step saved. Approved steps count toward the labor scope total.')
    } catch (error) {
      console.warn('Job step saved locally only.', error)
      const nextSteps = sortJobExecutionSteps(
        jobExecutionSteps.map((existing) => (existing.id === normalized.id ? normalized : existing))
      )
      setJobExecutionSteps(nextSteps)
      saveLocalJobScopeSteps(selectedEstimateRequest, nextSteps)
      refreshJobScopeLaborTotals(nextSteps)
      if (logLearning) await recordJobStepLearning(normalized, action, confidenceBefore)
      setJobScopeMessage('Job step saved locally. Add the job_execution_steps table when ready to sync across devices.')
    } finally {
      setJobStepSavingId(null)
    }
  }

  async function approveJobExecutionStep(step: JobExecutionStep) {
    const updated: JobExecutionStep = {
      ...step,
      status: 'human_verified',
      confidence: 'human_approved',
    }
    updateLocalJobExecutionStep(step.id, updated)
    await saveJobExecutionStep(updated, 'approved', true, step.confidence)
  }

  async function rejectJobExecutionStep(step: JobExecutionStep) {
    if (!step.admin_notes.trim()) {
      alert('Add an admin note or rejection reason before rejecting this step.')
      return
    }

    const updated: JobExecutionStep = {
      ...step,
      status: 'rejected',
      confidence: 'human_rejected',
    }
    updateLocalJobExecutionStep(step.id, updated)
    await saveJobExecutionStep(updated, 'rejected', true, step.confidence)
  }

  async function moveJobExecutionStep(id: string, direction: -1 | 1) {
    if (!selectedEstimateRequest) return
    const sorted = sortJobExecutionSteps(jobExecutionSteps)
    const index = sorted.findIndex((step) => step.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return

    const next = [...sorted]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(nextIndex, 0, moved)
    const renumbered = next.map((step, stepIndex) => ({ ...step, step_number: stepIndex + 1 }))

    setJobExecutionSteps(renumbered)
    saveLocalJobScopeSteps(selectedEstimateRequest, renumbered)
    refreshJobScopeLaborTotals(renumbered)
    setJobScopeMessage('Step order updated. Save any edited steps when ready.')

    await Promise.all(renumbered.map((step) => saveJobExecutionStep(step, 'reordered', false)))
  }

  function loadLocalAiResearchDrafts(request: WorkRequest) {
    try {
      return JSON.parse(
        window.localStorage.getItem(getAiResearchDraftStorageKey(request.id)) || '[]'
      ) as AiResearchDraft[]
    } catch {
      return []
    }
  }

  function saveLocalAiResearchDrafts(request: WorkRequest, drafts: AiResearchDraft[]) {
    window.localStorage.setItem(getAiResearchDraftStorageKey(request.id), JSON.stringify(drafts))
  }

  async function loadAiResearchDrafts(request: WorkRequest) {
    try {
      const { data, error } = await supabase
        .from('ai_research_drafts')
        .select('*')
        .eq('job_request_id', request.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as AiResearchDraft[]
      setAiResearchDrafts(rows)
      setAiResearchMessage(
        rows.length
          ? 'AI Research Draft — Human Review Required. Approved research can support estimate assumptions.'
          : 'AI Research Draft — Human Review Required. Add material, supplier, code, or safety research as draft evidence.'
      )
      return
    } catch (error) {
      console.warn('AI research drafts table unavailable; using local storage.', error)
    }

    const localRows = loadLocalAiResearchDrafts(request)
    setAiResearchDrafts(localRows)
    setAiResearchMessage(
      localRows.length
        ? 'Loaded local AI research drafts. Add the ai_research_drafts table when ready to sync across devices.'
        : 'AI Research Draft — Human Review Required. Draft pricing does not affect totals until approved and attached.'
    )
  }

  function updateLocalAiResearchDraft(id: string, changes: Partial<AiResearchDraft>) {
    setAiResearchDrafts((prev) => {
      const next = prev.map((draft) => (draft.id === id ? { ...draft, ...changes } : draft))
      if (selectedEstimateRequest) saveLocalAiResearchDrafts(selectedEstimateRequest, next)
      return next
    })
  }

  function addAiResearchDraft() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const draft: AiResearchDraft = {
      id: makeId(),
      created_at: new Date().toISOString(),
      lead_id: selectedEstimateRequest.id,
      property_id: getRequestPropertyId(selectedEstimateRequest),
      job_request_id: selectedEstimateRequest.id,
      repair_item_id: getDefaultRepairItemId(selectedEstimateRequest, selectedEstimateRequest.workType),
      research_topic: 'Material price / supplier reference',
      source_name: '',
      source_url: '',
      item_material_name: '',
      observed_price: null,
      availability_note: '',
      confidence: 'ai_draft',
      screenshot_file_reference: '',
      ai_notes: '',
      human_review_status: 'ai_draft',
      admin_notes: '',
      reviewed_at: null,
    }

    const next = [draft, ...aiResearchDrafts]
    setAiResearchDrafts(next)
    saveLocalAiResearchDrafts(selectedEstimateRequest, next)
    setAiResearchMessage('New AI research draft added. It will not affect estimate totals until approved and attached.')
    void saveAiResearchDraft(draft, false)
  }

  async function saveAiResearchDraft(draft: AiResearchDraft, showMessage = true) {
    if (!selectedEstimateRequest) return

    const normalized: AiResearchDraft = {
      ...draft,
      lead_id: draft.lead_id || selectedEstimateRequest.id,
      property_id: draft.property_id || getRequestPropertyId(selectedEstimateRequest),
      job_request_id: draft.job_request_id || selectedEstimateRequest.id,
      repair_item_id: draft.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, draft.item_material_name || draft.research_topic),
      observed_price: draft.observed_price === null ? null : Number(draft.observed_price || 0),
      reviewed_at:
        isHumanVerifiedStatus(draft.human_review_status) || draft.human_review_status === 'rejected'
          ? draft.reviewed_at || new Date().toISOString()
          : draft.reviewed_at,
    }

    setAiResearchSavingId(draft.id)

    try {
      const { data, error } = await supabase
        .from('ai_research_drafts')
        .upsert(normalized)
        .select()
        .single()

      if (error) throw error

      const saved = data as AiResearchDraft
      const next = aiResearchDrafts.map((item) => (item.id === saved.id ? saved : item))
      setAiResearchDrafts(next)
      saveLocalAiResearchDrafts(selectedEstimateRequest, next)
      if (showMessage) setAiResearchMessage('AI research draft saved. Human approval is still required before use.')
    } catch (error) {
      console.warn('AI research draft saved locally only.', error)
      const next = aiResearchDrafts.map((item) => (item.id === normalized.id ? normalized : item))
      setAiResearchDrafts(next)
      saveLocalAiResearchDrafts(selectedEstimateRequest, next)
      if (showMessage) setAiResearchMessage('AI research draft saved locally. Add the ai_research_drafts table when ready to sync.')
    } finally {
      setAiResearchSavingId(null)
    }
  }

  async function setAiResearchDraftStatus(draft: AiResearchDraft, status: AiResearchDraftStatus) {
    if (status === 'rejected' && !draft.admin_notes.trim()) {
      alert('Add admin notes before rejecting this research draft.')
      return
    }

    const updated: AiResearchDraft = {
      ...draft,
      human_review_status: status,
      confidence: isHumanVerifiedStatus(status) ? 'human_verified' : status === 'rejected' ? 'human_rejected' : draft.confidence,
      reviewed_at: isHumanVerifiedStatus(status) || status === 'rejected' ? new Date().toISOString() : draft.reviewed_at,
    }

    updateLocalAiResearchDraft(draft.id, updated)
    await saveAiResearchDraft(updated)
  }

  async function attachApprovedResearchToEstimate(draft: AiResearchDraft) {
    if (!selectedEstimateRequest) return

    if (!isHumanVerifiedStatus(draft.human_review_status)) {
      alert('Approve this research draft before attaching its price to the estimate.')
      return
    }

    const price = Number(draft.observed_price || 0)
    if (price <= 0) {
      alert('Add an observed price before attaching this research to an estimate item.')
      return
    }

    const itemName = draft.item_material_name.trim() || draft.research_topic.trim()
    if (!itemName) {
      alert('Add an item/material name first.')
      return
    }

    try {
      await ensureLeadExists(selectedEstimateRequest)

      const insert = {
        property_id: getRequestPropertyId(selectedEstimateRequest),
        job_id: selectedEstimateRequest.id,
        request_id: selectedEstimateRequest.id,
        repair_item_id: draft.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, itemName),
        lead_id: selectedEstimateRequest.id,
        item_name: itemName,
        category: draft.research_topic || 'AI research approved material',
        source: draft.source_name || 'AI Research Draft',
        source_url: draft.source_url || null,
        quantity: 1,
        unit_price: price,
        original_unit_price: price,
        total_price: price,
        required_quantity: 1,
        required_unit: 'item',
        package_size: 1,
        package_unit: 'item',
        packages_needed: 1,
        package_price: price,
        extended_total: price,
        quantity_reason: draft.ai_notes || draft.availability_note || 'Approved AI research draft attached as estimate assumption.',
        scope_source: 'approved_ai_research_draft',
        relevance_reason: `Approved research for ${selectedEstimateRequest.workType || 'current job'}: ${draft.research_topic}`,
        source_status: 'approved_research',
        review_status: 'needs_review',
        confidence: 'approved_research_needs_estimate_review',
        human_approved: false,
        admin_notes: draft.admin_notes || null,
      }

      const { data, error } = await supabase.from('estimate_items').insert(insert).select().single()
      if (error) throw error

      setEstimateItems((prev) => [...prev, data as EstimateItem])
      setAiResearchMessage('Approved research attached as a new estimate item. Review and approve the estimate line before proposal use.')
    } catch (error) {
      console.warn('Approved research attached locally only.', error)
      const localItem: EstimateItem = {
        id: makeId(),
        lead_id: selectedEstimateRequest.id,
        property_id: getRequestPropertyId(selectedEstimateRequest),
        job_id: selectedEstimateRequest.id,
        request_id: selectedEstimateRequest.id,
        repair_item_id: draft.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, itemName),
        item_name: itemName,
        category: draft.research_topic || 'AI research approved material',
        source: draft.source_name || 'AI Research Draft',
        source_url: draft.source_url || null,
        quantity: 1,
        unit_price: price,
        original_unit_price: price,
        total_price: price,
        required_quantity: 1,
        required_unit: 'item',
        package_size: 1,
        package_unit: 'item',
        packages_needed: 1,
        package_price: price,
        extended_total: price,
        quantity_reason: draft.ai_notes || draft.availability_note || 'Approved AI research draft attached as estimate assumption.',
        scope_source: 'approved_ai_research_draft',
        relevance_reason: `Approved research for ${selectedEstimateRequest.workType || 'current job'}: ${draft.research_topic}`,
        source_status: 'approved_research',
        review_status: 'needs_review',
        confidence: 'approved_research_needs_estimate_review',
        human_approved: false,
        admin_notes: draft.admin_notes || null,
      }
      setEstimateItems((prev) => [...prev, localItem])
      setAiResearchMessage('Approved research attached locally as an estimate item. Save the line item after database tables are ready.')
    }
  }

  function saveLocalJobPacketMetadata(metadata: JobPacketMetadata) {
    try {
      const existing = JSON.parse(window.localStorage.getItem(JOB_PACKET_METADATA_LOCAL_STORAGE_KEY) || '[]')
      window.localStorage.setItem(
        JOB_PACKET_METADATA_LOCAL_STORAGE_KEY,
        JSON.stringify([metadata, ...existing].slice(0, 200))
      )
    } catch {
      window.localStorage.setItem(JOB_PACKET_METADATA_LOCAL_STORAGE_KEY, JSON.stringify([metadata]))
    }
  }

  async function saveJobPacketMetadata(metadata: JobPacketMetadata) {
    saveLocalJobPacketMetadata(metadata)

    try {
      const { error } = await supabase.from('job_packets').insert({
        lead_id: metadata.lead_id,
        property_id: metadata.lead_id,
        job_request_id: metadata.lead_id,
        property_address: metadata.property_address,
        file_name: metadata.file_name,
        generated_at: metadata.generated_at,
        generated_by: metadata.generated_by,
        packet_status: metadata.packet_status,
        approved_labor_hours: metadata.approved_labor_hours,
        estimate_total: metadata.estimate_total,
        review_status: metadata.review_status,
        metadata,
      })
      if (error) throw error
    } catch (error) {
      console.warn('Job packet metadata saved locally only.', error)
    }
  }

  async function getJobPacketRows(request: WorkRequest) {
    const isCurrentRequest = selectedEstimateRequest?.id === request.id
    let packetEstimateItems = isCurrentRequest ? currentScopeEstimateItems : [] as EstimateItem[]
    let packetJobSteps = isCurrentRequest ? currentJobScopeSteps : [] as JobExecutionStep[]
    let packetResearchDrafts = isCurrentRequest ? aiResearchDrafts : [] as AiResearchDraft[]
    let packetSiteMediaFindings = isCurrentRequest ? currentSiteMediaEstimateFindings : [] as PropertyMediaFinding[]

    if (!isCurrentRequest) {
      try {
        const { data } = await supabase.from('estimate_items').select('*').eq('lead_id', request.id).order('created_at', { ascending: true })
        packetEstimateItems = ((data || []) as EstimateItem[]).filter((item) => estimateItemMatchesCurrentScope(item, request))
      } catch (error) {
        console.warn('Could not load estimate items for packet.', error)
      }

      try {
        const { data } = await supabase.from('job_execution_steps').select('*').eq('job_request_id', request.id).order('step_number', { ascending: true })
        packetJobSteps = sortJobExecutionSteps((data || []) as JobExecutionStep[])
      } catch (error) {
        console.warn('Could not load job steps for packet; using local fallback.', error)
        packetJobSteps = sortJobExecutionSteps(loadLocalJobScopeSteps(request))
      }

      try {
        const { data } = await supabase.from('ai_research_drafts').select('*').eq('job_request_id', request.id).order('created_at', { ascending: false })
        packetResearchDrafts = (data || []) as AiResearchDraft[]
      } catch (error) {
        console.warn('Could not load AI research drafts for packet; using local fallback.', error)
        packetResearchDrafts = loadLocalAiResearchDrafts(request)
      }

      try {
        const { data } = await supabase
          .from('property_media_findings')
          .select('*')
          .eq('lead_id', request.id)
          .in('review_status', ['approved', 'human_verified'])
          .order('created_at', { ascending: false })
        packetSiteMediaFindings = (data || []) as PropertyMediaFinding[]
      } catch (error) {
        console.warn('Could not load site media findings for packet.', error)
      }
    }

    return { packetEstimateItems, packetJobSteps, packetResearchDrafts, packetSiteMediaFindings }
  }

  async function exportJobPacket(request: WorkRequest) {
    const { packetEstimateItems, packetJobSteps, packetResearchDrafts, packetSiteMediaFindings } = await getJobPacketRows(request)
    const packetApprovedSteps = packetJobSteps.filter((step) => isHumanVerifiedStatus(step.status))
    const packetActiveSteps = packetJobSteps.filter((step) => step.status !== 'rejected')
    const approvedLaborLow = packetApprovedSteps.reduce((sum, step) => sum + Number(step.estimated_hours_low || 0), 0)
    const approvedLaborHigh = packetApprovedSteps.reduce((sum, step) => sum + Number(step.estimated_hours_high || 0), 0)
    const materialSubtotal = packetEstimateItems
      .filter((item) => !isEstimateItemRejected(item))
      .reduce((sum, item) => sum + Number(item.total_price || 0), 0)
    const totals = calculateEstimateTotals(
      packetEstimateItems,
      selectedEstimateRequest?.id === request.id ? estimateLaborCost : '0',
      estimateMarkupPercent,
      estimateContingencyPercent
    )
    const generatedAt = new Date().toISOString()
    const fileName = `shelter-prep-${slugForFileName(request.propertyAddress)}-${todayFileStamp()}.pdf`
    const humanReviewStatus =
      packetEstimateItems.every((item) => item.human_approved || isEstimateItemRejected(item)) &&
      packetActiveSteps.every((step) => isHumanVerifiedStatus(step.status))
        ? 'human_verified'
        : 'needs_review'

    const fileLines = [...request.photos, ...request.documents].map((file) =>
      `${file.type}: ${file.name}${file.url ? ` (${file.url})` : ''}`
    )

    const sections = [
      {
        heading: 'Property Information',
        lines: [
          `Address: ${request.propertyAddress}, ${request.city}, ${request.state} ${request.zip}`,
          `Work type: ${request.workType}`,
          `Urgency: ${request.urgency}`,
          `Occupancy: ${request.occupancy}`,
          `Timeline: ${request.timeline || 'Not provided'}`,
          `Property type: ${request.propertyFacts?.propertyType || 'Not verified'}`,
          `Generated: ${new Date(generatedAt).toLocaleString()}`,
        ],
      },
      {
        heading: 'Requester / Client Details',
        lines: [
          `Name: ${request.requesterName}`,
          `Email: ${request.email}`,
          `Phone: ${request.phone || 'Not provided'}`,
        ],
      },
      {
        heading: 'Work Request Description',
        lines: [request.description || 'No description provided.'],
      },
      {
        heading: 'Uploaded Files / Photo References',
        lines: fileLines.length ? fileLines : ['No uploaded files or photo references found.'],
      },
      {
        heading: 'Approved Site Media Notes',
        lines: packetSiteMediaFindings.length
          ? packetSiteMediaFindings.map((finding) =>
              `${finding.finding_type}: ${finding.observation}. Field consequence: ${finding.field_consequence || 'Needs human verification.'} Estimate impact: ${finding.estimate_impact || 'Needs human verification.'} Access: ${finding.access_notes || 'Needs human verification.'} Safety: ${finding.safety_notes || 'Needs human verification.'}`
            )
          : ['No approved Site Media Intelligence findings found.'],
      },
      {
        heading: 'Repair / Estimate Items',
        lines: packetEstimateItems.length
          ? packetEstimateItems.map((item) =>
              `${item.human_approved ? 'Approved' : isEstimateItemRejected(item) ? 'Rejected' : 'Needs review'} - ${item.item_name}: qty ${Number(item.quantity || 0)} at ${money(Number(item.unit_price || 0))}, total ${money(Number(item.total_price || 0))}. Notes: ${item.admin_notes || item.quantity_reason || 'None'}`
            )
          : ['No repair or estimate line items found.'],
      },
      {
        heading: 'Job Execution Scope Steps',
        lines: packetJobSteps.length
          ? packetJobSteps.flatMap((step) => [
              `Step ${step.step_number}: ${step.title} (${step.status})`,
              `Labor scope: ${step.labor_scope}`,
              `Trade: ${step.trade}; Hours: ${step.estimated_hours_low}-${step.estimated_hours_high}`,
              `Materials/tools: ${step.materials_tools || 'Not listed'}`,
              `Equipment: ${step.equipment || 'Not listed'}`,
              `Safety: ${step.safety_notes || 'None listed'}`,
              `Access: ${step.access_notes || 'None listed'}`,
              `Cleanup/disposal: ${step.cleanup_notes || 'None listed'}; Disposal needed: ${step.disposal_needed ? 'yes' : 'no'}`,
              `Admin notes: ${step.admin_notes || 'None'}`,
            ])
          : ['No job execution scope steps found.'],
      },
      {
        heading: 'AI Research Drafts',
        lines: packetResearchDrafts.length
          ? packetResearchDrafts.map((draft) =>
              `${draft.human_review_status} - ${draft.research_topic}: ${draft.item_material_name || 'item not named'} at ${money(draft.observed_price)} from ${draft.source_name || 'source not listed'} ${draft.source_url || ''}. Notes: ${draft.ai_notes || draft.admin_notes || 'None'}`
            )
          : ['No AI research drafts found.'],
      },
      {
        heading: 'Estimate Summary',
        lines: [
          `Materials subtotal: ${money(materialSubtotal)}`,
          `Approved labor hours: ${approvedLaborLow.toFixed(1)}-${approvedLaborHigh.toFixed(1)}`,
          `Labor total: ${money(totals.labor)}`,
          `Markup: ${totals.markup}% = ${money(totals.markupDollars)}`,
          `Contingency: ${totals.contingency}% = ${money(totals.contingencyDollars)}`,
          `Standard estimate: ${money(totals.standardTotal)}`,
          `Suggested range: ${money(totals.lowTotal)} - ${money(totals.premiumTotal)}`,
        ],
      },
      {
        heading: 'Human Review Status / Admin Notes',
        lines: [
          `Packet review status: ${humanReviewStatus}`,
          `Estimate notes: ${selectedEstimateRequest?.id === request.id ? estimateNotes : 'Open Estimate Review for current notes.'}`,
          'AI drafts are not final approval, client communication, purchase authorization, or proposal delivery.',
        ],
      },
    ]

    const blob = buildSimplePdfBlob('Shelter Prep Job Packet', sections)
    downloadBlob(blob, fileName)

    await saveJobPacketMetadata({
      id: makeId(),
      lead_id: request.id,
      property_address: request.propertyAddress,
      file_name: fileName,
      generated_at: generatedAt,
      generated_by: 'admin',
      packet_status: 'generated',
      approved_labor_hours: approvedLaborHigh,
      estimate_total: totals.standardTotal,
      review_status: humanReviewStatus,
    })

    alert(`Job packet exported: ${fileName}`)
  }

  async function openEstimateReview(request: WorkRequest) {
    setActiveTab('estimates')
    setSelectedEstimateRequest(request)
    setEstimateLoading(true)

    try {
      await ensureLeadExists(request)

      const { data: items, error: itemError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: true })

      if (itemError) throw itemError

      const { data: researchRows, error: researchError } = await supabase
        .from('estimate_research')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: false })

      if (researchError) throw researchError

      setEstimateItems((items || []) as EstimateItem[])
      setEstimateResearchRows((researchRows || []) as EstimateResearchRow[])
      setEstimateIntelligence(null)
      await loadVerifiedPricingMemory(request)
      await loadVerifiedFieldMemory(request)
      await applyBestLaborRateForRequest(request, false)
      await loadJobExecutionScope(request)
      await loadAiResearchDrafts(request)
      await loadSiteMediaIntelligence(request)

      if (!items || items.length === 0) {
        alert('No estimate items found yet. Click AI Research Materials on this request first, or add manual line items in the estimator.')
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load estimate review.')
    } finally {
      setEstimateLoading(false)
    }
  }

  async function buildLocalEstimateIntelligence(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will build a local Shelter Prep estimate intelligence draft: rough quantities, material allowances, urgency labor, overhead, coordination, risk buffers, and a contractor packet. Human review is required before use.'
    )

    if (!confirmStart) return

    const result = buildEstimateIntelligence({
      id: request.id,
      workType: request.workType,
      description: request.description,
      urgency: request.urgency,
      occupancy: request.occupancy,
      timeline: request.timeline,
      city: request.city,
      state: request.state,
      zip: request.zip,
      propertyFacts: request.propertyFacts,
      photoCount: request.photos.length,
      documentCount: request.documents.length,
    })

    setEstimateIntelligence(result)
    await loadJobExecutionScope(request)
    setEstimateLaborUnits(String(result.laborHours))
    setEstimateLaborCost(String(result.laborSubtotal))
    setEstimateMinimumCharge('0')
    setEstimateTripCharge('0')
    setEstimateDisposalFee('0')
    setAppliedLaborRate(null)
    setCuratedLaborDraft(buildCuratedLaborDraftForRequest(request, null, result.laborHours))
    setEstimateMarkupPercent(String(result.overheadPercent + result.coordinationPercent))
    setEstimateContingencyPercent(String(result.riskPercent))
    setEstimateLaborMessage(
      `Applied Shelter Prep ${result.primaryTrade} intelligence: ${result.laborHours} hours at ${money(result.laborRate)}/hr blended ${result.urgencyMultiplier > 1 ? 'urgent' : 'standard'} rate.`
    )
    setEstimateNotes(
      [
        'Shelter Prep Estimate Intelligence draft. Human/site verification required.',
        `Trades: ${result.tradeBreakdown.join(', ')}`,
        `Quantity basis: ${result.quantityBasis.join('; ')}`,
        `Missing info: ${result.missingInfo.join(', ') || 'none obvious'}`,
        `Risk flags: ${result.riskFlags.join('; ') || 'standard risk'}`,
      ].join('\n')
    )

    const shouldSaveItems = window.confirm(
      `Draft range: ${money(result.suggestedLow)} - ${money(result.suggestedHigh)}. Save ${result.draftItems.length} draft material/allowance line items into Estimate Review?`
    )

    if (!shouldSaveItems) {
      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      return
    }

    try {
      await ensureLeadExists(request)

      const inserts = result.draftItems.map((item) => ({
        property_id: getRequestPropertyId(request),
        job_id: request.id,
        request_id: request.id,
        repair_item_id: getDefaultRepairItemId(request, item.itemName),
        lead_id: request.id,
        item_name: `${item.itemName} (${item.unit})`,
        source: item.source,
        source_url: null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        original_unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice,
        scope_source: 'estimate_intelligence_current_scope',
        relevance_reason: `${request.workType || 'Current'} scope: ${item.itemName}`,
        source_status: item.source === 'fallback_product_search' ? 'needs_source_review' : 'current_scope',
        review_status: 'needs_review',
        confidence: item.confidence,
        human_approved: false,
      }))

      const { data, error } = await supabase
        .from('estimate_items')
        .insert(inserts)
        .select()

      if (error) throw error

      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      setEstimateItems((prev) => [...prev, ...((data || []) as EstimateItem[])])
      alert('Estimate intelligence draft saved. Review and approve line items before sending anything.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save estimate intelligence draft items.')
    }
  }

  function updateLocalEstimateItem(id: string, changes: Partial<EstimateItem>) {
    setEstimateItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...changes }
        const qty = Number(next.quantity || 0)
        const unit = Number(next.unit_price || 0)
        return { ...next, total_price: qty * unit }
      })
    )
  }

  function updateManualMaterialDraft(changes: Partial<ManualMaterialDraft>) {
    setManualMaterialDraft((prev) => {
      const next = { ...prev, ...changes }
      const quantity = Number(next.quantity || 0)
      const unitCost = Number(next.unitCost || 0)

      if (
        (changes.quantity !== undefined || changes.unitCost !== undefined) &&
        quantity > 0 &&
        unitCost >= 0
      ) {
        next.totalCost = String(Math.round(quantity * unitCost * 100) / 100)
      }

      return next
    })
  }

  async function recordMaterialReviewLearning(
    item: EstimateItem,
    action: MaterialReviewAction,
    overrides: Partial<EstimateItem> = {}
  ) {
    const request = selectedEstimateRequest
    const reviewedItem = { ...item, ...overrides }
    const originalUnitPrice = Number(reviewedItem.original_unit_price ?? item.original_unit_price ?? item.unit_price ?? 0)
    const reviewedUnitPrice = Number(reviewedItem.unit_price || 0)
    const quantity = Number(reviewedItem.quantity || 0)
    const finalTotal = Number(reviewedItem.total_price || quantity * reviewedUnitPrice || 0)
    const now = new Date().toISOString()

    const memoryRecord = {
      property_id: reviewedItem.property_id || getRequestPropertyId(request),
      job_id: reviewedItem.job_id || request?.id || reviewedItem.lead_id,
      request_id: reviewedItem.request_id || request?.id || reviewedItem.lead_id,
      repair_item_id: reviewedItem.repair_item_id || getDefaultRepairItemId(request, reviewedItem.item_name),
      work_type: request?.workType || reviewedItem.category || 'Material estimate',
      repair_description: getCurrentScopeReason(request),
      material_name: reviewedItem.item_name,
      vendor_source: reviewedItem.source || '',
      source_url: reviewedItem.source_url || '',
      original_unit_price: originalUnitPrice,
      reviewed_unit_price: reviewedUnitPrice,
      quantity,
      final_total: finalTotal,
      admin_action: action,
      rejection_reason: reviewedItem.rejection_reason || null,
      admin_notes: reviewedItem.admin_notes || null,
      confidence_before: item.confidence || 'needs_review',
      confidence_after: reviewedItem.confidence || (action === 'rejected' ? 'human_rejected' : 'human_reviewed'),
      created_at: now,
      reviewed_at: now,
    }

    try {
      const { error } = await supabase.from('material_review_memory').insert(memoryRecord)
      if (error) throw error
    } catch (error) {
      console.warn('Material review memory table unavailable; learning record was not saved.', error)
    }
  }

  async function recordHumanPricingMemory(
    item: EstimateItem,
    confidenceBefore = item.confidence || 'needs_review'
  ) {
    const request = selectedEstimateRequest
    const approvedPrice = Number(item.package_price || item.unit_price || 0)
    if (!request || !item.human_approved || isEstimateItemRejected(item) || approvedPrice <= 0) return

    const record = {
      property_id: item.property_id || getRequestPropertyId(request),
      work_request_id: item.request_id || item.job_id || item.lead_id || request.id,
      repair_item_id: item.repair_item_id || getDefaultRepairItemId(request, item.item_name),
      work_type: request.workType || item.category || 'Material estimate',
      item_name: item.item_name,
      original_ai_price: Number(item.original_unit_price ?? item.unit_price ?? 0),
      human_approved_price: approvedPrice,
      unit: item.package_unit || item.required_unit || 'unit',
      zip: request.zip || '',
      source: item.source_url || item.source || 'human_review',
      markup_notes: `Markup ${estimateMarkupPercent || 0}%, contingency ${estimateContingencyPercent || 0}%.`,
      admin_notes: item.admin_notes || item.quantity_reason || null,
      confidence_before: confidenceBefore,
      confidence_after: item.confidence || 'human_approved',
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
      human_verified: true,
    }

    try {
      const { error } = await supabase.from('human_pricing_memory').insert(record)
      if (error) throw error
      if (request) await loadVerifiedPricingMemory(request)
    } catch (error) {
      console.warn('Human pricing memory table unavailable; learning record was not saved.', error)
    }
  }

  async function saveEstimateItem(item: EstimateItem, action: MaterialReviewAction = 'edited', logLearning = true) {
    setEstimateSavingId(item.id)

    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unit_price || 0)
    const totalPrice = quantity * unitPrice

    try {
      const { data, error } = await supabase
        .from('estimate_items')
        .update({
          property_id: item.property_id || getRequestPropertyId(selectedEstimateRequest),
          job_id: item.job_id || selectedEstimateRequest?.id || item.lead_id,
          request_id: item.request_id || selectedEstimateRequest?.id || item.lead_id,
          repair_item_id: item.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, item.item_name),
          item_name: item.item_name,
          category: item.category || null,
          source: item.source,
          source_url: item.source_url,
          quantity,
          unit_price: unitPrice,
          original_unit_price: item.original_unit_price ?? unitPrice,
          total_price: totalPrice,
          required_quantity: item.required_quantity ?? quantity,
          required_unit: item.required_unit || null,
          package_size: item.package_size ?? null,
          package_unit: item.package_unit || null,
          package_coverage: item.package_coverage ?? null,
          package_coverage_unit: item.package_coverage_unit || null,
          packages_needed: item.packages_needed ?? quantity,
          package_price: item.package_price ?? unitPrice,
          extended_total: item.extended_total ?? totalPrice,
          quantity_reason: item.quantity_reason || null,
          scope_source: item.scope_source || 'current_request_scope',
          relevance_reason: item.relevance_reason || getEstimateInclusionReason(item),
          source_status: item.source_status || 'needs_source_review',
          review_status: item.review_status === 'rejected' ? 'rejected' : item.human_approved ? 'human_verified' : item.review_status || 'needs_review',
          material_complexity: item.material_complexity || null,
          quantity_low: item.quantity_low ?? item.required_quantity ?? quantity,
          quantity_high: item.quantity_high ?? quantity,
          required_optional: item.required_optional || 'required',
          admin_editable: item.admin_editable ?? true,
          material_review_notes: item.material_review_notes || null,
          rejection_reason: item.rejection_reason || null,
          admin_notes: item.admin_notes || null,
          confidence: item.confidence || 'human_reviewed',
          human_approved: item.review_status === 'rejected' ? false : item.human_approved || false,
        })
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      setEstimateItems((prev) =>
        prev.map((existing) => (existing.id === item.id ? (data as EstimateItem) : existing))
      )
      if (logLearning) {
        await recordMaterialReviewLearning(data as EstimateItem, action, {
          total_price: totalPrice,
          unit_price: unitPrice,
        })
        if ((data as EstimateItem).human_approved) await recordHumanPricingMemory(data as EstimateItem, item.confidence || 'needs_review')
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save estimate item.')
    } finally {
      setEstimateSavingId(null)
    }
  }

  async function addManualEstimateItem() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    if (!manualMaterialDraft.itemName.trim()) {
      alert('Add a material name first.')
      return
    }

    try {
      await ensureLeadExists(selectedEstimateRequest)

      const quantity = Number(manualMaterialDraft.quantity || 0)
      const unitPrice = Number(manualMaterialDraft.unitCost || 0)
      const totalPrice = Number(manualMaterialDraft.totalCost || quantity * unitPrice || 0)
      const repairItemId =
        manualMaterialDraft.repairItemId.trim() ||
        getDefaultRepairItemId(selectedEstimateRequest, manualMaterialDraft.itemName)

      const { data, error } = await supabase
        .from('estimate_items')
        .insert({
          property_id: getRequestPropertyId(selectedEstimateRequest),
          job_id: selectedEstimateRequest.id,
          request_id: selectedEstimateRequest.id,
          repair_item_id: repairItemId,
          lead_id: selectedEstimateRequest.id,
          item_name: manualMaterialDraft.itemName.trim(),
          source: manualMaterialDraft.vendor.trim() || 'Human Review',
          source_url: manualMaterialDraft.sourceUrl.trim() || null,
          quantity,
          unit_price: unitPrice,
          original_unit_price: unitPrice,
          total_price: totalPrice,
          required_quantity: quantity,
          required_unit: 'units',
          packages_needed: quantity,
          package_price: unitPrice,
          extended_total: totalPrice,
          quantity_reason: manualMaterialDraft.notes.trim() || 'Human-added material for current job scope.',
          scope_source: 'human_added_current_scope',
          relevance_reason: `${selectedEstimateRequest.workType || 'Current'} scope: human-added material`,
          source_status: isHumanVerifiedStatus(manualMaterialDraft.reviewStatus) ? 'human_added' : 'needs_source_review',
          review_status: manualMaterialDraft.reviewStatus,
          confidence: 'human_added',
          human_approved: isHumanVerifiedStatus(manualMaterialDraft.reviewStatus),
          admin_notes: manualMaterialDraft.notes.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      const addedItem = data as EstimateItem
      setEstimateItems((prev) => [...prev, addedItem])
      setManualMaterialDraft(EMPTY_MANUAL_MATERIAL_DRAFT)
      setShowManualMaterialForm(false)
      await recordMaterialReviewLearning(addedItem, 'added')
    } catch (error: any) {
      console.error(error)
      if (String(error?.message || '').includes('column')) {
        alert('Material review columns are missing. Run migration 202605120002_material_review_learning.sql first.')
      } else {
        alert(error?.message || 'Could not add manual estimate item.')
      }
    }
  }

  async function toggleEstimateItemApproved(item: EstimateItem) {
    const nextApproved = !item.human_approved
    const updated = {
      ...item,
      human_approved: nextApproved,
      review_status: nextApproved ? 'human_verified' : 'needs_review',
      rejection_reason: nextApproved ? null : item.rejection_reason,
      confidence: nextApproved ? 'human_approved' : item.confidence,
    }
    updateLocalEstimateItem(item.id, updated)
    await saveEstimateItem(updated, nextApproved ? 'approved' : 'edited', false)
    if (nextApproved) {
      await recordMaterialReviewLearning(updated, 'approved')
      await recordHumanPricingMemory(updated, item.confidence || 'needs_review')
    }
  }

  async function rejectEstimateItem(item: EstimateItem) {
    const reason = item.rejection_reason || 'Wrong material'
    if (!MATERIAL_REJECTION_REASONS.includes(reason)) {
      alert('Choose a rejection reason first.')
      return
    }

    const updated: EstimateItem = {
      ...item,
      human_approved: false,
      review_status: 'rejected',
      rejection_reason: reason,
      confidence: 'human_rejected',
    }

    updateLocalEstimateItem(item.id, updated)
    await saveEstimateItem(updated, 'rejected', false)
    await recordMaterialReviewLearning(updated, 'rejected')
  }

  async function approveAllEstimateItems() {
    const confirmApprove = window.confirm(
      'Approve all current line items for this draft? This still does not send a proposal or purchase order.'
    )

    if (!confirmApprove) return

    try {
      const approvableItems = currentScopeEstimateItems.filter((item) => !isEstimateItemRejected(item))
      const updates = approvableItems.map((item) =>
        supabase
          .from('estimate_items')
          .update({ human_approved: true, confidence: 'human_approved', review_status: 'human_verified', rejection_reason: null })
          .eq('id', item.id)
      )

      const results = await Promise.all(updates)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      setEstimateItems((prev) =>
        prev.map((item) => ({
          ...item,
          ...(approvableItems.some((approved) => approved.id === item.id)
            ? {
                human_approved: true,
                confidence: 'human_approved',
                review_status: 'human_verified',
                rejection_reason: null,
              }
            : {}),
        }))
      )
      await Promise.all(
        approvableItems.map((item) =>
          recordMaterialReviewLearning(
            { ...item, human_approved: true, confidence: 'human_approved', review_status: 'human_verified' },
            'approved'
          )
        )
      )
      await Promise.all(
        approvableItems.map((item) =>
          recordHumanPricingMemory(
            { ...item, human_approved: true, confidence: 'human_approved', review_status: 'human_verified' },
            item.confidence || 'needs_review'
          )
        )
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not approve estimate items.')
    }
  }

  async function saveEstimateItemAsPricingMemory(item: EstimateItem) {
    if (isEstimateItemRejected(item)) {
      alert('Rejected materials cannot be saved as approved pricing memory.')
      return
    }

    if (!item.human_approved) {
      alert('Approve this material line before saving it as pricing memory.')
      return
    }

    const verifiedPrice = Number(item.package_price || item.unit_price || 0)
    if (verifiedPrice <= 0) {
      alert('Add a package/unit price before saving this line as pricing memory.')
      return
    }

    const { error } = await supabase.from('pricing_memory_entries').insert({
      item_name: item.item_name,
      category: item.category || 'Material',
      trade: item.category || 'Material',
      repair_type: selectedEstimateRequest?.workType || 'Material estimate',
      description: item.relevance_reason || item.quantity_reason || getCurrentScopeReason(selectedEstimateRequest),
      city: selectedEstimateRequest?.city || '',
      state: selectedEstimateRequest?.state || '',
      zip: selectedEstimateRequest?.zip || '',
      property_type: selectedEstimateRequest?.propertyFacts?.propertyType || '',
      quantity: item.package_coverage || item.package_size || 1,
      unit: item.package_coverage_unit || item.package_unit || 'package',
      unit_cost: verifiedPrice,
      verified_price: verifiedPrice,
      total_cost: verifiedPrice,
      source: item.source_url || item.source || 'estimate_item_human_approved',
      confidence_level: 'high',
      human_verified: true,
      notes: `Price support only. Saved from material estimate line ${item.id}. Package unit: ${item.package_unit || 'package'}; required unit: ${item.required_unit || 'not set'}.`,
      last_checked: new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Saved. Future material estimates will use this human-approved local price first.')
    await recordHumanPricingMemory(item, item.confidence || 'needs_review')
    await recordMaterialReviewLearning(item, 'saved_for_next_time', {
      confidence: 'saved_for_next_time',
    })
    await loadPricingMemoryEntries()
  }

  function generateEstimatePdf() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const totals = calculateEstimateTotals(
      currentScopeEstimateItems,
      estimateLaborCost,
      estimateMarkupPercent,
      estimateContingencyPercent
    )
    const laborRateLabel = appliedLaborRate
      ? `${appliedLaborRate.trade}${appliedLaborRate.job_type ? ` / ${appliedLaborRate.job_type}` : ''} at ${money(Number(appliedLaborRate.typical_rate || 0))}/${appliedLaborRate.unit || 'hour'}`
      : 'Manual labor entry'
    const laborUnits = Number(estimateLaborUnits || 0)
    const laborMinimum = Number(estimateMinimumCharge || 0)
    const laborTrip = Number(estimateTripCharge || 0)
    const laborDisposal = Number(estimateDisposalFee || 0)
    const allApproved = currentScopeEstimateItems.length > 0 && totals.approvedCount === currentScopeEstimateItems.length

    const rows = currentScopeEstimateItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.item_name)}</td>
            <td>${escapeHtml(item.source)}</td>
            <td>${Number(item.quantity || 0).toFixed(2)}</td>
            <td>${money(Number(item.unit_price || 0))}</td>
            <td>${money(Number(item.total_price || 0))}</td>
            <td>${item.human_approved ? 'Approved' : 'Needs review'}</td>
          </tr>
        `
      )
      .join('')

    const html = `
      <html>
        <head>
          <title>Shelter Prep Estimate Draft</title>
          <style>
            body { font-family: Arial, sans-serif; color: #173425; padding: 32px; }
            h1 { color: #0f542d; margin-bottom: 4px; }
            .muted { color: #66736a; }
            .box { border: 1px solid #d7dfd3; border-radius: 14px; padding: 16px; margin: 18px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #d7dfd3; text-align: left; padding: 10px; font-size: 13px; }
            th { background: #f4f1ec; }
            .warning { background: #fff7e6; border: 1px solid #e2c47e; padding: 12px; border-radius: 12px; }
            .total { font-size: 22px; font-weight: bold; color: #0f542d; }
          </style>
        </head>
        <body>
          <h1>Shelter Prep Estimate Draft</h1>
          <div class="muted">Powered by AI. Approved by humans.</div>
          <div class="box">
            <strong>Client:</strong> ${escapeHtml(selectedEstimateRequest.requesterName)}<br />
            <strong>Email:</strong> ${escapeHtml(selectedEstimateRequest.email)}<br />
            <strong>Phone:</strong> ${escapeHtml(selectedEstimateRequest.phone || 'Not provided')}<br />
            <strong>Property:</strong> ${escapeHtml(selectedEstimateRequest.propertyAddress)}, ${escapeHtml(selectedEstimateRequest.city)}, ${escapeHtml(selectedEstimateRequest.state)} ${escapeHtml(selectedEstimateRequest.zip)}<br />
            <strong>Work Type:</strong> ${escapeHtml(selectedEstimateRequest.workType)}<br />
            <strong>Urgency:</strong> ${escapeHtml(selectedEstimateRequest.urgency)}
          </div>
          <div class="box">
            <strong>Scope Summary</strong><br />
            ${escapeHtml(selectedEstimateRequest.description)}
          </div>
          <div class="warning">
            ${allApproved ? 'All line items are human-approved.' : 'Draft only: some line items still require human review before sending.'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Source</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="box">
            <p><strong>Materials:</strong> ${money(totals.materialSubtotal)}</p>
            <p><strong>Labor:</strong> ${money(totals.labor)}</p>
            <p><strong>Labor source:</strong> ${escapeHtml(laborRateLabel)}</p>
            <p><strong>Labor units:</strong> ${laborUnits}</p>
            <p><strong>Minimum / Trip / Disposal:</strong> ${money(laborMinimum)} / ${money(laborTrip)} / ${money(laborDisposal)}</p>
            <p><strong>Markup:</strong> ${totals.markup}% = ${money(totals.markupDollars)}</p>
            <p><strong>Contingency:</strong> ${totals.contingency}% = ${money(totals.contingencyDollars)}</p>
            <p class="total">Standard Estimate: ${money(totals.standardTotal)}</p>
            <p><strong>Suggested Range:</strong> ${money(totals.lowTotal)} - ${money(totals.premiumTotal)}</p>
          </div>
          <div class="box">
            <strong>Notes / Assumptions</strong><br />
            ${escapeHtml(estimateNotes)}
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to generate the PDF.')
      return
    }

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }


  function generateInvoicePdf() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const totals = calculateEstimateTotals(
      currentScopeEstimateItems,
      estimateLaborCost,
      estimateMarkupPercent,
      estimateContingencyPercent
    )
    const amountDue = totals.standardTotal
    const allApproved = currentScopeEstimateItems.length === 0 || totals.approvedCount === currentScopeEstimateItems.length

    if (amountDue <= 0) {
      alert('Add estimate items or labor before generating an invoice.')
      return
    }

    const invoiceNumber = `SP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const invoiceDate = new Date().toLocaleDateString()

    const html = `
      <html>
        <head>
          <title>Shelter Prep Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; color: #173425; padding: 32px; }
            h1 { color: #0f542d; margin-bottom: 4px; }
            .muted { color: #66736a; }
            .top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
            .box { border: 1px solid #d7dfd3; border-radius: 14px; padding: 16px; margin: 18px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #d7dfd3; text-align: left; padding: 10px; font-size: 13px; }
            th { background: #f4f1ec; }
            .right { text-align: right; }
            .totalBox { border: 2px solid #0f542d; border-radius: 14px; padding: 16px; margin-top: 20px; }
            .total { font-size: 24px; font-weight: bold; color: #0f542d; }
            .notice { background: #fff7e6; border: 1px solid #e2c47e; padding: 12px; border-radius: 12px; margin-top: 16px; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <div class="top">
            <div>
              <h1>Shelter Prep Invoice</h1>
              <div class="muted">Professional services invoice</div>
            </div>
            <div class="box">
              <strong>Invoice #:</strong> ${escapeHtml(invoiceNumber)}<br />
              <strong>Date:</strong> ${escapeHtml(invoiceDate)}<br />
              <strong>Status:</strong> Draft / Review
            </div>
          </div>

          <div class="box">
            <strong>Bill To:</strong> ${escapeHtml(selectedEstimateRequest.requesterName)}<br />
            <strong>Email:</strong> ${escapeHtml(selectedEstimateRequest.email)}<br />
            <strong>Phone:</strong> ${escapeHtml(selectedEstimateRequest.phone || 'Not provided')}<br />
            <strong>Property:</strong> ${escapeHtml(selectedEstimateRequest.propertyAddress)}, ${escapeHtml(selectedEstimateRequest.city)}, ${escapeHtml(selectedEstimateRequest.state)} ${escapeHtml(selectedEstimateRequest.zip)}<br />
            <strong>Work Type:</strong> ${escapeHtml(selectedEstimateRequest.workType)}
          </div>

          <div class="box">
            <strong>Scope / Description</strong><br />
            ${escapeHtml(selectedEstimateRequest.description)}
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Project work per approved scope</td>
                <td class="right">${money(amountDue)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totalBox">
            <div class="muted">Amount Due</div>
            <div class="total">${money(amountDue)}</div>
          </div>

          ${allApproved ? '' : '<div class="notice">Internal note: Some underlying estimate line items still need review before this invoice is sent.</div>'}

          <div class="box">
            <strong>Payment Notes</strong><br />
            Payment due upon receipt unless otherwise agreed. Please reference the invoice number with payment.
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to generate the invoice.')
      return
    }

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  async function uploadInvoice() {
    if (!invoiceFile) {
      alert('Choose a PDF invoice first.')
      return
    }

    setInvoiceUploading(true)

    try {
      const path = `invoices/${Date.now()}-${safeFileName(invoiceFile.name)}`

      const { error: uploadError } = await supabase.storage
        .from(INVOICE_BUCKET)
        .upload(path, invoiceFile)

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('invoices').insert({
        file_name: invoiceFile.name,
        file_url: null,
        storage_bucket: INVOICE_BUCKET,
        storage_path: path,
        vendor_name: invoiceVendor,
        property_address: invoiceAddress,
        extraction_status: 'pending',
      })

      if (insertError) throw insertError

      alert('Invoice uploaded.')
      setInvoiceFile(null)
      setInvoiceVendor('')
      setInvoiceAddress('')
      await loadInvoices()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Invoice upload failed.')
    } finally {
      setInvoiceUploading(false)
    }
  }

  async function loadInvoiceAnalyses(invoiceIds: string[]) {
    if (invoiceIds.length === 0) {
      setInvoiceAnalyses({})
      return
    }

    try {
      const { data, error } = await supabase
        .from('invoice_cost_analyses')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const map: Record<string, InvoiceCostAnalysis> = {}
      ;((data || []) as InvoiceCostAnalysis[]).forEach((analysis) => {
        if (!map[analysis.invoice_id]) map[analysis.invoice_id] = analysis
      })

      setInvoiceAnalyses(map)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load invoice analyses.')
    }
  }

  async function loadInvoices() {
    setInvoiceLoading(true)

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as Invoice[]
      setInvoices(rows)
      const signedUrls: Record<string, string> = {}
      await Promise.all(
        rows.map(async (invoice) => {
          const path =
            invoice.storage_path ||
            storagePathFromPublicUrl(invoice.file_url || '', invoice.storage_bucket || INVOICE_BUCKET)
          if (!path) return
          const { data: signed } = await supabase.storage
            .from(invoice.storage_bucket || INVOICE_BUCKET)
            .createSignedUrl(path, 60 * 10)
          if (signed?.signedUrl) signedUrls[invoice.id] = signed.signedUrl
        })
      )
      setInvoiceFileUrls(signedUrls)
      await loadInvoiceAnalyses(rows.map((invoice) => invoice.id))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load invoices.')
    } finally {
      setInvoiceLoading(false)
    }
  }

  async function extractInvoiceData(invoiceId: string) {
    setExtractingInvoiceId(invoiceId)

    const { data, error } = await supabase.functions.invoke('extract-invoice', {
      body: { invoiceId },
    })

    if (error) {
      console.error(error)
      alert('Invoice extraction failed: ' + error.message)
      setExtractingInvoiceId(null)
      return
    }

    console.log('Invoice extraction result:', data)
    alert('Invoice extracted.')
    await loadInvoices()
    setExtractingInvoiceId(null)
  }

  async function analyzeInvoiceCosts(invoiceId: string) {
    setAnalyzingInvoiceId(invoiceId)

    const { data, error } = await supabase.functions.invoke('analyze-invoice-costs', {
      body: { invoiceId },
    })

    if (error) {
      console.error(error)
      alert('Invoice analysis failed: ' + error.message)
      setAnalyzingInvoiceId(null)
      return
    }

    console.log('Invoice analysis result:', data)

    const analysis = data?.analysis as InvoiceCostAnalysis | undefined

    if (analysis?.invoice_id) {
      setInvoiceAnalyses((prev) => ({ ...prev, [analysis.invoice_id]: analysis }))
    }

    alert(analysis?.summary || 'Invoice cost analysis complete.')
    await loadInvoices()
    setAnalyzingInvoiceId(null)
  }

  async function loadMaterials() {
    setMaterialLoading(true)

    try {
      const { data, error } = await supabase
        .from('material_costs')
        .select('*')
        .order('human_verified', { ascending: true })
        .order('updated_at', { ascending: false })

      if (error) throw error
      setMaterials((data || []) as MaterialCost[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load material costs.')
    } finally {
      setMaterialLoading(false)
    }
  }

  async function loadPricingMemoryEntries() {
    setPricingMemoryLoading(true)

    try {
      const { data, error } = await supabase
        .from('pricing_memory_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setPricingMemoryEntries((data || []) as PricingMemoryEntry[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load pricing memory. Run the pricing memory migration if needed.')
    } finally {
      setPricingMemoryLoading(false)
    }
  }

  async function loadAgentLearning() {
    setAgentLearningLoading(true)

    try {
      const [
        { data: events, error: eventsError },
        { data: rules, error: rulesError },
        { data: applications, error: applicationsError },
        { data: conflicts, error: conflictsError },
        { data: auditLogs, error: auditError },
      ] = await Promise.all([
        supabase.from('agent_learning_events').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('agent_learning_rules').select('*').order('updated_at', { ascending: false }).limit(100),
        supabase.from('agent_rule_applications').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('agent_memory_conflicts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('agent_memory_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      ])

      if (eventsError) throw eventsError
      if (rulesError) throw rulesError
      if (applicationsError) throw applicationsError
      if (conflictsError) throw conflictsError
      if (auditError) throw auditError

      setAgentLearningEvents((events || []) as AgentLearningEvent[])
      setAgentLearningRules((rules || []) as AgentLearningRule[])
      setAgentRuleApplications((applications || []) as AgentRuleApplication[])
      setAgentMemoryConflicts((conflicts || []) as AgentMemoryConflict[])
      setAgentMemoryAuditLogs((auditLogs || []) as AgentMemoryAuditLog[])
    } catch (error) {
      console.warn('Agent learning tables unavailable; apply the agent learning migration.', error)
      setAgentLearningEvents([])
      setAgentLearningRules([])
      setAgentRuleApplications([])
      setAgentMemoryConflicts([])
      setAgentMemoryAuditLogs([])
    } finally {
      setAgentLearningLoading(false)
    }
  }

  async function loadSourceLessons() {
    setSourceLessonsLoading(true)
    try {
      const { data, error } = await supabase
        .from('source_lessons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setSourceLessons(((data || []) as SourceLesson[]).map(normalizeSourceLessonRow))
    } catch (error) {
      console.warn('Source lesson table unavailable; apply the source lessons migration.', error)
      setSourceLessons([])
    } finally {
      setSourceLessonsLoading(false)
    }
  }

  function selectSourceLessonLinkedRequest(requestId: string) {
    const request = requests.find((item) => item.id === requestId)
    setSourceLessonDraft((draft) => ({
      ...draft,
      linked_work_request_id: requestId,
      linked_property_id: request ? getRequestPropertyId(request) : '',
      linked_repair_item_id: request ? getDefaultRepairItemId(request, draft.work_type || request.workType) : draft.linked_repair_item_id,
      work_type: request?.workType || draft.work_type,
      problem_description: request?.description || draft.problem_description,
    }))
  }

  async function generateCuratedLessonSummary() {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return
    }
    if (!canDraftSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('You do not have permission to draft curated lessons.')
      return
    }
    if (!splitSourceLessonLines(curatedLessonIntake.sourceLinksText).length) {
      alert('Paste at least one YouTube/video link first.')
      return
    }
    if (!curatedLessonIntake.learningGoal.trim()) {
      alert('Add the learning goal first.')
      return
    }

    setCuratedLessonError('')
    setSourceLessonSavingId('curated-lesson-intake')
    try {
      const { data: extraction, error: extractionError } = await supabase.functions.invoke<LessonExtractionResult>('lesson-extract', {
        body: {
          sourceLinks: splitSourceLessonLines(curatedLessonIntake.sourceLinksText),
          transcriptText: curatedLessonIntake.transcriptOrNotes,
          learningGoal: curatedLessonIntake.learningGoal,
          tradeCategory: curatedLessonIntake.tradeCategory,
          memoryDestination: curatedLessonIntake.memoryDestination,
        },
      })

      if (extractionError || extraction?.error || !extraction?.draft) {
        const message = extraction?.error || extractionError?.message || 'Transcript unavailable. Paste transcript or notes manually.'
        setCuratedLessonError(message)
        alert(message)
        return
      }

      const draft = buildCuratedLessonDraft(curatedLessonIntake, extraction.draft)
      const insert = {
        ...draft,
        created_by: currentUserId,
        linked_property_id: null,
        linked_work_request_id: null,
        linked_repair_item_id: null,
      }
      const { data, error } = await supabase.from('source_lessons').insert(insert).select().single()
      if (error) throw error
      const saved = normalizeSourceLessonRow(data as SourceLesson)
      setSourceLessons((prev) => [saved, ...prev])
      setCuratedLessonDraftId(saved.id)
      await logAgentMemoryAudit({
        action_type: 'curated_lesson_summary_generated',
        target_table: 'source_lessons',
        target_id: saved.id,
        previous_value: null,
        new_value: saved as unknown as Record<string, unknown>,
        reason: `Curated Lesson Intake generated a concise estimating-focused draft from ${extraction.transcriptSource || 'transcript'} text. Not saved to memory.`,
        property_id: null,
        work_request_id: null,
      })
    } catch (error: any) {
      console.error(error)
      const message = error?.message || 'Could not generate or save Curated Lesson Intake draft.'
      setCuratedLessonError(message)
      alert(message)
    } finally {
      setSourceLessonSavingId(null)
    }
  }

  function clearCuratedLessonIntake() {
    setCuratedLessonIntake(EMPTY_CURATED_LESSON_INTAKE)
    setCuratedLessonDraftId(null)
    setCuratedLessonError('')
  }

  async function generateSourceLessonDraft() {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return
    }
    if (!canDraftSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('You do not have permission to draft source lessons.')
      return
    }
    if (!sourceLessonDraft.source_url.trim() && !sourceLessonManualNotes.trim()) {
      alert('Paste a source link or manual field notes first.')
      return
    }
    if (!sourceLessonDraft.problem_description.trim()) {
      alert('Add the problem description first.')
      return
    }

    const promptFeedbackContext = buildSourceLessonPromptFeedbackContext(sourceLessons)
    const draft = buildSourceLessonDraftFromNotes(sourceLessonDraft, sourceLessonManualNotes, promptFeedbackContext)
    setSourceLessonSavingId('new-source-lesson')
    try {
      const insert = {
        ...draft,
        created_by: currentUserId,
        linked_property_id: draft.linked_property_id || null,
        linked_work_request_id: draft.linked_work_request_id || null,
        linked_repair_item_id: draft.linked_repair_item_id || null,
      }
      const { data, error } = await supabase.from('source_lessons').insert(insert).select().single()
      if (error) throw error
      const saved = normalizeSourceLessonRow(data as SourceLesson)
      setSourceLessons((prev) => [saved, ...prev])
      setSourceLessonDraft(EMPTY_SOURCE_LESSON_DRAFT)
      setSourceLessonManualNotes('')
      await logAgentMemoryAudit({
        action_type: 'source_lesson_draft_created',
        target_table: 'source_lessons',
        target_id: saved.id,
        previous_value: null,
        new_value: saved as unknown as Record<string, unknown>,
        reason: 'Lesson Summary Draft created from admin-provided source notes. Not operational memory.',
        property_id: asNullableUuid(saved.linked_property_id),
        work_request_id: asNullableUuid(saved.linked_work_request_id),
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save Lesson Summary Draft. Apply the source lessons migration first.')
    } finally {
      setSourceLessonSavingId(null)
    }
  }

  async function updateSourceLesson(lesson: SourceLesson, changes: Partial<SourceLesson>, actionType = 'source_lesson_edited') {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return null
    }
    const approving = changes.status === 'approved' || Boolean(changes.approved_at || changes.approved_by)
    const rejecting = changes.status === 'rejected' || changes.status === 'archived'
    const nextLesson = { ...lesson, ...changes }
    if (approving) {
      const gateMessage = getSourceLessonMemoryGateMessage(nextLesson)
      if (gateMessage) {
        alert(gateMessage)
        return null
      }
    }
    if ((approving || rejecting) && !canApproveSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('Only admins can approve, reject, or archive source lessons.')
      return null
    }
    if (!approving && !rejecting && !canDraftSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('You do not have permission to edit source lessons.')
      return null
    }

    setSourceLessonSavingId(lesson.id)
    try {
      const reviewChanging = Boolean(changes.comprehension_grade !== undefined || changes.admin_feedback !== undefined || approving || rejecting)
      const editedLesson = actionType === 'source_lesson_edited' || sourceLessonHasAdminEdits(nextLesson)
        ? getSourceLessonSnapshot(nextLesson)
        : changes.edited_lesson
      const grade = nextLesson.comprehension_grade || ''
      const guardedReviewStatus = grade === 'C'
        ? 'needs_review'
        : grade === 'D' || grade === 'F'
          ? 'rejected'
          : changes.human_review_status || (rejecting ? 'rejected' : approving ? 'human_verified' : editedLesson ? 'edited' : lesson.human_review_status)
      const guardedMemoryDestination = grade === 'D' || grade === 'F' || !grade
        ? 'none'
        : changes.memory_destination || lesson.memory_destination || 'none'
      const patch = {
        ...changes,
        original_draft: lesson.original_draft || getSourceLessonSnapshot(lesson),
        edited_lesson: editedLesson,
        human_review_status: guardedReviewStatus,
        memory_destination: guardedMemoryDestination,
        reviewed_by: reviewChanging ? currentUserId : changes.reviewed_by,
        reviewed_at: reviewChanging ? new Date().toISOString() : changes.reviewed_at,
        linked_property_id: changes.linked_property_id === '' ? null : changes.linked_property_id,
        linked_work_request_id: changes.linked_work_request_id === '' ? null : changes.linked_work_request_id,
        linked_repair_item_id: changes.linked_repair_item_id === '' ? null : changes.linked_repair_item_id,
      }
      const { data, error } = await supabase
        .from('source_lessons')
        .update(patch)
        .eq('id', lesson.id)
        .select()
        .single()
      if (error) throw error
      const saved = normalizeSourceLessonRow(data as SourceLesson)
      setSourceLessons((prev) => prev.map((item) => (item.id === lesson.id ? saved : item)))
      await logAgentMemoryAudit({
        action_type: actionType,
        target_table: 'source_lessons',
        target_id: lesson.id,
        previous_value: lesson as unknown as Record<string, unknown>,
        new_value: saved as unknown as Record<string, unknown>,
        reason: 'Source lesson review action recorded.',
        property_id: asNullableUuid(saved.linked_property_id),
        work_request_id: asNullableUuid(saved.linked_work_request_id),
      })
      return saved
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update source lesson.')
      return null
    } finally {
      setSourceLessonSavingId(null)
    }
  }

  async function createLearningEventFromSourceLesson(lesson: SourceLesson, memoryScope: 'global_operational' | 'project_specific') {
    if (!hasSupabaseSession) {
      throw new Error('Please sign in with your Supabase admin account first.')
    }
    const humanVerified = lesson.status === 'approved'
    const insert = {
      property_id: asNullableUuid(lesson.linked_property_id),
      work_request_id: asNullableUuid(lesson.linked_work_request_id),
      memory_scope: memoryScope,
      lesson_status: humanVerified ? 'human_verified' : 'needs_confirmation',
      source_agent: 'quality_check_agent' as AgentName,
      affected_agents: ['estimator_agent', 'project_workflow_agent', 'contractor_review_agent', 'quality_check_agent'] as AgentName[],
      task_type: lesson.work_type || 'field_lesson',
      original_agent_output: [
        `Source URL: ${lesson.source_url || 'Manual field note'}`,
        `Admin intent: ${lesson.admin_intent}`,
        `Observed method: ${lesson.observed_method}`,
      ].join('\n'),
      human_correction: lesson.lesson_summary,
      correction_category: 'workflow_logic' as CorrectionCategory,
      inferred_reason: lesson.estimate_impact || lesson.hidden_labor,
      confirmation_question: '',
      human_confirmed_reason: lesson.admin_notes || 'Human approved source lesson.',
      learning_value_score: 8,
      reusable: memoryScope === 'global_operational',
      human_verified: humanVerified,
      verified_by: currentUserId,
      confidence: humanVerified ? 'human_verified' : lesson.confidence,
      notes: [
        `source_lesson_id=${lesson.id}`,
        `source_url=${lesson.source_url || 'manual'}`,
        `source_links=${(lesson.source_links || []).map((link) => link.url).join(' | ') || 'manual'}`,
        `admin_intent=${lesson.admin_intent}`,
        `comprehension_grade=${lesson.comprehension_grade || 'ungraded'}`,
        `admin_feedback=${lesson.admin_feedback || 'none'}`,
        `memory_destination=${lesson.memory_destination || 'none'}`,
        `hidden_labor=${lesson.hidden_labor}`,
        `job_steps=${lesson.job_steps.join(' | ')}`,
        `tools_materials=${lesson.tools_materials.join(' | ')}`,
        `materials_tools_equipment=${(lesson.materials_tools_equipment || []).join(' | ')}`,
        `safety_notes=${lesson.safety_notes}`,
        `access_notes=${lesson.access_notes}`,
        `cleanup_notes=${lesson.cleanup_disposal || lesson.cleanup_notes}`,
      ].join('\n'),
    }

    const { data, error } = await supabase.from('agent_learning_events').insert(insert).select().single()
    if (error) throw error
    const savedEvent = data as AgentLearningEvent
    setAgentLearningEvents((prev) => [savedEvent, ...prev])
    await logAgentMemoryAudit({
      action_type: 'learning_event_created_from_source_lesson',
      target_table: 'agent_learning_events',
      target_id: savedEvent.id,
      previous_value: null,
      new_value: savedEvent as unknown as Record<string, unknown>,
      reason: 'Human Verified source lesson connected to Shelter Prep memory.',
      property_id: savedEvent.property_id || null,
      work_request_id: savedEvent.work_request_id || null,
    })
    return savedEvent
  }

  async function approveSourceLesson(lesson: SourceLesson) {
    const gateMessage = getSourceLessonMemoryGateMessage(lesson)
    if (gateMessage) {
      alert(gateMessage)
      return
    }
    if (!window.confirm(`Approve this Grade ${lesson.comprehension_grade} lesson for memory eligibility? This will not save it into memory yet.`)) return
    const saved = await updateSourceLesson(
      lesson,
      {
        status: 'approved',
        approved_by: currentUserId,
        approved_at: new Date().toISOString(),
        human_review_status: 'human_verified',
        memory_destination: lesson.memory_destination || 'none',
        confidence: lesson.confidence === 'low' ? 'medium' : lesson.confidence,
      },
      'source_lesson_approved'
    )
    if (!saved) return
    alert('Lesson approved. Use Save as Project-Specific or Save as Global Labor Memory when you are ready to create memory.')
  }

  async function rejectSourceLesson(lesson: SourceLesson) {
    const notes = window.prompt('Reason for rejection', lesson.admin_notes || 'Not reliable enough for Shelter Prep memory.') || lesson.admin_notes
    await updateSourceLesson(
      lesson,
      { status: 'rejected', approved_by: null, approved_at: null, human_review_status: 'rejected', memory_destination: 'none', admin_notes: notes },
      'source_lesson_rejected'
    )
  }

  async function saveSourceLessonProjectSpecific(lesson: SourceLesson) {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return
    }
    if (!canApproveSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('Only an admin or owner can save project-specific memory.')
      return
    }
    if (!lesson.linked_work_request_id && !lesson.linked_property_id && !lesson.linked_repair_item_id) {
      alert('Link this lesson to a property, request, or repair item before saving it as project-specific memory.')
      return
    }
    const gateMessage = getSourceLessonMemoryGateMessage(lesson)
    if (gateMessage) {
      alert(gateMessage)
      return
    }
    if (!window.confirm(`Save this Grade ${lesson.comprehension_grade} lesson as project-specific memory?`)) return
    const approved = lesson.status === 'approved'
      ? lesson
      : await updateSourceLesson(
          lesson,
          { status: 'approved', approved_by: currentUserId, approved_at: new Date().toISOString(), human_review_status: 'human_verified', memory_destination: 'project_specific' },
          'source_lesson_project_specific_approved'
        )
    if (!approved) return
    try {
      await createLearningEventFromSourceLesson(approved, 'project_specific')
      alert('Saved as project-specific Human Verified memory.')
      await loadAgentLearning()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save project-specific memory.')
    }
  }

  async function saveSourceLessonGlobalMemory(lesson: SourceLesson) {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return
    }
    if (!canApproveSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('Only an admin or owner can save Global Labor Memory.')
      return
    }
    const gateMessage = getSourceLessonMemoryGateMessage(lesson)
    if (gateMessage) {
      alert(gateMessage)
      return
    }
    if (!window.confirm(`Save this Grade ${lesson.comprehension_grade} lesson as Global Labor Memory?`)) return
    const approved = lesson.status === 'approved'
      ? lesson
      : await updateSourceLesson(
          lesson,
          { status: 'approved', approved_by: currentUserId, approved_at: new Date().toISOString(), human_review_status: 'human_verified', memory_destination: 'global_operational' },
          'source_lesson_global_approved'
        )
    if (!approved) return
    try {
      const event = await createLearningEventFromSourceLesson(approved, 'global_operational')
      const title = `${approved.work_type || 'Field'} lesson: ${approved.problem_description || approved.source_title}`.slice(0, 90)
      const { data, error } = await supabase.from('agent_learning_rules').insert({
        title,
        memory_scope: 'global_operational',
        lesson_status: 'human_verified',
        rule_type: 'labor',
        rule_text: [
          approved.lesson_summary,
          approved.hidden_labor ? `Hidden labor: ${approved.hidden_labor}` : '',
          approved.estimate_impact ? `Estimate impact: ${approved.estimate_impact}` : '',
        ].filter(Boolean).join('\n'),
        reason: `Human Verified from source lesson. Source URL: ${approved.source_url || 'manual field note'}. Admin intent: ${approved.admin_intent}`,
        applies_when: approved.applies_when,
        does_not_apply_when: approved.does_not_apply_when,
        source_event_id: event.id,
        source_agent: 'quality_check_agent',
        affected_agents: ['estimator_agent', 'project_workflow_agent', 'contractor_review_agent'],
        confidence: 'human_verified',
        human_verified: true,
        active: true,
        usage_count: 0,
      }).select().single()
      if (error) throw error
      const savedRule = data as AgentLearningRule
      setAgentLearningRules((prev) => [savedRule, ...prev])
      await logAgentMemoryAudit({
        action_type: 'global_labor_memory_created_from_source_lesson',
        target_table: 'agent_learning_rules',
        target_id: savedRule.id,
        previous_value: null,
        new_value: savedRule as unknown as Record<string, unknown>,
        reason: 'Admin approved source lesson as Global Labor Memory.',
        property_id: asNullableUuid(approved.linked_property_id),
        work_request_id: asNullableUuid(approved.linked_work_request_id),
      })
      alert('Saved as Global Labor Memory.')
      await loadAgentLearning()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save Global Labor Memory.')
    }
  }

  async function createJobExecutionStepsFromSourceLesson(lesson: SourceLesson) {
    if (!hasSupabaseSession) {
      alert('Please sign in with your Supabase admin account first.')
      setShowLogin(true)
      return
    }
    if (!canApproveSourceLessonsWithSession(currentUserRole, hasSupabaseSession)) {
      alert('You do not have permission to create job execution steps.')
      return
    }
    const request = lesson.linked_work_request_id
      ? requests.find((item) => item.id === lesson.linked_work_request_id)
      : selectedEstimateRequest
    if (!request) {
      alert('Link the lesson to a work request first, or open a request in Estimate Review.')
      return
    }
    const steps = (lesson.job_steps.length ? lesson.job_steps : [lesson.observed_method || lesson.lesson_summary])
      .filter(Boolean)
      .map((stepText, index): JobExecutionStep => ({
        id: makeId(),
        created_at: new Date().toISOString(),
        property_id: lesson.linked_property_id || getRequestPropertyId(request),
        job_request_id: request.id,
        repair_item_id: lesson.linked_repair_item_id || getDefaultRepairItemId(request, lesson.work_type),
        step_number: index + 1,
        title: stepText.slice(0, 80) || `Source lesson step ${index + 1}`,
        labor_scope: stepText,
        trade: lesson.work_type || request.workType || 'General repair',
        estimated_hours_low: 1,
        estimated_hours_high: 2,
        materials_tools: lesson.tools_materials.join(', '),
        equipment: '',
        safety_notes: lesson.safety_notes,
        access_notes: lesson.access_notes,
        cleanup_notes: lesson.cleanup_notes,
        disposal_needed: normalizeJobScopeTokenText([lesson.cleanup_notes, lesson.hidden_labor].join(' ')).includes('debris'),
        confidence: 'source_lesson_needs_review',
        status: 'needs_review',
        admin_notes: `Created from source lesson ${lesson.id}. Review before approval.`,
      }))

    setSelectedEstimateRequest(request)
    const nextSteps = sortJobExecutionSteps(steps)
    setJobExecutionSteps(nextSteps)
    saveLocalJobScopeSteps(request, nextSteps)
    setJobScopeMessage('Job execution steps created from Lesson Summary Draft. Review each step before approval.')
    setActiveTab('estimates')

    try {
      await ensureLeadExists(request)
      const { error } = await supabase.from('job_execution_steps').insert(nextSteps)
      if (error) throw error
      await logAgentMemoryAudit({
        action_type: 'job_execution_steps_created_from_source_lesson',
        target_table: 'source_lessons',
        target_id: lesson.id,
        previous_value: null,
        new_value: { step_count: nextSteps.length, request_id: request.id },
        reason: 'Admin created draft job execution steps from a human-reviewed source lesson draft.',
        property_id: asNullableUuid(getRequestPropertyId(request)),
        work_request_id: asNullableUuid(request.id),
      })
    } catch (error) {
      console.warn('Source lesson job steps saved locally only.', error)
    }
  }

  async function saveAgentLearningEvent(input: CorrectionLearningInput) {
    const evaluation = evaluateCorrectionForLearning(input)
    const confirmedReason = evaluation.should_ask_confirmation
      ? window.prompt(evaluation.confirmation_question, evaluation.inferred_reason) || ''
      : ''
    const lessonStatus: LessonStatus =
      evaluation.should_ask_confirmation && !confirmedReason.trim()
        ? 'needs_confirmation'
        : evaluation.learning_value_score >= 6 && confirmedReason.trim()
          ? 'human_verified'
          : evaluation.reusable
            ? 'draft'
            : 'draft'
    const humanVerified = lessonStatus === 'human_verified'
    const eventInsert = {
      property_id: null,
      work_request_id: null,
      memory_scope: 'global_operational',
      lesson_status: lessonStatus,
      source_agent: input.source_agent,
      affected_agents: evaluation.affected_agents,
      task_type: input.task_type || 'general_correction',
      original_agent_output: input.original_agent_output,
      human_correction: input.human_correction,
      correction_category: evaluation.correction_category,
      inferred_reason: evaluation.inferred_reason,
      confirmation_question: evaluation.confirmation_question,
      human_confirmed_reason: confirmedReason,
      learning_value_score: evaluation.learning_value_score,
      reusable: evaluation.reusable,
      human_verified: humanVerified,
      verified_by: null,
      confidence: humanVerified ? 'human_verified' : 'draft_needs_confirmation',
      notes:
        evaluation.learning_value_score <= 2
          ? 'Applied as a correction only; low reusable learning value.'
          : 'Evaluated as conditional operational memory.',
    }

    const { data, error } = await supabase
      .from('agent_learning_events')
      .insert(eventInsert)
      .select()
      .single()

    if (error) throw error

    const savedEvent = data as AgentLearningEvent
    setAgentLearningEvents((prev) => [savedEvent, ...prev])
    await logAgentMemoryAudit({
      action_type: 'learning_event_created',
      target_table: 'agent_learning_events',
      target_id: savedEvent.id,
      previous_value: null,
      new_value: savedEvent as unknown as Record<string, unknown>,
      reason: savedEvent.notes || 'Human correction evaluated for operational memory.',
      property_id: savedEvent.property_id || null,
      work_request_id: savedEvent.work_request_id || null,
    })
    if (savedEvent.reusable && savedEvent.lesson_status !== 'rejected' && savedEvent.lesson_status !== 'deprecated') {
      await createAgentLearningRuleFromConfirmedEvent(savedEvent)
    }
    return savedEvent
  }

  async function createAgentLearningRuleFromConfirmedEvent(event: AgentLearningEvent) {
    if (!canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admins can approve shared operational memory.')
      return null
    }
    const reason = event.human_confirmed_reason || event.inferred_reason
    const title = event.human_correction
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Human-verified operational rule'
    const insert = {
      title,
      rule_type: event.correction_category,
      rule_text: event.human_correction,
      reason,
      memory_scope: 'global_operational',
      lesson_status: event.lesson_status,
      applies_when: `Use only for similar ${event.task_type || 'tasks'} where the same field condition or user need is present.`,
      does_not_apply_when: 'Do not apply when scope, access, budget, code, client preference, or site constraints differ.',
      source_event_id: event.id,
      source_agent: event.source_agent,
      affected_agents: event.affected_agents,
      confidence: event.confidence || event.lesson_status,
      human_verified: event.lesson_status === 'human_verified',
      active: true,
      usage_count: 0,
      last_used_at: null,
    }

    const { data, error } = await supabase
      .from('agent_learning_rules')
      .insert(insert)
      .select()
      .single()

    if (error) throw error

    const savedRule = data as AgentLearningRule
    setAgentLearningRules((prev) => [savedRule, ...prev])
    await logAgentMemoryAudit({
      action_type: 'conditional_rule_creation',
      target_table: 'agent_learning_rules',
      target_id: savedRule.id,
      previous_value: null,
      new_value: savedRule as unknown as Record<string, unknown>,
      reason: 'Created from human-reviewed learning event.',
      property_id: event.property_id || null,
      work_request_id: event.work_request_id || null,
    })
    return savedRule
  }

  async function getRelevantLearningRulesForAgent(
    agentName: AgentName,
    taskType: string,
    context: string,
    includeUnverified = false
  ) {
    const contextText = normalizeJobScopeTokenText([taskType, context].join(' '))
    const tokens = contextText.split(' ').filter((word) => word.length > 4)

    try {
      const { data, error } = await supabase
        .from('agent_learning_rules')
        .select('*')
        .eq('active', true)
        .eq('memory_scope', 'global_operational')
        .order('updated_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const matchedRules = ((data || []) as AgentLearningRule[])
        .filter((rule) =>
          includeUnverified
            ? rule.lesson_status === 'human_verified' || rule.lesson_status === 'needs_confirmation' || rule.lesson_status === 'draft'
            : rule.lesson_status === 'human_verified' && rule.human_verified
        )
        .map((rule) => {
          const ruleText = normalizeJobScopeTokenText([
            rule.rule_type,
            rule.rule_text,
            rule.reason,
            rule.applies_when,
            rule.does_not_apply_when,
            rule.source_agent,
          ].join(' '))
          const matched = tokens.filter((token) => ruleText.includes(token))
          const routedToAgent = Array.isArray(rule.affected_agents) && rule.affected_agents.includes(agentName)
          return {
            rule,
            score: matched.length + (routedToAgent ? 2 : 0),
          }
        })
        .filter(({ score }) => score >= Math.min(2, tokens.length || 2))
        .sort((a, b) => b.score - a.score)
        .map(({ rule }) => rule)

      if (!includeUnverified && matchedRules.length > 1) {
        const conflict = detectOperationalMemoryConflict(matchedRules, taskType, agentName)
        if (conflict) {
          await createAgentMemoryConflict(conflict, agentName, taskType, context)
          return []
        }
      }

      return matchedRules
    } catch (error) {
      console.warn('Relevant agent learning rules unavailable.', error)
      return []
    }
  }

  function detectOperationalMemoryConflict(rules: AgentLearningRule[], taskType: string, agentName: AgentName) {
    const highImpact = ['cost', 'safety', 'access', 'code', 'best', 'labor', 'material', 'schedule', 'design', 'function', 'client']
    const combinedTask = normalizeJobScopeTokenText([taskType, agentName].join(' '))
    const relevantRules = rules.filter((rule) => {
      const text = normalizeJobScopeTokenText([rule.rule_type, rule.rule_text, rule.reason, rule.applies_when].join(' '))
      return highImpact.some((word) => text.includes(word) || combinedTask.includes(word))
    })
    if (relevantRules.length < 2) return null

    const hasRelocationOrUsability = relevantRules.some((rule) =>
      normalizeJobScopeTokenText([rule.rule_text, rule.reason].join(' ')).match(/\b(entry|relocation|move|place|usability|comfort)\b/)
    )
    const hasConstraintOrCost = relevantRules.some((rule) =>
      normalizeJobScopeTokenText([rule.rule_text, rule.reason, rule.does_not_apply_when].join(' ')).match(/\b(existing|budget|cost|constraint|cannot|keep|complexity|plumbing)\b/)
    )
    const priorities = new Set(relevantRules.map((rule) => rule.priority_level || 'normal'))
    if (!hasRelocationOrUsability && !hasConstraintOrCost && priorities.size < 2) return null

    return {
      rules: relevantRules.slice(0, 4),
      summary: `${getLearningDisplayName(relevantRules[0].rule_type)} rules point toward different field priorities for this task.`,
      recommendation:
        'Use the rule whose applies/does-not-apply boundaries best match the current scope, budget, access, safety, and client expectation. If field conditions are unclear, require site review before final output.',
    }
  }

  async function createAgentMemoryConflict(
    conflict: { rules: AgentLearningRule[]; summary: string; recommendation: string },
    agentName: AgentName,
    taskType: string,
    context: string
  ) {
    const ruleIds = conflict.rules.map((rule) => rule.id)
    const existingOpen = agentMemoryConflicts.find(
      (item) =>
        item.resolution_status === 'needs_review' &&
        item.task_type === (taskType || 'general_task') &&
        ruleIds.every((id) => item.conflicting_rule_ids.includes(id))
    )
    if (existingOpen) return existingOpen

    const { data, error } = await supabase
      .from('agent_memory_conflicts')
      .insert({
        property_id: null,
        work_request_id: null,
        task_type: taskType || 'general_task',
        detected_by_agent: agentName,
        conflicting_rule_ids: ruleIds,
        conflict_summary: `${conflict.summary} Context: ${context}`.slice(0, 1200),
        recommended_resolution: conflict.recommendation,
        resolution_status: 'needs_review',
        creates_new_rule: false,
      })
      .select()
      .single()

    if (error) {
      console.warn('Could not create memory conflict.', error)
      return null
    }

    const saved = data as AgentMemoryConflict
    setAgentMemoryConflicts((prev) => [saved, ...prev])
    await logAgentMemoryAudit({
      action_type: 'memory_conflict_created',
      target_table: 'agent_memory_conflicts',
      target_id: saved.id,
      previous_value: null,
      new_value: saved as unknown as Record<string, unknown>,
      reason: 'Relevant human-verified rules conflict and require review.',
      property_id: saved.property_id || null,
      work_request_id: saved.work_request_id || null,
    })
    return saved
  }

  async function logAgentRuleApplication(
    rules: AgentLearningRule[],
    agentName: AgentName,
    taskType: string,
    context: string,
    applicationContext: LearningRuleApplicationContext = {}
  ) {
    if (!rules.length) return []
    const applicationType = applicationContext.application_type || 'applied'
    const inserts = rules.map((rule) => ({
      rule_id: rule.id,
      application_type: applicationType,
      applied_by_agent: agentName,
      property_id: applicationContext.property_id || null,
      work_request_id: applicationContext.work_request_id || null,
      task_type: taskType || 'general_task',
      output_context: context,
      generated_output_excerpt: (applicationContext.generated_output_excerpt || context || '').slice(0, 800),
      human_feedback_status: 'ignored' as AgentRuleApplicationFeedbackStatus,
      human_feedback_notes: '',
      confidence_before: applicationContext.confidence_before || rule.confidence || null,
      confidence_after: null,
      reviewed_at: null,
    }))

    const { data, error } = await supabase
      .from('agent_rule_applications')
      .insert(inserts)
      .select()

    if (error) {
      console.warn('Could not record agent rule applications.', error)
      return []
    }

    setAgentRuleApplications((prev) => [...((data || []) as AgentRuleApplication[]), ...prev].slice(0, 100))
    const savedApplications = (data || []) as AgentRuleApplication[]
    await Promise.all(
      savedApplications.map((application) =>
        logAgentMemoryAudit({
          action_type: `rule_application_${application.application_type}`,
          target_table: 'agent_rule_applications',
          target_id: application.id,
          previous_value: null,
          new_value: application as unknown as Record<string, unknown>,
          reason: application.application_type === 'applied' ? 'Operational memory influenced generated output.' : 'Operational memory was shown as a suggestion.',
          property_id: application.property_id || null,
          work_request_id: application.work_request_id || null,
        })
      )
    )
    return savedApplications
  }

  async function logAgentMemoryAudit(entry: Omit<AgentMemoryAuditLog, 'id' | 'created_at' | 'actor_role'> & { actor_role?: MemoryActorRole | null }) {
    const insert = {
      actor_id: entry.actor_id || currentUserId || null,
      actor_role: entry.actor_role || memoryActorRole,
      action_type: entry.action_type,
      target_table: entry.target_table,
      target_id: entry.target_id,
      previous_value: entry.previous_value || null,
      new_value: entry.new_value || null,
      reason: entry.reason || null,
      property_id: entry.property_id || null,
      work_request_id: entry.work_request_id || null,
    }
    const { data, error } = await supabase.from('agent_memory_audit_log').insert(insert).select().single()
    if (error) {
      console.warn('Could not write agent memory audit log.', error)
      return null
    }
    const saved = data as AgentMemoryAuditLog
    setAgentMemoryAuditLogs((prev) => [saved, ...prev].slice(0, 200))
    return saved
  }

  async function logContractorAssignmentAudit(
    actionType: string,
    assignment: ContractorAssignment,
    previousValue: ContractorAssignment | null,
    reason: string
  ) {
    await logAgentMemoryAudit({
      action_type: actionType,
      target_table: 'contractor_assignments',
      target_id: assignment.id,
      previous_value: previousValue as unknown as Record<string, unknown> | null,
      new_value: assignment as unknown as Record<string, unknown>,
      reason,
      property_id: assignment.property_id || null,
      work_request_id: assignment.work_request_id || null,
    })
  }

  async function loadContractorAssignments() {
    setContractorAssignmentLoading(true)
    try {
      const [{ data: assignments, error: assignmentsError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabase.from('contractor_assignments').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('profiles').select('id,email,full_name,role').eq('role', 'contractor').order('full_name', { ascending: true }),
      ])
      if (assignmentsError) throw assignmentsError
      if (profilesError && canApproveOperationalMemory(memoryActorRole)) throw profilesError
      setContractorAssignments((assignments || []) as ContractorAssignment[])
      setContractorProfiles(((profiles || []) as ContractorProfile[]).filter((profile) => profile.role === 'contractor'))
    } catch (error) {
      console.warn('Could not load contractor assignments.', error)
      setContractorAssignments([])
      if (canApproveOperationalMemory(memoryActorRole)) setContractorProfiles([])
    } finally {
      setContractorAssignmentLoading(false)
    }
  }

  async function assignContractorToRequest(request: WorkRequest) {
    if (!canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admins can assign contractors.')
      return
    }
    const contractorId = selectedContractorByRequest[request.id]
    if (!contractorId) {
      alert('Choose a contractor first.')
      return
    }
    setContractorAssignmentSavingId(request.id)
    try {
      const insert = {
        property_id: getRequestPropertyId(request),
        work_request_id: request.id,
        contractor_profile_id: contractorId,
        assigned_by: currentUserId,
        status: 'assigned' as ContractorAssignmentStatus,
        assignment_notes: '',
        contractor_notes: '',
        last_status_change_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('contractor_assignments').insert(insert).select().single()
      if (error) throw error
      const saved = data as ContractorAssignment
      setContractorAssignments((prev) => [saved, ...prev])
      await logContractorAssignmentAudit('contractor_assignment_created', saved, null, 'Contractor assigned from property workflow.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not assign contractor.')
    } finally {
      setContractorAssignmentSavingId(null)
    }
  }

  async function updateContractorAssignment(
    assignment: ContractorAssignment,
    changes: Partial<Pick<ContractorAssignment, 'status' | 'contractor_notes' | 'assignment_notes'>>
  ) {
    const contractorChangingOwn =
      memoryActorRole === 'contractor' &&
      assignment.contractor_profile_id === currentUserId &&
      (!changes.status || CONTRACTOR_UPDATABLE_ASSIGNMENT_STATUSES.includes(changes.status)) &&
      !Object.prototype.hasOwnProperty.call(changes, 'assignment_notes')
    if (!canApproveOperationalMemory(memoryActorRole) && !contractorChangingOwn) {
      alert('You do not have permission to update this contractor assignment.')
      return
    }
    setContractorAssignmentSavingId(assignment.id)
    try {
      const patch = {
        ...changes,
        updated_at: new Date().toISOString(),
        ...(changes.status ? { last_status_change_at: new Date().toISOString() } : {}),
      }
      const { data, error } = await supabase
        .from('contractor_assignments')
        .update(patch)
        .eq('id', assignment.id)
        .select()
        .single()
      if (error) throw error
      const saved = data as ContractorAssignment
      setContractorAssignments((prev) => prev.map((item) => (item.id === assignment.id ? saved : item)))
      await logContractorAssignmentAudit(
        changes.status === 'cancelled'
          ? 'contractor_assignment_cancelled'
          : changes.status
            ? 'contractor_assignment_status_changed'
            : 'contractor_assignment_notes_updated',
        saved,
        assignment,
        changes.status ? `Status changed to ${changes.status}.` : 'Contractor notes updated.'
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update contractor assignment.')
    } finally {
      setContractorAssignmentSavingId(null)
    }
  }

  async function submitLearningDraft() {
    if (!learningDraft.human_correction.trim()) {
      alert('Add the human correction first.')
      return
    }

    setAgentLearningSavingId('new-learning-event')
    try {
      await saveAgentLearningEvent(learningDraft)
      setLearningDraft({
        source_agent: 'quality_check_agent',
        task_type: '',
        original_agent_output: '',
        human_correction: '',
      })
      await loadAgentLearning()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save agent learning. Apply the shared agent learning migration first.')
    } finally {
      setAgentLearningSavingId(null)
    }
  }

  async function updateAgentLearningRule(rule: AgentLearningRule, changes: Partial<AgentLearningRule>) {
    const approving =
      changes.human_verified === true ||
      changes.lesson_status === 'human_verified' ||
      (changes.active === true && rule.memory_scope === 'global_operational')
    const rejectingOrDeprecating = changes.lesson_status === 'rejected' || changes.lesson_status === 'deprecated'
    const restricted = approving || rejectingOrDeprecating || Object.prototype.hasOwnProperty.call(changes, 'priority_level')
    if (restricted && !canApproveOperationalMemory(memoryActorRole)) {
      alert('Only admins can approve shared operational memory.')
      return
    }
    if (!restricted && !canEditOperationalMemory(memoryActorRole)) {
      alert('You do not have permission to edit operational memory.')
      return
    }
    setAgentLearningSavingId(rule.id)
    try {
      const patch = { ...changes, updated_at: new Date().toISOString() }
      const { data, error } = await supabase
        .from('agent_learning_rules')
        .update(patch)
        .eq('id', rule.id)
        .select()
        .single()
      if (error) throw error
      setAgentLearningRules((prev) => prev.map((item) => (item.id === rule.id ? (data as AgentLearningRule) : item)))
      const trackedKeys = ['lesson_status', 'human_verified', 'active', 'confidence', 'priority_level', 'applies_when', 'does_not_apply_when']
      const actionKey = trackedKeys.find((key) => Object.prototype.hasOwnProperty.call(changes, key)) || 'rule_update'
      await logAgentMemoryAudit({
        action_type:
          changes.lesson_status === 'deprecated'
            ? 'rule_deprecation'
            : changes.lesson_status === 'rejected'
              ? 'rule_rejection'
              : `${actionKey}_change`,
        target_table: 'agent_learning_rules',
        target_id: rule.id,
        previous_value: rule as unknown as Record<string, unknown>,
        new_value: data as Record<string, unknown>,
        reason: 'Operational memory rule updated from Agent Learning.',
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update learning rule.')
    } finally {
      setAgentLearningSavingId(null)
    }
  }

  async function updateAgentRuleApplicationFeedback(
    application: AgentRuleApplication,
    status: AgentRuleApplicationFeedbackStatus,
    notes = application.human_feedback_notes || ''
  ) {
    if (!canProvideRuleFeedback(memoryActorRole, application, status, contractorAssignments, currentUserId)) {
      alert('You do not have permission to modify operational memory feedback.')
      return
    }
    setAgentLearningSavingId(application.id)
    try {
      const reviewedAt = new Date().toISOString()
      const confidenceAfter =
        status === 'accepted'
          ? 'reinforced'
          : status === 'edited'
            ? 'needs_review'
            : status === 'rejected'
              ? 'lowered_needs_review'
              : application.confidence_after || null

      const { data, error } = await supabase
        .from('agent_rule_applications')
        .update({
          human_feedback_status: status,
          human_feedback_notes: notes,
          confidence_after: confidenceAfter,
          reviewed_at: status === 'ignored' ? null : reviewedAt,
        })
        .eq('id', application.id)
        .select()
        .single()

      if (error) throw error

      setAgentRuleApplications((prev) =>
        prev.map((item) => (item.id === application.id ? (data as AgentRuleApplication) : item))
      )
      await logAgentMemoryAudit({
        action_type: `rule_feedback_${status}`,
        target_table: 'agent_rule_applications',
        target_id: application.id,
        previous_value: application as unknown as Record<string, unknown>,
        new_value: data as Record<string, unknown>,
        reason: notes || `Rule application feedback marked ${status}.`,
        property_id: application.property_id || null,
        work_request_id: application.work_request_id || null,
      })

      const currentRule = agentLearningRules.find((rule) => rule.id === application.rule_id)
      if (currentRule && status === 'accepted' && application.application_type === 'applied') {
        await updateAgentLearningRule(currentRule, {
          usage_count: Number(currentRule.usage_count || 0) + 1,
          last_used_at: reviewedAt,
          confidence: currentRule.confidence === 'high' ? 'high' : 'reinforced',
        })
      }

      if (currentRule && status === 'edited') {
        await updateAgentLearningRule(currentRule, {
          lesson_status: 'needs_confirmation',
          confidence: 'needs_review',
        })
      }

      if (currentRule && status === 'rejected') {
        await updateAgentLearningRule(currentRule, {
          lesson_status: 'needs_confirmation',
          confidence: 'lowered_needs_review',
        })
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save rule feedback.')
    } finally {
      setAgentLearningSavingId(null)
    }
  }

  async function resolveAgentMemoryConflict(
    conflict: AgentMemoryConflict,
    resolutionStatus: AgentMemoryConflictStatus,
    selectedRuleId: string | null = null,
    createNewRule = false
  ) {
    if (!canResolveMemoryConflict(memoryActorRole)) {
      alert('Only admins can resolve shared operational memory conflicts.')
      return
    }
    setAgentLearningSavingId(conflict.id)
    try {
      const notes = window.prompt('Add human resolution notes for this memory conflict.', conflict.human_resolution_notes || '') || ''
      const resolvedAt = new Date().toISOString()
      let newRuleId: string | null = null

      if (createNewRule) {
        const selectedRule = selectedRuleId ? agentLearningRuleById.get(selectedRuleId) : null
        const { data: ruleData, error: ruleError } = await supabase
          .from('agent_learning_rules')
          .insert({
            title: `Resolved boundary: ${conflict.task_type}`,
            memory_scope: 'global_operational',
            lesson_status: 'human_verified',
            rule_type: selectedRule?.rule_type || 'workflow_logic',
            rule_text: notes || conflict.recommended_resolution || conflict.conflict_summary,
            reason: 'Created from a human-reviewed operational memory conflict.',
            applies_when: notes || 'Apply only when the human-reviewed conflict resolution matches the current field context.',
            does_not_apply_when: 'Do not apply when cost, safety, access, code, client preference, or scope constraints differ.',
            source_agent: conflict.detected_by_agent,
            affected_agents: selectedRule?.affected_agents || ['quality_check_agent'],
            confidence: 'human_verified',
            human_verified: true,
            active: true,
            usage_count: 0,
          })
          .select()
          .single()
        if (ruleError) throw ruleError
        const createdRule = ruleData as AgentLearningRule
        newRuleId = createdRule.id
        setAgentLearningRules((prev) => [createdRule, ...prev])
        await logAgentMemoryAudit({
          action_type: 'conditional_rule_creation',
          target_table: 'agent_learning_rules',
          target_id: createdRule.id,
          previous_value: null,
          new_value: createdRule as unknown as Record<string, unknown>,
          reason: 'Created from human-reviewed memory conflict resolution.',
          property_id: conflict.property_id || null,
          work_request_id: conflict.work_request_id || null,
        })
      }

      const { data, error } = await supabase
        .from('agent_memory_conflicts')
        .update({
          resolved_at: ['resolved', 'dismissed', 'ask_client', 'needs_site_review'].includes(resolutionStatus)
            ? resolvedAt
            : null,
          human_selected_rule_id: selectedRuleId,
          human_resolution_notes: notes,
          resolution_status: resolutionStatus,
          creates_new_rule: createNewRule,
          new_rule_id: newRuleId,
        })
        .eq('id', conflict.id)
        .select()
        .single()
      if (error) throw error

      setAgentMemoryConflicts((prev) => prev.map((item) => (item.id === conflict.id ? (data as AgentMemoryConflict) : item)))
      await logAgentMemoryAudit({
        action_type: 'conflict_resolution',
        target_table: 'agent_memory_conflicts',
        target_id: conflict.id,
        previous_value: conflict as unknown as Record<string, unknown>,
        new_value: data as Record<string, unknown>,
        reason: notes || resolutionStatus,
        property_id: conflict.property_id || null,
        work_request_id: conflict.work_request_id || null,
      })

      const { data: resolutionEvent, error: resolutionEventError } = await supabase.from('agent_learning_events').insert({
        property_id: conflict.property_id || null,
        work_request_id: conflict.work_request_id || null,
        memory_scope: 'global_operational',
        lesson_status: resolutionStatus === 'resolved' ? 'human_verified' : 'needs_confirmation',
        source_agent: conflict.detected_by_agent,
        affected_agents: ['quality_check_agent'],
        task_type: conflict.task_type,
        original_agent_output: conflict.conflict_summary,
        human_correction: notes || resolutionStatus,
        correction_category: 'workflow_logic',
        inferred_reason: conflict.recommended_resolution || '',
        human_confirmed_reason: notes,
        learning_value_score: 8,
        reusable: createNewRule,
        human_verified: resolutionStatus === 'resolved',
        confidence: resolutionStatus === 'resolved' ? 'human_verified' : 'needs_review',
        notes: 'Saved from human-reviewed operational memory conflict resolution.',
      }).select().single()
      if (resolutionEventError) throw resolutionEventError
      await logAgentMemoryAudit({
        action_type: 'learning_event_created',
        target_table: 'agent_learning_events',
        target_id: (resolutionEvent as AgentLearningEvent).id,
        previous_value: null,
        new_value: resolutionEvent as Record<string, unknown>,
        reason: 'Conflict resolution documented as an operational memory learning event.',
        property_id: conflict.property_id || null,
        work_request_id: conflict.work_request_id || null,
      })
      await loadAgentLearning()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not resolve memory conflict.')
    } finally {
      setAgentLearningSavingId(null)
    }
  }

  async function updateMaterialCostsNow() {
    setMaterialUpdating(true)

    const { data, error } = await supabase.functions.invoke('update-material-costs', {
      body: {},
    })

    if (error) {
      console.error(error)
      alert('Material update failed: ' + error.message)
      setMaterialUpdating(false)
      return
    }

    console.log('Material update result:', data)
    alert('Material costs updated from FRED/API.')
    await loadMaterials()
    setMaterialUpdating(false)
  }

  async function addMaterialCost() {
    if (!materialName || !materialPrice) {
      alert('Material name and typical price are required.')
      return
    }

    const price = Number(materialPrice)
    const normalizedName = normalizeMaterialName(materialName)

    const { error } = await supabase.from('material_costs').insert({
      item_name: materialName,
      normalized_name: normalizedName,
      category: materialCategory || 'Material',
      unit: materialUnit || 'each',
      low_price: Math.round(price * 0.9 * 100) / 100,
      typical_price: price,
      high_price: Math.round(price * 1.15 * 100) / 100,
      source: materialSource || 'manual_admin_entry',
      store_name: materialSource || 'Manual entry',
      zip: '',
      confidence: 'database_review',
      human_verified: false,
      last_checked: new Date().toISOString(),
      notes: 'Manual draft material cost. Human approval required before reuse.',
    })

    if (error) {
      alert(error.message)
      return
    }

    setMaterialName('')
    setMaterialCategory('')
    setMaterialUnit('')
    setMaterialPrice('')
    setMaterialSource('')
    await loadMaterials()
  }

  function editMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)
    const typical = currentTypical || 0

    setMaterialEditorItem(item)
    setMaterialEditorDraft({
      name: currentName,
      unit: item.unit || 'each',
      typicalPrice: String(typical),
      lowPrice: String(item.low_price ?? Math.round(typical * 0.9 * 100) / 100),
      highPrice: String(item.high_price ?? Math.round(typical * 1.15 * 100) / 100),
      category: item.category || 'Material',
      zip: item.zip || '',
      source: item.source || item.store_name || 'admin_review',
    })
  }

  function closeMaterialEditor() {
    setMaterialEditorItem(null)
    setMaterialEditorDraft(null)
  }

  async function saveMaterialEditor() {
    if (!materialEditorItem || !materialEditorDraft) return

    const nextTypical = parseMoneyInput(materialEditorDraft.typicalPrice)
    if (!Number.isFinite(nextTypical) || nextTypical <= 0) {
      alert('Please enter a valid typical price.')
      return
    }

    setMaterialSavingId(materialEditorItem.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: materialEditorDraft.name,
        normalized_name: normalizeMaterialName(materialEditorDraft.name),
        category: materialEditorDraft.category || 'Material',
        unit: materialEditorDraft.unit || 'each',
        low_price: parseMoneyInput(materialEditorDraft.lowPrice) || nextTypical,
        typical_price: nextTypical,
        high_price: parseMoneyInput(materialEditorDraft.highPrice) || nextTypical,
        source: materialEditorDraft.source || 'admin_review',
        store_name: materialEditorDraft.source || 'Admin review',
        zip: materialEditorDraft.zip || '',
        confidence: materialEditorItem.human_verified ? 'database_verified' : 'database_review',
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Edited in Material Cost Review. Human review required unless approved as verified.',
      })
      .eq('id', materialEditorItem.id)

    if (error) {
      alert(error.message)
    } else {
      closeMaterialEditor()
      await loadMaterials()
    }

    setMaterialSavingId(null)
  }

  async function approveMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)

    const approvedPrice = currentTypical
    if (!Number.isFinite(approvedPrice) || approvedPrice <= 0) {
      alert('Edit this material and add a valid typical price before approving it.')
      return
    }

    setMaterialSavingId(item.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: currentName,
        normalized_name: normalizeMaterialName(currentName),
        unit: item.unit || 'each',
        low_price: Math.round(approvedPrice * 0.95 * 100) / 100,
        typical_price: approvedPrice,
        high_price: Math.round(approvedPrice * 1.1 * 100) / 100,
        confidence: 'database_verified',
        human_verified: true,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Approved as human-verified pricing memory. Future estimates may reuse this price first.',
      })
      .eq('id', item.id)

    if (error) alert(error.message)
    else {
      alert('Material cost approved as verified. Future AI estimates can reuse this price first.')
      await loadMaterials()
    }

    setMaterialSavingId(null)
  }


  async function loadLaborRates() {
    setLaborLoading(true)

    const { data, error } = await supabase
      .from('labor_rates')
      .select('*')
      .order('human_verified', { ascending: true })
      .order('updated_at', { ascending: false })

    if (error) alert(error.message)
    else setLaborRates((data || []) as LaborRate[])

    setLaborLoading(false)
  }

  async function addLaborRate() {
    if (!laborTrade || !laborTypicalRate) {
      alert('Trade and typical rate are required.')
      return
    }

    const typical = parseMoneyInput(laborTypicalRate)
    if (!Number.isFinite(typical) || typical <= 0) {
      alert('Please enter a valid typical rate.')
      return
    }

    const { error } = await supabase.from('labor_rates').insert({
      trade: laborTrade,
      job_type: laborJobType || 'General',
      unit: laborUnit || 'hour',
      low_rate: Math.round(typical * 0.85 * 100) / 100,
      typical_rate: typical,
      high_rate: Math.round(typical * 1.25 * 100) / 100,
      minimum_charge: parseMoneyInput(laborMinimumCharge),
      trip_charge: parseMoneyInput(laborTripCharge),
      disposal_fee: parseMoneyInput(laborDisposalFee),
      zip: '',
      region: laborRegion || '',
      source: 'manual_admin_entry',
      confidence: 'labor_review',
      human_verified: false,
      last_checked: new Date().toISOString(),
      notes: 'Manual draft labor rate. Human approval required before reuse.',
    })

    if (error) {
      alert(error.message)
      return
    }

    setLaborTrade('')
    setLaborJobType('')
    setLaborUnit('hour')
    setLaborTypicalRate('')
    setLaborMinimumCharge('')
    setLaborTripCharge('')
    setLaborDisposalFee('')
    setLaborRegion('')
    await loadLaborRates()
  }

  async function editLaborRate(rate: LaborRate) {
    const nextTrade = window.prompt('Trade', rate.trade || '')
    if (nextTrade === null) return

    const nextJobType = window.prompt('Job type / scope', rate.job_type || 'General')
    if (nextJobType === null) return

    const nextUnit = window.prompt('Unit, ex: hour / sqft / day / fixed', rate.unit || 'hour')
    if (nextUnit === null) return

    const nextTypicalText = window.prompt('Typical labor rate', String(rate.typical_rate || 0))
    if (nextTypicalText === null) return

    const nextTypical = parseMoneyInput(nextTypicalText)
    if (!Number.isFinite(nextTypical) || nextTypical <= 0) {
      alert('Please enter a valid typical labor rate.')
      return
    }

    const nextLowText = window.prompt(
      'Low rate',
      String(rate.low_rate ?? Math.round(nextTypical * 0.85 * 100) / 100)
    )
    if (nextLowText === null) return

    const nextHighText = window.prompt(
      'High rate',
      String(rate.high_rate ?? Math.round(nextTypical * 1.25 * 100) / 100)
    )
    if (nextHighText === null) return

    const nextMinimumText = window.prompt('Minimum charge', String(rate.minimum_charge || 0))
    if (nextMinimumText === null) return

    const nextTripText = window.prompt('Trip charge', String(rate.trip_charge || 0))
    if (nextTripText === null) return

    const nextDisposalText = window.prompt('Disposal fee', String(rate.disposal_fee || 0))
    if (nextDisposalText === null) return

    const nextZip = window.prompt('ZIP or service area', rate.zip || '')
    if (nextZip === null) return

    const nextRegion = window.prompt('Region', rate.region || '')
    if (nextRegion === null) return

    setLaborSavingId(rate.id)

    const { error } = await supabase
      .from('labor_rates')
      .update({
        trade: nextTrade,
        job_type: nextJobType || 'General',
        unit: nextUnit || 'hour',
        low_rate: parseMoneyInput(nextLowText) || nextTypical,
        typical_rate: nextTypical,
        high_rate: parseMoneyInput(nextHighText) || nextTypical,
        minimum_charge: parseMoneyInput(nextMinimumText),
        trip_charge: parseMoneyInput(nextTripText),
        disposal_fee: parseMoneyInput(nextDisposalText),
        zip: nextZip || '',
        region: nextRegion || '',
        source: rate.source || 'admin_review',
        confidence: rate.human_verified ? 'labor_verified' : 'labor_review',
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Edited in Labor Rate Review. Human review required unless approved as verified.',
      })
      .eq('id', rate.id)

    if (error) alert(error.message)
    else await loadLaborRates()

    setLaborSavingId(null)
  }

  async function approveLaborRate(rate: LaborRate) {
    const approvedTypical = Number(rate.typical_rate || 0)
    if (!Number.isFinite(approvedTypical) || approvedTypical <= 0) {
      alert('Edit this labor rate and add a valid typical rate before approving it.')
      return
    }

    setLaborSavingId(rate.id)

    const { error } = await supabase
      .from('labor_rates')
      .update({
        unit: rate.unit || 'hour',
        low_rate: Math.round(approvedTypical * 0.9 * 100) / 100,
        typical_rate: approvedTypical,
        high_rate: Math.round(approvedTypical * 1.15 * 100) / 100,
        confidence: 'labor_verified',
        human_verified: true,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Approved as human-verified labor memory. Future estimates may reuse this rate first.',
      })
      .eq('id', rate.id)

    if (error) alert(error.message)
    else {
      alert('Labor rate approved as verified. Future estimates can reuse this labor memory.')
      await loadLaborRates()
    }

    setLaborSavingId(null)
  }

  function updateCuratedLaborDraft(changes: Partial<CuratedLaborDraft>) {
    setCuratedLaborDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...changes, adminEdited: true }
      const totals = curatedLaborTotal(
        Number(next.laborHoursLow || 0),
        Number(next.laborHoursHigh || 0),
        Number(next.hourlyRateLow || 0),
        Number(next.hourlyRateHigh || 0),
        Number(next.accessMultiplier || 1),
        Number(next.setupCleanupHours || 0)
      )
      setEstimateLaborUnits(next.laborHoursHigh)
      setEstimateLaborCost(String(totals.standard))
      setEstimateLaborMessage('Curated labor estimate. Admin approval required.')
      return next
    })
  }

  async function saveCuratedLaborAsVerifiedMemory() {
    if (!selectedEstimateRequest || !curatedLaborDraft) {
      alert('Open an estimate and generate a curated labor draft first.')
      return
    }

    const lowHours = Number(curatedLaborDraft.laborHoursLow || 0)
    const highHours = Number(curatedLaborDraft.laborHoursHigh || 0)
    const lowRate = Number(curatedLaborDraft.hourlyRateLow || 0)
    const highRate = Number(curatedLaborDraft.hourlyRateHigh || 0)

    if (lowHours <= 0 || highHours <= 0 || lowRate <= 0 || highRate <= 0) {
      alert('Labor hours and hourly rate ranges must be greater than zero before saving verified memory.')
      return
    }

    setCuratedLaborSaving(true)

    const typicalRate = Math.round(((lowRate + highRate) / 2) * 100) / 100
    const totals = curatedLaborTotal(
      lowHours,
      highHours,
      lowRate,
      highRate,
      Number(curatedLaborDraft.accessMultiplier || 1),
      Number(curatedLaborDraft.setupCleanupHours || 0)
    )
    const overrideNote = curatedLaborDraft.adminEdited
      ? curatedLaborDraft.notes || 'Admin edited curated labor estimate before approval.'
      : ''

    const sourceLinks = curatedLaborDraft.sourceLinks.map((link) => ({
      ...link,
      admin_override_note: overrideNote || link.admin_override_note || '',
    }))

    try {
      const { data, error } = await supabase
        .from('labor_rates')
        .insert({
          trade: curatedLaborDraft.trade,
          job_type: curatedLaborDraft.jobType,
          unit: 'hour',
          low_rate: lowRate,
          typical_rate: typicalRate,
          high_rate: highRate,
          labor_hours_low: lowHours,
          labor_hours_high: highHours,
          hourly_rate_low: lowRate,
          hourly_rate_high: highRate,
          access_multiplier: Number(curatedLaborDraft.accessMultiplier || 1),
          setup_cleanup_hours: Number(curatedLaborDraft.setupCleanupHours || 0),
          minimum_charge: 0,
          trip_charge: 0,
          disposal_fee: 0,
          zip: selectedEstimateRequest.zip || '',
          region: [selectedEstimateRequest.city, selectedEstimateRequest.state].filter(Boolean).join(', '),
          source: 'admin_verified_curated_labor_memory',
          source_links: sourceLinks,
          source_priority: 'admin_verified_shelter_prep_labor_memory',
          admin_override_note: overrideNote,
          admin_edited: curatedLaborDraft.adminEdited,
          confidence: 'labor_verified',
          human_verified: true,
          last_checked: new Date().toISOString(),
          verified_at: new Date().toISOString(),
          verified_by: currentUserId || null,
          notes: [
            'Curated labor estimate. Admin approval required.',
            curatedLaborDraft.notes,
            `Approved labor range: ${lowHours}-${highHours} hours at ${money(lowRate)}-${money(highRate)}/hr. Draft labor range ${money(totals.low)}-${money(totals.high)}.`,
          ].filter(Boolean).join('\n'),
        })
        .select('*')
        .single()

      if (error) throw error

      const saved = data as LaborRate
      setAppliedLaborRate(saved)
      setCuratedLaborDraft(buildCuratedLaborDraftForRequest(selectedEstimateRequest, saved, highHours))
      setEstimateLaborCost(String(totals.standard))
      setEstimateLaborMessage('Curated labor estimate saved as human-verified Shelter Prep labor memory. Admin approval required before final estimate.')
      await loadLaborRates()
      alert('Curated labor estimate saved as verified labor memory.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save curated labor memory. Make sure the Curated Labor Cost Memory migration has been applied.')
    } finally {
      setCuratedLaborSaving(false)
    }
  }

  function exportCsv() {
    if (!hasAdminConsoleAccess) {
      setShowLogin(true)
      return
    }

    if (requests.length === 0) {
      alert('No requests to export.')
      return
    }

    const headers = [
      'createdAt',
      'status',
      'requesterName',
      'email',
      'phone',
      'propertyAddress',
      'city',
      'state',
      'zip',
      'workType',
      'urgency',
      'occupancy',
      'timeline',
      'description',
      'photos',
      'documents',
    ]

    const rows = requests.map((r) =>
      [
        r.createdAt,
        r.status,
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.urgency,
        r.occupancy,
        r.timeline,
        r.description,
        r.photos.map((f) => f.name).join(' | '),
        r.documents.map((f) => f.name).join(' | '),
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'shelter-prep-requests.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (r.archived) return false

      const matchesFilter = filter === 'all' || r.status === filter
      const text = [
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.description,
      ]
        .join(' ')
        .toLowerCase()

      return matchesFilter && text.includes(search.toLowerCase())
    })
  }, [requests, filter, search])

  const addressGroupedRequests = useMemo(() => {
    const groups = new Map<string, WorkRequest[]>()
    filteredRequests.forEach((request) => {
      const addressKey = (request.propertyAddress || `${request.city} ${request.state}` || request.id).trim().toLowerCase()
      const current = groups.get(addressKey) || []
      groups.set(addressKey, [...current, request])
    })

    return Array.from(groups.values()).map((group) => {
      const primary = group
        .slice()
        .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0]
      const mergedPhotos = group.flatMap((request) => request.photos || [])
      const mergedDocuments = group.flatMap((request) => request.documents || [])
      const mergedNotes = group.flatMap((request) => request.adminNotes || [])
      const needsAttention = group.find((request) => request.status === 'needs_info' || request.status === 'pending_approval')
      return {
        ...primary,
        status: needsAttention?.status || primary.status,
        photos: mergedPhotos,
        documents: mergedDocuments,
        adminNotes: mergedNotes,
        description: group.length > 1
          ? `${primary.description || 'Property work'} (${group.length} records grouped at this address)`
          : primary.description,
      }
    })
  }, [filteredRequests])

  useEffect(() => {
    if (!hasAdminConsoleAccess || (activeTab !== 'dashboard' && activeTab !== 'properties')) return

    filteredRequests.forEach((request) => {
      if (!request.propertyAddress.trim()) return
      if (!propertyAgentOutputsByRequest[request.id]?.length) {
        void loadOrCreatePropertyAgentOutputs(request)
      }
      if (siteMediaFindingsByRequest[request.id] === undefined) {
        void loadSiteMediaIntelligence(request)
      }
      if (propertyProfilesByLeadId[request.id]) return
      if (propertyProfileLoadingByLeadId[request.id]) return
      if (propertyProfileErrorsByLeadId[request.id]) return
      refreshLeadPropertyProfile(request)
    })
  }, [
    activeTab,
    filteredRequests,
    hasAdminConsoleAccess,
    propertyProfileErrorsByLeadId,
    propertyProfileLoadingByLeadId,
    propertyProfilesByLeadId,
    propertyAgentOutputsByRequest,
    siteMediaFindingsByRequest,
  ])

  const filteredArchivedRequests = useMemo(() => {
    return archivedRequests.filter((r) => {
      const text = [
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.description,
        r.archiveReason,
      ]
        .join(' ')
        .toLowerCase()

      return text.includes(archivedSearch.toLowerCase())
    })
  }, [archivedRequests, archivedSearch])

  const sellerPrepSelectedRequest = useMemo(() => {
    return requests.find((request) => request.id === sellerPrepSelectedId) || requests[0] || null
  }, [requests, sellerPrepSelectedId])
  const inspectionTaskIntelligence = useMemo(() => {
    return buildInspectionTaskIntelligence(sellerPrepSelectedRequest, sellerPrepItemsV1)
  }, [sellerPrepSelectedRequest, sellerPrepItemsV1])

  const columns: RequestStatus[] = [
    'new',
    'in_progress',
    'needs_info',
    'pending_approval',
    'estimate_ready',
  ]

  const activePropertyCount = addressGroupedRequests.filter((request) => request.status !== 'estimate_ready').length
  const needsReviewRequests = addressGroupedRequests.filter((request) => request.status === 'needs_info' || request.status === 'pending_approval')
  const readyForActionRequests = addressGroupedRequests.filter((request) => request.status === 'pending_approval' || request.status === 'estimate_ready')
  const recentlyUpdatedRequests = [...addressGroupedRequests]
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, 4)
  const dashboardSections = [
    {
      title: 'Properties by Address',
      hint: 'Each property address is one work group. Open only what needs the next decision.',
      items: addressGroupedRequests,
    },
  ]

  function getPropertyWorkflow(request: WorkRequest) {
    const isOpenEstimate = selectedEstimateRequest?.id === request.id
    const scopedItems = isOpenEstimate
      ? currentScopeEstimateItems
      : estimateItems.filter((item) => estimateItemMatchesCurrentScope(item, request))
    const hasEstimateDraft = scopedItems.length > 0 || Boolean(request.aiEstimate)
    const pendingReview = scopedItems.some((item) => !item.human_approved && !isEstimateItemRejected(item))
    const approvedEstimate = scopedItems.length > 0 && scopedItems.every((item) => item.human_approved || isEstimateItemRejected(item))
    const missingInfo = request.status === 'needs_info' || getMissingInfoItems(request).length > 0
    const hasSellerSummary = sellerPrepSelectedId === request.id && Boolean(sellerPrepAnalysisV1)

    if (request.archived) {
      return {
        stage: 'Complete',
        title: 'Work archived',
        body: 'The property is out of the active workflow. History and supporting files remain available.',
        buttonLabel: 'Export Job Packet',
        onPrimary: () => exportJobPacket(request),
        disabled: false,
      }
    }

    if (hasSellerSummary) {
      return {
        stage: 'Seller Summary',
        title: 'Seller summary ready',
        body: 'Repair priorities and seller-facing recommendations are ready to review.',
        buttonLabel: sellerPrepLoadingId === request.id ? 'Opening...' : 'View Seller Summary',
        onPrimary: () => loadSellerPrepDraftForRequest(request),
        disabled: sellerPrepLoadingId === request.id,
      }
    }

    if (pendingReview || request.status === 'pending_approval') {
      return {
        stage: 'Review Required',
        title: 'Estimate draft ready',
        body: 'Labor, materials, and scope notes are prepared. Human review is required before sending or routing.',
        buttonLabel: estimateLoading ? 'Opening...' : 'Review Estimate',
        onPrimary: () => openEstimateReview(request),
        disabled: estimateLoading,
      }
    }

    if (approvedEstimate || request.status === 'estimate_ready') {
      return {
        stage: 'Contractor Routing',
        title: 'Estimate ready for packet',
        body: 'Reviewed estimate information is ready to package for reporting or contractor coordination.',
        buttonLabel: 'Export Job Packet',
        onPrimary: () => exportJobPacket(request),
        disabled: false,
      }
    }

    if (missingInfo) {
      return {
        stage: 'Intake',
        title: 'Missing information needed',
        body: 'A few details are needed before this job can move forward.',
        buttonLabel: messageSavingId === request.id ? 'Creating...' : 'Create Info Request',
        onPrimary: () => generateMissingInfoRequest(request),
        disabled: messageSavingId === request.id,
      }
    }

    if (hasEstimateDraft) {
      return {
        stage: 'Estimate Draft',
        title: 'Estimate draft started',
        body: 'Initial pricing and scope assumptions are available. Review the estimate before sharing or routing.',
        buttonLabel: 'Review Estimate',
        onPrimary: () => openEstimateReview(request),
        disabled: false,
      }
    }

    return {
      stage: request.photos.length || request.documents.length ? 'Scope Organized' : 'Intake',
      title: 'Ready to organize scope',
      body: 'Photos, documents, and request details are attached. Shelter Prep can prepare the first repair scope and estimate draft.',
      buttonLabel: materialEstimateLoadingId === request.id ? 'Preparing...' : 'Prepare Draft',
      onPrimary: () => buildMaterialEstimate(request),
      disabled: materialEstimateLoadingId === request.id,
    }
  }

  function isRejectedResearchTask(task: AgentResearchTask) {
    return task.status === 'rejected'
  }

  function isRejectedFinding(finding: PropertyMediaFinding) {
    return finding.review_status === 'rejected' || finding.review_status === 'deprecated'
  }

  function getActiveFindings(request: WorkRequest) {
    return (siteMediaFindingsByRequest[request.id] || []).filter((finding) => !isRejectedFinding(finding))
  }

  function getArchivedFindings(request: WorkRequest) {
    return (siteMediaFindingsByRequest[request.id] || []).filter(isRejectedFinding)
  }

  function getActiveResearchTasks(request: WorkRequest) {
    return (agentResearchTasksByRequest[request.id] || []).filter((task) => !isRejectedResearchTask(task))
  }

  function getArchivedResearchTasks(request: WorkRequest) {
    return (agentResearchTasksByRequest[request.id] || []).filter(isRejectedResearchTask)
  }

  function isBerlinAveRequest(request: WorkRequest) {
    const text = [
      request.propertyAddress,
      request.city,
      request.state,
      request.inspectionIntelligence?.propertyAddress,
      request.inspectionIntelligence?.city,
      request.inspectionIntelligence?.fileName,
      request.inspectionIntelligence?.repairItems?.map((item) => item.source_text).join(' '),
    ].filter(Boolean).join(' ')
    return /11134\s+sw\s+berlin|berlin ave|wilsonville|inspection pages/i.test(text)
  }

  function getInspectionWorkGroups(request: WorkRequest) {
    const intelligence = request.inspectionIntelligence
    if (!intelligence) return []

    const persistedGroups = (intelligence.workGroups || intelligence.repairBundles || []) as InspectionRepairBundleDraft[]
    if (persistedGroups.length > 0) return persistedGroups.filter((bundle) => bundle.status !== 'rejected')

    if (isBerlinAveRequest(request)) {
      return buildBerlinAveWorkGroups(intelligence.id || `inspection-${request.id}`, request.propertyId || getRequestPropertyId(request))
    }

    if (intelligence.repairItems?.length) {
      return buildRepairBundles(intelligence.repairItems, request.propertyId || getRequestPropertyId(request))
        .filter((bundle) => bundle.status !== 'rejected')
    }

    return []
  }

  function getArchivedInspectionWorkGroups(request: WorkRequest) {
    const intelligence = request.inspectionIntelligence
    if (!intelligence) return []
    return ((intelligence.workGroups || intelligence.repairBundles || []) as InspectionRepairBundleDraft[])
      .filter((bundle) => bundle.status === 'rejected')
  }

  function hasInspectionFindingsWithoutWorkGroups(request: WorkRequest) {
    return Boolean(request.inspectionIntelligence?.repairItems?.length) && getInspectionWorkGroups(request).length === 0
  }

  function getNeedsReviewCount(request: WorkRequest) {
    const findings = getActiveFindings(request).filter((finding) =>
      ['ai_draft', 'needs_review', 'needs_more_info', 'research_requested', 'research_drafted'].includes(finding.review_status)
    )
    const tasks = getActiveResearchTasks(request).filter((task) =>
      ['draft', 'queued', 'researching', 'answered', 'needs_review'].includes(task.status)
    )
    const workGroups = getInspectionWorkGroups(request).filter((bundle) =>
      ['ai_draft', 'needs_review', 'needs_more_info', 'research_requested'].includes(bundle.status)
    )
    return findings.length + tasks.length + workGroups.length
  }

  function getRequestEvidenceCount(request: WorkRequest) {
    return getUniqueUploadedFiles(request).length
  }

  function getUniqueUploadedFiles(request: WorkRequest) {
    const uniqueFiles = new Map<string, StoredFile>()
    ;[...request.photos, ...request.documents].forEach((file) => {
      const key = (file.path || file.url || file.id || file.name).toLowerCase()
      if (!uniqueFiles.has(key)) uniqueFiles.set(key, file)
    })
    return Array.from(uniqueFiles.values())
  }

  function getResearchAnswerSummary(task: AgentResearchTask) {
    const raw = task.answer_draft || task.recommended_next_action || task.missing_information || 'No answer drafted yet.'
    return raw.length > 170 ? `${raw.slice(0, 167)}...` : raw
  }

  function getResearchNextStep(task: AgentResearchTask) {
    if (task.status === 'queued' || task.status === 'draft') return 'Run research'
    if (task.answer_draft && task.status !== 'human_verified') return 'Review draft'
    if (task.status === 'human_verified') return 'Human verified'
    return task.recommended_next_action || 'Needs review'
  }

  function getOperationalStatusStyle(status: string) {
    if (['human_verified', 'approved', 'estimate_ready'].includes(status)) return styles.badge
    if (['rejected', 'failed', 'extraction_failed'].includes(status)) return styles.badgeDanger
    return styles.badgeMuted
  }

  function renderResearchCategoryControls(
    selected: AgentResearchCategory[],
    onChange: (next: AgentResearchCategory[]) => void
  ) {
    return (
      <div style={styles.checkboxGrid}>
        {AGENT_RESEARCH_CATEGORIES.map((category) => (
          <label key={category} style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selected.includes(category)}
              onChange={() => onChange(toggleResearchCategory(selected, category))}
            />
            <span>{category}</span>
          </label>
        ))}
      </div>
    )
  }

  function renderWorkGroupResearchResources(request: WorkRequest, group: InspectionRepairBundleDraft) {
    const tasks = getWorkGroupResearchTasks(request, group)
    const task = getBestWorkGroupResearchTask(request, group)
    const sources = task ? agentResearchSourcesByTask[task.id] || [] : []
    const historyTasks = task ? tasks.filter((item) => item.id !== task.id) : []

    if (!task) {
      return (
        <p style={styles.small}>Source research not yet performed.</p>
      )
    }

    const bestResources = sources.slice(0, 3)
    const isFireSuppression = /fire|sprinkler|suppression/i.test(`${group.title} ${group.system_category} ${group.recommended_trade}`)
    const conclusion = isFireSuppression
      ? 'Painted sprinkler heads may be a fire/life-safety issue requiring fire authority or sprinkler professional review.'
      : (task.answer_draft || group.evidence_summary || group.summary || 'Draft research is available for admin review.').split('\n').find((line) => line.trim() && !/^Research Draft/i.test(line))?.replace(/^What we know:\s*/i, '') || 'Draft research is available for admin review.'
    const nextSteps = isFireSuppression
      ? [
          'Contact TVF&R Fire Marshal.',
          'Contact Wilsonville permit desk.',
          'Request seller/HOA sprinkler documentation and photos.',
        ]
      : (task.recommended_next_action || 'Review source context. Confirm missing evidence. Route to qualified trade.')
          .split(/(?:\.\s+|\n)/)
          .map((step) => step.trim())
          .filter(Boolean)
          .slice(0, 3)

    return (
      <>
        <div style={styles.noticeBox}>
          <div style={styles.buttonRow}>
            <strong>Research Draft</strong>
            <span style={getOperationalStatusStyle(task.status)}>{getLearningDisplayName(task.status)}</span>
          </div>
          <p style={{ ...styles.small, maxWidth: 720 }}>
            <strong>What matters:</strong> {conclusion}
          </p>
          <div>
            <strong style={styles.small}>Best resources</strong>
            {bestResources.length === 0 ? (
              <p style={styles.small}>No suggested resources saved yet.</p>
            ) : (
              <ul style={styles.smallList}>
                {bestResources.map((source) => (
                  <li key={`${task.id}-best-${source.id}`}>{source.source_title}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <strong style={styles.small}>Next steps</strong>
            <ol style={styles.smallList}>
              {nextSteps.map((step, index) => (
                <li key={`${task.id}-step-${index}`}>{step.replace(/\.$/, '')}.</li>
              ))}
            </ol>
          </div>
          {hasAdminConsoleAccess && (
            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={agentResearchSavingId === task.id || task.status === 'human_verified'}
                onClick={() => saveAgentResearchTask(task, { status: 'human_verified' })}
              >
                Human Verify
              </button>
              <button
                type="button"
                style={styles.linkButton}
                disabled={agentResearchSavingId === task.id}
                onClick={() => saveAgentResearchTask(task)}
              >
                Edit
              </button>
              <button
                type="button"
                style={styles.linkButton}
                disabled={agentResearchSavingId === task.id || task.status === 'rejected'}
                onClick={() => saveAgentResearchTask(task, { status: 'rejected' })}
              >
                Reject
              </button>
            </div>
          )}
        </div>
        <details style={styles.moreActions}>
          <summary style={styles.moreActionsSummary}>Show Sources / Details</summary>
          {task.answer_draft && <p style={{ ...styles.small, whiteSpace: 'pre-wrap', maxWidth: 760 }}>{task.answer_draft}</p>}
          {sources.length > 0 ? (
            <ul style={styles.smallList}>
              {sources.map((source) => (
                <li key={source.id}>
                  {source.source_url ? (
                    <a href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>
                  ) : (
                    <span>{source.source_title}</span>
                  )}
                  {' '}({source.source_quality || 'unknown'}, {source.source_category || source.source_type})
                  {source.source_publisher && <> - {source.source_publisher}</>}
                  {source.source_date_accessed && <> - accessed {new Date(source.source_date_accessed).toLocaleDateString()}</>}
                  {(source.relevance_note || source.source_excerpt || source.excerpt) && (
                    <>
                      <br />
                      <span style={styles.small}>{source.relevance_note || source.source_excerpt || source.excerpt}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.small}>No source rows saved for this draft.</p>
          )}
          <p style={styles.small}>Online source search requested: {task.online_search_requested ? 'Yes' : 'No'}</p>
          <p style={styles.small}>Live online source search performed: {task.online_search_performed ? 'Yes' : 'No'}</p>
          <p style={styles.small}>Official sources used: {task.official_sources_used ? 'Yes' : 'No'}</p>
          <p style={styles.small}>Supplier/material sources used: {task.supplier_sources_used ? 'Yes' : 'No'}</p>
          <p style={styles.small}>Internal memory used: {task.internal_memory_used ? 'Yes' : 'No'}</p>
          {task.online_search_requested && !task.online_search_performed && (
            <p style={styles.small}>Live online source search not performed.</p>
          )}
          {hasAdminConsoleAccess && (
            <textarea
              style={{ ...styles.input, minHeight: 92 }}
              defaultValue={task.answer_draft || ''}
              placeholder="Edit research draft"
              onBlur={(event) => saveAgentResearchTask(task, { answer_draft: event.target.value })}
            />
          )}
        </details>
        {historyTasks.length > 0 && (
          <details style={styles.moreActions}>
            <summary style={styles.moreActionsSummary}>History ({historyTasks.length})</summary>
            <ul style={styles.smallList}>
              {historyTasks.map((historyTask) => (
                <li key={`history-${historyTask.id}`}>
                  {getLearningDisplayName(historyTask.status)} - {getResearchAnswerSummary(historyTask)}
                </li>
              ))}
            </ul>
          </details>
        )}
        {getArchivedResearchTasks(request).filter((historyTask) => historyTask.evidence_id === `work-group:${group.id}`).length > 0 && (
          <details style={styles.moreActions}>
            <summary style={styles.moreActionsSummary}>Rejected / Archived</summary>
            <ul style={styles.smallList}>
              {getArchivedResearchTasks(request)
                .filter((historyTask) => historyTask.evidence_id === `work-group:${group.id}`)
                .map((historyTask) => (
                  <li key={`archived-research-${historyTask.id}`}>{historyTask.question}</li>
                ))}
            </ul>
          </details>
          )}
      </>
    )
  }

  function renderAddressWorkGroups(request: WorkRequest) {
    const workGroups = getInspectionWorkGroups(request)
    const archivedGroups = getArchivedInspectionWorkGroups(request)
    const hasFindingsWithoutGroups = hasInspectionFindingsWithoutWorkGroups(request)
    const evidenceCount = getUniqueUploadedFiles(request).length
    const hasInspectionEvidence = Boolean(request.inspectionIntelligence || evidenceCount)
    const interpretationFailed = request.inspectionProcessingStatus === 'extraction_failed'

    if (!workGroups.length && !hasFindingsWithoutGroups && !hasInspectionEvidence) return null

    return (
      <details open={workGroups.length > 0 || hasFindingsWithoutGroups} style={styles.moreActions}>
        <summary style={styles.moreActionsSummary}>Work Groups ({workGroups.length})</summary>
        {workGroups.length === 0 ? (
          <div style={styles.noticeBox}>
            <p style={styles.small}>
              {hasFindingsWithoutGroups
                ? 'Findings found. Generate work groups.'
                : interpretationFailed
                  ? 'Media could not be interpreted. Run interpretation manually or add a finding.'
                  : 'Media uploaded. Interpretation pending.'}
            </p>
            {hasFindingsWithoutGroups && hasAdminConsoleAccess && (
              <button
                type="button"
                style={styles.primaryButton}
                disabled={inspectionFindingSavingId === `work-groups-${request.id}`}
                onClick={() => generateInspectionWorkGroups(request)}
              >
                {inspectionFindingSavingId === `work-groups-${request.id}` ? 'Generating...' : 'Generate Work Groups'}
              </button>
            )}
          </div>
        ) : (
          <div style={styles.inspectionTaskGrid}>
            {workGroups.map((group) => (
              <div key={group.id} style={styles.inspectionTaskCard}>
                <div style={styles.buttonRow}>
                  <div style={{ flex: 1 }}>
                    <strong>{group.title}</strong>
                    <p style={styles.small}>{group.evidence_summary || group.summary}</p>
                  </div>
                  <span style={group.priority === 'Critical' ? styles.badgeDanger : styles.badgeMuted}>{group.priority}</span>
                </div>
                <p style={styles.small}>Trade: {group.recommended_trade}</p>
                <p style={styles.small}>Next action: {group.recommended_next_action || 'Review before use.'}</p>
                <div style={styles.buttonRow}>
                  <span style={styles.badgeMuted}>{getLearningDisplayName(group.status)}</span>
                  {group.safety_concern && <span style={styles.badgeMuted}>Safety concern</span>}
                </div>

                <details style={styles.moreActions}>
                  <summary style={styles.moreActionsSummary}>Review</summary>
                  {hasAdminConsoleAccess ? (
                    <>
                      <input
                        style={styles.input}
                        defaultValue={group.title}
                        placeholder="Work group title"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { title: event.target.value })}
                      />
	                      <div style={styles.grid3}>
                        <input
                          style={styles.input}
                          defaultValue={group.recommended_trade}
                          placeholder="Trade"
                          onBlur={(event) => updateInspectionBundle(request, group.id, { recommended_trade: event.target.value })}
                        />
                        <select
                          style={styles.input}
                          defaultValue={group.priority}
                          onChange={(event) => updateInspectionBundle(request, group.id, { priority: event.target.value })}
                        >
                          {['Critical', 'High', 'Medium', 'Low', 'Needs review'].map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                        <select
                          style={styles.input}
                          defaultValue={group.severity || 'Needs review'}
                          onChange={(event) => updateInspectionBundle(request, group.id, { severity: event.target.value })}
                        >
                          {['High', 'Medium', 'Low', 'Needs review'].map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.grid3}>
                        <select
                          style={styles.input}
                          defaultValue={group.status}
                          onChange={(event) => updateInspectionBundle(request, group.id, { status: event.target.value as InspectionDraftStatus })}
                        >
                          {['ai_draft', 'needs_review', 'needs_more_info', 'research_requested', 'human_verified', 'rejected'].map((value) => (
                            <option key={value} value={value}>{getLearningDisplayName(value)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={inspectionFindingSavingId === group.id || isHumanVerifiedStatus(group.status)}
                          onClick={() => updateInspectionBundle(request, group.id, { status: 'human_verified' })}
                        >
                          Human Verify
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={inspectionFindingSavingId === group.id || group.status === 'rejected'}
                          onClick={() => updateInspectionBundle(request, group.id, { status: 'rejected' })}
                        >
                          Reject
                        </button>
                      </div>
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={group.evidence_summary || ''}
                        placeholder="Evidence summary"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { evidence_summary: event.target.value })}
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={group.recommended_next_action || ''}
                        placeholder="Next action"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { recommended_next_action: event.target.value })}
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={(group.missing_information || []).join('\n')}
                        placeholder="Missing information"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { missing_information: event.target.value.split('\n').filter(Boolean) })}
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={(group.resource_categories || []).join('\n')}
                        placeholder="Resource categories"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { resource_categories: event.target.value.split('\n').filter(Boolean) })}
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={group.estimate_note || ''}
                        placeholder="Estimate note"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { estimate_note: event.target.value })}
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 70 }}
                        defaultValue={group.contractor_scope_note || ''}
                        placeholder="Contractor scope note"
                        onBlur={(event) => updateInspectionBundle(request, group.id, { contractor_scope_note: event.target.value })}
                      />
                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={inspectionFindingSavingId === group.id || group.status === 'needs_more_info'}
                          onClick={() => requestResearchForWorkGroup(request, group, 'needs_more_info')}
                        >
                          Needs More Info
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={inspectionFindingSavingId === group.id || agentResearchSavingId === `work-group-${group.id}`}
                          onClick={() => requestResearchForWorkGroup(request, group, 'research_requested')}
                        >
                          Research Needed
                        </button>
                      </div>
                    </>
                  ) : null}
                  <p style={styles.small}>Area: {group.work_area || group.system_category}</p>
                  <p style={styles.small}>Severity: {group.severity || 'Needs review'}</p>
                  <p style={styles.small}>Source: {group.source_page || 'Inspection source needs review'}</p>
                  <p style={styles.small}>Source text: {group.source_text || group.summary}</p>
                  {((group.resource_categories || []).length > 0 || getWorkGroupResearchTasks(request, group).length > 0) && (
                    <details style={styles.moreActions}>
                      <summary style={styles.moreActionsSummary}>Resources</summary>
                      {(group.resource_categories || []).length > 0 && (
                        <>
                        <p style={styles.small}>{Math.min(3, group.resource_categories.length)} suggested resources</p>
                        <ul style={styles.smallList}>
                          {(group.resource_categories || []).slice(0, 3).map((category, index) => (
                            <li key={`${group.id}-resource-${index}`}>{category}</li>
                          ))}
                        </ul>
                        </>
                      )}
                      {renderWorkGroupResearchResources(request, group)}
                    </details>
                  )}
                </details>
              </div>
            ))}
          </div>
        )}
        {archivedGroups.length > 0 && (
          <details style={styles.moreActions}>
            <summary style={styles.moreActionsSummary}>Rejected / Archived ({archivedGroups.length})</summary>
            <ul style={styles.smallList}>
              {archivedGroups.map((group) => (
                <li key={`archived-work-group-${group.id}`}>{group.title}</li>
              ))}
            </ul>
          </details>
        )}
      </details>
    )
  }

  function renderUploadedEvidence(request: WorkRequest) {
    const uploadedFiles = getUniqueUploadedFiles(request)

    return (
      <section style={styles.mediaPanel}>
        <div style={styles.mediaPanelHeader}>
          <div>
            <strong>Uploaded Evidence</strong>
            <p style={styles.small}>
              {uploadedFiles.length
                ? `${uploadedFiles.length} evidence file${uploadedFiles.length === 1 ? '' : 's'} attached to request ${request.id}`
                : 'No uploaded evidence is attached to this lead yet.'}
            </p>
          </div>
          <button
            type="button"
            style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
            onClick={() => loadRequestsFromSupabase(true)}
          >
            Refresh files + interpret
          </button>
        </div>

        {uploadedFiles.length === 0 ? (
          <div style={styles.empty}>Uploaded photos, videos, documents, and inspection reports will appear here after submission.</div>
        ) : (
          <div style={styles.mediaGrid}>
            {uploadedFiles.map((file) => {
              const category = getEvidenceCategory(file.name, '', file.type)
              const isPhoto = category === 'photo'
              const isPdf = isPdfEvidence(file)
              const previewUrl = file.previewUrl || file.url || ''
              const status: UploadEvidenceStatus = file.url || file.path ? 'uploaded' : 'selected'
              const evidenceKey = getEvidenceKey(file)
              const primaryInspectionKey = getEvidenceKey(file, isPdf ? 'full_pdf' : isPhoto ? 'image' : 'file')
              const linkedFindings = getEvidenceFindingsForFile(request, file)
              const inspectionStatus = evidenceInspectionStatusByKey[primaryInspectionKey] || evidenceInspectionStatusByKey[evidenceKey] || (linkedFindings.length ? 'needs_admin_review' : 'uploaded')
              const pageDraft = evidencePageDraftsByKey[evidenceKey] || '1'
              const researchDraft = getEvidenceResearchDraft(file)

              return (
                <div key={file.id || file.path || file.name} style={styles.mediaItem}>
                  {isPhoto ? (
                    previewUrl ? (
                      <button
                        type="button"
                        style={styles.thumbnailButton}
                        onClick={() => openRequestFile(file)}
                        aria-label={`Open ${file.name}`}
                      >
                        <img src={previewUrl} alt={file.name} style={styles.mediaThumbnail} loading="lazy" />
                      </button>
                    ) : (
                      <div style={styles.mediaThumbnailFallback}>Photo</div>
                    )
                  ) : (
                    <div style={styles.documentIcon}>{category === 'video' ? 'VIDEO' : category === 'inspection report' ? 'REPORT' : 'DOC'}</div>
                  )}

                  <div style={styles.mediaMeta}>
                    <span style={styles.fileName}>{file.name}</span>
                    <span style={styles.small}>{getEvidenceTypeLabel(category)}</span>
                    <span style={getOperationalStatusStyle(inspectionStatus)}>
                      {inspectionStatus === 'uploaded' ? 'Not interpreted' : inspectionStatus.replace(/_/g, ' ')}
                    </span>
                    <span style={inspectionStatus === 'failed' ? styles.smallDanger : styles.small}>
                      {getEvidenceInterpretationMessage(inspectionStatus, linkedFindings.length)}
                    </span>
                  </div>

                  <div style={styles.mediaActions}>
                    {(file.url || file.path) ? (
                      <>
                        <button
                          type="button"
                          style={linkedFindings.length ? styles.primaryButton : styles.outlineButton}
                          disabled={!hasAdminConsoleAccess || evidenceInspectionStatusByKey[primaryInspectionKey] === 'interpreting'}
                          onClick={() => inspectEvidenceFile(request, file, isPdf ? 'full_pdf' : isPhoto ? 'image' : 'file')}
                        >
                          {linkedFindings.length ? 'Review Findings' : isPhoto ? 'Inspect image' : 'Inspect this file'}
                        </button>
                      </>
                    ) : (
                      <span style={styles.small}>Open/download available after upload.</span>
                    )}
                  </div>

                  <details style={styles.moreActions}>
                    <summary style={styles.moreActionsSummary}>Details</summary>
                    <div style={styles.compactMetaGrid}>
                      <span>Upload status: {status}</span>
                      <span>Category: {category}</span>
                      <span>Request: {request.id}</span>
                      <span>Property: {request.propertyId || getRequestPropertyId(request) || 'Not linked yet'}</span>
                      <span>Uploaded: {formatUploadedAt(file.createdAt)}</span>
                    </div>
                    <div style={styles.buttonRow}>
                      {(file.url || file.path) && (
                        <>
                          <button type="button" style={styles.linkButton} onClick={() => openRequestFile(file)}>
                            {isPhoto ? 'Open preview' : 'Open file'}
                          </button>
                          <button type="button" style={styles.linkButton} onClick={() => openRequestFile(file, true)}>
                            Download
                          </button>
                        </>
                      )}
                      {hasAdminConsoleAccess && (
                        <button type="button" style={styles.linkButton} onClick={() => addManualSiteMediaFinding(request, file)}>
                          Add finding
                        </button>
                      )}
                      {hasAdminConsoleAccess && (
                        <button
                          type="button"
                          style={styles.linkButton}
                          onClick={() => updateEvidenceResearchDraft(file, {
                            question: researchDraft.question || `Research this evidence file: ${file.name}`,
                            research_scope: 'Uploaded files + property data',
                            research_categories: getSourceResearchDefaults('property-specific', file.name),
                          })}
                        >
                          Ask Agent to Research
                        </button>
                      )}
                      <button type="button" style={styles.linkButton} onClick={() => savePhotoFieldMemory(request, file)}>
                        Learn from this
                      </button>
                    </div>
                    {isPdf && (
                      <div style={styles.buttonRow}>
                        <button type="button" style={styles.linkButton} disabled={!hasAdminConsoleAccess} onClick={() => inspectEvidenceFile(request, file, 'full_pdf')}>
                          Inspect full PDF
                        </button>
                        <input
                          style={{ ...styles.input, minWidth: 120, marginBottom: 0 }}
                          value={pageDraft}
                          placeholder="Page or range"
                          onChange={(event) => setEvidencePageDraftsByKey((prev) => ({ ...prev, [evidenceKey]: event.target.value }))}
                        />
                        <button type="button" style={styles.linkButton} disabled={!hasAdminConsoleAccess} onClick={() => inspectEvidenceFile(request, file, 'page', pageDraft)}>
                          Inspect selected page
                        </button>
                        <button type="button" style={styles.linkButton} disabled={!hasAdminConsoleAccess} onClick={() => inspectEvidenceFile(request, file, 'range', pageDraft)}>
                          Inspect page range
                        </button>
                      </div>
                    )}
                  </details>

                  {hasAdminConsoleAccess && (
                    <details open={Boolean(researchDraft.question)} style={styles.moreActions}>
                      <summary style={styles.moreActionsSummary}>Add research question</summary>
                      <textarea
                        style={{ ...styles.input, minHeight: 68 }}
                        value={researchDraft.question}
                        placeholder="Question about this evidence file/page/image"
                        onChange={(event) => updateEvidenceResearchDraft(file, { question: event.target.value })}
                      />
                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <select
                          style={styles.input}
                          value={researchDraft.research_scope}
                          onChange={(event) => updateEvidenceResearchDraft(file, { research_scope: event.target.value as AgentResearchScope })}
                        >
                          {AGENT_RESEARCH_SCOPES.map((scope) => (
                            <option key={scope} value={scope}>{scope}</option>
                          ))}
                        </select>
                        <select
                          style={styles.input}
                          value={researchDraft.question_type}
                          onChange={(event) => updateEvidenceResearchDraft(file, { question_type: event.target.value as AgentResearchQuestionType })}
                        >
                          {AGENT_RESEARCH_QUESTION_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <p style={styles.small}>Research categories</p>
                      {renderResearchCategoryControls(
                        researchDraft.research_categories,
                        (next) => updateEvidenceResearchDraft(file, { research_categories: next })
                      )}
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentResearchSavingId === `evidence-${evidenceKey}` || !researchDraft.question.trim()}
                        onClick={() => addEvidenceResearchTask(request, file)}
                      >
                        Add Research Question
                      </button>
                    </details>
                  )}
                  <div style={styles.noticeBox}>
                    <strong>AI Draft findings for this evidence</strong>
                    {linkedFindings.length === 0 ? (
                      <p style={styles.small}>
                        {inspectionStatus === 'uploaded'
                          ? 'Not interpreted yet.'
                          : inspectionStatus === 'failed'
                            ? 'Interpretation failed. Upload clearer evidence or manually add findings.'
                            : 'No findings drafted yet. Run Inspect this file or mark Needs More Info.'}
                      </p>
                    ) : (
                      <ul style={styles.smallList}>
                        {linkedFindings.map((finding) => (
                          <li key={finding.id}>
                            <strong>{finding.finding_type}</strong> - {finding.observation}
                            <br />
                            <span style={styles.small}>
                              {getLearningDisplayName(finding.review_status)}; {finding.confidence} confidence. {finding.field_consequence}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  function renderSelectedEvidence() {
    const selectedFiles = [
      ...photoFiles.map((file, index) => ({ file, index, group: 'photo' as const })),
      ...documentFiles.map((file, index) => ({ file, index, group: 'document' as const })),
    ]

    if (selectedFiles.length === 0) return null

    return (
      <section style={styles.mediaPanel}>
        <div style={styles.mediaPanelHeader}>
          <div>
            <strong>Uploaded Evidence</strong>
            <p style={styles.small}>
              These files are selected locally for this request. They remain visible here as selected, uploading, or failed until the request saves.
            </p>
            {inspectionReading && <p style={styles.small}>Reading inspection report...</p>}
          </div>
          <span style={localEvidenceStatus === 'failed' ? styles.badgeDanger : localEvidenceStatus === 'uploading' ? styles.badgeMuted : styles.badge}>
            {localEvidenceStatus}
          </span>
        </div>

        <div style={styles.mediaGrid}>
          {selectedFiles.map(({ file, index, group }) => {
            const category = getEvidenceCategory(file.name, file.type, group === 'photo' ? 'photo' : 'document')
            const previewUrl = localEvidencePreviews[getLocalEvidenceKey(file, index, group)] || ''
            const isPhoto = category === 'photo'

            return (
              <div key={getLocalEvidenceKey(file, index, group)} style={styles.mediaItem}>
                {isPhoto && previewUrl ? (
                  <img src={previewUrl} alt={file.name} style={styles.mediaThumbnail} loading="lazy" />
                ) : (
                  <div style={styles.documentIcon}>{category === 'video' ? 'VIDEO' : category === 'inspection report' ? 'REPORT' : 'DOC'}</div>
                )}

                <div style={styles.mediaMeta}>
                  <span style={styles.fileName}>{file.name}</span>
                  <span style={styles.small}>File type: {getEvidenceTypeLabel(category, file.type)}</span>
                  <span style={styles.small}>Upload category: {category}</span>
                  <span style={styles.small}>Upload status: {submitting ? 'uploading' : localEvidenceStatus}</span>
                  <span style={styles.small}>Attached request: pending</span>
                  <span style={styles.small}>Attached property: pending</span>
                  <span style={styles.small}>Uploaded: selected locally / upload pending</span>
                  <span style={localEvidenceStatus === 'failed' ? styles.badgeDanger : styles.badgeMuted}>
                    {submitting ? 'uploading' : localEvidenceStatus}
                  </span>
                </div>

                <div style={styles.mediaActions}>
                  <span style={styles.small}>Open/download link available after upload.</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  function renderInspectionReportDraft() {
    if (!inspectionReading && !inspectionReportDraft) return null

    return (
      <div style={styles.inspectionTaskPanel}>
        <div style={styles.buttonRow}>
          <div style={{ flex: 1 }}>
            <strong>Inspection Report Reading</strong>
            <p style={styles.small}>
              {inspectionReading
                ? 'Reading inspection report...'
                : `AI Draft from ${inspectionReportDraft?.fileName || 'uploaded inspection report'}. Human review required before save.`}
            </p>
          </div>
          <span style={inspectionReportDraft?.status === 'Needs Review' ? styles.badgeMuted : styles.badge}>
            {inspectionReading ? 'AI Draft' : inspectionReportDraft?.status || 'AI Draft'}
          </span>
        </div>

        {inspectionReportDraft && (
          <>
            <div style={styles.grid3}>
              <div style={styles.factCard}>
                <small>Property address</small>
                <strong>{inspectionReportDraft.propertyAddress || 'Needs review'}</strong>
                <span style={styles.small}>{[inspectionReportDraft.city, inspectionReportDraft.state].filter(Boolean).join(', ') || 'City/state needs review'}</span>
              </div>
              <div style={styles.factCard}>
                <small>Client/customer</small>
                <strong>{inspectionReportDraft.clientName || 'Needs review'}</strong>
              </div>
              <div style={styles.factCard}>
                <small>Inspector/company</small>
                <strong>{[inspectionReportDraft.inspectorName, inspectionReportDraft.inspectorCompany].filter(Boolean).join(' / ') || 'Needs review'}</strong>
              </div>
            </div>

            <div style={styles.noticeBox}>
              <strong>Report type/source:</strong> {inspectionReportDraft.reportType || 'Inspection report'}
              <br />
              <strong>Front-page payload:</strong> {Math.round(inspectionReportDraft.frontPagePayloadBytes / 1024)} KB of {Math.round(INSPECTION_FRONT_PAGE_MAX_BYTES / 1024)} KB max
              <br />
              <strong>Extraction status:</strong>{' '}
              {inspectionReportDraft.missingInfo.length
                ? `Needs missing info: ${inspectionReportDraft.missingInfo.join(', ')}.`
                : 'Draft fields detected. Review before saving.'}
            </div>

            {inspectionReportDraft.summaryItems.length > 0 && (
              <>
                <strong>Inspection summary items</strong>
                <ul style={styles.smallList}>
                  {inspectionReportDraft.summaryItems.map((item, index) => (
                    <li key={`${inspectionReportDraft.fileName}-summary-${index}`}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {renderInspectionIntelligence(inspectionReportDraft.intelligence)}

            {inspectionDraftTasks.length > 0 && (
              <>
                <strong>Draft Inspection Task Intelligence</strong>
                <div style={styles.inspectionTaskGrid}>
                  {inspectionDraftTasks.map((task) => (
                    <div key={task.id} style={styles.inspectionTaskCard}>
                      <div style={styles.buttonRow}>
                        <div style={{ flex: 1 }}>
                          <strong>{task.task_title}</strong>
                          <p style={styles.small}>{task.defect_concern}</p>
                        </div>
                        <span style={styles.badgeMuted}>{task.human_review_status}</span>
                      </div>
                      <p style={styles.small}>
                        {task.building_system} • {task.risk_level} • {task.trade_needed}
                      </p>
                      <div style={styles.noticeBox}>
                        <strong>Recommended next action:</strong> {task.recommended_next_action}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  function renderInspectionIntelligence(intelligence?: InspectionIntelligenceDraft | null, request?: WorkRequest) {
    return (
      <InspectionIntelligencePanel
        intelligence={intelligence}
        styles={styles}
        money={money}
        getStatusLabel={getLearningDisplayName}
        canEdit={hasAdminConsoleAccess && Boolean(request)}
        savingFindingId={inspectionFindingSavingId}
        onUpdateFinding={request ? (itemId, changes) => updateInspectionFinding(request, itemId, changes) : undefined}
        onUpdateBundle={request ? (bundleId, changes) => updateInspectionBundle(request, bundleId, changes) : undefined}
      />
    )
  }

  function renderInspectionProcessing(request: WorkRequest) {
    const pdfs = request.documents.filter(isPdfEvidence)
    const status = pdfProcessingByRequest[request.id] || request.inspectionProcessingStatus || (pdfs.length ? 'uploaded' : undefined)
    if (!pdfs.length && !request.inspectionIntelligence && !request.inspectionExtractionMessage) return null

    return (
      <section style={styles.inspectionTaskPanel}>
        <div style={styles.buttonRow}>
          <div style={{ flex: 1 }}>
            <strong>Inspection Intelligence</strong>
            <p style={styles.small}>
              {pdfs.length
                ? `${pdfs.length} PDF evidence file${pdfs.length === 1 ? '' : 's'} attached.`
                : 'No inspection PDF evidence is attached yet.'}
            </p>
          </div>
          <span style={status === 'extraction_failed' ? styles.badgeDanger : status === 'human_verified' ? styles.badge : styles.badgeMuted}>
            {getInspectionStatusLabel(status)}
          </span>
        </div>

        {request.inspectionExtractionMessage && (
          <div style={status === 'extraction_failed' ? { ...styles.noticeBox, background: '#fde8df', borderColor: '#e5b4a3', color: '#8a2f12' } : styles.noticeBox}>
            {request.inspectionExtractionMessage}
          </div>
        )}

        {request.inspectionExtractionSummary && (
          <p style={styles.small}>{request.inspectionExtractionSummary}</p>
        )}

        {hasAdminConsoleAccess && (
          <div style={styles.buttonRow}>
            <button
              type="button"
              style={styles.outlineButton}
              disabled={pdfProcessingByRequest[request.id] === 'extracting_pdf'}
              onClick={() => processInspectionPdfsForRequest(request)}
            >
              {pdfProcessingByRequest[request.id] === 'extracting_pdf' ? 'Extracting PDF...' : 'Inspect Uploaded PDF'}
            </button>
            <button
              type="button"
              style={styles.linkButton}
              disabled={pdfProcessingByRequest[request.id] === 'extracting_pdf'}
              onClick={async () => {
                await loadRequestsFromSupabase()
                const latest = requests.find((item) => item.id === request.id) || request
                if ((latest.documents || request.documents).some(isPdfEvidence)) {
                  await processInspectionPdfsForRequest(latest)
                }
              }}
            >
              Refresh Files + Re-check
            </button>
          </div>
        )}

        {status === 'extraction_failed' && (
          <p style={styles.small}>
            PDF text could not be extracted. Upload clearer PDF, images, or manually add findings.
          </p>
        )}
      </section>
    )
  }

  function renderSiteMediaIntelligence(request: WorkRequest) {
    const allFindings = siteMediaFindingsByRequest[request.id] || []
    const findings = allFindings.filter((finding) => !isRejectedFinding(finding))
    const archivedFindings = allFindings.filter(isRejectedFinding)
    const approvedFindings = getApprovedSiteMediaFindings(request)
    const uploadedFiles = [...request.photos, ...request.documents]
    const canEditSiteMedia = hasSupabaseSession && canEditOperationalMemory(currentUserRole)
    const canApproveSiteMedia = hasSupabaseSession && canApproveOperationalMemory(currentUserRole)
    const loading = Boolean(siteMediaLoadingByRequest[request.id])

    return (
      <section style={styles.siteMediaPanel}>
        <div style={styles.buttonRow}>
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>Site Media Intelligence</h3>
            <p style={styles.small}>
              Uploaded property photos/files only. Findings are notes and job context until a human reviews them.
            </p>
          </div>
          <button
            type="button"
            style={styles.outlineButton}
            disabled={loading}
            onClick={() => loadSiteMediaIntelligence(request, false)}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {canEditSiteMedia && (
            <button
              type="button"
              style={styles.primaryButton}
              disabled={siteMediaSavingId === `new-${request.id}`}
              onClick={() => addManualSiteMediaFinding(request)}
            >
              Add Manual Finding
            </button>
          )}
        </div>

        <p style={styles.small}>AI/media analysis remains draft until a human verifies it.</p>

        <details style={styles.moreActions}>
          <summary style={styles.moreActionsSummary}>Media sources ({uploadedFiles.length})</summary>
          {uploadedFiles.length === 0 ? (
            <div style={styles.empty}>No uploaded property media is attached to this lead yet.</div>
          ) : (
            <div style={styles.siteMediaSourceList}>
              {uploadedFiles.map((file) => (
                <div
                  key={file.id || file.path || file.name}
                  style={isCompact ? { ...styles.siteMediaSourceRow, gridTemplateColumns: '1fr' } : styles.siteMediaSourceRow}
                >
                  <span style={styles.fileName}>{file.name}</span>
                  <span style={styles.badgeMuted}>{file.type}</span>
                  <button type="button" style={styles.linkButton} onClick={() => openRequestFile(file)}>
                    Open
                  </button>
                  {canEditSiteMedia && (
                    <button
                      type="button"
                      style={styles.linkButton}
                      disabled={siteMediaSavingId === `new-${request.id}`}
                      onClick={() => addManualSiteMediaFinding(request, file)}
                    >
                      Add finding
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </details>

        {approvedFindings.length > 0 && (
          <div style={styles.aiBox}>
            <strong>Approved site context</strong>
            <ul style={styles.smallList}>
              {approvedFindings.map((finding) => (
                <li key={`approved-${finding.id}`}>
                  {finding.finding_type}: {finding.observation} Estimate note: {finding.estimate_impact || 'Needs human verification.'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <strong>Evidence Findings</strong>
        {findings.length === 0 ? (
          <div style={styles.empty}>
            No findings need review.
          </div>
        ) : (
          <div style={styles.siteMediaFindingGrid}>
            {findings.map((finding) => (
              <div key={finding.id} style={styles.siteMediaFindingCard}>
                <div style={styles.badgeRow}>
                  <span style={getOperationalStatusStyle(finding.review_status)}>
                    {getLearningDisplayName(finding.review_status)}
                  </span>
                  <span style={styles.badgeMuted}>{getSiteMediaSourceFileLabel(request, finding.source_file_id)}</span>
                </div>

                <p style={styles.small}>{finding.observation}</p>

                <details style={styles.moreActions}>
                  <summary style={styles.moreActionsSummary}>Show details</summary>
                <div style={isCompact ? styles.mobileStack : styles.grid3}>
                  <select
                    style={styles.input}
                    value={finding.finding_type}
                    disabled={!canEditSiteMedia}
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { finding_type: event.target.value })}
                  >
                    {SITE_MEDIA_FINDING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <select
                    style={styles.input}
                    value={finding.confidence}
                    disabled={!canEditSiteMedia}
                    onChange={(event) =>
                      updateLocalSiteMediaFinding(finding.id, { confidence: event.target.value as PropertyMediaConfidence })
                    }
                  >
                    {SITE_MEDIA_CONFIDENCE_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <select
                    style={styles.input}
                    value={finding.source_file_id || ''}
                    disabled={!canEditSiteMedia}
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { source_file_id: event.target.value || null })}
                  >
                    <option value="">Manual / no file linked</option>
                    {uploadedFiles
                      .filter((file) => asNullableUuid(file.id || ''))
                      .map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                  </select>
                </div>

                <textarea
                  style={{ ...styles.input, minHeight: 76 }}
                  value={finding.observation}
                  disabled={!canEditSiteMedia}
                  placeholder="Observation visible from available media"
                  onChange={(event) => updateLocalSiteMediaFinding(finding.id, { observation: event.target.value })}
                />
                <div style={isCompact ? styles.mobileStack : styles.grid2}>
                  <textarea
                    style={{ ...styles.input, minHeight: 76 }}
                    value={finding.field_consequence}
                    disabled={!canEditSiteMedia}
                    placeholder="Field consequence"
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { field_consequence: event.target.value })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 76 }}
                    value={finding.estimate_impact}
                    disabled={!canEditSiteMedia}
                    placeholder="Estimate impact / note only"
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { estimate_impact: event.target.value })}
                  />
                </div>
                <div style={isCompact ? styles.mobileStack : styles.grid2}>
                  <textarea
                    style={{ ...styles.input, minHeight: 76 }}
                    value={finding.access_notes}
                    disabled={!canEditSiteMedia}
                    placeholder="Access notes"
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { access_notes: event.target.value })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 76 }}
                    value={finding.safety_notes}
                    disabled={!canEditSiteMedia}
                    placeholder="Safety notes"
                    onChange={(event) => updateLocalSiteMediaFinding(finding.id, { safety_notes: event.target.value })}
                  />
                </div>
                <textarea
                  style={{ ...styles.input, minHeight: 64 }}
                  value={finding.admin_notes}
                  disabled={!canEditSiteMedia}
                  placeholder="Admin notes"
                  onChange={(event) => updateLocalSiteMediaFinding(finding.id, { admin_notes: event.target.value })}
                />

                <details style={styles.moreActions}>
                  <summary style={styles.moreActionsSummary}>Research Questions</summary>
                  {canEditSiteMedia && (() => {
                    const draft = getAgentResearchDraft(finding)
                    return (
                      <div style={styles.noticeBox}>
                        <button
                          type="button"
                          style={styles.linkButton}
                          onClick={() => updateAgentResearchDraft(finding.id, {
                            question: `Research this finding: ${finding.observation}`,
                            question_type: finding.finding_type === 'safety' ? 'safety' : 'property-specific',
                            research_scope: 'Uploaded files + property data',
                            research_categories: getSourceResearchDefaults(finding.finding_type === 'safety' ? 'safety' : 'property-specific', finding.observation),
                          })}
                        >
                          Research this finding
                        </button>
                        <textarea
                          style={{ ...styles.input, minHeight: 72 }}
                          value={draft.question}
                          placeholder="Add research question"
                          onChange={(event) => updateAgentResearchDraft(finding.id, { question: event.target.value })}
                        />
                        <div style={isCompact ? styles.mobileStack : styles.grid2}>
                          <select
                            style={styles.input}
                            value={draft.research_scope}
                            onChange={(event) => updateAgentResearchDraft(finding.id, { research_scope: event.target.value as AgentResearchScope })}
                          >
                            {AGENT_RESEARCH_SCOPES.map((scope) => (
                              <option key={scope} value={scope}>{scope}</option>
                            ))}
                          </select>
                          <select
                            style={styles.input}
                            value={draft.question_type}
                            onChange={(event) => updateAgentResearchDraft(finding.id, { question_type: event.target.value as AgentResearchQuestionType })}
                          >
                            {AGENT_RESEARCH_QUESTION_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <p style={styles.small}>Research categories</p>
                        {renderResearchCategoryControls(
                          draft.research_categories,
                          (next) => updateAgentResearchDraft(finding.id, { research_categories: next })
                        )}
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentResearchSavingId === `new-${finding.id}` || !draft.question.trim()}
                          onClick={() => addAgentResearchTask(request, finding)}
                        >
                          Add Research Question
                        </button>
                      </div>
                    )
                  })()}

                  {(agentResearchTasksByFinding[finding.id] || []).length === 0 ? (
                    <p style={styles.small}>No research questions yet.</p>
                  ) : (
                    <div style={styles.inspectionTaskGrid}>
                      {(agentResearchTasksByFinding[finding.id] || []).map((task) => {
                        const sources = agentResearchSourcesByTask[task.id] || []
                        return (
                          <div key={task.id} style={styles.inspectionTaskCard}>
                            <div style={styles.badgeRow}>
                              <span style={task.status === 'rejected' ? styles.badgeDanger : task.status === 'human_verified' ? styles.badge : styles.badgeMuted}>
                                {getLearningDisplayName(task.status)}
                              </span>
                              <span style={styles.badgeMuted}>{task.confidence || 'low'} confidence</span>
                              <span style={styles.badgeMuted}>{task.question_type}</span>
                              {task.source_quality && <span style={styles.badgeMuted}>{task.source_quality}</span>}
                            </div>

                            {canEditSiteMedia ? (
                              <>
                                <textarea
                                  style={{ ...styles.input, minHeight: 66 }}
                                  defaultValue={task.question}
                                  onBlur={(event) => saveAgentResearchTask(task, { question: event.target.value })}
                                />
                                <div style={isCompact ? styles.mobileStack : styles.grid2}>
                                  <select
                                    style={styles.input}
                                    value={task.research_scope}
                                    onChange={(event) => saveAgentResearchTask(task, { research_scope: event.target.value as AgentResearchScope })}
                                  >
                                    {AGENT_RESEARCH_SCOPES.map((scope) => (
                                      <option key={scope} value={scope}>{scope}</option>
                                    ))}
                                  </select>
                                  <select
                                    style={styles.input}
                                    value={task.question_type}
                                    onChange={(event) => saveAgentResearchTask(task, { question_type: event.target.value as AgentResearchQuestionType })}
                                  >
                                    {AGENT_RESEARCH_QUESTION_TYPES.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                </div>
                                <p style={styles.small}>Research categories</p>
                                {renderResearchCategoryControls(
                                  normalizeResearchCategories(task.research_categories, getSourceResearchDefaults(task.question_type, task.question)),
                                  (next) => saveAgentResearchTask(task, {
                                    research_categories: next,
                                    online_search_requested: researchCategoriesRequestOnline(next, task.research_scope),
                                    source_quality: getPrimarySourceQuality(next),
                                  })
                                )}
                              </>
                            ) : (
                              <p style={styles.small}>{task.question}</p>
                            )}

                            {task.answer_draft && (
                              <details open style={styles.moreActions}>
                                <summary style={styles.moreActionsSummary}>Draft answer</summary>
                                <textarea
                                  style={{ ...styles.input, minHeight: 92 }}
                                  defaultValue={task.answer_draft || ''}
                                  disabled={!canEditSiteMedia}
                                  onBlur={(event) => saveAgentResearchTask(task, { answer_draft: event.target.value })}
                                />
                                <p style={styles.small}>
                                  <strong>Evidence found:</strong> {task.evidence_summary || 'No strong evidence found.'}
                                </p>
                                <p style={styles.small}>
                                  <strong>Missing information:</strong> {task.missing_information || 'None listed.'}
                                </p>
                                <p style={styles.small}>
                                  <strong>Recommended next action:</strong> {task.recommended_next_action || 'Needs admin review.'}
                                </p>
                                <p style={styles.small}>
                                  <strong>Online search performed:</strong> {task.online_search_performed ? 'Yes' : 'No'}
                                  {' '}<strong>Internal memory used:</strong> {task.internal_memory_used ? 'Yes' : 'No'}
                                </p>
                                <p style={styles.small}>
                                  <strong>Official sources used:</strong> {task.official_sources_used ? 'Yes' : 'No'}
                                  {' '}<strong>Supplier/material sources used:</strong> {task.supplier_sources_used ? 'Yes' : 'No'}
                                </p>
                                {task.online_search_requested && !task.online_search_performed && (
                                  <p style={styles.small}>
                                    Online research was requested, but no live source search has been performed yet. Use uploaded/property context only or connect Source Research backend.
                                  </p>
                                )}
                                {task.source_priority && (
                                  <p style={styles.small}>
                                    <strong>Source priority:</strong> {task.source_priority}
                                  </p>
                                )}
                                <strong>Sources</strong>
                                {sources.length === 0 ? (
                                  <p style={styles.small}>No source rows saved for this answer.</p>
                                ) : (
                                  <ul style={styles.smallList}>
                                    {sources.map((source) => (
                                      <li key={source.id}>
                                        {source.source_url ? (
                                          <a href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>
                                        ) : (
                                          <span>{source.source_title}</span>
                                        )}
                                        {' '}({source.source_type}, {source.confidence || 'low'} confidence)
                                        {source.source_quality && <> - {source.source_quality}</>}
                                        {source.excerpt && (
                                          <>
                                            <br />
                                            <span style={styles.small}>{source.excerpt}</span>
                                          </>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </details>
                            )}

                            <div style={styles.buttonRow}>
                              {canEditSiteMedia && (
                                <>
                                  <button
                                    type="button"
                                    style={styles.outlineButton}
                                    disabled={agentResearchSavingId === task.id}
                                    onClick={() => runAgentResearchTask(request, finding, task)}
                                  >
                                    {agentResearchSavingId === task.id && task.status === 'researching' ? 'Researching...' : 'Run Research'}
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.outlineButton}
                                    disabled={agentResearchSavingId === task.id}
                                    onClick={() => saveAgentResearchTask(task)}
                                  >
                                    Save Answer
                                  </button>
                                </>
                              )}
                              {canApproveSiteMedia && (
                                <>
                                  <button
                                    type="button"
                                    style={styles.outlineButton}
                                    disabled={agentResearchSavingId === task.id || task.status === 'human_verified'}
                                    onClick={() => saveAgentResearchTask(task, { status: 'human_verified' })}
                                  >
                                    Human Verify
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.outlineButton}
                                    disabled={agentResearchSavingId === task.id || task.status === 'rejected'}
                                    onClick={() => saveAgentResearchTask(task, { status: 'rejected' })}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.outlineButton}
                                    disabled={agentResearchSavingId === task.id || task.status === 'needs_review'}
                                    onClick={() => saveAgentResearchTask(task, { status: 'needs_review' })}
                                  >
                                    Mark Needs Review
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </details>

                <div style={styles.buttonRow}>
                  {canEditSiteMedia && (
                    <button
                      type="button"
                      style={styles.primaryButton}
                      disabled={siteMediaSavingId === finding.id}
                      onClick={() => saveSiteMediaFinding(finding)}
                    >
                      {siteMediaSavingId === finding.id ? 'Saving...' : 'Save Finding'}
                    </button>
                  )}
                  {canApproveSiteMedia && (
                    <>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id || isHumanVerifiedStatus(finding.review_status)}
                        onClick={() => saveSiteMediaFinding(finding, { review_status: 'human_verified' })}
                      >
                        Human Verify
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id || finding.review_status === 'rejected'}
                        onClick={() => saveSiteMediaFinding(finding, { review_status: 'rejected' })}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id || finding.review_status === 'needs_review'}
                        onClick={() => saveSiteMediaFinding(finding, { review_status: 'needs_review' })}
                      >
                        Mark Needs Review
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id || finding.review_status === 'needs_more_info'}
                        onClick={() => markFindingNeedsMoreInfo(request, finding)}
                      >
                        Needs More Info
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id}
                        onClick={() => markFindingNeedsMoreInfo(request, finding)}
                      >
                        Ask Agent to Research
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={siteMediaSavingId === finding.id || finding.review_status === 'human_verified'}
                        onClick={() => saveSiteMediaFinding(finding, { review_status: 'human_verified' })}
                      >
                        Mark Human Verified
                      </button>
                      {isHumanVerifiedStatus(finding.review_status) && (
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={siteMediaSavingId === finding.id}
                          onClick={() => saveVerifiedFindingToMemory(request, finding)}
                        >
                          Save to Memory if Verified
                        </button>
                      )}
                    </>
                  )}
                </div>
                </details>
              </div>
            ))}
          </div>
        )}
        {archivedFindings.length > 0 && (
          <details style={styles.moreActions}>
            <summary style={styles.moreActionsSummary}>Rejected / Archived ({archivedFindings.length})</summary>
            <ul style={styles.smallList}>
              {archivedFindings.map((finding) => (
                <li key={`archived-finding-${finding.id}`}>{finding.observation}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    )
  }

  function missingInfoQuestionFor(item: string) {
    const normalized = item.toLowerCase()
    if (normalized.includes('address')) return 'What is the full property address, including city, state, and ZIP?'
    if (normalized.includes('photo')) return 'Can you upload photos of the affected area and any access constraints?'
    if (normalized.includes('deadline')) return 'When does this work need to be estimated, started, or completed?'
    if (normalized.includes('inspection')) return 'Can you upload the inspection report or the exact inspection repair notes?'
    if (normalized.includes('access')) return 'How should crews access the property, park, unload, and enter the work area?'
    if (normalized.includes('scope')) return 'What specific repair outcome should the estimate cover?'
    return item.endsWith('?') ? item : `${item}?`
  }

  function renderRevealSection({
    title,
    summary,
    defaultOpen = false,
    children,
    action,
  }: {
    title: string
    summary: string
    defaultOpen?: boolean
    children: React.ReactNode
    action?: React.ReactNode
  }) {
    return (
      <details style={styles.revealCard} open={defaultOpen}>
        <summary style={styles.revealSummary}>
          <span>
            <strong>{title}</strong>
            <small>{summary}</small>
          </span>
          <span style={styles.revealChevron}>Open</span>
        </summary>
        <div style={styles.revealBody}>
          {children}
          {action && <div style={styles.revealAction}>{action}</div>}
        </div>
      </details>
    )
  }

  function renderPropertyWorkflowCard(request: WorkRequest) {
    const workflow = getPropertyWorkflow(request)
    const agentOutputs = propertyAgentOutputsByRequest[request.id] || []
    const approvedSiteMediaFindings = getApprovedSiteMediaFindings(request)
    const coordinationOutput = agentOutputs.find((output) => output.agent_name === 'coordination_agent')
    const logisticsOutput = agentOutputs.find((output) => output.agent_name === 'logistics_agent')
    const hasLogisticsOutput = Boolean(logisticsOutput)
    const coordinationJson = coordinationOutput?.output_json || {}
    const logisticsJson = logisticsOutput?.output_json || {}
    const unifiedScopeSummary =
      typeof coordinationJson.unified_scope_summary === 'string'
        ? coordinationJson.unified_scope_summary
        : workflow.body
    const recommendedNextStep =
      typeof coordinationJson.recommended_next_step === 'string'
        ? coordinationJson.recommended_next_step
        : workflow.buttonLabel
    const missingInfoCount = agentOutputs.reduce((sum, output) => sum + output.missing_info.length, 0)
    const needsReviewCount = agentOutputs.filter((output) => !isHumanVerifiedStatus(output.status)).length
    const logisticsSummary = getJsonString(
      logisticsJson.logistics_summary,
      'Site logistics are being audited against access, staging, handling, disposal, and safety.'
    )
    const accessClassification = getJsonString(logisticsJson.access_classification, 'unknown')
    const materialHandlingDifficulty = getJsonString(logisticsJson.material_handling_difficulty, 'unknown')
    const hiddenLaborFlags = getJsonStringArray(logisticsJson.hidden_labor_flags)
    const logisticsQuestions = getJsonStringArray(logisticsJson.missing_info_questions)
    const recommendedLineItems = getJsonStringArray(logisticsJson.recommended_line_items)
    const logisticsBlockers = getJsonStringArray(coordinationJson.logistics_blockers)
    const unresolvedMemoryConflicts = agentMemoryConflicts.filter(
      (conflict) =>
        conflict.resolution_status === 'needs_review' &&
        (!conflict.work_request_id || conflict.work_request_id === request.id)
    )
    const criticalLogisticsBlockers = (logisticsBlockers.length ? logisticsBlockers : logisticsQuestions).slice(0, 3)
    const logisticsAuditNotes = getJsonStringArray(logisticsJson.audit_notes)
    const logisticsConfidence = logisticsOutput?.confidence || 'pending'
    const reviewSummary = agentOutputs.length
      ? `${needsReviewCount} of ${agentOutputs.length} agent output(s) need human review${
          missingInfoCount ? `; ${missingInfoCount} missing-info flag(s).` : '.'
        }`
      : 'Property intelligence is being prepared in the background.'

    const secondaryActions = [
      {
        label: aiLoadingId === request.id ? 'Preparing...' : 'Prepare Estimate Draft',
        onClick: () => runAiEstimate(request),
        disabled: aiLoadingId === request.id,
      },
      {
        label: sellerPrepLoadingId === request.id ? 'Preparing...' : 'Prepare Seller Summary',
        onClick: () => runSellerPrepDraftV1(request),
        disabled: sellerPrepLoadingId === request.id,
      },
      {
        label: sellerPrepLoadingId === request.id ? 'Opening...' : 'View Seller Summary',
        onClick: () => loadSellerPrepDraftForRequest(request),
        disabled: sellerPrepLoadingId === request.id,
      },
      {
        label: materialEstimateLoadingId === request.id ? 'Refreshing...' : 'Refresh Material Package',
        onClick: () => buildMaterialEstimate(request),
        disabled: materialEstimateLoadingId === request.id,
      },
      {
        label: 'Refresh Estimate Intelligence',
        onClick: () => buildLocalEstimateIntelligence(request),
        disabled: false,
      },
      {
        label: 'Export Job Packet',
        onClick: () => exportJobPacket(request),
        disabled: false,
      },
      {
        label: autoWorkflowLoadingId === request.id ? 'Researching...' : 'Research + Takeoff Draft',
        onClick: () => autoProcessLead(request),
        disabled: autoWorkflowLoadingId === request.id,
      },
      {
        label: messageSavingId === request.id ? 'Creating...' : 'Create Info Request',
        onClick: () => generateMissingInfoRequest(request),
        disabled: messageSavingId === request.id,
      },
    ]
    const requestAssignments = contractorAssignments.filter(
      (assignment) =>
        assignment.property_id === getRequestPropertyId(request) ||
        assignment.work_request_id === request.id
    )
    const visibleAssignments =
      memoryActorRole === 'contractor'
        ? requestAssignments.filter((assignment) => assignment.contractor_profile_id === currentUserId)
        : requestAssignments
    const scopedItems = estimateItems.filter((item) => estimateItemMatchesCurrentScope(item, request))
    const pendingEstimateItems = scopedItems.filter((item) => !item.human_approved && !isEstimateItemRejected(item))
    const approvedEstimateItems = scopedItems.filter((item) => item.human_approved)
    const materialOutput = agentOutputs.find((output) => output.agent_name === 'material_agent')
    const materialJson = materialOutput?.output_json || {}
    const materialAssumptions = [
      ...getJsonStringArray(materialJson.assumptions),
      ...(materialOutput?.assumptions || []),
    ].slice(0, 4)
    const materialLinks = scopedItems.filter((item) => item.source_url).slice(0, 3)
    const missingQuestions = [
      ...getMissingInfoItems(request).map(missingInfoQuestionFor),
      ...logisticsQuestions,
      ...agentOutputs.flatMap((output) => output.missing_info.map(missingInfoQuestionFor)),
    ].filter((item, index, arr) => item && arr.indexOf(item) === index)
    const estimateReviewStatus = scopedItems.length
      ? pendingEstimateItems.length
        ? `${pendingEstimateItems.length} draft item${pendingEstimateItems.length === 1 ? '' : 's'} need human review`
        : `${approvedEstimateItems.length} item${approvedEstimateItems.length === 1 ? '' : 's'} human reviewed`
      : request.aiEstimate
        ? 'AI draft present; human review required'
        : 'No estimate draft yet'

    return (
      <div style={isCompact ? { ...styles.workflowCard, ...styles.mobileWorkflowCard } : styles.workflowCard}>
        {renderRevealSection({
          title: 'Scope Interpretation',
          summary: 'Plain-language read of the job',
          defaultOpen: true,
          action: (
            <button type="button" style={styles.workflowPrimaryButton} disabled={workflow.disabled} onClick={workflow.onPrimary}>
              {workflow.buttonLabel}
            </button>
          ),
          children: (
            <>
              <p style={styles.workflowBody}>{unifiedScopeSummary}</p>
              <p style={styles.workflowFootnote}>Recommended next step: {recommendedNextStep}. AI drafts stay in review until a human approves them.</p>
              {criticalLogisticsBlockers.length > 0 && (
                <div style={styles.logisticsAlert}>
                  {criticalLogisticsBlockers.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              )}
              {approvedSiteMediaFindings.length > 0 && (
                <div style={styles.logisticsSummaryBox}>
                  <strong>Approved media context</strong>
                  <ul style={styles.smallList}>
                    {approvedSiteMediaFindings.slice(0, 4).map((finding) => (
                      <li key={`workflow-site-media-${finding.id}`}>
                        {finding.finding_type}: {finding.access_notes || finding.safety_notes || finding.field_consequence || finding.observation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hasLogisticsOutput ? (
                <div style={styles.logisticsSummaryBox}>
                  <div style={styles.badgeRow}>
                    <span style={styles.badgeMuted}>Access: {accessClassification}</span>
                    <span style={styles.badgeMuted}>Material handling: {materialHandlingDifficulty}</span>
                    <span style={styles.badge}>Confidence: {logisticsConfidence.replace(/_/g, ' ')}</span>
                  </div>
                  <p style={styles.workflowBody}>{logisticsSummary}</p>
                </div>
              ) : (
                <p style={styles.workflowFootnote}>Site logistics are being prepared from the available lead and media context.</p>
              )}
            </>
          ),
        })}

        {renderRevealSection({
          title: 'Missing Info',
          summary: missingQuestions.length ? `${missingQuestions.length} question${missingQuestions.length === 1 ? '' : 's'} to resolve` : 'No obvious blockers',
          action: (
            <button
              type="button"
              style={styles.workflowSecondaryButton}
              disabled={messageSavingId === request.id}
              onClick={() => generateMissingInfoRequest(request)}
            >
              {messageSavingId === request.id ? 'Creating...' : 'Create Info Request'}
            </button>
          ),
          children: missingQuestions.length ? (
            <ul style={styles.questionList}>
              {missingQuestions.slice(0, 6).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p style={styles.workflowBody}>No obvious missing-info questions from the current lead text and uploaded media. Human review still required before estimating.</p>
          ),
        })}

        {renderRevealSection({
          title: 'Materials + Links',
          summary: scopedItems.length ? `${scopedItems.length} draft material item${scopedItems.length === 1 ? '' : 's'}` : 'No material package yet',
          action: (
            <button
              type="button"
              style={styles.workflowSecondaryButton}
              disabled={materialEstimateLoadingId === request.id}
              onClick={() => buildMaterialEstimate(request)}
            >
              {materialEstimateLoadingId === request.id ? 'Refreshing...' : 'Refresh Material Package'}
            </button>
          ),
          children: (
            <>
              {scopedItems.length ? (
                <div style={styles.revealItemList}>
                  {scopedItems.slice(0, 5).map((item) => (
                    <div key={item.id} style={styles.revealLineItem}>
                      <strong>{item.item_name}</strong>
                      <span>{item.quantity || item.required_quantity || 'Qty TBD'} {item.required_unit || ''} • {money(item.total_price || item.extended_total || item.unit_price)}</span>
                      {item.relevance_reason && <small>{item.relevance_reason}</small>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.workflowBody}>No material list has been drafted yet. Use the action below to prepare a draft package from the request and uploaded context.</p>
              )}
              <strong>Assumptions</strong>
              <ul style={styles.smallList}>
                {(materialAssumptions.length ? materialAssumptions : ['Quantities, waste, substitutions, delivery path, and current pricing require human review.']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {materialLinks.length > 0 && (
                <>
                  <strong>Links</strong>
                  <div style={styles.buttonRow}>
                    {materialLinks.map((item) => (
                      <button key={item.id} type="button" style={styles.linkButton} onClick={() => window.open(item.source_url || '', '_blank', 'noopener,noreferrer')}>
                        {item.source || item.item_name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ),
        })}

        {renderRevealSection({
          title: 'Estimate Draft',
          summary: estimateReviewStatus,
          action: (
            <button type="button" style={styles.workflowSecondaryButton} disabled={estimateLoading} onClick={() => openEstimateReview(request)}>
              {estimateLoading ? 'Opening...' : 'Review Estimate'}
            </button>
          ),
          children: (
            <>
              <div style={styles.badgeRow}>
                <span style={pendingEstimateItems.length ? styles.badgeMuted : styles.badge}>{estimateReviewStatus}</span>
                <span style={styles.badgeMuted}>Human review required</span>
              </div>
              {request.aiEstimate ? (
                <p style={styles.workflowBody}>
                  Draft range: Low {money(request.aiEstimate.lowPrice)} • Standard {money(request.aiEstimate.standardPrice)} • Premium {money(request.aiEstimate.premiumPrice)}
                </p>
              ) : (
                <p style={styles.workflowBody}>No AI estimate summary is attached yet.</p>
              )}
              {scopedItems.length > 0 && <p style={styles.workflowFootnote}>{scopedItems.length} scoped estimate/material row(s) are available as context only until approved.</p>}
            </>
          ),
        })}

        {(canApproveOperationalMemory(memoryActorRole) || visibleAssignments.length > 0) && (
          <details style={styles.revealCard}>
            <summary style={styles.revealSummary}>
              <span>
                <strong>Contractor Assignment</strong>
                <small>{visibleAssignments.length ? `${visibleAssignments.length} active assignment${visibleAssignments.length === 1 ? '' : 's'}` : 'No contractor assigned'}</small>
              </span>
              <span style={styles.revealChevron}>Open</span>
            </summary>
            <div style={styles.revealBody}>
            {canApproveOperationalMemory(memoryActorRole) && (
              <div style={isCompact ? styles.mobileStack : styles.grid2}>
                <select
                  style={styles.input}
                  value={selectedContractorByRequest[request.id] || ''}
                  onChange={(event) =>
                    setSelectedContractorByRequest((prev) => ({ ...prev, [request.id]: event.target.value }))
                  }
                >
                  <option value="">Choose contractor</option>
                  {contractorProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email || profile.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  style={styles.workflowSecondaryButton}
                  disabled={contractorAssignmentSavingId === request.id || !selectedContractorByRequest[request.id]}
                  onClick={() => assignContractorToRequest(request)}
                >
                  Assign Contractor
                </button>
              </div>
            )}
            {contractorAssignmentLoading && <p style={styles.small}>Loading assignments...</p>}
            {visibleAssignments.length === 0 ? (
              <p style={styles.small}>No contractor assigned yet.</p>
            ) : (
              <div style={styles.fileGrid}>
                {visibleAssignments.map((assignment) => {
                  const contractor = contractorProfiles.find((profile) => profile.id === assignment.contractor_profile_id)
                  const notesDraft = contractorNotesByAssignment[assignment.id] ?? assignment.contractor_notes ?? ''
                  return (
                    <div key={assignment.id} style={styles.aiBox}>
                      <div style={styles.badgeRow}>
                        <span style={assignment.status === 'cancelled' ? styles.badgeDanger : styles.badge}>
                          {getLearningDisplayName(assignment.status)}
                        </span>
                        <span style={styles.badgeMuted}>{contractor?.full_name || contractor?.email || 'Assigned contractor'}</span>
                      </div>
                      {assignment.assignment_notes && <p style={styles.small}>Admin notes: {assignment.assignment_notes}</p>}
                      <textarea
                        style={{ ...styles.input, minHeight: 72 }}
                        placeholder="Contractor notes"
                        value={notesDraft}
                        disabled={memoryActorRole !== 'contractor' && !canApproveOperationalMemory(memoryActorRole)}
                        onChange={(event) =>
                          setContractorNotesByAssignment((prev) => ({ ...prev, [assignment.id]: event.target.value }))
                        }
                      />
                      <div style={styles.buttonRow}>
                        {memoryActorRole === 'contractor' &&
                          CONTRACTOR_UPDATABLE_ASSIGNMENT_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              style={styles.outlineButton}
                              disabled={contractorAssignmentSavingId === assignment.id}
                              onClick={() => updateContractorAssignment(assignment, { status, contractor_notes: notesDraft })}
                            >
                              {getLearningDisplayName(status)}
                            </button>
                          ))}
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={contractorAssignmentSavingId === assignment.id}
                          onClick={() => updateContractorAssignment(assignment, { contractor_notes: notesDraft })}
                        >
                          Save Notes
                        </button>
                        {canApproveOperationalMemory(memoryActorRole) && assignment.status !== 'cancelled' && (
                          <button
                            type="button"
                            style={styles.outlineButton}
                            disabled={contractorAssignmentSavingId === assignment.id}
                            onClick={() => updateContractorAssignment(assignment, { status: 'cancelled' })}
                          >
                            Cancel Assignment
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </details>
        )}

        <details style={styles.revealCard}>
          <summary style={styles.revealSummary}>
            <span>
              <strong>History / Advanced</strong>
              <small>{reviewSummary}</small>
            </span>
            <span style={styles.revealChevron}>Open</span>
          </summary>
          <div style={styles.revealBody}>
          {unresolvedMemoryConflicts.length ? (
            <div style={styles.warningBox}>Operational memory conflict needs human decision before final output.</div>
          ) : null}
          {hiddenLaborFlags.length ? (
            <>
              <strong>Hidden labor flags</strong>
              <ul style={styles.smallList}>
                {hiddenLaborFlags.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {recommendedLineItems.length ? (
            <>
              <strong>Recommended line items</strong>
              <ul style={styles.smallList}>
                {recommendedLineItems.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {logisticsAuditNotes.length ? <p style={styles.workflowFootnote}>{logisticsAuditNotes[0]}</p> : null}
          {agentOutputs.length === 0 ? (
            <div style={styles.empty}>Property intelligence is being prepared in the background.</div>
          ) : (
            <div style={styles.agentOutputGrid}>
              {agentOutputs.map((output) => (
                <div key={output.id} style={styles.agentOutputCard}>
                  <div style={styles.badgeRow}>
                    <span style={styles.badgeMuted}>{getAgentDisplayName(output.agent_name)}</span>
                    <span style={output.status === 'rejected' ? styles.badgeDanger : styles.badge}>
                      {getLearningDisplayName(output.status)}
                    </span>
                  </div>
                  <p style={styles.small}>Confidence: {output.confidence}</p>
                  <p style={styles.small}>{output.input_summary}</p>
                  <strong>Assumptions</strong>
                  <ul style={styles.smallList}>
                    {(output.assumptions.length ? output.assumptions : ['None listed']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <strong>Missing Info</strong>
                  <ul style={styles.smallList}>
                    {(output.missing_info.length ? output.missing_info : ['None obvious']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <strong>Audit Notes</strong>
                  <ul style={styles.smallList}>
                    {(output.audit_notes.length ? output.audit_notes : ['Human review required before final use.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <div style={styles.revealAction}>
            <button type="button" style={styles.workflowSecondaryButton} onClick={() => exportJobPacket(request)}>
              Export Job Packet
            </button>
            <button type="button" style={styles.workflowSecondaryButton} disabled={autoWorkflowLoadingId === request.id} onClick={() => autoProcessLead(request)}>
              {autoWorkflowLoadingId === request.id ? 'Researching...' : 'Research + Takeoff Draft'}
            </button>
          </div>
          </div>
        </details>
      </div>
    )
  }

  const currentScopeEstimateItems = useMemo(
    () =>
      estimateItems.filter((item) =>
        estimateItemMatchesCurrentScope(item, selectedEstimateRequest)
      ),
    [estimateItems, selectedEstimateRequest]
  )
  const currentSiteMediaEstimateFindings = useMemo(
    () => getApprovedSiteMediaFindings(selectedEstimateRequest),
    [selectedEstimateRequest, siteMediaFindingsByRequest]
  )

  const visibleEstimateItems = useMemo(
    () =>
      showRejectedEstimateItems
        ? estimateItems.filter((item) => {
            if (!selectedEstimateRequest) return true
            const propertyId = getRequestPropertyId(selectedEstimateRequest)
            return (
              item.lead_id === selectedEstimateRequest.id ||
              item.request_id === selectedEstimateRequest.id ||
              item.job_id === selectedEstimateRequest.id ||
              item.property_id === propertyId
            )
          })
        : currentScopeEstimateItems,
    [currentScopeEstimateItems, estimateItems, selectedEstimateRequest, showRejectedEstimateItems]
  )

  const rejectedEstimateCount = estimateItems.filter(isEstimateItemRejected).length

  const currentJobScopeSteps = useMemo(
    () =>
      sortJobExecutionSteps(
        jobExecutionSteps.filter((step) =>
          selectedEstimateRequest ? step.job_request_id === selectedEstimateRequest.id : true
        )
      ),
    [jobExecutionSteps, selectedEstimateRequest]
  )

  const activeJobScopeSteps = currentJobScopeSteps.filter((step) => step.status !== 'rejected')
  const approvedJobScopeSteps = currentJobScopeSteps.filter((step) => isHumanVerifiedStatus(step.status))
  const jobScopeApprovedLowHours = approvedJobScopeSteps.reduce(
    (sum, step) => sum + Number(step.estimated_hours_low || 0),
    0
  )
  const jobScopeApprovedHighHours = approvedJobScopeSteps.reduce(
    (sum, step) => sum + Number(step.estimated_hours_high || 0),
    0
  )
  const jobScopeCurrentLowHours = activeJobScopeSteps.reduce(
    (sum, step) => sum + Number(step.estimated_hours_low || 0),
    0
  )
  const jobScopeCurrentHighHours = activeJobScopeSteps.reduce(
    (sum, step) => sum + Number(step.estimated_hours_high || 0),
    0
  )
  const jobScopeLaborHoursLabel = approvedJobScopeSteps.length
    ? `${jobScopeApprovedLowHours.toFixed(1)}-${jobScopeApprovedHighHours.toFixed(1)} approved hrs`
    : `${jobScopeCurrentLowHours.toFixed(1)}-${jobScopeCurrentHighHours.toFixed(1)} current draft hrs`

  const estimateTotals = calculateEstimateTotals(
    currentScopeEstimateItems,
    estimateLaborCost,
    estimateMarkupPercent,
    estimateContingencyPercent
  )
  const estimateMaterialSubtotal = estimateTotals.materialSubtotal
  const estimateLaborNumber = estimateTotals.labor
  const estimateLaborUnitsNumber = Number(estimateLaborUnits || 0)
  const estimateLaborBaseNumber = appliedLaborRate
    ? Number(appliedLaborRate.typical_rate || 0) * estimateLaborUnitsNumber
    : estimateLaborNumber
  const estimateLaborMinimumNumber = Number(estimateMinimumCharge || 0)
  const estimateTripChargeNumber = Number(estimateTripCharge || 0)
  const estimateDisposalFeeNumber = Number(estimateDisposalFee || 0)
  const estimateMarkupNumber = estimateTotals.markup
  const estimateContingencyNumber = estimateTotals.contingency
  const estimateDirectCost = estimateTotals.directCost
  const estimateMarkupDollars = estimateTotals.markupDollars
  const estimateContingencyDollars = estimateTotals.contingencyDollars
  const estimateStandardTotal = estimateTotals.standardTotal
  const estimateLowTotal = estimateTotals.lowTotal
  const estimatePremiumTotal = estimateTotals.premiumTotal
  const approvedEstimateCount = estimateTotals.approvedCount
  const allEstimateItemsApproved =
    currentScopeEstimateItems.length > 0 && approvedEstimateCount === currentScopeEstimateItems.length
  const propertyResearchPack = useMemo(
    () => buildPropertyResearchPack(propertyAddress, city, stateValue || 'OR', zip),
    [propertyAddress, city, stateValue, zip]
  )
  const selectedInspectionCount = documentFiles.filter((file) => /\.(pdf|doc|docx)$/i.test(file.name)).length
  const selectedVideoCount = documentFiles.filter((file) => file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name)).length
  const selectedOtherMediaCount = documentFiles.length - selectedInspectionCount - selectedVideoCount
  const selectedMediaSummary = [
    photoFiles.length ? `${photoFiles.length} photo${photoFiles.length === 1 ? '' : 's'} attached` : '',
    selectedInspectionCount ? `${selectedInspectionCount} inspection/report file${selectedInspectionCount === 1 ? '' : 's'} attached` : '',
    selectedVideoCount ? `${selectedVideoCount} video${selectedVideoCount === 1 ? '' : 's'} attached` : '',
    selectedOtherMediaCount ? `${selectedOtherMediaCount} other file${selectedOtherMediaCount === 1 ? '' : 's'} attached` : '',
  ].filter(Boolean)
  const hasPulledPropertyFacts = Boolean(
    propertyFacts.squareFeet ||
      propertyFacts.bedrooms ||
      propertyFacts.bathrooms ||
      propertyFacts.yearBuilt ||
      propertyType ||
      jurisdiction ||
      propertyFacts.propertyType ||
      propertyFacts.jurisdiction
  )
  const propertyFactsSummary = [
    propertyFacts.squareFeet ? `${propertyFacts.squareFeet} sqft` : '',
    propertyFacts.bedrooms ? `${propertyFacts.bedrooms} beds` : '',
    propertyFacts.bathrooms ? `${propertyFacts.bathrooms} baths` : '',
    propertyFacts.yearBuilt ? `Built ${propertyFacts.yearBuilt}` : '',
  ].filter(Boolean)
  const visibleAgentLearningEvents = agentLearningEvents.filter(
    (event) => agentLearningStatusFilter === 'all' || event.lesson_status === agentLearningStatusFilter
  )
  const visibleAgentLearningRules = agentLearningRules.filter(
    (rule) => agentLearningStatusFilter === 'all' || rule.lesson_status === agentLearningStatusFilter
  )
  const visibleSourceLessons = sourceLessons.filter(
    (lesson) => sourceLessonStatusFilter === 'all' || lesson.status === sourceLessonStatusFilter
  )
  const curatedLessonSummaryDraft = curatedLessonDraftId
    ? sourceLessons.find((lesson) => lesson.id === curatedLessonDraftId) || null
    : sourceLessons.find((lesson) => lesson.admin_notes?.includes('Curated Lesson Intake draft')) || null
  const agentLearningRuleById = new Map(agentLearningRules.map((rule) => [rule.id, rule]))
  const visibleAgentRuleApplications = agentRuleApplications.filter((application) => {
    const matchesRule = ruleApplicationRuleFilter === 'all' || application.rule_id === ruleApplicationRuleFilter
    const matchesType = ruleApplicationTypeFilter === 'all' || application.application_type === ruleApplicationTypeFilter
    const matchesAgent = ruleApplicationAgentFilter === 'all' || application.applied_by_agent === ruleApplicationAgentFilter
    const matchesFeedback =
      ruleApplicationFeedbackFilter === 'all' || application.human_feedback_status === ruleApplicationFeedbackFilter
    const taskFilter = normalizeJobScopeTokenText(ruleApplicationTaskFilter)
    const matchesTask = !taskFilter || normalizeJobScopeTokenText(application.task_type).includes(taskFilter)
    return matchesRule && matchesType && matchesAgent && matchesFeedback && matchesTask
  })
  const visibleAgentMemoryConflicts = agentMemoryConflicts.filter(
    (conflict) => memoryConflictStatusFilter === 'all' || conflict.resolution_status === memoryConflictStatusFilter
  )

  return (
    <div style={isCompact ? { ...styles.page, ...styles.mobilePage } : styles.page}>
      <header style={isCompact ? { ...styles.header, ...styles.mobileHeader } : styles.header}>
        <div>
          <div style={isCompact ? { ...styles.brand, ...styles.mobileBrand } : styles.brand}>SHELTER PREP</div>
          <div style={isCompact ? { ...styles.subBrand, ...styles.mobileSubBrand } : styles.subBrand}>HOME SERVICES</div>
        </div>

        <nav style={isCompact ? { ...styles.nav, ...styles.mobileNav } : styles.nav}>
          {[
            { label: 'New Request', tab: 'new' as Tab, onClick: () => setActiveTab('new') },
            {
              label: currentUserRole === 'contractor' && !hasAdminConsoleAccess ? 'Assignments' : 'Properties',
              tab: 'properties' as Tab,
              onClick: () => {
                if (hasAdminConsoleAccess || currentUserRole === 'contractor') setActiveTab('properties')
                else setShowLogin(true)
              },
            },
            { label: 'Dashboard', tab: 'dashboard' as Tab, onClick: () => requireAdmin('dashboard') },
            { label: 'Reports', tab: 'reports' as Tab, onClick: () => requireAdmin('reports') },
          ].map((item) => (
            <button
              key={item.tab}
              type="button"
              style={
                activeTab === item.tab
                  ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) }
                  : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }
              }
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              style={{ ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
              onClick={() => setShowMoreMenu((current) => !current)}
            >
              More
            </button>

            {showMoreMenu && (
              <div style={styles.moreMenu}>
                {hasAdminConsoleAccess && (
                  <>
                    <div style={styles.moreMenuLabel}>Admin Tools</div>
                    {[
                      { label: 'Project Gallery', tab: 'gallery' as Tab },
                      { label: 'Messages', tab: 'messages' as Tab },
                      { label: 'Seller Prep', tab: 'sellerPrep' as Tab },
                      { label: 'Pricing Memory', tab: 'pricingMemory' as Tab },
                      { label: 'Material Costs', tab: 'materials' as Tab },
                      { label: 'Labor Rates', tab: 'labor' as Tab },
                      { label: 'AI Estimator', tab: 'estimates' as Tab },
                      { label: 'Agent Learning', tab: 'agentLearning' as Tab },
                      { label: 'Archived Leads', tab: 'archived' as Tab },
                      { label: 'Invoices', tab: 'invoices' as Tab },
                      { label: 'Historical Upload', tab: 'history' as Tab },
                      { label: 'AI Intake', tab: 'intake' as Tab },
                      { label: 'Settings', tab: 'settings' as Tab },
                    ].map((item) => (
                      <button
                        key={item.tab}
                        type="button"
                        style={activeTab === item.tab ? styles.moreMenuItemActive : styles.moreMenuItem}
                        onClick={() => {
                          requireAdmin(item.tab)
                          setShowMoreMenu(false)
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      style={styles.moreMenuItem}
                      onClick={() => {
                        exportCsv()
                        setShowMoreMenu(false)
                      }}
                    >
                      Export CSV
                    </button>
                  </>
                )}

                {canAccessSourceLessonAgent && (
                  <>
                    <div style={styles.moreMenuLabel}>{hasAdminConsoleAccess ? 'Learning Tools' : 'Field Tools'}</div>
                    <button
                      type="button"
                      style={activeTab === 'fieldLessons' ? styles.moreMenuItemActive : styles.moreMenuItem}
                      onClick={() => {
                        openSourceLessonAgent()
                        setShowMoreMenu(false)
                      }}
                    >
                      Field Lesson Agent
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        <div style={isCompact ? { ...styles.headerActions, ...styles.mobileHeaderActions } : styles.headerActions}>
          {isAdmin ? (
            <button style={styles.primaryButton} onClick={handleLogout}>
              Exit Demo PIN
            </button>
          ) : hasAdminConsoleAccess ? (
            <button style={styles.outlineButton} disabled>
              Admin Access
            </button>
          ) : (
            <button style={styles.primaryButton} onClick={() => setShowLogin(true)}>
              Admin Login
            </button>
          )}
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div style={styles.previewBanner}>
          <strong>Admin warning:</strong> Supabase env vars are missing. Add{' '}
          <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> or{' '}
          <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>.
          Preview/manual entry still works, but saving, uploads, dashboards, and signed file links need Supabase.
        </div>
      )}

      {isAdmin && !hasSupabaseSession && (
        <div style={styles.previewBanner}>
          <strong>Demo PIN active:</strong> This is read-only and is not a security boundary. Sign in with a Supabase admin/owner account before opening protected admin operations or saving operational records.
        </div>
      )}

      <main style={isCompact ? { ...styles.main, ...styles.mobileMain } : styles.main}>
        {activeTab === 'new' && (
          <div style={isCompact ? styles.mobileStack : styles.twoColumn}>
            <section style={styles.card}>
              <div style={styles.hero}>Start a property</div>

              <p style={styles.muted}>
                Add the address and whatever media you have. Shelter Prep will organize the rest for review.
              </p>

              {successMessage && <div style={styles.success}>{successMessage}</div>}

              <form onSubmit={handleSubmit} style={styles.intakeFlow}>
                <div style={styles.intakeStepCard}>
                  <div style={styles.intakeStepHeader}>
                    <span style={styles.workflowStage}>Start Property</span>
                    <strong>Add photos, video, or an inspection report first.</strong>
                  </div>

                  <div style={isCompact ? styles.mobileStack : styles.intakeMediaGrid}>
                    <label style={styles.intakeMediaButton}>
                      <span>Take Photos</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        style={styles.hiddenFileInput}
                        onChange={(e) => {
                          setLocalEvidenceStatus('selected')
                          setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>
                    <label style={styles.intakeMediaButton}>
                      <span>Choose Photos</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.heic,.heif"
                        style={styles.hiddenFileInput}
                        onChange={(e) => {
                          setLocalEvidenceStatus('selected')
                          setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>
                    <label style={styles.intakeMediaButton}>
                      <span>Upload Inspection PDF</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,.mp4,.mov,image/*,video/*,application/pdf"
                        style={styles.hiddenFileInput}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          setLocalEvidenceStatus('selected')
                          setDocumentFiles((prev) => [...prev, ...files])
                          void readInspectionFiles(files)
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>
                    <label style={styles.intakeMediaButton}>
                      <span>Add Video</span>
                      <input
                        type="file"
                        multiple
                        accept="video/*,.mp4,.mov"
                        style={styles.hiddenFileInput}
                        onChange={(e) => {
                          setLocalEvidenceStatus('selected')
                          setDocumentFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>

                  <div style={styles.mediaSummaryBox}>
                    {selectedMediaSummary.length ? (
                      selectedMediaSummary.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span>Add photos, video, or an inspection report to help Shelter Prep organize the repair scope.</span>
                    )}
                  </div>

                  {renderSelectedEvidence()}
                </div>

                <div style={styles.intakeStepCard}>
                  <div style={styles.intakeStepHeader}>
                    <span style={styles.workflowStage}>Property Address</span>
                    <strong>Where is the work?</strong>
                  </div>
                  <input
                    style={styles.input}
                    placeholder="Property address"
                    value={propertyAddress}
                    onChange={(e) => {
                      setPropertyAddress(e.target.value)
                      setPropertyLookupMessage('')
                      setPropertyLookupStatus('idle')
                    }}
                  />
                </div>

                <div style={styles.intakeStepCard}>
                  <div style={styles.intakeStepHeader}>
                    <span style={styles.workflowStage}>What Needs Attention?</span>
                    <strong>A short note is enough.</strong>
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 110 }}
                    placeholder="Example: kitchen cabinet removal, drywall patch, repaint wall"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={styles.intakeStepCard}>
                  <div style={styles.intakeStepHeader}>
                    <span style={styles.workflowStage}>Property Details Review</span>
                    <button
                      type="button"
                      style={styles.workflowSecondaryButton}
                      onClick={pullPropertyInfo}
                      disabled={propertyLookupLoading || !propertyAddress.trim()}
                    >
                      {propertyLookupLoading ? 'Pulling...' : 'Pull Property Facts'}
                    </button>
                  </div>
                  {hasPulledPropertyFacts ? (
                    <div style={styles.propertyFactsSummary}>
                      {propertyFactsSummary.length ? propertyFactsSummary.join(' • ') : 'Property facts pulled.'}
                      <span>{propertyType || propertyFacts.propertyType || 'Property type needs review'}</span>
                      <span>{jurisdiction || propertyFacts.jurisdiction || propertyResearchPack.jurisdiction}</span>
                    </div>
                  ) : (
                    <p style={styles.workflowFootnote}>Property facts not pulled yet.</p>
                  )}
                  {propertyLookupMessage && (
                    <div style={{ ...styles.noticeBox, marginTop: 10 }}>
                      <strong>{propertyLookupStatusLabel(propertyLookupStatus)}</strong>
                      <p style={{ margin: '6px 0 0' }}>{propertyLookupMessage}</p>
                    </div>
                  )}

                  {renderInspectionReportDraft()}

                  <details style={styles.moreActions}>
                    <summary style={styles.moreActionsSummary}>More property details</summary>
                    <div style={styles.progressiveFieldGrid}>
                      <input
                        style={styles.input}
                        placeholder="Bedrooms"
                        value={propertyFacts.bedrooms}
                        onChange={(e) => setPropertyFacts((prev) => ({ ...prev, bedrooms: e.target.value, verified: true }))}
                      />
                      <input
                        style={styles.input}
                        placeholder="Bathrooms"
                        value={propertyFacts.bathrooms}
                        onChange={(e) => setPropertyFacts((prev) => ({ ...prev, bathrooms: e.target.value, verified: true }))}
                      />
                      <input
                        style={styles.input}
                        placeholder="Square feet"
                        value={propertyFacts.squareFeet}
                        onChange={(e) => setPropertyFacts((prev) => ({ ...prev, squareFeet: e.target.value, verified: true }))}
                      />
                      <input
                        style={styles.input}
                        placeholder="Lot size"
                        value={propertyFacts.lotSize}
                        onChange={(e) => setPropertyFacts((prev) => ({ ...prev, lotSize: e.target.value, verified: true }))}
                      />
                      <input
                        style={styles.input}
                        placeholder="Year built"
                        value={propertyFacts.yearBuilt}
                        onChange={(e) => setPropertyFacts((prev) => ({ ...prev, yearBuilt: e.target.value, verified: true }))}
                      />
                      <input
                        style={styles.input}
                        placeholder="Property type"
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                      />
                    </div>
                  </details>
                </div>

                <details style={styles.intakeDisclosure}>
                  <summary style={styles.moreActionsSummary}>Contact details</summary>
                  <div style={styles.progressiveFieldGrid}>
                    <input style={styles.input} placeholder="Name" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
                    <input style={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input style={styles.input} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </details>

                <details style={styles.intakeDisclosure}>
                  <summary style={styles.moreActionsSummary}>Access / occupancy / timeline</summary>
                  <div style={styles.progressiveFieldGrid}>
                    <select style={styles.input} value={workType} onChange={(e) => setWorkType(e.target.value)}>
                      {WORK_TYPES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <select style={styles.input} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                      <option>Standard</option>
                      <option>Urgent</option>
                      <option>ASAP</option>
                    </select>
                    <select style={styles.input} value={occupancy} onChange={(e) => setOccupancy(e.target.value)}>
                      <option>Occupied</option>
                      <option>Vacant</option>
                      <option>Unknown</option>
                    </select>
                    <input style={styles.input} placeholder="Desired timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
                  </div>
                </details>

                <details style={styles.intakeDisclosure}>
                  <summary style={styles.moreActionsSummary}>Jurisdiction / permit notes</summary>
                  <div style={styles.progressiveFieldGrid}>
                    <input style={styles.input} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    <input style={styles.input} placeholder="State" value={stateValue} onChange={(e) => setStateValue(e.target.value)} />
                    <input style={styles.input} placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
                    <input
                      style={styles.input}
                      placeholder="Jurisdiction"
                      value={jurisdiction || propertyResearchPack.jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                    />
                    <input style={styles.input} placeholder="Zoning" value={zoning} onChange={(e) => setZoning(e.target.value)} />
                    <input style={styles.input} placeholder="Parcel / account #" value={parcelNumber} onChange={(e) => setParcelNumber(e.target.value)} />
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 90 }}
                    placeholder="Verification notes, access constraints, additions, ADU, finished basement"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                  />
                  <p style={styles.workflowFootnote}>Permit office: {propertyResearchPack.permitOffice}</p>
                </details>

                <details style={styles.intakeDisclosure}>
                  <summary style={styles.moreActionsSummary}>Source links</summary>
                  <div style={styles.grid2}>
                    {propertyResearchPack.links.map((link) => (
                      <button
                        key={link.label}
                        type="button"
                        style={styles.linkPanel}
                        onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                      >
                        <strong>{link.label}</strong>
                        <span>{link.note}</span>
                      </button>
                    ))}
                  </div>
                  <ul style={styles.mutedList}>
                    {propertyResearchPack.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </details>

                <div style={styles.intakeStatusCard}>
                  <strong>Organize Scope</strong>
                  <p style={styles.workflowBody}>Shelter Prep is ready to organize photos, documents, and property context.</p>
                  <span>{propertyAddress ? 'Review Repair Scope after start.' : 'Add an address to begin.'}</span>
                </div>

                <div style={styles.intakeActionRow}>
                  <button type="submit" style={styles.primaryButton} disabled={submitting}>
                    {submitting ? 'Starting...' : 'Start Property'}
                  </button>

                <button
                  type="button"
                  style={styles.outlineButton}
                  onClick={resetForm}
                >
                  Clear
                </button>
                </div>
              </form>
            </section>

            {hasAdminConsoleAccess && (
              <aside style={styles.sideCard}>
                <h2>Service Health</h2>
                <div style={styles.healthGrid}>
                  <div style={styles.healthRow}>
                    <span>Supabase</span>
                    <strong style={isSupabaseConfigured ? styles.healthOk : styles.healthNeedsSetup}>
                      {isSupabaseConfigured ? 'Connected' : 'Needs setup'}
                    </strong>
                  </div>
                  <div style={styles.healthRow}>
                    <span>Property Lookup</span>
                    <strong style={isSupabaseConfigured ? styles.healthOk : styles.healthNeedsSetup}>
                      {isSupabaseConfigured ? 'Ready to call Edge Function' : 'Fallback only'}
                    </strong>
                  </div>
                </div>

                {!isSupabaseConfigured && (
                  <p style={styles.small}>
                    Add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> or{' '}
                    <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong> in StackBlitz secrets to enable saved app data.
                  </p>
                )}

                <h2>Admin Tools</h2>
                <p style={styles.muted}>
                  Pricing, invoice, learning, gallery, and estimate tools are available under More when you need them.
                </p>
              </aside>
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <Suspense fallback={<div style={styles.empty}>Loading gallery...</div>}>
            <Gallery
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isAdmin={hasAuthenticatedAdminAccess}
              canManageGallery={galleryCanManage}
              localAdminMode={false}
            />
          </Suspense>
        )}

        {hasAdminConsoleAccess && activeTab === 'intake' && (
          <section style={styles.card}>
            <h2>AI Text Message / Screenshot Intake</h2>
            <p style={styles.muted}>
              Paste a text message or upload a screenshot from iMessage, email, or a client thread. AI will extract the address, work type, urgency, missing info, and a safe reply draft. Review everything before submitting.
            </p>

            <div style={styles.warningBox}>
              Intake drafts are not sent automatically. AI can draft missing-info requests, but a human must review before any estimate, proposal, purchase order, email, or submission is used.
            </div>

            <textarea
              style={{ ...styles.input, minHeight: 180 }}
              placeholder="Paste the agent/client text here. Example: Hi John, can you quote a roof repair at 183 SW Wright Ave? Tight inspection deadline."
              value={intakeText}
              onChange={(e) => setIntakeText(e.target.value)}
            />

            <div style={styles.uploadBox}>
              <strong>Screenshot upload</strong>
              <p style={styles.small}>
                Optional. Upload a screenshot of a text thread, inspection note, email, or job request.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIntakeScreenshotFile(e.target.files?.[0] || null)}
              />
              {intakeScreenshotFile && (
                <p style={styles.small}>{intakeScreenshotFile.name}</p>
              )}
            </div>

            <div style={{ ...styles.buttonRow, marginTop: 14 }}>
              <button style={styles.primaryButton} onClick={analyzeIntake} disabled={intakeAnalyzing}>
                {intakeAnalyzing ? 'Analyzing Intake...' : 'Analyze Intake'}
              </button>
              <button
                style={styles.outlineButton}
                onClick={() => {
                  setIntakeText('')
                  setIntakeScreenshotFile(null)
                  setIntakeDraft(null)
                }}
              >
                Clear Intake
              </button>
            </div>

            {intakeDraft && (
              <div style={{ ...styles.reviewBox, marginTop: 24 }}>
                <h3>AI Intake Draft</h3>

                <div style={styles.grid2}>
                  <div>
                    <strong>Work Type</strong>
                    <p style={styles.muted}>{intakeDraft.workType || 'Needs review'}</p>
                  </div>
                  <div>
                    <strong>Urgency</strong>
                    <p style={styles.muted}>{intakeDraft.urgency || 'Needs review'}</p>
                  </div>
                </div>

                <div style={styles.grid2}>
                  <div>
                    <strong>Address</strong>
                    <p style={styles.muted}>{intakeDraft.propertyAddress || 'Missing'}</p>
                  </div>
                  <div>
                    <strong>ZIP</strong>
                    <p style={styles.muted}>{intakeDraft.zip || 'Missing'}</p>
                  </div>
                </div>

                <div style={styles.grid2}>
                  <div>
                    <strong>Contact</strong>
                    <p style={styles.muted}>
                      {[intakeDraft.requesterName, intakeDraft.email, intakeDraft.phone].filter(Boolean).join(' • ') || 'Missing'}
                    </p>
                  </div>
                  <div>
                    <strong>Timeline</strong>
                    <p style={styles.muted}>{intakeDraft.timeline || 'Needs review'}</p>
                  </div>
                </div>

                <strong>Clean Scope Draft</strong>
                <p style={styles.scopeText}>{intakeDraft.description || 'No scope extracted.'}</p>

                <strong>Missing Info Checklist</strong>
                {intakeDraft.missingInfo && intakeDraft.missingInfo.length > 0 ? (
                  <ul style={styles.mutedList}>
                    {intakeDraft.missingInfo.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={styles.muted}>No obvious missing info detected. Still review before use.</p>
                )}

                <strong>Suggested Reply Draft</strong>
                <div style={styles.replyDraftBox}>
                  {intakeDraft.suggestedReply || 'No reply draft generated.'}
                </div>

                <p style={styles.small}>
                  Confidence: {intakeDraft.confidence || 'needs_review'}
                  {intakeDraft.notes ? ` • ${intakeDraft.notes}` : ''}
                </p>

                <div style={styles.buttonRow}>
                  <button style={styles.primaryButton} onClick={applyIntakeDraftToNewRequest}>
                    Use Draft in New Request
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={() => copyToClipboard(intakeDraft.suggestedReply || '')}
                  >
                    Copy Suggested Reply
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={saveIntakeReplyDraft}
                    disabled={messageSavingId === 'intake-draft'}
                  >
                    {messageSavingId === 'intake-draft' ? 'Saving...' : 'Save Reply Draft'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'messages' && (
          <section style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <h2>Message Center</h2>
                <p style={styles.muted}>AI-drafted replies and missing-info requests. Human review is required before sending.</p>
              </div>
              <button style={styles.outlineButton} disabled={messageLoading} onClick={loadMessageCenter}>
                {messageLoading ? 'Loading...' : 'Refresh Messages'}
              </button>
            </div>

            <p style={styles.workflowFootnote}>
              AI drafts require human review before any message, price, proposal, purchase order, or contractor commitment is used.
            </p>

            <div style={styles.segmentedControl}>
              {[
                { label: 'All', value: 'all' },
                { label: 'Drafts', value: 'draft' },
                { label: 'Approved', value: 'approved' },
                { label: 'Sent', value: 'sent' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  style={messageFilter === filter.value ? styles.segmentedActive : styles.segmentedButton}
                  onClick={() => setMessageFilter(filter.value as 'all' | 'draft' | 'sent' | 'approved')}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {(() => {
              const filteredMessages = messageLogs.filter((log) => messageFilter === 'all' || log.status === messageFilter)

              if (filteredMessages.length === 0) {
                return (
                  <div style={styles.messageEmptyState}>
                    No messages yet. Drafts will appear here when a property needs follow-up.
                  </div>
                )
              }

              return filteredMessages.map((log) => {
                const request = getLinkedRequest(log.lead_id)
                const propertyAddress = request?.propertyAddress || getRequestLabel(log.lead_id)
                const propertyLocation = [request?.city, request?.zip].filter(Boolean).join(' ')
                const recipient = [log.recipient_name, log.recipient_email, log.recipient_phone].filter(Boolean).join(' • ') || 'Recipient not set'
                const createdLabel = log.created_at ? new Date(log.created_at).toLocaleString() : 'Time not set'
                const isReviewing = reviewingMessageId === log.id

                return (
                  <div key={log.id} style={styles.messageCard}>
                    <div style={styles.messageCardHeader}>
                      <div>
                        <h3 style={styles.messagePropertyTitle}>{propertyAddress}</h3>
                        {propertyLocation && <p style={styles.messagePropertyMeta}>{propertyLocation}</p>}
                      </div>
                      <span style={styles.workflowStateChip}>{getMessageWorkflowState(log, request)}</span>
                    </div>

                    <div style={styles.messagePurposeRow}>
                      <strong>{getMessagePurpose(log)}</strong>
                      <span>{recipient}</span>
                      <span>{createdLabel}</span>
                    </div>

                    <p style={styles.messagePreview}>{isReviewing ? log.message_body : getMessagePreview(log.message_body)}</p>
                    {isReviewing && log.notes && <p style={styles.messageNote}>Notes: {log.notes}</p>}

                    <div style={styles.messageActionRow}>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => setReviewingMessageId(isReviewing ? null : log.id)}
                      >
                        Review Draft
                      </button>
                      <details style={styles.messageMore}>
                        <summary style={styles.messageMoreSummary}>More</summary>
                        <div style={styles.messageMoreGrid}>
                          <button type="button" style={styles.workflowSecondaryButton} onClick={() => copyToClipboard(log.message_body)}>
                            Copy Message
                          </button>
                          <button
                            type="button"
                            style={styles.workflowSecondaryButton}
                            disabled={messageSavingId === log.id}
                            onClick={() => markMessageLog(log, 'approved')}
                          >
                            Approve Draft
                          </button>
                          <button
                            type="button"
                            style={styles.workflowSecondaryButton}
                            disabled={messageSavingId === log.id}
                            onClick={() => markMessageLog(log, 'sent')}
                          >
                            Mark Sent
                          </button>
                          <button
                            type="button"
                            style={styles.workflowSecondaryButton}
                            disabled={messageSavingId === log.id || !log.recipient_email}
                            onClick={() => sendMessageEmail(log)}
                          >
                            Send Email
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                )
              })
            })()}

            <hr style={styles.divider} />

            <h3>Missing Info Requests</h3>
            {missingInfoRequests.length === 0 && <p style={styles.muted}>No missing-info request records yet.</p>}
            {missingInfoRequests.map((item) => {
              const flags = [
                item.missing_address ? 'address' : '',
                item.missing_photos ? 'photos' : '',
                item.missing_inspection_report ? 'inspection report' : '',
                item.missing_deadline ? 'deadline' : '',
                item.missing_access_info ? 'access info' : '',
                item.missing_scope_clarity ? 'scope clarity' : '',
              ].filter(Boolean)

              return (
                <div key={item.id} style={styles.requestCard}>
                  <strong>{getRequestLabel(item.lead_id)}</strong>
                  <p style={styles.small}>Status: {item.status || 'draft'} • Auto-send safe: {item.auto_send_allowed ? 'Yes' : 'No'}</p>
                  <p style={styles.small}>Missing: {flags.join(', ') || 'None listed'}</p>
                  {item.generated_message && <p style={styles.scopeText}>{item.generated_message}</p>}
                  <button
                    style={styles.outlineButton}
                    onClick={() => copyToClipboard(item.generated_message || '')}
                  >
                    Copy Request
                  </button>
                </div>
              )
            })}
          </section>
        )}

        {(hasAdminConsoleAccess || currentUserRole === 'contractor') && (activeTab === 'dashboard' || activeTab === 'properties') && (
          <>
            <section style={isCompact ? { ...styles.card, ...styles.mobileCard } : styles.card}>
              <div style={isCompact ? styles.mobileStack : styles.dashboardHero}>
                <div>
                  <span style={styles.workflowStage}>{activeTab === 'properties' ? 'Properties' : 'Dashboard'}</span>
                  <h2>{currentUserRole === 'contractor' && !hasAdminConsoleAccess ? 'My Assignments' : 'Property Work Queue'}</h2>
                  <p style={styles.muted}>
                    Start with the property, then move through photos, repair review, approval, routing, and reporting.
                  </p>
                </div>
                {hasAdminConsoleAccess && (
                  <button type="button" style={styles.primaryButton} onClick={() => setActiveTab('new')}>
                    Start New Request
                  </button>
                )}
              </div>

              {hasAdminConsoleAccess && (
                <div style={isCompact ? styles.mobileStack : styles.dashboardMetricGrid}>
                  <div style={styles.dashboardMetricCard}>
                    <strong>{activePropertyCount}</strong>
                    <span>Active Properties</span>
                  </div>
                  <div style={styles.dashboardMetricCard}>
                    <strong>{needsReviewRequests.length}</strong>
                    <span>Needs Review</span>
                  </div>
                  <div style={styles.dashboardMetricCard}>
                    <strong>{readyForActionRequests.length}</strong>
                    <span>Ready</span>
                  </div>
                  <div style={styles.dashboardMetricCard}>
                    <strong>{addressGroupedRequests.length}</strong>
                    <span>Address Groups</span>
                  </div>
                </div>
              )}

              {currentUserRole === 'contractor' && !hasAdminConsoleAccess ? (
                <p style={styles.muted}>Assigned property and work request details appear here when available.</p>
              ) : (
                <div style={isCompact ? styles.mobileStack : styles.grid2}>
                  <input
                    style={styles.input}
                    placeholder="Search requests"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <select
                    style={styles.input}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | RequestStatus)}
                  >
                    <option value="all">All Statuses</option>
                    {columns.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status].label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {currentUserRole === 'contractor' && !hasAdminConsoleAccess && (
              <section style={isCompact ? { ...styles.card, ...styles.mobileCard } : styles.card}>
                <h3>My Assignments</h3>
                {contractorAssignments.length === 0 ? (
                  <p style={styles.muted}>No active assignments are available for this contractor profile.</p>
                ) : (
                  <div style={styles.fileGrid}>
                    {contractorAssignments.map((assignment) => {
                      const notesDraft = contractorNotesByAssignment[assignment.id] ?? assignment.contractor_notes ?? ''
                      return (
                        <div key={assignment.id} style={styles.requestCard}>
                          <div style={styles.badgeRow}>
                            <span style={assignment.status === 'cancelled' ? styles.badgeDanger : styles.badge}>
                              {getLearningDisplayName(assignment.status)}
                            </span>
                            <span style={styles.badgeMuted}>
                              {assignment.work_request_id || assignment.property_id || 'Assigned work'}
                            </span>
                          </div>
                          {assignment.assignment_notes && <p style={styles.small}>Admin notes: {assignment.assignment_notes}</p>}
                          <textarea
                            style={{ ...styles.input, minHeight: 72 }}
                            placeholder="Contractor notes"
                            value={notesDraft}
                            onChange={(event) =>
                              setContractorNotesByAssignment((prev) => ({ ...prev, [assignment.id]: event.target.value }))
                            }
                          />
                          <div style={styles.buttonRow}>
                            {CONTRACTOR_UPDATABLE_ASSIGNMENT_STATUSES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                style={styles.outlineButton}
                                disabled={contractorAssignmentSavingId === assignment.id}
                                onClick={() => updateContractorAssignment(assignment, { status, contractor_notes: notesDraft })}
                              >
                                {getLearningDisplayName(status)}
                              </button>
                            ))}
                            <button
                              type="button"
                              style={styles.outlineButton}
                              disabled={contractorAssignmentSavingId === assignment.id}
                              onClick={() => updateContractorAssignment(assignment, { contractor_notes: notesDraft })}
                            >
                              Save Notes
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            <section style={isCompact ? { ...styles.kanban, ...styles.mobileKanban } : styles.kanban}>
              {filteredRequests.filter((request) =>
                currentUserRole === 'contractor' && !hasAdminConsoleAccess
                  ? contractorAssignments.some(
                      (assignment) =>
                        assignment.contractor_profile_id === currentUserId &&
                        (assignment.property_id === getRequestPropertyId(request) || assignment.work_request_id === request.id)
                    )
                  : true
              ).length === 0 && (
                <div style={styles.empty}>No requests match this search.</div>
              )}

              {dashboardSections.map((section) => {
                const items = section.items.filter((request) => {
                  if (currentUserRole !== 'contractor' || hasAdminConsoleAccess) return true
                  return contractorAssignments.some(
                    (assignment) =>
                      assignment.contractor_profile_id === currentUserId &&
                      (assignment.property_id === getRequestPropertyId(request) || assignment.work_request_id === request.id)
                  )
                })

                if (items.length === 0) return null

                return (
                  <div
                    key={section.title}
	                    style={{
	                      ...styles.column,
                        ...(isCompact ? styles.mobileColumn : {}),
	                      background: '#fbfcfa',
	                      border: '1px solid #d7dfd3',
	                    }}
                  >
                    <h3>
                      {section.title} ({items.length})
                    </h3>
                    <p style={styles.small}>{section.hint}</p>

                    {items.length === 0 && <div style={styles.empty}>No requests</div>}

                    {items.map((request) => {
                      const profile = propertyProfilesByLeadId[request.id]
                      const profileLoading = Boolean(propertyProfileLoadingByLeadId[request.id])
                      const profileError = propertyProfileErrorsByLeadId[request.id]
                      const workflow = getPropertyWorkflow(request)
                      const isEditingRequest = editingRequestId === request.id
                      const editDraft = requestEditDrafts[request.id] || createRequestEditDraft(request)
                      const noteDraft = adminNoteDrafts[request.id] || { noteType: 'internal' as AdminNoteType, body: '' }
                      const evidenceCount = getRequestEvidenceCount(request)
                      const needsReviewCount = getNeedsReviewCount(request)
                      const activeFindingCount = getActiveFindings(request).length
                      const activeResearchCount = getActiveResearchTasks(request).length
                      const workGroupCount = getInspectionWorkGroups(request).length

                      return (
	                      <div key={request.id} style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}>
                        <div style={styles.propertyCardHeader}>
                          <div style={{ flex: 1 }}>
	                          <strong style={isCompact ? { ...styles.mobileRequestTitle, flex: 1 } : { flex: 1 }}>{request.propertyAddress || 'Property address needed'}</strong>
                            <p style={styles.small}>{request.description || 'No request summary yet.'}</p>
                          </div>
                          {hasAdminConsoleAccess && (
                            <button
                              type="button"
                              style={styles.outlineButton}
                              onClick={() => (isEditingRequest ? setEditingRequestId(null) : startEditingRequest(request))}
                            >
                              {isEditingRequest ? 'Close Edit' : 'Edit'}
                            </button>
                          )}
                        </div>
                        <div style={styles.badgeRow}>
                          <span style={getOperationalStatusStyle(request.status)}>{STATUS_META[request.status].label}</span>
                          <span style={styles.badgeMuted}>{workflow.stage}</span>
                          <span style={styles.badgeMuted}>{workGroupCount} work groups</span>
                          <span style={styles.badgeMuted}>{evidenceCount} evidence</span>
                          <span style={needsReviewCount ? styles.badgeMuted : styles.badge}>{needsReviewCount} needs review</span>
                        </div>

                        <section style={styles.nextActionPanel}>
                          <strong>{workflow.title}</strong>
                          <p style={styles.small}>{workflow.body}</p>
                          <button
                            type="button"
                            style={styles.primaryButton}
                            disabled={workflow.disabled}
                            onClick={workflow.onPrimary}
                          >
                            {workflow.buttonLabel}
                          </button>
                        </section>

                        {renderAddressWorkGroups(request)}

                        {isEditingRequest && hasAdminConsoleAccess && (
                          <details style={styles.moreActions}>
                            <summary style={styles.moreActionsSummary}>Edit operational record</summary>
                            <div style={styles.grid2}>
                              <input
                                style={styles.input}
                                value={editDraft.propertyAddress}
                                placeholder="Property address"
                                onChange={(event) => updateRequestEditDraft(request.id, { propertyAddress: event.target.value })}
                              />
                              <select
                                style={styles.input}
                                value={editDraft.status}
                                onChange={(event) => updateRequestEditDraft(request.id, { status: event.target.value as RequestStatus })}
                              >
                                {columns.map((next) => (
                                  <option key={next} value={next}>{STATUS_META[next].label}</option>
                                ))}
                              </select>
                              <input
                                style={styles.input}
                                value={editDraft.workType}
                                placeholder="Request title / work type"
                                onChange={(event) => updateRequestEditDraft(request.id, { workType: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.urgency}
                                placeholder="Urgency"
                                onChange={(event) => updateRequestEditDraft(request.id, { urgency: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.occupancy}
                                placeholder="Occupancy"
                                onChange={(event) => updateRequestEditDraft(request.id, { occupancy: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.propertyType}
                                placeholder="Property type"
                                onChange={(event) => updateRequestEditDraft(request.id, { propertyType: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.jurisdiction}
                                placeholder="Jurisdiction"
                                onChange={(event) => updateRequestEditDraft(request.id, { jurisdiction: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.bedrooms}
                                placeholder="Beds"
                                onChange={(event) => updateRequestEditDraft(request.id, { bedrooms: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.bathrooms}
                                placeholder="Baths"
                                onChange={(event) => updateRequestEditDraft(request.id, { bathrooms: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.squareFeet}
                                placeholder="Square footage"
                                onChange={(event) => updateRequestEditDraft(request.id, { squareFeet: event.target.value })}
                              />
                              <input
                                style={styles.input}
                                value={editDraft.yearBuilt}
                                placeholder="Year built"
                                onChange={(event) => updateRequestEditDraft(request.id, { yearBuilt: event.target.value })}
                              />
                            </div>
                            <textarea
                              style={{ ...styles.input, minHeight: 92 }}
                              value={editDraft.description}
                              placeholder="Request title / description"
                              onChange={(event) => updateRequestEditDraft(request.id, { description: event.target.value })}
                            />
                            <textarea
                              style={{ ...styles.input, minHeight: 82 }}
                              value={editDraft.scopeInterpretation}
                              placeholder="Scope interpretation"
                              onChange={(event) => updateRequestEditDraft(request.id, { scopeInterpretation: event.target.value })}
                            />
                            <textarea
                              style={{ ...styles.input, minHeight: 82 }}
                              value={editDraft.missingInformation}
                              placeholder="Missing information"
                              onChange={(event) => updateRequestEditDraft(request.id, { missingInformation: event.target.value })}
                            />
                            <div style={styles.grid3}>
                              <textarea
                                style={{ ...styles.input, minHeight: 82 }}
                                value={editDraft.internalNotes}
                                placeholder="Internal notes"
                                onChange={(event) => updateRequestEditDraft(request.id, { internalNotes: event.target.value })}
                              />
                              <textarea
                                style={{ ...styles.input, minHeight: 82 }}
                                value={editDraft.agentFacingNotes}
                                placeholder="Agent-facing notes"
                                onChange={(event) => updateRequestEditDraft(request.id, { agentFacingNotes: event.target.value })}
                              />
                              <textarea
                                style={{ ...styles.input, minHeight: 82 }}
                                value={editDraft.contractorFacingNotes}
                                placeholder="Contractor-facing notes"
                                onChange={(event) => updateRequestEditDraft(request.id, { contractorFacingNotes: event.target.value })}
                              />
                            </div>
                            <button
                              type="button"
                              style={styles.primaryButton}
                              disabled={requestSavingId === request.id}
                              onClick={() => saveRequestEdits(request)}
                            >
                              {requestSavingId === request.id ? 'Saving...' : 'Save Operational Record'}
                            </button>
                          </details>
                        )}

                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>Notes ({request.adminNotes?.length || 0})</summary>
                        <section style={styles.noticeBox}>
                          <strong>Admin Notes</strong>
                          {request.adminNotes?.length ? (
                            <ul style={styles.smallList}>
                              {request.adminNotes.slice(0, 4).map((note) => (
                                <li key={note.id}>
                                  <div style={styles.grid2}>
                                    <select
                                      style={styles.input}
                                      value={note.noteType}
                                      disabled={!hasAdminConsoleAccess || requestSavingId === request.id}
                                      onChange={(event) => updateAdminNote(request, note.id, { noteType: event.target.value as AdminNoteType })}
                                    >
                                      <option value="internal">Internal</option>
                                      <option value="agent-facing">Agent-facing</option>
                                      <option value="contractor-facing">Contractor-facing</option>
                                    </select>
                                    <span style={styles.small}>
                                      {note.authorLabel || 'Admin'} - {new Date(note.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <textarea
                                    style={{ ...styles.input, minHeight: 64 }}
                                    defaultValue={note.body}
                                    disabled={!hasAdminConsoleAccess || requestSavingId === request.id}
                                    onBlur={(event) => updateAdminNote(request, note.id, { body: event.target.value })}
                                  />
                                  {hasAdminConsoleAccess && (
                                    <button
                                      type="button"
                                      style={styles.outlineButton}
                                      disabled={requestSavingId === request.id}
                                      onClick={() => openNoteResearchSetup(note)}
                                    >
                                      Ask Agent to Research
                                    </button>
                                  )}
                                  {hasAdminConsoleAccess && openNoteResearchByNote[note.id] && (() => {
                                    const draft = getNoteResearchDraft(note)
                                    return (
                                      <div style={styles.noticeBox}>
                                        <strong>Source Research Setup</strong>
                                        <textarea
                                          style={{ ...styles.input, minHeight: 76 }}
                                          value={draft.question}
                                          placeholder="What should the agent find?"
                                          onChange={(event) => updateNoteResearchDraft(note.id, { question: event.target.value })}
                                        />
                                        <div style={isCompact ? styles.mobileStack : styles.grid2}>
                                          <select
                                            style={styles.input}
                                            value={draft.research_scope}
                                            onChange={(event) => updateNoteResearchDraft(note.id, { research_scope: event.target.value as AgentResearchScope })}
                                          >
                                            {AGENT_RESEARCH_SCOPES.map((scope) => (
                                              <option key={scope} value={scope}>{scope}</option>
                                            ))}
                                          </select>
                                          <select
                                            style={styles.input}
                                            value={draft.question_type}
                                            onChange={(event) => updateNoteResearchDraft(note.id, { question_type: event.target.value as AgentResearchQuestionType })}
                                          >
                                            {AGENT_RESEARCH_QUESTION_TYPES.map((type) => (
                                              <option key={type} value={type}>{type}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <p style={styles.small}>Research categories</p>
                                        {renderResearchCategoryControls(
                                          draft.research_categories,
                                          (next) => updateNoteResearchDraft(note.id, { research_categories: next })
                                        )}
                                        <div style={styles.buttonRow}>
                                          <button
                                            type="button"
                                            style={styles.outlineButton}
                                            disabled={agentResearchSavingId === `note-${note.id}` || !draft.question.trim()}
                                            onClick={() => askAgentToResearchAdminNote(request, note)}
                                          >
                                            {agentResearchSavingId === `note-${note.id}` ? 'Running Research...' : 'Run Research'}
                                          </button>
                                          <button
                                            type="button"
                                            style={styles.outlineButton}
                                            disabled={agentResearchSavingId === `note-${note.id}`}
                                            onClick={() => setOpenNoteResearchByNote((prev) => ({ ...prev, [note.id]: false }))}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  <br />
                                  {note.updatedAt && <span style={styles.small}>Edited {new Date(note.updatedAt).toLocaleString()}</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p style={styles.small}>No admin notes yet.</p>
                          )}

                          {hasAdminConsoleAccess && (
                            <>
                              <div style={styles.grid2}>
                                <select
                                  style={styles.input}
                                  value={noteDraft.noteType}
                                  onChange={(event) => updateAdminNoteDraft(request.id, { noteType: event.target.value as AdminNoteType })}
                                >
                                  <option value="internal">Internal</option>
                                  <option value="agent-facing">Agent-facing</option>
                                  <option value="contractor-facing">Contractor-facing</option>
                                </select>
                                <button
                                  type="button"
                                  style={styles.outlineButton}
                                  disabled={requestSavingId === request.id || !noteDraft.body.trim()}
                                  onClick={() => saveAdminNote(request)}
                                >
                                  Add Note
                                </button>
                              </div>
                              <textarea
                                style={{ ...styles.input, minHeight: 72 }}
                                value={noteDraft.body}
                                placeholder="Add admin note"
                                onChange={(event) => updateAdminNoteDraft(request.id, { body: event.target.value })}
                              />
                            </>
                          )}
                          <details style={styles.moreActions}>
                            <summary style={styles.moreActionsSummary}>
                              Research Tasks ({getActiveResearchTasks(request).length})
                            </summary>
                            {sourceResearchMessagesByRequest[request.id] && (
                              <p style={styles.small}>{sourceResearchMessagesByRequest[request.id]}</p>
                            )}
                            {getActiveResearchTasks(request).length === 0 ? (
                              <p style={styles.small}>No active research tasks.</p>
                            ) : (
                              <div style={styles.inspectionTaskGrid}>
                                {getActiveResearchTasks(request).map((task) => {
                                  const sources = agentResearchSourcesByTask[task.id] || []
                                  return (
                                    <div key={task.id} style={styles.inspectionTaskCard}>
                                      <div style={styles.badgeRow}>
                                        <span style={getOperationalStatusStyle(task.status)}>
                                          {getLearningDisplayName(task.status)}
                                        </span>
                                      </div>
                                      <strong>{task.question}</strong>
                                      <p style={styles.small}>
                                        {getResearchAnswerSummary(task)}
                                      </p>
                                      <p style={styles.small}>Next action: {getResearchNextStep(task)}</p>
                                      <details style={styles.moreActions}>
                                        <summary style={styles.moreActionsSummary}>Show details</summary>
                                        <div style={styles.noticeBox}>
                                          <p style={styles.small}>
                                            <strong>Draft answer:</strong> {task.answer_draft || 'No draft answer yet. Click Run Research.'}
                                          </p>
                                          <p style={styles.small}>
                                            <strong>Categories:</strong> {normalizeResearchCategories(task.research_categories, getSourceResearchDefaults(task.question_type, task.question)).join(', ')}
                                          </p>
                                          <p style={styles.small}>
                                            <strong>Evidence summary:</strong> {task.evidence_summary || 'No evidence summary drafted yet.'}
                                          </p>
                                          <p style={styles.small}>
                                            <strong>Missing information:</strong> {task.missing_information || 'No missing information listed yet.'}
                                          </p>
                                          <p style={styles.small}>
                                            <strong>Recommended next action:</strong> {task.recommended_next_action || 'Run research, then review before use.'}
                                          </p>
                                          <p style={styles.small}>
                                            <strong>Online source search requested:</strong> {task.online_search_requested ? 'Yes' : 'No'}
                                            {' '}
                                            <strong>Live source search performed:</strong> {task.online_search_performed ? 'Yes' : 'No'}
                                            {' '}<strong>Official sources:</strong> {task.official_sources_used ? 'Used' : 'Not used'}
                                            {' '}<strong>Supplier/material sources:</strong> {task.supplier_sources_used ? 'Used' : 'Not used'}
                                            {' '}<strong>Internal memory:</strong> {task.internal_memory_used ? 'Used' : 'Not used'}
                                          </p>
                                          {task.online_search_requested && !task.online_search_performed && (
                                            <p style={styles.small}>
                                              Online research was requested, but no live source search has been performed yet. This draft uses uploaded/property/admin-note context only.
                                            </p>
                                          )}
                                          {sources.length > 0 && (
                                            <ul style={styles.smallList}>
                                              {sources.map((source) => (
                                                <li key={source.id}>
                                                  {source.source_url ? (
                                                    <a href={source.source_url} target="_blank" rel="noreferrer">{source.source_title}</a>
                                                  ) : (
                                                    <span>{source.source_title}</span>
                                                  )}
                                                  {' '}({source.source_type}, {source.source_quality || 'unknown'})
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                          {sources.length === 0 && <p style={styles.small}>Source list: no source rows saved yet.</p>}
                                        </div>
                                      </details>
                                      <div style={styles.buttonRow}>
                                        {(task.status === 'queued' || task.status === 'draft' || !task.answer_draft) && (
                                          <button
                                            type="button"
                                            style={styles.primaryButton}
                                            disabled={agentResearchSavingId === task.id}
                                            onClick={() => runRequestAgentResearchTask(request, task)}
                                          >
                                            {agentResearchSavingId === task.id && task.status === 'researching' ? 'Researching...' : 'Run Research'}
                                          </button>
                                        )}
                                        {canApproveOperationalMemory(memoryActorRole) && (
                                          <>
                                            {task.answer_draft && task.status !== 'human_verified' && (
                                              <button
                                                type="button"
                                                style={styles.primaryButton}
                                                disabled={agentResearchSavingId === task.id}
                                                onClick={() => saveAgentResearchTask(task, { status: 'human_verified' })}
                                              >
                                                Human Verify
                                              </button>
                                            )}
                                            {task.status !== 'rejected' && (
                                              <button
                                                type="button"
                                                style={styles.outlineButton}
                                                disabled={agentResearchSavingId === task.id}
                                                onClick={() => saveAgentResearchTask(task, { status: 'rejected' })}
                                              >
                                                Reject
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {getArchivedResearchTasks(request).length > 0 && (
                              <details style={styles.moreActions}>
                                <summary style={styles.moreActionsSummary}>Rejected / Archived ({getArchivedResearchTasks(request).length})</summary>
                                <ul style={styles.smallList}>
                                  {getArchivedResearchTasks(request).map((task) => (
                                    <li key={`archived-task-${task.id}`}>{task.question}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </details>
                        </section>
                        </details>

                        {request.propertyFacts && (
                          <details style={styles.moreActions}>
                            <summary style={styles.moreActionsSummary}>Property</summary>
	                          <div style={isCompact ? { ...styles.propertyProfileCard, ...styles.mobilePropertyProfileCard } : styles.propertyProfileCard}>
	                            <strong>Verified Property Profile</strong>
	                            <div style={isCompact ? { ...styles.compactFactGrid, ...styles.mobileCompactFactGrid } : styles.compactFactGrid}>
                              <span>Beds: {profile?.beds || request.propertyFacts.bedrooms || 'TBD'}</span>
                              <span>Baths: {profile?.baths || request.propertyFacts.bathrooms || 'TBD'}</span>
                              <span>Sq ft: {profile?.sqft || request.propertyFacts.squareFeet || 'TBD'}</span>
                              <span>Built: {profile?.yearBuilt || request.propertyFacts.yearBuilt || 'TBD'}</span>
                              <span>Type: {profile?.propertyType || request.propertyFacts.propertyType || 'TBD'}</span>
                              <span>Jurisdiction: {profile?.jurisdiction || request.propertyFacts.jurisdiction || 'Review'}</span>
                            </div>
                            {profileLoading && <p style={styles.small}>Loading property profile...</p>}
                            {profileError && (
                              <p style={styles.small}>Property lookup failed: {profileError}</p>
                            )}
                            {request.propertyFacts.verificationNotes && (
                              <p style={styles.small}>Notes: {request.propertyFacts.verificationNotes}</p>
                            )}
                            <div style={styles.buttonRow}>
	                              <button
	                                type="button"
	                                style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                                disabled={profileLoading}
                                onClick={() => refreshLeadPropertyProfile(request, true)}
                              >
                                Refresh Property Profile
                              </button>
                              {buildPropertyResearchPack(
                                request.propertyAddress,
                                request.city,
                                request.state,
                                request.zip
                              ).links.slice(0, 3).map((link) => (
	                                <button
	                                  key={`${request.id}-${link.label}`}
	                                  type="button"
	                                  style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                                  onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                                >
                                  {link.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          </details>
                        )}

                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>Uploaded Evidence ({evidenceCount})</summary>
                          {renderUploadedEvidence(request)}
                        </details>
	
                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>Scope Interpretation</summary>
                          {request.scopeInterpretation || request.missingInformation ? (
                            <div style={styles.noticeBox}>
                              {request.scopeInterpretation && <p style={styles.small}>{request.scopeInterpretation}</p>}
                              {request.missingInformation && <p style={styles.small}>Missing: {request.missingInformation}</p>}
                            </div>
                          ) : (
                            <p style={styles.small}>No scope interpretation yet.</p>
                          )}
                          {renderInspectionProcessing(request)}
                        </details>

                        {activeFindingCount > 0 && (
                          <details style={styles.moreActions}>
                            <summary style={styles.moreActionsSummary}>Evidence Findings ({activeFindingCount})</summary>
	                          {renderSiteMediaIntelligence(request)}
                          </details>
                        )}

                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>Research Tasks ({activeResearchCount})</summary>
                          {activeResearchCount === 0 ? (
                            <p style={styles.small}>No active research tasks.</p>
                          ) : (
                            <div style={styles.inspectionTaskGrid}>
                              {getActiveResearchTasks(request).map((task) => (
                                <div key={`property-research-${task.id}`} style={styles.inspectionTaskCard}>
                                  <div style={styles.badgeRow}>
                                    <span style={getOperationalStatusStyle(task.status)}>{getLearningDisplayName(task.status)}</span>
                                  </div>
                                  <strong>{task.question}</strong>
                                  <p style={styles.small}>{getResearchAnswerSummary(task)}</p>
                                  <p style={styles.small}>Next action: {getResearchNextStep(task)}</p>
                                  <details style={styles.moreActions}>
                                    <summary style={styles.moreActionsSummary}>Show details</summary>
                                    <p style={styles.small}>{task.evidence_summary || 'No evidence summary drafted yet.'}</p>
                                    <p style={styles.small}>{task.missing_information || 'No missing information listed.'}</p>
                                    <p style={styles.small}>{task.recommended_next_action || 'Review before use.'}</p>
                                  </details>
                                </div>
                              ))}
                            </div>
                          )}
                        </details>

                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>History / Archived</summary>
	                        {renderPropertyWorkflowCard(request)}
                        </details>

                        {hasAdminConsoleAccess && (
                          <details style={styles.moreActions}>
                            <summary style={styles.moreActionsSummary}>History / Advanced</summary>
                            <select
                              style={styles.input}
                              value={request.status}
                              onChange={(e) => updateStatus(request.id, e.target.value as RequestStatus)}
                            >
                              {columns.map((next) => (
                                <option key={next} value={next}>
                                  {STATUS_META[next].label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              style={{
                                ...styles.outlineButton,
                                width: '100%',
                                borderColor: '#c9a9a9',
                                color: '#8a2f2f',
                                marginTop: 10,
                              }}
                              onClick={() => archiveLead(request)}
                            >
                              Archive Lead
                            </button>
                          </details>
                        )}
                      </div>
                      )
                    })}
                  </div>
                )
              })}
            </section>
          </>
        )}


        {hasAdminConsoleAccess && activeTab === 'reports' && (
          <section style={styles.card}>
            <div style={isCompact ? styles.mobileStack : styles.dashboardHero}>
              <div>
                <span style={styles.workflowStage}>Reports</span>
                <h2>Report and Learning Queue</h2>
                <p style={styles.muted}>
                  Review properties that are ready to package, send for review, or feed back into pricing and field learning.
                </p>
              </div>
              <button type="button" style={styles.primaryButton} onClick={() => readyForActionRequests[0] ? exportJobPacket(readyForActionRequests[0]) : setActiveTab('properties')}>
                {readyForActionRequests[0] ? 'Generate Report' : 'Review Properties'}
              </button>
            </div>

            <div style={isCompact ? styles.mobileStack : styles.grid3}>
              <div style={styles.fileBox}>
                <strong>Ready</strong>
                <p style={styles.small}>{readyForActionRequests.length} properties are ready for report, packet, or routing review.</p>
              </div>
              <div style={styles.fileBox}>
                <strong>Needs Review</strong>
                <p style={styles.small}>{needsReviewRequests.length} properties still need human review or missing information.</p>
              </div>
              <div style={styles.fileBox}>
                <strong>Learning Sources</strong>
                <p style={styles.small}>Pricing memory, field lessons, gallery evidence, and invoices remain under More / Admin Tools.</p>
              </div>
            </div>
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'settings' && (
          <section style={styles.card}>
            <span style={styles.workflowStage}>Settings</span>
            <h2>Admin Settings</h2>
            <p style={styles.muted}>
              Admin and security settings are preserved here so operational tools stay available without crowding the daily workflow.
            </p>
            <div style={styles.healthGrid}>
              <div style={styles.healthRow}>
                <span>Supabase</span>
                <strong style={isSupabaseConfigured ? styles.healthOk : styles.healthNeedsSetup}>
                  {isSupabaseConfigured ? 'Connected' : 'Needs setup'}
                </strong>
              </div>
              <div style={styles.healthRow}>
                <span>Signed-in role</span>
                <strong>{memoryActorRole}</strong>
              </div>
              <div style={styles.healthRow}>
                <span>Admin console</span>
                <strong style={hasAdminConsoleAccess ? styles.healthOk : styles.healthNeedsSetup}>
                  {hasAdminConsoleAccess ? 'Available' : 'Locked'}
                </strong>
              </div>
            </div>
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'archived' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Archived Leads</h2>
                <p style={styles.muted}>
                  Archived leads are hidden from the Dashboard, but their files, estimates,
                  messages, and research stay saved in Supabase.
                </p>
              </div>

              <button
                type="button"
                style={styles.outlineButton}
                disabled={archivedLoading}
                onClick={loadArchivedRequestsFromSupabase}
              >
                {archivedLoading ? 'Loading...' : 'Refresh Archived'}
              </button>
            </div>

            <input
              style={styles.input}
              placeholder="Search archived leads"
              value={archivedSearch}
              onChange={(e) => setArchivedSearch(e.target.value)}
            />

            {filteredArchivedRequests.length === 0 ? (
              <div style={styles.empty}>No archived leads found.</div>
            ) : (
              <div style={styles.fileGrid}>
                {filteredArchivedRequests.map((request) => (
                  <div key={request.id} style={styles.requestCard}>
                    <strong>{request.propertyAddress || 'Untitled lead'}</strong>

                    <p style={styles.small}>
                      {request.city}, {request.state} {request.zip}
                    </p>

                    <p style={styles.small}>
                      {request.requesterName || 'No name'} • {request.email || 'No email'}
                    </p>

                    <p style={styles.small}>
                      Status before archive: {STATUS_META[request.status]?.label || request.status}
                    </p>

                    <p style={styles.small}>
                      Archived: {request.archivedAt ? new Date(request.archivedAt).toLocaleString() : 'Unknown date'}
                    </p>

                    {request.archiveReason && (
                      <p style={styles.small}>Reason: {request.archiveReason}</p>
                    )}

                    <p>{request.description || 'No description saved.'}</p>

                    <button
                      type="button"
                      style={styles.primaryButton}
                      disabled={restoringId === request.id}
                      onClick={() => restoreArchivedLead(request)}
                    >
                      {restoringId === request.id ? 'Restoring...' : 'Restore to Dashboard'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'invoices' && (
          <section style={styles.card}>
            <h2>Invoice Upload + AI Extraction</h2>

            <input
              style={styles.input}
              placeholder="Vendor name"
              value={invoiceVendor}
              onChange={(e) => setInvoiceVendor(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Property address"
              value={invoiceAddress}
              onChange={(e) => setInvoiceAddress(e.target.value)}
            />

            <input
              style={styles.input}
              type="file"
              accept="application/pdf"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />

            <button style={styles.primaryButton} disabled={invoiceUploading} onClick={uploadInvoice}>
              {invoiceUploading ? 'Uploading...' : 'Upload Invoice'}
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              disabled={invoiceLoading}
              onClick={loadInvoices}
            >
              {invoiceLoading ? 'Loading...' : 'Refresh'}
            </button>

            <div style={{ marginTop: 20 }}>
              {invoices.length === 0 && <p style={styles.muted}>No invoices uploaded yet.</p>}

              {invoices.map((invoice) => {
                const analysis = invoiceAnalyses[invoice.id]

                return (
                  <div key={invoice.id} style={styles.requestCard}>
                    <strong>{invoice.file_name}</strong>
                    <p style={styles.small}>Vendor: {invoice.vendor_name || 'Not entered'}</p>
                    <p style={styles.small}>Property: {invoice.property_address || 'Not entered'}</p>
                    <p style={styles.small}>Invoice #: {invoice.invoice_number || 'Not extracted yet'}</p>
                    <p style={styles.small}>Status: {invoice.extraction_status || 'pending'}</p>
                    <p style={styles.small}>Subtotal: {money(invoice.subtotal)}</p>
                    <p style={styles.small}>Tax: {money(invoice.tax)}</p>
                    <p style={styles.small}>Total: {money(invoice.total)}</p>

                    {invoice.extraction_error && (
                      <p style={{ ...styles.small, color: '#b42318' }}>
                        Error: {invoice.extraction_error}
                      </p>
                    )}

                    {invoiceFileUrls[invoice.id] ? (
                      <a href={invoiceFileUrls[invoice.id]} target="_blank" rel="noreferrer">
                        Open / Download PDF
                      </a>
                    ) : (
                      <p style={styles.small}>File unavailable until a signed URL can be generated.</p>
                    )}

                    <button
                      style={styles.wideButton}
                      disabled={extractingInvoiceId === invoice.id}
                      onClick={() => extractInvoiceData(invoice.id)}
                    >
                      {extractingInvoiceId === invoice.id
                        ? 'Extracting...'
                        : 'Extract Invoice Data'}
                    </button>

                    <button
                      style={styles.wideButton}
                      disabled={analyzingInvoiceId === invoice.id}
                      onClick={() => analyzeInvoiceCosts(invoice.id)}
                    >
                      {analyzingInvoiceId === invoice.id
                        ? 'Analyzing...'
                        : 'Analyze Invoice Costs'}
                    </button>

                    {analysis && (
                      <div style={styles.aiBox}>
                        <strong>Cost Analysis: {analysis.risk_level || 'unknown'} risk</strong>
                        <p>{analysis.summary}</p>
                        <p style={styles.small}>{analysis.client_summary}</p>
                        <p style={styles.small}>
                          Overcharge flags: {countItems(analysis.overcharge_flags)} • Scope gaps:{' '}
                          {countItems(analysis.scope_gaps)} • Pricing risks:{' '}
                          {countItems(analysis.pricing_risks)}
                        </p>

                        {Array.isArray(analysis.recommended_actions) && analysis.recommended_actions.length > 0 && (
                          <ul style={styles.smallList}>
                            {analysis.recommended_actions.map((action, index) => (
                              <li key={`${analysis.id}-action-${index}`}>{action}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'history' && (
          <Suspense fallback={<div style={styles.empty}>Loading history...</div>}>
            <HistoricalUpload />
          </Suspense>
        )}

        {hasAdminConsoleAccess && activeTab === 'sellerPrep' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Seller Prep Intelligence V1</h2>
                <p style={styles.muted}>
                  Rule-based draft for seller-prep scope, buyer impact, inspection risk, and net-impact notes.
                  Powered by AI-style logic. Approved by humans.
                </p>
              </div>
              <select
                style={{ ...styles.input, maxWidth: 360, marginBottom: 0 }}
                value={sellerPrepSelectedRequest?.id || ''}
                onChange={(event) => {
                  const next = requests.find((request) => request.id === event.target.value)
                  if (next) loadSellerPrepDraftForRequest(next)
                }}
              >
                <option value="">Select lead</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.propertyAddress || request.description.slice(0, 50) || request.id}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.noticeBox}>
              Safety rule: final report/send actions stay disabled until a human approves the Seller Prep analysis.
              This V1 draft does not send emails, submit proposals, order materials, approve contractor bids, or make final decisions.
            </div>

            {sellerPrepSelectedRequest ? (
              <>
                <div style={styles.requestCard}>
                  <strong>{sellerPrepSelectedRequest.propertyAddress || 'Untitled property'}</strong>
                  <p style={styles.small}>
                    {sellerPrepSelectedRequest.city}, {sellerPrepSelectedRequest.state} {sellerPrepSelectedRequest.zip} •{' '}
                    {sellerPrepSelectedRequest.workType}
                  </p>
                  <p>{sellerPrepSelectedRequest.description}</p>
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={() => runSellerPrepDraftV1(sellerPrepSelectedRequest)}
                    >
                      Run Seller Prep Draft
                    </button>
                    <button
                      type="button"
                      style={styles.outlineButton}
                      onClick={() => loadSellerPrepDraftForRequest(sellerPrepSelectedRequest)}
                    >
                      Load Latest Draft
                    </button>
                  </div>
                </div>

                {sellerPrepAnalysisV1 && (
                  <div style={styles.aiBox}>
                    <div style={styles.buttonRow}>
                      <div style={{ flex: 1 }}>
                        <strong>Property Summary</strong>
                        <p>{sellerPrepAnalysisV1.summary}</p>
                        <p>
                          Total prep range: {money(sellerPrepAnalysisV1.total_low_estimate)} -{' '}
                          {money(sellerPrepAnalysisV1.total_high_estimate)}
                        </p>
                        <p>Seller net impact: {sellerPrepAnalysisV1.seller_net_impact}</p>
                        <p style={styles.small}>
                          Confidence: {sellerPrepAnalysisV1.confidence || 'draft'} • Human review:{' '}
                          {sellerPrepAnalysisV1.human_review_status}
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={markSellerPrepAnalysisApproved}
                        disabled={isHumanVerifiedStatus(sellerPrepAnalysisV1.human_review_status)}
                      >
                        Mark Analysis Human Verified
                      </button>
                    </div>

                    <div style={styles.noticeBox}>
                      Final Report / Send buttons:{' '}
                      <strong>
                        {isHumanVerifiedStatus(sellerPrepAnalysisV1.human_review_status)
                          ? 'Enabled for future report workflow'
                          : 'Disabled until human verified'}
                      </strong>
                    </div>
                  </div>
                )}

                <div style={styles.inspectionTaskPanel}>
                  <div style={styles.buttonRow}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginTop: 0 }}>Inspection Task Intelligence</h3>
                      <p style={styles.small}>
                        Doctrine path: inspection item -&gt; risk -&gt; trade -&gt; missing evidence -&gt; next task.
                        All records are AI Draft or Needs Review until a human approves them elsewhere.
                      </p>
                    </div>
                    <span style={styles.badgeMuted}>Admin review</span>
                  </div>

                  {inspectionTaskIntelligence.length === 0 ? (
                    <div style={styles.empty}>
                      No inspection report or inspection-related file detected for this selected lead yet.
                    </div>
                  ) : (
                    <div style={styles.inspectionTaskGrid}>
                      {inspectionTaskIntelligence.map((task) => (
                        <div key={task.id} style={styles.inspectionTaskCard}>
                          <div style={styles.buttonRow}>
                            <div style={{ flex: 1 }}>
                              <strong>{task.task_title}</strong>
                              <p style={styles.small}>{task.defect_concern}</p>
                            </div>
                            <span style={styles.badgeDanger}>{task.risk_level}</span>
                            <span style={styles.badgeMuted}>{task.human_review_status || 'needs_review'}</span>
                          </div>

                          <div style={styles.grid3}>
                            <div style={styles.factCard}>
                              <small>Building system</small>
                              <strong>{task.building_system}</strong>
                            </div>
                            <div style={styles.factCard}>
                              <small>Trade needed</small>
                              <strong>{task.trade_needed}</strong>
                            </div>
                            <div style={styles.factCard}>
                              <small>Urgency</small>
                              <strong>{task.urgency}</strong>
                            </div>
                          </div>

                          <div style={styles.grid2}>
                            <div>
                              <strong>Missing information needed</strong>
                              <ul style={styles.smallList}>
                                {task.missing_information_needed.map((item, index) => (
                                  <li key={`${task.id}-missing-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <strong>Photo requests</strong>
                              <ul style={styles.smallList}>
                                {task.photo_requests.map((item, index) => (
                                  <li key={`${task.id}-photo-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div style={styles.noticeBox}>
                            <strong>Recommended next action:</strong> {task.recommended_next_action}
                            <br />
                            <strong>Source:</strong> {task.source_label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {sellerPrepItemsV1.length === 0 ? (
                  <div style={styles.empty}>No Seller Prep draft loaded yet.</div>
                ) : (
                  sellerPrepItemsV1.map((item) => (
                    <div key={item.id} style={styles.requestCard}>
                      <div style={styles.grid3}>
                        <div>
                          <strong>{item.repair_item}</strong>
                          <p style={styles.small}>{item.trade_category || 'General'} • {item.recommendation || 'needs review'}</p>
                        </div>
                        <div>
                          <strong>Buyer Impact</strong>
                          <p style={styles.small}>{item.buyer_impact_score || 0}/10</p>
                        </div>
                        <div>
                          <strong>Inspection Risk</strong>
                          <p style={styles.small}>{item.inspection_risk_score || 0}/10</p>
                        </div>
                      </div>

                      <div style={styles.grid3}>
                        <input
                          style={styles.input}
                          type="number"
                          value={Number(item.estimated_low || 0)}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { estimated_low: Number(event.target.value) })}
                        />
                        <input
                          style={styles.input}
                          type="number"
                          value={Number(item.estimated_high || 0)}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { estimated_high: Number(event.target.value) })}
                        />
                        <select
                          style={styles.input}
                          value={item.human_review_status || 'needs_review'}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { human_review_status: event.target.value })}
                        >
                          <option value="needs_review">needs_review</option>
                          <option value="human_verified">human_verified</option>
                          <option value="deprecated">deprecated</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>

                      <input
                        style={styles.input}
                        value={item.recommendation || ''}
                        placeholder="Recommendation"
                        onChange={(event) => updateSellerPrepItemLocal(item.id, { recommendation: event.target.value })}
                      />

                      <p style={styles.small}>Missing info: {item.missing_info || 'None obvious'}</p>
                      <p style={styles.small}>Notes: {item.ai_notes || 'No notes.'}</p>

                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          disabled={sellerPrepSavingId === item.id}
                          onClick={() => saveSellerPrepItem(item)}
                        >
                          {sellerPrepSavingId === item.id ? 'Saving...' : 'Save Item'}
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          onClick={() => saveSellerPrepItemAsPricingMemory(item)}
                          disabled={!isHumanVerifiedStatus(item.human_review_status)}
                        >
                          Approve as Pricing Memory
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div style={styles.empty}>No leads loaded yet.</div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'pricingMemory' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Pricing Memory</h2>
                <p style={styles.muted}>
                  Human-verified prices saved from Seller Prep and historical/project review.
                </p>
              </div>
              <button type="button" style={styles.outlineButton} disabled={pricingMemoryLoading} onClick={loadPricingMemoryEntries}>
                {pricingMemoryLoading ? 'Loading...' : 'Refresh Pricing Memory'}
              </button>
            </div>

            {pricingMemoryEntries.length === 0 ? (
              <div style={styles.empty}>No pricing memory yet. Approve a Seller Prep item first.</div>
            ) : (
              <div style={styles.fileGrid}>
                {pricingMemoryEntries.map((entry) => (
                  <div key={entry.id} style={styles.requestCard}>
                    <strong>{entry.item_name || 'Unnamed pricing item'}</strong>
                    <p style={styles.small}>
                      {entry.category || 'seller_prep'} • {entry.unit || 'project'} • ZIP {entry.zip || 'not set'}
                    </p>
                    <p>Verified price: {money(entry.verified_price)}</p>
                    <p style={styles.small}>Source: {entry.source || 'not set'}</p>
                    <p style={styles.small}>
                      Human verified: {entry.human_verified ? 'Yes' : 'No'} • Last checked:{' '}
                      {entry.last_checked ? new Date(entry.last_checked).toLocaleDateString() : 'not set'}
                    </p>
                    {entry.notes && <p style={styles.small}>Notes: {entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'materials' && (
          <section style={styles.card}>
            <h2>Material Cost Review</h2>
            <p style={styles.muted}>
              Review AI-found, database, and fallback material costs. Approving a price saves
              your judgment as pricing memory so future estimates can reuse it first.
            </p>

            <div style={styles.noticeBox}>
              Confidence labels: <strong>database_verified</strong> = you approved it,{' '}
              <strong>database_review</strong> = saved draft from database,{' '}
              <strong>medium</strong> = AI saw a visible web price,{' '}
              <strong>needs_review</strong> = uncertain AI/web price, and{' '}
              <strong>fallback_review</strong> = rough fallback price used.
            </div>

            <button
              style={styles.primaryButton}
              disabled={materialUpdating}
              onClick={updateMaterialCostsNow}
            >
              {materialUpdating ? 'Updating...' : 'Update Market Data'}
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              disabled={materialLoading}
              onClick={loadMaterials}
            >
              {materialLoading ? 'Loading...' : 'Refresh Material Database'}
            </button>

            <hr style={styles.divider} />

            <h3>Add Manual Draft Cost</h3>
            <p style={styles.small}>
              Optional. You can still let the AI agent add most draft prices automatically.
            </p>

            <input
              style={styles.input}
              placeholder="Material name, ex: concrete deck block"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Category, ex: Concrete / Lumber / Hardware"
              value={materialCategory}
              onChange={(e) => setMaterialCategory(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Unit, ex: each / bag / sqft"
              value={materialUnit}
              onChange={(e) => setMaterialUnit(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Typical price"
              value={materialPrice}
              onChange={(e) => setMaterialPrice(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Source, ex: Home Depot / Lowe's / local supplier"
              value={materialSource}
              onChange={(e) => setMaterialSource(e.target.value)}
            />

            <button style={styles.primaryButton} onClick={addMaterialCost}>
              Add Draft Material Cost
            </button>

            <hr style={styles.divider} />

            <h3>Review Saved Material Costs</h3>

            <div style={{ marginTop: 16 }}>
              {materials.length === 0 && (
                <p style={styles.muted}>
                  No material costs yet. Run AI Research Materials on a job first, then refresh this screen.
                </p>
              )}

              {materials.map((item) => {
                const itemName = getMaterialName(item)
                const typicalPrice = getMaterialTypicalPrice(item)
                const confidence = getConfidenceLabel(item.confidence, item.human_verified)
                const lowPrice = item.low_price ?? null
                const highPrice = item.high_price ?? null
                const isVerified = Boolean(item.human_verified)

                return (
                  <div
                    key={item.id}
                    style={{
                      ...styles.requestCard,
                      border: isVerified ? '2px solid #0f542d' : '1px solid #d7dfd3',
                      background: isVerified ? '#f1fbf2' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{itemName}</strong>
                        <p style={styles.small}>
                          {item.category || 'Material'} • {item.unit || 'each'} • ZIP:{' '}
                          {item.zip || item.region || 'Not set'}
                        </p>
                      </div>

                      <div
                        style={{
                          background: isVerified ? '#0f542d' : '#fff8e8',
                          color: isVerified ? 'white' : '#6f4f14',
                          borderRadius: 999,
                          padding: '8px 12px',
                          fontWeight: 900,
                          fontSize: 12,
                          height: 'fit-content',
                        }}
                      >
                        {confidence}
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Low</strong>
                        <p>{money(lowPrice)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Typical</strong>
                        <p>{money(typicalPrice)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>High</strong>
                        <p>{money(highPrice)}</p>
                      </div>
                    </div>

                    <p style={styles.small}>
                      Source: {item.store_name || item.source || 'Not entered'}
                      {item.source_url ? ' • ' : ''}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          Open source
                        </a>
                      )}
                    </p>

                    <p style={styles.small}>
                      Last checked: {item.last_checked || item.updated_at || 'Not set'}
                    </p>

                    {item.notes && <p style={styles.small}>{item.notes}</p>}

                    <div style={styles.buttonRow}>
                      <button
                        style={styles.outlineButton}
                        disabled={materialSavingId === item.id}
                        onClick={() => editMaterialCost(item)}
                      >
                        {materialSavingId === item.id ? 'Saving...' : 'Edit / Save Price'}
                      </button>

                      <button
                        style={styles.primaryButton}
                        disabled={materialSavingId === item.id || isVerified}
                        onClick={() => approveMaterialCost(item)}
                      >
                        {isVerified ? 'Verified' : 'Approve as Verified'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'labor' && (
          <section style={styles.card}>
            <h2>Labor Rate Review</h2>
            <p style={styles.muted}>
              Review and approve labor rates by trade, job type, unit, ZIP, and region.
              This becomes labor memory so estimates can use your verified rates instead
              of guessing.
            </p>

            <div style={styles.noticeBox}>
              Confidence labels: <strong>labor_verified</strong> = you approved it,{' '}
              <strong>labor_review</strong> = draft rate that needs review, and{' '}
              <strong>needs_review</strong> = incomplete or uncertain rate. AI can draft,
              but human approval is required before any proposal, estimate, purchase order,
              email, or submission is sent.
            </div>

            <button
              style={styles.outlineButton}
              disabled={laborLoading}
              onClick={loadLaborRates}
            >
              {laborLoading ? 'Loading...' : 'Refresh Labor Rates'}
            </button>

            <hr style={styles.divider} />

            <h3>Add Manual Draft Labor Rate</h3>
            <p style={styles.small}>
              Use this for local rates you know. Later the AI estimator can pull from this
              table when building the labor side of estimates.
            </p>

            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Trade, ex: Roofing / Decking / Painting"
                value={laborTrade}
                onChange={(e) => setLaborTrade(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Job type, ex: roof repair / deck framing"
                value={laborJobType}
                onChange={(e) => setLaborJobType(e.target.value)}
              />
            </div>

            <div style={styles.grid3}>
              <input
                style={styles.input}
                placeholder="Unit, ex: hour / sqft / day / fixed"
                value={laborUnit}
                onChange={(e) => setLaborUnit(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Typical rate"
                value={laborTypicalRate}
                onChange={(e) => setLaborTypicalRate(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Region, ex: Portland Metro"
                value={laborRegion}
                onChange={(e) => setLaborRegion(e.target.value)}
              />
            </div>

            <div style={styles.grid3}>
              <input
                style={styles.input}
                placeholder="Minimum charge"
                value={laborMinimumCharge}
                onChange={(e) => setLaborMinimumCharge(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Trip charge"
                value={laborTripCharge}
                onChange={(e) => setLaborTripCharge(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Disposal fee"
                value={laborDisposalFee}
                onChange={(e) => setLaborDisposalFee(e.target.value)}
              />
            </div>

            <button style={styles.primaryButton} onClick={addLaborRate}>
              Add Draft Labor Rate
            </button>

            <hr style={styles.divider} />

            <h3>Review Saved Labor Rates</h3>

            <div style={{ marginTop: 16 }}>
              {laborRates.length === 0 && (
                <p style={styles.muted}>
                  No labor rates yet. Add a few draft rates for your local market, then
                  approve them as verified when you are comfortable using them.
                </p>
              )}

              {laborRates.map((rate) => {
                const isVerified = Boolean(rate.human_verified)
                const confidence = getLaborConfidenceLabel(rate.confidence, rate.human_verified)

                return (
                  <div
                    key={rate.id}
                    style={{
                      ...styles.requestCard,
                      border: isVerified ? '2px solid #0f542d' : '1px solid #d7dfd3',
                      background: isVerified ? '#f1fbf2' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{rate.trade}</strong>
                        <p style={styles.small}>
                          {rate.job_type || 'General'} • {rate.unit || 'hour'} • ZIP:{' '}
                          {rate.zip || rate.region || 'Not set'}
                        </p>
                      </div>

                      <div
                        style={{
                          background: isVerified ? '#0f542d' : '#fff8e8',
                          color: isVerified ? 'white' : '#6f4f14',
                          borderRadius: 999,
                          padding: '8px 12px',
                          fontWeight: 900,
                          fontSize: 12,
                          height: 'fit-content',
                        }}
                      >
                        {confidence}
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Low</strong>
                        <p>{money(rate.low_rate)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Typical</strong>
                        <p>{money(rate.typical_rate)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>High</strong>
                        <p>{money(rate.high_rate)}</p>
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Minimum</strong>
                        <p>{money(rate.minimum_charge)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Trip</strong>
                        <p>{money(rate.trip_charge)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Disposal</strong>
                        <p>{money(rate.disposal_fee)}</p>
                      </div>
                    </div>

                    <p style={styles.small}>
                      Source: {rate.source || 'Shelter Prep'} • Last checked:{' '}
                      {rate.last_checked || rate.updated_at || 'Not set'}
                    </p>

                    {rate.notes && <p style={styles.small}>{rate.notes}</p>}

                    <div style={styles.buttonRow}>
                      <button
                        style={styles.outlineButton}
                        disabled={laborSavingId === rate.id}
                        onClick={() => editLaborRate(rate)}
                      >
                        {laborSavingId === rate.id ? 'Saving...' : 'Edit / Save Rate'}
                      </button>

                      <button
                        style={styles.primaryButton}
                        disabled={laborSavingId === rate.id || isVerified}
                        onClick={() => approveLaborRate(rate)}
                      >
                        {isVerified ? 'Verified' : 'Approve as Verified'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {canAccessSourceLessonAgent && activeTab === 'fieldLessons' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Field Lesson Agent</h2>
                <p style={styles.muted}>
                  Paste a source link and field notes. Shelter Prep drafts a Lesson Summary Draft for admin review before any memory is saved.
                </p>
              </div>
              <button type="button" style={styles.outlineButton} disabled={sourceLessonsLoading} onClick={loadSourceLessons}>
                {sourceLessonsLoading ? 'Loading...' : 'Refresh Lessons'}
              </button>
            </div>

            <div style={styles.noticeBox}>
              Do not automatically train from YouTube. Source links and manual notes create drafts only. Human Verified memory starts after admin approval.
            </div>
            {!hasSupabaseSession && (
              <div style={styles.warningBox}>
                Please sign in with your Supabase admin account first. Local PIN mode can view this screen, but protected source lesson writes require Supabase Auth.
              </div>
            )}

            <div style={styles.requestCard}>
              <h3 style={{ marginTop: 0 }}>Create Lesson Summary Draft</h3>
              <div style={isCompact ? styles.mobileStack : styles.grid2}>
                <input
                  style={styles.input}
                  placeholder="Paste YouTube link showing how this repair is done."
                  value={sourceLessonDraft.source_url}
                  onChange={(event) =>
                    setSourceLessonDraft((draft) => ({
                      ...draft,
                      source_url: event.target.value,
                      source_type: inferSourceLessonType(event.target.value),
                    }))
                  }
                />
                <select
                  style={styles.input}
                  value={sourceLessonDraft.source_type}
                  onChange={(event) =>
                    setSourceLessonDraft((draft) => ({ ...draft, source_type: event.target.value as SourceLessonSourceType }))
                  }
                >
                  {SOURCE_LESSON_SOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getLearningDisplayName(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={isCompact ? styles.mobileStack : styles.grid2}>
                <input
                  style={styles.input}
                  placeholder="Source title"
                  value={sourceLessonDraft.source_title}
                  onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, source_title: event.target.value }))}
                />
                <input
                  style={styles.input}
                  placeholder="Work type"
                  value={sourceLessonDraft.work_type}
                  onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, work_type: event.target.value }))}
                />
              </div>
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                placeholder="Problem description"
                value={sourceLessonDraft.problem_description}
                onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, problem_description: event.target.value }))}
              />
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                placeholder="Extract hidden labor, tools, safety risks, cleanup, missing info, and estimate impact."
                value={sourceLessonDraft.admin_intent}
                onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, admin_intent: event.target.value }))}
              />
              <textarea
                style={{ ...styles.input, minHeight: 130 }}
                placeholder="Paste notes/transcript manually for now. TODO: transcript extraction API integration later."
                value={sourceLessonManualNotes}
                onChange={(event) => setSourceLessonManualNotes(event.target.value)}
              />
              <div style={isCompact ? styles.mobileStack : styles.grid3}>
                <select
                  style={styles.input}
                  value={sourceLessonDraft.linked_work_request_id || ''}
                  onChange={(event) => selectSourceLessonLinkedRequest(event.target.value)}
                >
                  <option value="">Optional linked request</option>
                  {requests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {getSourceLessonRequestLabel(request)}
                    </option>
                  ))}
                </select>
                <input
                  style={styles.input}
                  placeholder="Linked property ID"
                  value={sourceLessonDraft.linked_property_id || ''}
                  onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, linked_property_id: event.target.value }))}
                />
                <input
                  style={styles.input}
                  placeholder="Linked repair item ID"
                  value={sourceLessonDraft.linked_repair_item_id || ''}
                  onChange={(event) => setSourceLessonDraft((draft) => ({ ...draft, linked_repair_item_id: event.target.value }))}
                />
              </div>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={sourceLessonSavingId === 'new-source-lesson' || !canDraftSourceLessons}
                onClick={generateSourceLessonDraft}
              >
                {sourceLessonSavingId === 'new-source-lesson' ? 'Generating...' : 'Generate Lesson Draft'}
              </button>
            </div>

            <div
              style={{
                ...styles.segmentedControl,
                gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))',
              }}
            >
              {[
                { value: 'all', label: 'All' },
                ...SOURCE_LESSON_STATUSES.map((status) => ({ value: status, label: getLearningDisplayName(status) })),
              ].map((status) => (
                <button
                  key={status.value}
                  type="button"
                  style={sourceLessonStatusFilter === status.value ? styles.segmentedActive : styles.segmentedButton}
                  onClick={() => setSourceLessonStatusFilter(status.value as 'all' | SourceLessonStatus)}
                >
                  {status.label}
                </button>
              ))}
            </div>

            <h3>Lesson Summary Drafts</h3>
            {visibleSourceLessons.length === 0 ? (
              <div style={styles.empty}>No Lesson Summary Drafts yet.</div>
            ) : (
              <div style={styles.fileGrid}>
                {visibleSourceLessons.map((lesson) => (
                  <div key={lesson.id} style={styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={lesson.status === 'approved' ? styles.badge : styles.badgeMuted}>
                        {lesson.status === 'approved' ? 'Human Verified' : lesson.status === 'needs_review' ? 'Needs Admin Review' : getLearningDisplayName(lesson.status)}
                      </span>
                      <span style={styles.badgeMuted}>{getLearningDisplayName(lesson.source_type)}</span>
                      <span style={styles.badgeMuted}>{getLearningDisplayName(lesson.confidence)}</span>
                      <span style={canPromoteSourceLessonToMemory(lesson) ? styles.badge : lesson.comprehension_grade ? styles.badgeDanger : styles.badgeMuted}>
                        {lesson.comprehension_grade ? `Grade ${lesson.comprehension_grade}` : 'Ungraded'}
                      </span>
                      <span style={styles.badgeMuted}>{getLearningDisplayName(lesson.human_review_status)}</span>
                    </div>

                    {getSourceLessonMemoryGateMessage(lesson) && (
                      <div style={styles.warningBox}>{getSourceLessonMemoryGateMessage(lesson)} Never update estimating memory automatically from an ungraded lesson.</div>
                    )}

                    <label style={styles.small}>Source URL</label>
                    <input
                      style={styles.input}
                      value={lesson.source_url}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, source_url: event.target.value } : item))
                        )
                      }
                    />
                    <label style={styles.small}>Source links reviewed</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 70 }}
                      placeholder="One source URL per line"
                      value={(lesson.source_links || []).map((link) => link.url).join('\n')}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) =>
                            item.id === lesson.id
                              ? {
                                  ...item,
                                  source_links: splitSourceLessonLines(event.target.value).map((url) => ({
                                    url,
                                    title: item.source_title,
                                    source_type: item.source_type,
                                    date_checked: new Date().toISOString(),
                                  })),
                                }
                              : item
                          )
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 72 }}
                      placeholder="Problem description"
                      value={lesson.problem_description}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, problem_description: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 72 }}
                      placeholder="Admin intent"
                      value={lesson.admin_intent}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, admin_intent: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 90 }}
                      placeholder="Lesson summary"
                      value={lesson.lesson_summary}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, lesson_summary: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 80 }}
                      placeholder="Operational meaning"
                      value={lesson.operational_meaning || ''}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, operational_meaning: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 80 }}
                      placeholder="Observed method"
                      value={lesson.observed_method}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, observed_method: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 80 }}
                      placeholder="Hidden labor"
                      value={lesson.hidden_labor}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, hidden_labor: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 86 }}
                      placeholder="Materials, tools, and equipment, one per line"
                      value={getSourceLessonDisplayList(lesson.materials_tools_equipment)}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, materials_tools_equipment: splitSourceLessonLines(event.target.value) } : item))
                        )
                      }
                    />
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <textarea
                        style={{ ...styles.input, minHeight: 110 }}
                        placeholder="Job steps, one per line"
                        value={getSourceLessonDisplayList(lesson.job_steps)}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, job_steps: splitSourceLessonLines(event.target.value) } : item))
                          )
                        }
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 110 }}
                        placeholder="Tools/materials, one per line"
                        value={getSourceLessonDisplayList(lesson.tools_materials)}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, tools_materials: splitSourceLessonLines(event.target.value) } : item))
                          )
                        }
                      />
                    </div>
                    <textarea
                      style={{ ...styles.input, minHeight: 72 }}
                      placeholder="Cleanup / disposal"
                      value={lesson.cleanup_disposal || ''}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, cleanup_disposal: event.target.value } : item))
                        )
                      }
                    />
                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Safety notes"
                        value={lesson.safety_notes}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, safety_notes: event.target.value } : item))
                          )
                        }
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Access notes"
                        value={lesson.access_notes}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, access_notes: event.target.value } : item))
                          )
                        }
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Cleanup notes"
                        value={lesson.cleanup_notes}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, cleanup_notes: event.target.value } : item))
                          )
                        }
                      />
                    </div>
                    <textarea
                      style={{ ...styles.input, minHeight: 72 }}
                      placeholder="Estimate impact"
                      value={lesson.estimate_impact}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, estimate_impact: event.target.value } : item))
                        )
                      }
                    />
                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <select
                        style={styles.input}
                        value={lesson.comprehension_grade || ''}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) =>
                              item.id === lesson.id
                                ? {
                                    ...item,
                                    comprehension_grade: event.target.value as SourceLessonComprehensionGrade,
                                    human_review_status: event.target.value === 'C' ? 'needs_review' : item.human_review_status,
                                  }
                                : item
                            )
                          )
                        }
                      >
                        {SOURCE_LESSON_COMPREHENSION_GRADES.map((grade) => (
                          <option key={grade.value || 'blank'} value={grade.value}>
                            {grade.label}
                          </option>
                        ))}
                      </select>
                      <select
                        style={styles.input}
                        value={lesson.human_review_status || 'needs_review'}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, human_review_status: event.target.value as SourceLessonHumanReviewStatus } : item))
                          )
                        }
                      >
                        {['ai_draft', 'needs_review', 'human_verified', 'rejected', 'deprecated'].map((status) => (
                          <option key={status} value={status}>
                            {getLearningDisplayName(status)}
                          </option>
                        ))}
                      </select>
                      <select
                        style={styles.input}
                        value={lesson.memory_destination || 'none'}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, memory_destination: event.target.value as SourceLessonMemoryDestination } : item))
                          )
                        }
                      >
                        {['none', 'project_specific', 'global_operational', 'contractor_scope', 'job_execution_context'].map((destination) => (
                          <option key={destination} value={destination}>
                            {getLearningDisplayName(destination)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      style={{ ...styles.input, minHeight: 82 }}
                      placeholder="What did the agent miss or misunderstand?"
                      value={lesson.admin_feedback || ''}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, admin_feedback: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 86 }}
                      placeholder="Missing info questions, one per line"
                      value={getSourceLessonDisplayList(lesson.missing_info_questions)}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === lesson.id ? { ...item, missing_info_questions: splitSourceLessonLines(event.target.value) } : item))
                        )
                      }
                    />
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Applies when"
                        value={lesson.applies_when}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, applies_when: event.target.value } : item))
                          )
                        }
                      />
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Does not apply when"
                        value={lesson.does_not_apply_when}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) => (item.id === lesson.id ? { ...item, does_not_apply_when: event.target.value } : item))
                          )
                        }
                      />
                    </div>

                    <div style={styles.buttonRow}>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || !canDraftSourceLessons}
                        onClick={() =>
                          updateSourceLesson(
                            lesson,
                            {
                              source_type: lesson.source_type,
                              source_url: lesson.source_url,
                              source_title: lesson.source_title,
                              work_type: lesson.work_type,
                              problem_description: lesson.problem_description,
                              source_links: lesson.source_links,
                              admin_intent: lesson.admin_intent,
                              lesson_summary: lesson.lesson_summary,
                              operational_meaning: lesson.operational_meaning,
                              observed_method: lesson.observed_method,
                              hidden_labor: lesson.hidden_labor,
                              materials_tools_equipment: lesson.materials_tools_equipment,
                              job_steps: lesson.job_steps,
                              tools_materials: lesson.tools_materials,
                              safety_notes: lesson.safety_notes,
                              access_notes: lesson.access_notes,
                              cleanup_notes: lesson.cleanup_notes,
                              cleanup_disposal: lesson.cleanup_disposal,
                              estimate_impact: lesson.estimate_impact,
                              missing_info_questions: lesson.missing_info_questions,
                              applies_when: lesson.applies_when,
                              does_not_apply_when: lesson.does_not_apply_when,
                              confidence: lesson.confidence,
                              comprehension_grade: lesson.comprehension_grade,
                              admin_feedback: lesson.admin_feedback,
                              human_review_status: lesson.comprehension_grade === 'C' ? 'needs_review' : lesson.human_review_status,
                              memory_destination: lesson.memory_destination,
                              admin_notes: lesson.admin_notes,
                              linked_property_id: lesson.linked_property_id,
                              linked_work_request_id: lesson.linked_work_request_id,
                              linked_repair_item_id: lesson.linked_repair_item_id,
                            },
                            'source_lesson_edited'
                          )
                        }
                      >
                        Edit Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        disabled={sourceLessonSavingId === lesson.id || lesson.status === 'approved' || !canApproveSourceLessons || !canPromoteSourceLessonToMemory(lesson)}
                        onClick={() => approveSourceLesson(lesson)}
                      >
                        Approve Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || lesson.status === 'rejected' || !canApproveSourceLessons}
                        onClick={() => rejectSourceLesson(lesson)}
                      >
                        Reject Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || !canApproveSourceLessons || !canPromoteSourceLessonToMemory(lesson)}
                        onClick={() => saveSourceLessonProjectSpecific(lesson)}
                      >
                        Save as Project-Specific Only
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || !canSaveGlobalLaborMemory || !canPromoteSourceLessonToMemory(lesson)}
                        onClick={() => saveSourceLessonGlobalMemory(lesson)}
                      >
                        Save as Global Labor Memory
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || !canCreateSourceLessonJobSteps}
                        onClick={() => createJobExecutionStepsFromSourceLesson(lesson)}
                      >
                        Create Job Execution Steps
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === lesson.id || lesson.status === 'archived' || !canApproveSourceLessons}
                        onClick={() => updateSourceLesson(lesson, { status: 'archived' }, 'source_lesson_archived')}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'agentLearning' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Agent Learning</h2>
                <p style={styles.muted}>
                  Shared operational memory from human corrections. Agent names route the lesson, but the memory belongs to the whole Shelter Prep system.
                </p>
              </div>
              <button type="button" style={styles.outlineButton} disabled={agentLearningLoading} onClick={loadAgentLearning}>
                {agentLearningLoading ? 'Loading...' : 'Refresh Learning'}
              </button>
            </div>

            <div style={styles.noticeBox}>
              AI may draft, classify, estimate, organize, summarize, and suggest. It may not approve, finalize, send, purchase, or override human judgment.
              <br />
              Only admins can approve shared operational memory.
            </div>

            <details style={styles.revealCard} open>
              <summary style={styles.revealSummary}>
                <div>
                  <strong>Curated Lesson Intake</strong>
                  <p style={styles.small}>Paste curated video sources and create a concise, estimating-focused draft for human review.</p>
                </div>
                <span style={styles.revealChevron}>Review</span>
              </summary>
              <div style={styles.revealBody}>
                {!hasSupabaseSession && (
                  <div style={styles.warningBox}>
                    Sign in with Supabase before generating or saving lesson drafts. Local PIN mode can view admin screens, but protected writes require Supabase Auth.
                  </div>
                )}
                <textarea
                  style={{ ...styles.input, minHeight: 110 }}
                  placeholder="Paste YouTube/video links (one per line)"
                  value={curatedLessonIntake.sourceLinksText}
                  onChange={(event) => setCuratedLessonIntake((draft) => ({ ...draft, sourceLinksText: event.target.value }))}
                />
                <textarea
                  style={{ ...styles.input, minHeight: 130 }}
                  placeholder="Paste transcript or notes if video transcript is unavailable"
                  value={curatedLessonIntake.transcriptOrNotes}
                  onChange={(event) => setCuratedLessonIntake((draft) => ({ ...draft, transcriptOrNotes: event.target.value }))}
                />
                <input
                  style={styles.input}
                  placeholder="Learning goal / what should the agent learn?"
                  value={curatedLessonIntake.learningGoal}
                  onChange={(event) => setCuratedLessonIntake((draft) => ({ ...draft, learningGoal: event.target.value }))}
                />
                <div style={isCompact ? styles.mobileStack : styles.grid2}>
                  <select
                    style={styles.input}
                    value={curatedLessonIntake.tradeCategory}
                    onChange={(event) => setCuratedLessonIntake((draft) => ({ ...draft, tradeCategory: event.target.value }))}
                  >
                    {CURATED_LESSON_TRADE_CATEGORIES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                  <select
                    style={styles.input}
                    value={curatedLessonIntake.memoryDestination}
                    onChange={(event) =>
                      setCuratedLessonIntake((draft) => ({
                        ...draft,
                        memoryDestination: event.target.value as SourceLessonMemoryDestination,
                      }))
                    }
                  >
                    {CURATED_LESSON_MEMORY_DESTINATIONS.map((destination) => (
                      <option key={destination.value} value={destination.value}>
                        {destination.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    disabled={sourceLessonSavingId === 'curated-lesson-intake' || !canDraftSourceLessons}
                    onClick={generateCuratedLessonSummary}
                  >
                    {sourceLessonSavingId === 'curated-lesson-intake' ? 'Generating...' : 'Generate Lesson Summary'}
                  </button>
                  <button type="button" style={styles.outlineButton} onClick={clearCuratedLessonIntake}>
                    Clear
                  </button>
                </div>
                {curatedLessonError && <div style={styles.warningBox}>{curatedLessonError}</div>}

                {curatedLessonSummaryDraft && (
                  <div style={{ ...styles.requestCard, marginTop: 14 }}>
                    <div style={styles.badgeRow}>
                      <span style={curatedLessonSummaryDraft.status === 'approved' ? styles.badge : styles.badgeMuted}>
                        {curatedLessonSummaryDraft.status === 'approved' ? 'Approved' : 'Draft'}
                      </span>
                      <span style={styles.badgeMuted}>{curatedLessonSummaryDraft.work_type || 'General Repair'}</span>
                      <span style={styles.badgeMuted}>
                        {CURATED_LESSON_MEMORY_DESTINATIONS.find((item) => item.value === curatedLessonSummaryDraft.memory_destination)?.label ||
                          getLearningDisplayName(curatedLessonSummaryDraft.memory_destination || 'none')}
                      </span>
                      <span
                        style={
                          canPromoteSourceLessonToMemory(curatedLessonSummaryDraft)
                            ? styles.badge
                            : curatedLessonSummaryDraft.comprehension_grade
                              ? styles.badgeDanger
                              : styles.badgeMuted
                        }
                      >
                        {curatedLessonSummaryDraft.comprehension_grade ? `Grade ${curatedLessonSummaryDraft.comprehension_grade}` : 'Ungraded'}
                      </span>
                    </div>
                    <h3 style={{ marginTop: 0 }}>Lesson Summary Draft</h3>
                    <div style={styles.noticeBox}>
                      Summary must stay under one page. AI may summarize and suggest, but it may not auto-update memory. Only approved lessons can become memory.
                    </div>

                    <label style={styles.small}>Sources</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 78 }}
                      value={(curatedLessonSummaryDraft.source_links || []).map((link) => link.url).join('\n')}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) =>
                            item.id === curatedLessonSummaryDraft.id
                              ? {
                                  ...item,
                                  source_links: splitSourceLessonLines(event.target.value).map((url) => ({
                                    url,
                                    title: item.source_title,
                                    source_type: inferSourceLessonType(url),
                                    date_checked: new Date().toISOString(),
                                  })),
                                  source_url: splitSourceLessonLines(event.target.value)[0] || '',
                                }
                              : item
                          )
                        )
                      }
                    />
                    <label style={styles.small}>Learning goal</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 70 }}
                      value={curatedLessonSummaryDraft.problem_description}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, problem_description: event.target.value } : item))
                        )
                      }
                    />
                    <label style={styles.small}>Key lesson</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 86 }}
                      value={curatedLessonSummaryDraft.lesson_summary}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, lesson_summary: event.target.value } : item))
                        )
                      }
                    />
                    <label style={styles.small}>Operational meaning</label>
                    <textarea
                      style={{ ...styles.input, minHeight: 78 }}
                      value={curatedLessonSummaryDraft.operational_meaning || ''}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, operational_meaning: event.target.value } : item))
                        )
                      }
                    />
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <div>
                        <label style={styles.small}>Estimate impact</label>
                        <textarea
                          style={{ ...styles.input, minHeight: 86 }}
                          value={curatedLessonSummaryDraft.estimate_impact}
                          onChange={(event) =>
                            setSourceLessons((prev) =>
                              prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, estimate_impact: event.target.value } : item))
                            )
                          }
                        />
                      </div>
                      <div>
                        <label style={styles.small}>Hidden labor</label>
                        <textarea
                          style={{ ...styles.input, minHeight: 86 }}
                          value={curatedLessonSummaryDraft.hidden_labor}
                          onChange={(event) =>
                            setSourceLessons((prev) =>
                              prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, hidden_labor: event.target.value } : item))
                            )
                          }
                        />
                      </div>
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <div>
                        <label style={styles.small}>Materials/tools/equipment</label>
                        <textarea
                          style={{ ...styles.input, minHeight: 86 }}
                          value={getSourceLessonDisplayList(curatedLessonSummaryDraft.materials_tools_equipment)}
                          onChange={(event) =>
                            setSourceLessons((prev) =>
                              prev.map((item) =>
                                item.id === curatedLessonSummaryDraft.id
                                  ? { ...item, materials_tools_equipment: splitSourceLessonLines(event.target.value) }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <label style={styles.small}>Cleanup/disposal</label>
                        <textarea
                          style={{ ...styles.input, minHeight: 86 }}
                          value={curatedLessonSummaryDraft.cleanup_disposal || ''}
                          onChange={(event) =>
                            setSourceLessons((prev) =>
                              prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, cleanup_disposal: event.target.value } : item))
                            )
                          }
                        />
                      </div>
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <select
                        style={styles.input}
                        value={curatedLessonSummaryDraft.confidence}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) =>
                              item.id === curatedLessonSummaryDraft.id ? { ...item, confidence: event.target.value as SourceLessonConfidence } : item
                            )
                          )
                        }
                      >
                        {['low', 'medium', 'high'].map((confidence) => (
                          <option key={confidence} value={confidence}>
                            Confidence: {getLearningDisplayName(confidence)}
                          </option>
                        ))}
                      </select>
                      <select
                        style={styles.input}
                        value={curatedLessonSummaryDraft.human_review_status || 'needs_review'}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) =>
                              item.id === curatedLessonSummaryDraft.id
                                ? { ...item, human_review_status: event.target.value as SourceLessonHumanReviewStatus }
                                : item
                            )
                          )
                        }
                      >
                        {['ai_draft', 'needs_review', 'human_verified', 'rejected', 'deprecated'].map((status) => (
                          <option key={status} value={status}>
                            Human review: {getLearningDisplayName(status)}
                          </option>
                        ))}
                      </select>
                      <select
                        style={styles.input}
                        value={curatedLessonSummaryDraft.comprehension_grade || ''}
                        onChange={(event) =>
                          setSourceLessons((prev) =>
                            prev.map((item) =>
                              item.id === curatedLessonSummaryDraft.id
                                ? {
                                    ...item,
                                    comprehension_grade: event.target.value as SourceLessonComprehensionGrade,
                                    human_review_status: event.target.value === 'C' ? 'needs_review' : item.human_review_status,
                                  }
                                : item
                            )
                          )
                        }
                      >
                        {SOURCE_LESSON_COMPREHENSION_GRADES.map((grade) => (
                          <option key={grade.value || 'blank'} value={grade.value}>
                            {grade.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      style={{ ...styles.input, minHeight: 82 }}
                      placeholder="What did the agent miss or misunderstand?"
                      value={curatedLessonSummaryDraft.admin_feedback || ''}
                      onChange={(event) =>
                        setSourceLessons((prev) =>
                          prev.map((item) => (item.id === curatedLessonSummaryDraft.id ? { ...item, admin_feedback: event.target.value } : item))
                        )
                      }
                    />
                    {getSourceLessonMemoryGateMessage(curatedLessonSummaryDraft) && (
                      <div style={styles.warningBox}>{getSourceLessonMemoryGateMessage(curatedLessonSummaryDraft)}</div>
                    )}
                    <div style={styles.buttonRow}>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        disabled={
                          sourceLessonSavingId === curatedLessonSummaryDraft.id ||
                          curatedLessonSummaryDraft.status === 'approved' ||
                          !canApproveSourceLessons ||
                          !canPromoteSourceLessonToMemory(curatedLessonSummaryDraft)
                        }
                        onClick={() => approveSourceLesson(curatedLessonSummaryDraft)}
                      >
                        Approve Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === curatedLessonSummaryDraft.id || !canDraftSourceLessons}
                        onClick={() =>
                          updateSourceLesson(
                            curatedLessonSummaryDraft,
                            {
                              source_links: curatedLessonSummaryDraft.source_links,
                              source_url: curatedLessonSummaryDraft.source_url,
                              source_title: curatedLessonSummaryDraft.source_title,
                              work_type: curatedLessonSummaryDraft.work_type,
                              problem_description: curatedLessonSummaryDraft.problem_description,
                              admin_intent: curatedLessonSummaryDraft.admin_intent,
                              lesson_summary: curatedLessonSummaryDraft.lesson_summary,
                              operational_meaning: curatedLessonSummaryDraft.operational_meaning,
                              estimate_impact: curatedLessonSummaryDraft.estimate_impact,
                              hidden_labor: curatedLessonSummaryDraft.hidden_labor,
                              materials_tools_equipment: curatedLessonSummaryDraft.materials_tools_equipment,
                              cleanup_disposal: curatedLessonSummaryDraft.cleanup_disposal,
                              confidence: curatedLessonSummaryDraft.confidence,
                              comprehension_grade: curatedLessonSummaryDraft.comprehension_grade,
                              admin_feedback: curatedLessonSummaryDraft.admin_feedback,
                              human_review_status:
                                curatedLessonSummaryDraft.comprehension_grade === 'C'
                                  ? 'needs_review'
                                  : curatedLessonSummaryDraft.human_review_status,
                              memory_destination: curatedLessonSummaryDraft.memory_destination,
                            },
                            'curated_lesson_edited'
                          )
                        }
                      >
                        Edit Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={sourceLessonSavingId === curatedLessonSummaryDraft.id || curatedLessonSummaryDraft.status === 'rejected' || !canApproveSourceLessons}
                        onClick={() => rejectSourceLesson(curatedLessonSummaryDraft)}
                      >
                        Reject Lesson
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={
                          sourceLessonSavingId === curatedLessonSummaryDraft.id ||
                          !canApproveSourceLessons ||
                          curatedLessonSummaryDraft.status !== 'approved' ||
                          !canPromoteSourceLessonToMemory(curatedLessonSummaryDraft)
                        }
                        onClick={() => saveSourceLessonProjectSpecific(curatedLessonSummaryDraft)}
                      >
                        Save as Project-Specific
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={
                          sourceLessonSavingId === curatedLessonSummaryDraft.id ||
                          !canSaveGlobalLaborMemory ||
                          curatedLessonSummaryDraft.status !== 'approved' ||
                          !canPromoteSourceLessonToMemory(curatedLessonSummaryDraft)
                        }
                        onClick={() => saveSourceLessonGlobalMemory(curatedLessonSummaryDraft)}
                      >
                        Save as Global Labor Memory
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div
              style={{
                ...styles.segmentedControl,
                gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))',
              }}
            >
              {[
                { value: 'all', label: 'All' },
                ...LESSON_STATUSES.map((status) => ({ value: status, label: getLearningDisplayName(status) })),
              ].map((status) => (
                <button
                  key={status.value}
                  type="button"
                  style={agentLearningStatusFilter === status.value ? styles.segmentedActive : styles.segmentedButton}
                  onClick={() => setAgentLearningStatusFilter(status.value as 'all' | LessonStatus)}
                >
                  {status.label}
                </button>
              ))}
            </div>

            <div style={styles.requestCard}>
              <h3 style={{ marginTop: 0 }}>Evaluate a Human Correction</h3>
              <div style={isCompact ? styles.mobileStack : styles.grid2}>
                <select
                  style={styles.input}
                  value={learningDraft.source_agent}
                  onChange={(event) =>
                    setLearningDraft((draft) => ({ ...draft, source_agent: event.target.value as AgentName }))
                  }
                >
                  {AGENT_NAMES.map((agent) => (
                    <option key={agent} value={agent}>
                      {getLearningDisplayName(agent)}
                    </option>
                  ))}
                </select>
                <input
                  style={styles.input}
                  placeholder="Task type, ex: shower layout / deck estimate"
                  value={learningDraft.task_type}
                  onChange={(event) => setLearningDraft((draft) => ({ ...draft, task_type: event.target.value }))}
                />
              </div>
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                placeholder="Original agent output"
                value={learningDraft.original_agent_output}
                onChange={(event) => setLearningDraft((draft) => ({ ...draft, original_agent_output: event.target.value }))}
              />
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                placeholder="Human correction"
                value={learningDraft.human_correction}
                onChange={(event) => setLearningDraft((draft) => ({ ...draft, human_correction: event.target.value }))}
              />
              {learningDraft.human_correction && (
                <div style={styles.aiBox}>
                  {(() => {
                    const evaluation = evaluateCorrectionForLearning(learningDraft)
                    return (
                      <>
                        <strong>{getLearningDisplayName(evaluation.correction_category)}</strong>
                        <p style={styles.small}>
                          Score {evaluation.learning_value_score}.{' '}
                          {evaluation.reusable ? 'Reusable conditional logic detected.' : 'Apply correction only.'}
                        </p>
                        <p style={styles.small}>{evaluation.inferred_reason}</p>
                        {evaluation.confirmation_question && <p style={styles.small}>{evaluation.confirmation_question}</p>}
                      </>
                    )
                  })()}
                </div>
              )}
              <button
                type="button"
                style={styles.primaryButton}
                disabled={agentLearningSavingId === 'new-learning-event'}
                onClick={submitLearningDraft}
              >
                {agentLearningSavingId === 'new-learning-event' ? 'Saving...' : 'Save Learning Event'}
              </button>
            </div>

            <h3>Learning Events</h3>
            {visibleAgentLearningEvents.length === 0 ? (
              <div style={styles.empty}>No learning events yet. Human corrections with reusable field logic will appear here.</div>
            ) : (
              <div style={styles.fileGrid}>
                {visibleAgentLearningEvents.map((event) => (
                  <div key={event.id} style={styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={styles.badgeMuted}>{getLearningDisplayName(event.source_agent)}</span>
                      <span style={event.lesson_status === 'human_verified' ? styles.badge : styles.badgeMuted}>
                        {getLearningDisplayName(event.lesson_status)}
                      </span>
                      <span style={styles.badgeMuted}>{getLearningDisplayName(event.memory_scope || 'global_operational')}</span>
                      <span style={styles.badgeMuted}>score {event.learning_value_score}</span>
                    </div>
                    <strong>{getLearningDisplayName(event.correction_category)}</strong>
                    <p style={styles.small}>Task: {event.task_type || 'General correction'}</p>
                    <p style={styles.small}>Correction: {event.human_correction}</p>
                    <p style={styles.small}>Reason: {event.human_confirmed_reason || event.inferred_reason}</p>
                    <p style={styles.small}>Affected agents: {getLearningAgentList(event.affected_agents)}</p>
                    <button
                      type="button"
                      style={styles.outlineButton}
                      disabled={
                        !event.reusable ||
                        event.lesson_status === 'rejected' ||
                        event.lesson_status === 'deprecated' ||
                        !canApproveOperationalMemory(memoryActorRole) ||
                        agentLearningSavingId === event.id
                      }
                      onClick={() =>
                        createAgentLearningRuleFromConfirmedEvent({
                          ...event,
                          lesson_status: 'human_verified',
                          human_verified: true,
                          confidence: 'human_verified',
                        })
                      }
                    >
                      Create Verified Rule
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3>Shared Rules</h3>
            {visibleAgentLearningRules.length === 0 ? (
              <div style={styles.empty}>No shared learning rules yet.</div>
            ) : (
              <div style={styles.fileGrid}>
                {visibleAgentLearningRules.map((rule) => {
                  const ruleAuditLogs = agentMemoryAuditLogs.filter(
                    (log) => log.target_table === 'agent_learning_rules' && log.target_id === rule.id
                  )
                  return (
                  <div key={rule.id} style={styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>{getLearningDisplayName(rule.memory_scope || 'global_operational')}</span>
                      <span style={rule.lesson_status === 'human_verified' ? styles.badge : styles.badgeMuted}>
                        {getLearningDisplayName(rule.lesson_status)}
                      </span>
                      <span style={rule.active ? styles.badge : styles.badgeMuted}>{rule.active ? 'active' : 'inactive'}</span>
                      <span style={styles.badgeMuted}>{rule.confidence || 'draft'}</span>
                    </div>
                    <input
                      style={styles.input}
                      value={rule.title}
                      onChange={(event) =>
                        setAgentLearningRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, title: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 90 }}
                      value={rule.rule_text}
                      onChange={(event) =>
                        setAgentLearningRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, rule_text: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 76 }}
                      placeholder="Applies when"
                      value={rule.applies_when}
                      onChange={(event) =>
                        setAgentLearningRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, applies_when: event.target.value } : item))
                        )
                      }
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 76 }}
                      placeholder="Does not apply when"
                      value={rule.does_not_apply_when}
                      onChange={(event) =>
                        setAgentLearningRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, does_not_apply_when: event.target.value } : item))
                        )
                      }
                    />
                    <p style={styles.small}>Affected agents: {getLearningAgentList(rule.affected_agents)}</p>
                    <div style={styles.buttonRow}>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentLearningSavingId === rule.id || !canEditOperationalMemory(memoryActorRole)}
                        onClick={() =>
                          updateAgentLearningRule(rule, {
                            title: rule.title,
                            rule_text: rule.rule_text,
                            applies_when: rule.applies_when,
                            does_not_apply_when: rule.does_not_apply_when,
                          })
                        }
                      >
                        Save Rule
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentLearningSavingId === rule.id || rule.human_verified || !canApproveOperationalMemory(memoryActorRole)}
                        onClick={() =>
                          updateAgentLearningRule(rule, {
                            lesson_status: 'human_verified',
                            human_verified: true,
                            active: true,
                            memory_scope: 'global_operational',
                            confidence: 'human_verified',
                          })
                        }
                      >
                        Approve Rule
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentLearningSavingId === rule.id || !rule.active || !canApproveOperationalMemory(memoryActorRole)}
                        onClick={() => updateAgentLearningRule(rule, { active: false })}
                      >
                        Deactivate
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentLearningSavingId === rule.id || rule.lesson_status === 'rejected' || !canApproveOperationalMemory(memoryActorRole)}
                        onClick={() => updateAgentLearningRule(rule, { lesson_status: 'rejected', human_verified: false, active: false })}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        disabled={agentLearningSavingId === rule.id || rule.lesson_status === 'deprecated' || !canApproveOperationalMemory(memoryActorRole)}
                        onClick={() => updateAgentLearningRule(rule, { lesson_status: 'deprecated', active: false })}
                      >
                        Deprecate
                      </button>
                    </div>
                    {ruleAuditLogs.length ? (
                      <details style={styles.moreActions}>
                        <summary style={styles.moreActionsSummary}>Audit history</summary>
                        <ul style={styles.smallList}>
                          {ruleAuditLogs.slice(0, 5).map((log) => (
                            <li key={log.id}>
                              {getLearningDisplayName(log.action_type)} by {getLearningDisplayName(log.actor_role || 'viewer')}{' '}
                              {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <p style={styles.small}>No audit history yet.</p>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            <h3>Memory Conflicts</h3>
            <div
              style={{
                ...styles.segmentedControl,
                gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(7, minmax(0, 1fr))',
              }}
            >
              {[
                { value: 'all', label: 'All' },
                ...AGENT_MEMORY_CONFLICT_STATUSES.map((status) => ({ value: status, label: getLearningDisplayName(status) })),
              ].map((status) => (
                <button
                  key={status.value}
                  type="button"
                  style={memoryConflictStatusFilter === status.value ? styles.segmentedActive : styles.segmentedButton}
                  onClick={() => setMemoryConflictStatusFilter(status.value as 'all' | AgentMemoryConflictStatus)}
                >
                  {status.label}
                </button>
              ))}
            </div>
            {visibleAgentMemoryConflicts.length === 0 ? (
              <div style={styles.empty}>No operational memory conflicts need review.</div>
            ) : (
              <div style={styles.fileGrid}>
                {visibleAgentMemoryConflicts.map((conflict) => {
                  const conflictingRules = conflict.conflicting_rule_ids
                    .map((id) => agentLearningRuleById.get(id))
                    .filter((rule): rule is AgentLearningRule => Boolean(rule))
                  const firstRule = conflictingRules[0]
                  const secondRule = conflictingRules[1]
                  const conflictAuditLogs = agentMemoryAuditLogs.filter(
                    (log) => log.target_table === 'agent_memory_conflicts' && log.target_id === conflict.id
                  )
                  return (
                    <div key={conflict.id} style={styles.requestCard}>
                      <div style={styles.badgeRow}>
                        <span style={conflict.resolution_status === 'needs_review' ? styles.badgeDanger : styles.badgeMuted}>
                          {getLearningDisplayName(conflict.resolution_status)}
                        </span>
                        <span style={styles.badgeMuted}>{getLearningDisplayName(conflict.detected_by_agent)}</span>
                        <span style={styles.badgeMuted}>{conflict.task_type || 'General task'}</span>
                      </div>
                      <strong>{conflict.conflict_summary}</strong>
                      {conflict.recommended_resolution && <p style={styles.small}>{conflict.recommended_resolution}</p>}
                      <div style={styles.fileGrid}>
                        {conflictingRules.map((rule) => (
                          <div key={rule.id} style={styles.aiBox}>
                            <strong>{rule.title}</strong>
                            <p style={styles.small}>{rule.rule_text}</p>
                            <p style={styles.small}>Applies: {rule.applies_when || 'Not specified'}</p>
                            <p style={styles.small}>Does not apply: {rule.does_not_apply_when || 'Not specified'}</p>
                          </div>
                        ))}
                      </div>
                      {conflict.human_resolution_notes && <p style={styles.small}>Human notes: {conflict.human_resolution_notes}</p>}
                      <div style={styles.buttonRow}>
                        {firstRule && (
                          <button
                            type="button"
                            style={styles.outlineButton}
                            disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                            onClick={() => resolveAgentMemoryConflict(conflict, 'resolved', firstRule.id)}
                          >
                            Use Rule A
                          </button>
                        )}
                        {secondRule && (
                          <button
                            type="button"
                            style={styles.outlineButton}
                            disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                            onClick={() => resolveAgentMemoryConflict(conflict, 'resolved', secondRule.id)}
                          >
                            Use Rule B
                          </button>
                        )}
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                          onClick={() => resolveAgentMemoryConflict(conflict, 'ask_client')}
                        >
                          Ask Client
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                          onClick={() => resolveAgentMemoryConflict(conflict, 'needs_site_review')}
                        >
                          Needs Site Review
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                          onClick={() => resolveAgentMemoryConflict(conflict, 'dismissed')}
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === conflict.id || !canResolveMemoryConflict(memoryActorRole)}
                          onClick={() => resolveAgentMemoryConflict(conflict, 'resolved', firstRule?.id || null, true)}
                        >
                          Create Conditional Rule
                        </button>
                      </div>
                      {conflictAuditLogs.length ? (
                        <details style={styles.moreActions}>
                          <summary style={styles.moreActionsSummary}>Audit history</summary>
                          <ul style={styles.smallList}>
                            {conflictAuditLogs.slice(0, 5).map((log) => (
                              <li key={log.id}>
                                {getLearningDisplayName(log.action_type)} by {getLearningDisplayName(log.actor_role || 'viewer')}{' '}
                                {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <p style={styles.small}>No audit history yet.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <h3>Recent Rule Applications</h3>
            <div style={isCompact ? styles.mobileStack : styles.applicationFilterGrid}>
              <select
                style={styles.input}
                value={ruleApplicationRuleFilter}
                onChange={(event) => setRuleApplicationRuleFilter(event.target.value)}
              >
                <option value="all">All rules</option>
                {agentLearningRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.title || 'Untitled rule'}
                  </option>
                ))}
              </select>
              <select
                style={styles.input}
                value={ruleApplicationTypeFilter}
                onChange={(event) => setRuleApplicationTypeFilter(event.target.value as 'all' | AgentRuleApplicationType)}
              >
                <option value="all">All types</option>
                {AGENT_RULE_APPLICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getLearningDisplayName(type)}
                  </option>
                ))}
              </select>
              <select
                style={styles.input}
                value={ruleApplicationAgentFilter}
                onChange={(event) => setRuleApplicationAgentFilter(event.target.value as 'all' | AgentName)}
              >
                <option value="all">All agents</option>
                {AGENT_NAMES.map((agent) => (
                  <option key={agent} value={agent}>
                    {getLearningDisplayName(agent)}
                  </option>
                ))}
              </select>
              <select
                style={styles.input}
                value={ruleApplicationFeedbackFilter}
                onChange={(event) =>
                  setRuleApplicationFeedbackFilter(event.target.value as 'all' | AgentRuleApplicationFeedbackStatus)
                }
              >
                <option value="all">All feedback</option>
                {AGENT_RULE_FEEDBACK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getLearningDisplayName(status)}
                  </option>
                ))}
              </select>
              <input
                style={styles.input}
                placeholder="Filter task type"
                value={ruleApplicationTaskFilter}
                onChange={(event) => setRuleApplicationTaskFilter(event.target.value)}
              />
            </div>

            {visibleAgentRuleApplications.length === 0 ? (
              <div style={styles.empty}>No operational memory usage has been recorded yet.</div>
            ) : (
              <div style={styles.fileGrid}>
                {visibleAgentRuleApplications.map((application) => {
                  const rule = agentLearningRuleById.get(application.rule_id)
                  return (
                    <div key={application.id} style={styles.requestCard}>
                      <div style={styles.badgeRow}>
                        <span style={application.application_type === 'applied' ? styles.badge : styles.badgeMuted}>
                          {getLearningDisplayName(application.application_type || 'suggested')}
                        </span>
                        <span style={styles.badgeMuted}>{getLearningDisplayName(application.applied_by_agent)}</span>
                        <span
                          style={
                            application.human_feedback_status === 'accepted'
                              ? styles.badge
                              : application.human_feedback_status === 'rejected'
                                ? styles.badgeDanger
                                : styles.badgeMuted
                          }
                        >
                          {getLearningDisplayName(application.human_feedback_status)}
                        </span>
                        <span style={styles.badgeMuted}>{application.task_type || 'General task'}</span>
                      </div>
                      <strong>{rule?.title || 'Rule application'}</strong>
                      <p style={styles.small}>
                        Used {application.created_at ? new Date(application.created_at).toLocaleString() : 'recently'}
                      </p>
                      <p style={styles.small}>Context: {application.output_context || 'No context recorded.'}</p>
                      <p style={styles.small}>
                        Output excerpt: {application.generated_output_excerpt || 'No generated output excerpt recorded.'}
                      </p>
                      <textarea
                        style={{ ...styles.input, minHeight: 76 }}
                        placeholder="Human feedback notes"
                        value={application.human_feedback_notes || ''}
                        onChange={(event) =>
                          setAgentRuleApplications((prev) =>
                            prev.map((item) =>
                              item.id === application.id ? { ...item, human_feedback_notes: event.target.value } : item
                            )
                          )
                        }
                      />
                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === application.id || !canProvideRuleFeedback(memoryActorRole, application, 'accepted', contractorAssignments, currentUserId)}
                          onClick={() => updateAgentRuleApplicationFeedback(application, 'accepted')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === application.id || !canProvideRuleFeedback(memoryActorRole, application, 'edited', contractorAssignments, currentUserId)}
                          onClick={() => updateAgentRuleApplicationFeedback(application, 'edited')}
                        >
                          Mark Edited
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={agentLearningSavingId === application.id || !canProvideRuleFeedback(memoryActorRole, application, 'rejected', contractorAssignments, currentUserId)}
                          onClick={() => updateAgentRuleApplicationFeedback(application, 'rejected')}
                        >
                          Reject Use
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {hasAdminConsoleAccess && activeTab === 'estimates' && (
          <section style={styles.card}>
            <h2>AI Estimate Review</h2>
            <p style={styles.muted}>
              AI can research and draft. A human must review and approve line items before
              any proposal, estimate, purchase order, email, or submission is sent.
            </p>

            {!selectedEstimateRequest && (
              <div style={styles.noticeBox}>
                Open a job from the Dashboard, then click Open Estimate Review. You can also
                run AI Research Materials first to fill this panel with draft material items.
              </div>
            )}

            {selectedEstimateRequest && (
              <>
                <div style={styles.requestCard}>
                  <strong>{selectedEstimateRequest.propertyAddress}</strong>
                  <p style={styles.small}>
                    {selectedEstimateRequest.city}, {selectedEstimateRequest.state}{' '}
                    {selectedEstimateRequest.zip}
                  </p>
                  <p style={styles.small}>
                    {selectedEstimateRequest.requesterName} • {selectedEstimateRequest.email}
                  </p>
                  <p>{selectedEstimateRequest.description}</p>
                  <div style={styles.noticeBox}>
                    Estimate status: {approvedEstimateCount}/{currentScopeEstimateItems.length} current-scope line items
                    approved. {allEstimateItemsApproved ? 'Ready for draft PDF.' : 'Still needs human review.'}
                    {rejectedEstimateCount > 0 ? ` ${rejectedEstimateCount} rejected item(s) hidden by default.` : ''}
                  </div>
                </div>

                {(matchedPricingMemory.length > 0 || matchedJobStepMemory.length > 0 || matchedFieldMemory.length > 0) ? (
                  <div style={styles.intelligencePanel}>
                    <strong>Based on verified memory from similar jobs</strong>
                    <p style={styles.small}>
                      Supporting context only. Current scope, site conditions, and human approval still control the estimate.
                    </p>
                    {matchedPricingMemory.length > 0 && (
                      <>
                        <strong>Pricing memory</strong>
                        <ul style={styles.smallList}>
                          {matchedPricingMemory.slice(0, 4).map((memory) => (
                            <li key={memory.id}>
                              {memory.item_name || 'Similar item'}: {money(Number(memory.human_approved_price || 0))}{' '}
                              {memory.unit ? `/ ${memory.unit}` : ''} •{' '}
                              {memory.reviewed_at ? new Date(memory.reviewed_at).toLocaleDateString() : 'reviewed'} •{' '}
                              {memory.confidence_after || 'human verified'}
                              {memory.admin_notes ? ` • ${memory.admin_notes}` : ''}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {matchedJobStepMemory.length > 0 && (
                      <>
                        <strong>Labor scope memory</strong>
                        <ul style={styles.smallList}>
                          {matchedJobStepMemory.slice(0, 4).map((memory, index) => (
                            <li key={memory.id || `${memory.step_title}-${index}`}>
                              {memory.status === 'rejected' ? 'Past rejected suggestion - avoid this pattern: ' : ''}
                              {memory.step_title || 'Similar step'}: {memory.approved_hours_low ?? memory.approved_hours ?? 'review'}-
                              {memory.approved_hours_high ?? memory.approved_hours ?? 'review'} hrs •{' '}
                              {memory.reviewed_at ? new Date(memory.reviewed_at).toLocaleDateString() : 'reviewed'}
                              {memory.admin_notes ? ` • ${memory.admin_notes}` : ''}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {matchedFieldMemory.length > 0 && (
                      <>
                        <strong>Photo / field memory</strong>
                        <ul style={styles.smallList}>
                          {matchedFieldMemory.map((memory) => (
                            <li key={memory.id}>
                              {memory.photo_description || 'Verified field note'}: {memory.follow_up_lesson || memory.estimate_impact || 'review current conditions'} •{' '}
                              {memory.reviewed_at ? new Date(memory.reviewed_at).toLocaleDateString() : 'reviewed'}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
	                ) : (
	                  <div style={styles.empty}>No verified memory matched this job yet.</div>
	                )}

	                {currentSiteMediaEstimateFindings.length > 0 && (
	                  <div style={styles.intelligencePanel}>
	                    <strong>Approved Site Media Notes</strong>
	                    <p style={styles.small}>
	                      Context only. These notes do not change final estimate totals automatically.
	                    </p>
	                    <ul style={styles.smallList}>
	                      {currentSiteMediaEstimateFindings.map((finding) => (
	                        <li key={`estimate-site-media-${finding.id}`}>
	                          {finding.finding_type}: {finding.observation} Field consequence: {finding.field_consequence || 'Needs human verification.'} Estimate note: {finding.estimate_impact || 'Needs human verification.'}
	                        </li>
	                      ))}
	                    </ul>
	                  </div>
	                )}
	
	                {estimateIntelligence && (
                  <div style={styles.intelligencePanel}>
                    <div style={styles.buttonRow}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginTop: 0 }}>Estimate Intelligence Core</h3>
                        <p style={styles.small}>
                          Draft only. Quantities, labor, materials, overhead, and risk buffers need human/site review.
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        onClick={() => copyToClipboard(estimateIntelligence.contractorPacket)}
                      >
                        Copy Contractor Packet
                      </button>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.factCard}>
                        <span>Trades</span>
                        <strong>{estimateIntelligence.tradeBreakdown.join(', ')}</strong>
                      </div>
                      <div style={styles.factCard}>
                        <span>Labor</span>
                        <strong>
                          {estimateIntelligence.laborHours} hrs @ {money(estimateIntelligence.laborRate)}/hr
                        </strong>
                      </div>
                      <div style={styles.factCard}>
                        <span>Draft Range</span>
                        <strong>
                          {money(estimateIntelligence.suggestedLow)} - {money(estimateIntelligence.suggestedHigh)}
                        </strong>
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div>
                        <strong>Quantity Basis</strong>
                        <ul style={styles.smallList}>
                          {estimateIntelligence.quantityBasis.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong>Missing Info</strong>
                        <ul style={styles.smallList}>
                          {(estimateIntelligence.missingInfo.length
                            ? estimateIntelligence.missingInfo
                            : ['None obvious']).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong>Risk Flags</strong>
                        <ul style={styles.smallList}>
                          {(estimateIntelligence.riskFlags.length
                            ? estimateIntelligence.riskFlags
                            : ['Standard risk']).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <pre style={styles.packetBox}>{estimateIntelligence.contractorPacket}</pre>
                  </div>
                )}

                <div style={styles.aiBox}>
                  <div style={styles.buttonRow}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginTop: 0 }}>Job Execution Scope</h3>
                      <p style={styles.small}>
                        AI-generated scope steps are drafts. Approve steps before they count as final proposal labor.
                      </p>
                    </div>
                    <button
                      type="button"
                      style={styles.outlineButton}
                      onClick={() => selectedEstimateRequest && generateJobExecutionScope(selectedEstimateRequest)}
                    >
                      Generate Scope Steps
                    </button>
                    <button type="button" style={styles.primaryButton} onClick={addManualJobExecutionStep}>
                      + Add Manual Step
                    </button>
                  </div>

                  <div style={styles.noticeBox}>
                    {jobScopeMessage} Total labor scope: {jobScopeLaborHoursLabel}. Rejected steps do not count.
                  </div>

                  {currentJobScopeSteps.length === 0 && (
                    <div style={styles.empty}>
                      No job execution steps yet. Generate scope steps or add a manual step.
                    </div>
                  )}

                  {currentJobScopeSteps.map((step, index) => (
                    <div
                      key={step.id}
                      style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}
                    >
                      <div style={styles.badgeRow}>
                        <span style={step.status === 'rejected' ? styles.badgeDanger : styles.badge}>
                          Step {step.step_number}: {getLearningDisplayName(step.status)}
                        </span>
                        <span style={styles.badgeMuted}>{getLearningDisplayName(step.confidence || 'needs_review')}</span>
                        {step.disposal_needed && <span style={styles.badgeMuted}>Disposal needed</span>}
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <input
                          style={styles.input}
                          value={step.title}
                          placeholder="Step title"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { title: event.target.value })}
                        />
                        <input
                          style={styles.input}
                          value={step.trade}
                          placeholder="Trade / skill"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { trade: event.target.value })}
                        />
                      </div>

                      <textarea
                        style={{ ...styles.input, minHeight: 86 }}
                        value={step.labor_scope}
                        placeholder="Labor scope"
                        onChange={(event) => updateLocalJobExecutionStep(step.id, { labor_scope: event.target.value })}
                      />

                      <div style={isCompact ? styles.mobileStack : styles.grid3}>
                        <input
                          style={styles.input}
                          type="number"
                          step="0.25"
                          value={Number(step.estimated_hours_low || 0)}
                          placeholder="Low hours"
                          onChange={(event) =>
                            updateLocalJobExecutionStep(step.id, {
                              estimated_hours_low: Number(event.target.value),
                            })
                          }
                        />
                        <input
                          style={styles.input}
                          type="number"
                          step="0.25"
                          value={Number(step.estimated_hours_high || 0)}
                          placeholder="High hours"
                          onChange={(event) =>
                            updateLocalJobExecutionStep(step.id, {
                              estimated_hours_high: Number(event.target.value),
                            })
                          }
                        />
                        <select
                          style={styles.input}
                          value={step.status}
                          onChange={(event) =>
                            updateLocalJobExecutionStep(step.id, {
                              status: event.target.value as JobExecutionStepStatus,
                            })
                          }
                        >
                          {JOB_STEP_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <textarea
                          style={{ ...styles.input, minHeight: 76 }}
                          value={step.materials_tools}
                          placeholder="Materials / tools"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { materials_tools: event.target.value })}
                        />
                        <textarea
                          style={{ ...styles.input, minHeight: 76 }}
                          value={step.equipment}
                          placeholder="Equipment"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { equipment: event.target.value })}
                        />
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid3}>
                        <textarea
                          style={{ ...styles.input, minHeight: 76 }}
                          value={step.safety_notes}
                          placeholder="Safety notes"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { safety_notes: event.target.value })}
                        />
                        <textarea
                          style={{ ...styles.input, minHeight: 76 }}
                          value={step.access_notes}
                          placeholder="Access notes"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { access_notes: event.target.value })}
                        />
                        <textarea
                          style={{ ...styles.input, minHeight: 76 }}
                          value={step.cleanup_notes}
                          placeholder="Cleanup / disposal notes"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { cleanup_notes: event.target.value })}
                        />
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <label style={{ ...styles.outlineButton, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={step.disposal_needed}
                            onChange={(event) =>
                              updateLocalJobExecutionStep(step.id, { disposal_needed: event.target.checked })
                            }
                          />
                          Disposal needed
                        </label>
                        <input
                          style={styles.input}
                          value={step.admin_notes}
                          placeholder="Admin notes / rejection reason"
                          onChange={(event) => updateLocalJobExecutionStep(step.id, { admin_notes: event.target.value })}
                        />
                      </div>

                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          disabled={jobStepSavingId === step.id}
                          onClick={() => saveJobExecutionStep(step)}
                        >
                          {jobStepSavingId === step.id ? 'Saving...' : 'Save Step'}
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={jobStepSavingId === step.id || isHumanVerifiedStatus(step.status)}
                          onClick={() => approveJobExecutionStep(step)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={jobStepSavingId === step.id || step.status === 'rejected'}
                          onClick={() => rejectJobExecutionStep(step)}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={jobStepSavingId === step.id || step.status === 'ai_draft'}
                          onClick={() => recordJobStepLearning(step, step.status === 'rejected' ? 'rejected' : step.confidence === 'human_added' ? 'added' : 'edited')}
                        >
                          Save as verified memory
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={index === 0}
                          onClick={() => moveJobExecutionStep(step.id, -1)}
                        >
                          Move Up
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={index === currentJobScopeSteps.length - 1}
                          onClick={() => moveJobExecutionStep(step.id, 1)}
                        >
                          Move Down
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.aiBox}>
                  <div style={styles.buttonRow}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginTop: 0 }}>AI Research Draft</h3>
                      <p style={styles.small}>
                        AI Research Draft — Human Review Required. Draft research cannot approve pricing, send proposals, buy materials, or email clients.
                      </p>
                    </div>
                    <button type="button" style={styles.primaryButton} onClick={addAiResearchDraft}>
                      + Add Research Draft
                    </button>
                  </div>

                  <div style={styles.noticeBox}>
                    {aiResearchMessage} Approved research can be attached to estimate assumptions; rejected research does not affect totals.
                  </div>

                  {aiResearchDrafts.length === 0 && (
                    <div style={styles.empty}>
                      No AI research drafts yet. Add material prices, supplier links, product notes, code/safety references, or assumptions for review.
                    </div>
                  )}

                  {aiResearchDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}
                    >
                      <div style={styles.badgeRow}>
                        <span style={draft.human_review_status === 'rejected' ? styles.badgeDanger : styles.badge}>
                          {getLearningDisplayName(draft.human_review_status)}
                        </span>
                        <span style={styles.badgeMuted}>{getLearningDisplayName(draft.confidence || 'needs_review')}</span>
                        {draft.reviewed_at && <span style={styles.badgeMuted}>Reviewed {new Date(draft.reviewed_at).toLocaleDateString()}</span>}
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <input
                          style={styles.input}
                          value={draft.research_topic}
                          placeholder="Research topic"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { research_topic: event.target.value })}
                        />
                        <input
                          style={styles.input}
                          value={draft.item_material_name}
                          placeholder="Item / material name"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { item_material_name: event.target.value })}
                        />
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid3}>
                        <input
                          style={styles.input}
                          value={draft.source_name}
                          placeholder="Source name"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { source_name: event.target.value })}
                        />
                        <input
                          style={styles.input}
                          value={draft.source_url}
                          placeholder="Source URL"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { source_url: event.target.value })}
                        />
                        <input
                          style={styles.input}
                          type="number"
                          value={draft.observed_price ?? ''}
                          placeholder="Observed price"
                          onChange={(event) =>
                            updateLocalAiResearchDraft(draft.id, {
                              observed_price: event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <input
                          style={styles.input}
                          value={draft.availability_note}
                          placeholder="Availability note"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { availability_note: event.target.value })}
                        />
                        <input
                          style={styles.input}
                          value={draft.screenshot_file_reference}
                          placeholder="Screenshot / file reference"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { screenshot_file_reference: event.target.value })}
                        />
                      </div>

                      <textarea
                        style={{ ...styles.input, minHeight: 86 }}
                        value={draft.ai_notes}
                        placeholder="AI notes, assumptions, code/safety notes, supplier notes"
                        onChange={(event) => updateLocalAiResearchDraft(draft.id, { ai_notes: event.target.value })}
                      />

                      <div style={isCompact ? styles.mobileStack : styles.grid2}>
                        <select
                          style={styles.input}
                          value={draft.human_review_status}
                          onChange={(event) =>
                            updateLocalAiResearchDraft(draft.id, {
                              human_review_status: event.target.value as AiResearchDraftStatus,
                            })
                          }
                        >
                          {AI_RESEARCH_DRAFT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <input
                          style={styles.input}
                          value={draft.admin_notes}
                          placeholder="Admin notes / rejection reason"
                          onChange={(event) => updateLocalAiResearchDraft(draft.id, { admin_notes: event.target.value })}
                        />
                      </div>

                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          disabled={aiResearchSavingId === draft.id}
                          onClick={() => saveAiResearchDraft(draft)}
                        >
                          {aiResearchSavingId === draft.id ? 'Saving...' : 'Save Research'}
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={aiResearchSavingId === draft.id || isHumanVerifiedStatus(draft.human_review_status)}
                          onClick={() => setAiResearchDraftStatus(draft, 'human_verified')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={aiResearchSavingId === draft.id || draft.human_review_status === 'rejected'}
                          onClick={() => setAiResearchDraftStatus(draft, 'rejected')}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          disabled={!isHumanVerifiedStatus(draft.human_review_status)}
                          onClick={() => attachApprovedResearchToEstimate(draft)}
                        >
                          Attach Price to Estimate
                        </button>
                        {draft.source_url && (
                          <button
                            type="button"
                            style={styles.linkButton}
                            onClick={() => window.open(draft.source_url, '_blank')}
                          >
                            Open Source
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.aiBox}>
                  <strong>Draft Labor Cost</strong>
                  <p style={styles.small}>Curated labor estimate. Admin approval required.</p>
                  <p style={styles.small}>{estimateLaborMessage}</p>

                  {curatedLaborDraft ? (() => {
                    const draftTotals = curatedLaborTotal(
                      Number(curatedLaborDraft.laborHoursLow || 0),
                      Number(curatedLaborDraft.laborHoursHigh || 0),
                      Number(curatedLaborDraft.hourlyRateLow || 0),
                      Number(curatedLaborDraft.hourlyRateHigh || 0),
                      Number(curatedLaborDraft.accessMultiplier || 1),
                      Number(curatedLaborDraft.setupCleanupHours || 0)
                    )

                    return (
                      <>
                        <div style={styles.grid3}>
                          <div style={styles.fileBox}>
                            <strong>Low Draft</strong>
                            <p>{money(draftTotals.low)}</p>
                          </div>
                          <div style={styles.fileBox}>
                            <strong>Curated Draft</strong>
                            <p>{money(draftTotals.standard)}</p>
                          </div>
                          <div style={styles.fileBox}>
                            <strong>High Draft</strong>
                            <p>{money(draftTotals.high)}</p>
                          </div>
                        </div>

                        <h3>Source Links</h3>
                        <div style={styles.revealItemList}>
                          {curatedLaborDraft.sourceLinks.map((link) => (
                            <div key={`${link.name}-${link.priority}`} style={styles.revealLineItem}>
                              <strong>{link.name}</strong>
                              <span>{link.confidence} • checked {new Date(link.date_checked).toLocaleDateString()}</span>
                              {link.admin_override_note && <small>Admin override: {link.admin_override_note}</small>}
                              <button
                                type="button"
                                style={styles.linkButton}
                                onClick={() => {
                                  if (link.url.startsWith('http')) window.open(link.url, '_blank', 'noopener,noreferrer')
                                }}
                              >
                                {link.url.startsWith('http') ? 'Open source' : 'Internal source'}
                              </button>
                            </div>
                          ))}
                        </div>

                        <h3>Admin Edited Labor Cost</h3>
                        <div style={styles.grid3}>
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Labor hours low"
                            value={curatedLaborDraft.laborHoursLow}
                            onChange={(e) => updateCuratedLaborDraft({ laborHoursLow: e.target.value })}
                          />
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Labor hours high"
                            value={curatedLaborDraft.laborHoursHigh}
                            onChange={(e) => updateCuratedLaborDraft({ laborHoursHigh: e.target.value })}
                          />
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Access multiplier"
                            value={curatedLaborDraft.accessMultiplier}
                            onChange={(e) => updateCuratedLaborDraft({ accessMultiplier: e.target.value })}
                          />
                        </div>

                        <div style={styles.grid3}>
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Hourly rate low"
                            value={curatedLaborDraft.hourlyRateLow}
                            onChange={(e) => updateCuratedLaborDraft({ hourlyRateLow: e.target.value })}
                          />
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Hourly rate high"
                            value={curatedLaborDraft.hourlyRateHigh}
                            onChange={(e) => updateCuratedLaborDraft({ hourlyRateHigh: e.target.value })}
                          />
                          <input
                            style={styles.input}
                            type="number"
                            placeholder="Setup/cleanup hours"
                            value={curatedLaborDraft.setupCleanupHours}
                            onChange={(e) => updateCuratedLaborDraft({ setupCleanupHours: e.target.value })}
                          />
                        </div>

                        <div style={styles.grid2}>
                          <input
                            style={styles.input}
                            placeholder="Confidence"
                            value={curatedLaborDraft.confidence}
                            onChange={(e) => updateCuratedLaborDraft({ confidence: e.target.value })}
                          />
                          <input
                            style={styles.input}
                            placeholder="Trade / job type"
                            value={`${curatedLaborDraft.trade} / ${curatedLaborDraft.jobType}`}
                            onChange={(e) => {
                              const [trade, ...jobType] = e.target.value.split('/')
                              updateCuratedLaborDraft({ trade: trade.trim(), jobType: jobType.join('/').trim() || curatedLaborDraft.jobType })
                            }}
                          />
                        </div>

                        <textarea
                          style={{ ...styles.input, minHeight: 96 }}
                          placeholder="Notes / admin override"
                          value={curatedLaborDraft.notes}
                          onChange={(e) => updateCuratedLaborDraft({ notes: e.target.value })}
                        />

                        <div style={styles.buttonRow}>
                          <button
                            type="button"
                            style={styles.outlineButton}
                            onClick={() => selectedEstimateRequest && applyBestLaborRateForRequest(selectedEstimateRequest, true)}
                          >
                            Regenerate Curated Draft
                          </button>
                          <button
                            type="button"
                            style={styles.primaryButton}
                            disabled={curatedLaborSaving}
                            onClick={saveCuratedLaborAsVerifiedMemory}
                          >
                            {curatedLaborSaving ? 'Saving...' : 'Save as Verified Labor Memory'}
                          </button>
                        </div>
                      </>
                    )
                  })() : (
                    <div style={styles.noticeBox}>
                      No curated labor draft yet. Re-apply labor to generate one from verified memory, similar job context, benchmark links, and public wage data.
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          onClick={() => selectedEstimateRequest && applyBestLaborRateForRequest(selectedEstimateRequest, true)}
                        >
                          Generate Curated Labor Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={styles.grid2}>
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Labor total / manual override"
                    value={estimateLaborCost}
                    onChange={(e) => setEstimateLaborCost(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Markup %"
                    value={estimateMarkupPercent}
                    onChange={(e) => setEstimateMarkupPercent(e.target.value)}
                  />
                </div>

                <input
                  style={styles.input}
                  type="number"
                  placeholder="Contingency %"
                  value={estimateContingencyPercent}
                  onChange={(e) => setEstimateContingencyPercent(e.target.value)}
                />

                <textarea
                  style={{ ...styles.input, minHeight: 100 }}
                  placeholder="Estimate notes and assumptions"
                  value={estimateNotes}
                  onChange={(e) => setEstimateNotes(e.target.value)}
                />

                <div style={styles.aiBox}>
                  <strong>Estimate Summary</strong>
                  <p>Materials: {money(estimateMaterialSubtotal)}</p>
                  <p>Labor: {money(estimateLaborNumber)}</p>
                  <p style={styles.small}>
                    Job execution labor scope: {jobScopeLaborHoursLabel}
                    {approvedJobScopeSteps.length > 0
                      ? ' (approved high hours feed the labor units above)'
                      : ' (draft only until approved)'}
                  </p>
                  {appliedLaborRate && (
                    <p style={styles.small}>
                      Labor base: {money(estimateLaborBaseNumber)} • Minimum:{' '}
                      {money(estimateLaborMinimumNumber)} • Trip:{' '}
                      {money(estimateTripChargeNumber)} • Disposal:{' '}
                      {money(estimateDisposalFeeNumber)}
                    </p>
                  )}
                  <p>
                    Markup: {estimateMarkupPercent}% = {money(estimateMarkupDollars)}
                  </p>
                  <p>
                    Contingency: {estimateContingencyPercent}% ={' '}
                    {money(estimateContingencyDollars)}
                  </p>
                  <p>
                    Suggested range: {money(estimateLowTotal)} - {money(estimatePremiumTotal)}
                  </p>
                  <h3>Standard estimate: {money(estimateStandardTotal)}</h3>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => setShowManualMaterialForm((current) => !current)}
                  >
                    + Add Material
                  </button>
                  <label style={{ ...styles.outlineButton, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={showRejectedEstimateItems}
                      onChange={(event) => setShowRejectedEstimateItems(event.target.checked)}
                    />
                    Show rejected items
                  </label>
                  <button
                    style={styles.primaryButton}
                    onClick={() => selectedEstimateRequest && buildLocalEstimateIntelligence(selectedEstimateRequest)}
                  >
                    Build Estimate Intelligence
                  </button>
                  <button style={styles.outlineButton} onClick={approveAllEstimateItems}>
                    Approve All Line Items
                  </button>
                  <button style={styles.primaryButton} onClick={generateEstimatePdf}>
                    Generate Draft PDF
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => selectedEstimateRequest && exportJobPacket(selectedEstimateRequest)}
                  >
                    Export Job Packet
                  </button>
                  <button style={styles.outlineButton} onClick={generateInvoicePdf}>
                    Generate Draft Invoice
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={() => selectedEstimateRequest && openEstimateReview(selectedEstimateRequest)}
                    disabled={estimateLoading}
                  >
                    {estimateLoading ? 'Loading...' : 'Refresh Items'}
                  </button>
                </div>

                {showManualMaterialForm && (
                  <div style={styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>Human-added material</span>
                      <span style={styles.badgeMuted}>Current job only</span>
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        placeholder="Material name"
                        value={manualMaterialDraft.itemName}
                        onChange={(e) => updateManualMaterialDraft({ itemName: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        placeholder="Vendor/source"
                        value={manualMaterialDraft.vendor}
                        onChange={(e) => updateManualMaterialDraft({ vendor: e.target.value })}
                      />
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Quantity"
                        value={manualMaterialDraft.quantity}
                        onChange={(e) => updateManualMaterialDraft({ quantity: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Unit cost"
                        value={manualMaterialDraft.unitCost}
                        onChange={(e) => updateManualMaterialDraft({ unitCost: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Total cost"
                        value={manualMaterialDraft.totalCost}
                        onChange={(e) => updateManualMaterialDraft({ totalCost: e.target.value })}
                      />
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        placeholder="Source URL"
                        value={manualMaterialDraft.sourceUrl}
                        onChange={(e) => updateManualMaterialDraft({ sourceUrl: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        placeholder="Repair item / scope link"
                        value={manualMaterialDraft.repairItemId}
                        onChange={(e) => updateManualMaterialDraft({ repairItemId: e.target.value })}
                      />
                    </div>
                    <select
                      style={styles.input}
                      value={manualMaterialDraft.reviewStatus}
                      onChange={(e) =>
                        updateManualMaterialDraft({ reviewStatus: e.target.value as ManualMaterialDraft['reviewStatus'] })
                      }
                    >
                      <option value="needs_review">needs_review</option>
                      <option value="human_verified">human_verified</option>
                    </select>
                    <textarea
                      style={{ ...styles.input, minHeight: 90 }}
                      placeholder="Notes"
                      value={manualMaterialDraft.notes}
                      onChange={(e) => updateManualMaterialDraft({ notes: e.target.value })}
                    />
                    <div style={styles.buttonRow}>
                      <button type="button" style={styles.primaryButton} onClick={addManualEstimateItem}>
                        Save Material
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        onClick={() => {
                          setManualMaterialDraft(EMPTY_MANUAL_MATERIAL_DRAFT)
                          setShowManualMaterialForm(false)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {visibleEstimateItems.length === 0 && (
                  <div style={styles.empty}>
                    No current-scope material items are visible. Add a material, run current-scope research, or show rejected items.
                  </div>
                )}

                {visibleEstimateItems.map((item) => (
                  <div key={item.id} style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={isEstimateItemRejected(item) ? styles.badgeDanger : styles.badge}>
                        {isEstimateItemRejected(item) ? 'Rejected' : item.confidence === 'human_added' ? 'Human-added material' : item.source_status === 'needs_source_review' ? 'Needs source review' : 'Included because...'}
                      </span>
                      {item.material_complexity && <span style={styles.badgeMuted}>{materialComplexityLabel(item.material_complexity)}</span>}
                      <span style={styles.badgeMuted}>{item.required_optional || 'required'}</span>
                      {item.human_approved && <span style={styles.badge}>Learned from approval</span>}
                      {isEstimateItemRejected(item) && <span style={styles.badgeMuted}>Learned from rejection</span>}
                      {item.source_status === 'pricing_memory' && <span style={styles.badgeMuted}>Price support only</span>}
                    </div>
                    <p style={styles.small}>Included because: {getEstimateInclusionReason(item)}</p>
                    <p style={styles.small}>Material list is draft unless human verified.</p>
                    {item.material_review_notes && (
                      <div style={styles.noticeBox}>{item.material_review_notes}</div>
                    )}

                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        value={item.item_name || ''}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, { item_name: e.target.value })
                        }
                      />
                      <input
                        style={styles.input}
                        value={item.source || ''}
                        placeholder="Source"
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, { source: e.target.value })
                        }
                      />
                    </div>

                    {(item.required_quantity || item.package_coverage || item.packages_needed) && (
                      <div style={styles.aiBox}>
                        <strong>Package Math</strong>
                        <div style={styles.grid3}>
                          <p style={styles.small}>
                            Required: {Number(item.required_quantity || item.quantity || 0).toLocaleString()}{' '}
                            {item.required_unit || 'units'}
                          </p>
                          <p style={styles.small}>
                            Package: {Number(item.package_coverage || item.package_size || 1).toLocaleString()}{' '}
                            {item.package_coverage_unit || item.package_unit || 'per package'}
                          </p>
                          <p style={styles.small}>
                            Packages: {Number(item.packages_needed || item.quantity || 0).toLocaleString()} ×{' '}
                            {money(Number(item.package_price || item.unit_price || 0))}
                          </p>
                        </div>
                        <p style={styles.small}>
                          {item.quantity_reason || 'Quantity draft needs human review.'}
                        </p>
                        <p style={styles.small}>
                          Source status: <strong>{item.source_status || 'needs_source_review'}</strong>
                          {item.source_status === 'needs_source_review'
                            ? ' • Product/search price is not verified. Do not approve automatically.'
                            : ' • Human-approved pricing memory used.'}
                        </p>
                      </div>
                    )}

                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Quantity low"
                        value={Number(item.quantity_low ?? item.required_quantity ?? item.quantity ?? 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            quantity_low: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Quantity high"
                        value={Number(item.quantity_high ?? item.quantity ?? 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            quantity_high: Number(e.target.value),
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        type="number"
                        value={Number(item.quantity || 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        type="number"
                        value={Number(item.unit_price || 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            unit_price: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        value={money(Number(item.total_price || 0))}
                        readOnly
                      />
                    </div>

                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <input
                        style={styles.input}
                        placeholder="Unit"
                        value={item.required_unit || item.package_unit || ''}
                        onChange={(e) => updateLocalEstimateItem(item.id, { required_unit: e.target.value })}
                      />
                      <select
                        style={styles.input}
                        value={item.required_optional || 'required'}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, { required_optional: e.target.value as EstimateItem['required_optional'] })
                        }
                      >
                        <option value="required">required</option>
                        <option value="optional">optional</option>
                        <option value="review">review</option>
                      </select>
                      <select
                        style={styles.input}
                        value={item.review_status || 'needs_review'}
                        onChange={(e) => updateLocalEstimateItem(item.id, { review_status: e.target.value })}
                      >
                        <option value="needs_review">needs_review</option>
                        <option value="human_verified">human_verified</option>
                        <option value="rejected">rejected</option>
                        <option value="deprecated">deprecated</option>
                      </select>
                    </div>

                    <input
                      style={styles.input}
                      placeholder="Source URL"
                      value={item.source_url || ''}
                      onChange={(e) =>
                        updateLocalEstimateItem(item.id, { source_url: e.target.value })
                      }
                    />

                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <select
                        style={styles.input}
                        value={item.rejection_reason || ''}
                        disabled={item.human_approved}
                        onChange={(e) => updateLocalEstimateItem(item.id, { rejection_reason: e.target.value })}
                      >
                        <option value="">Rejection reason</option>
                        {MATERIAL_REJECTION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <input
                        style={styles.input}
                        placeholder="Admin notes"
                        value={item.admin_notes || ''}
                        onChange={(e) => updateLocalEstimateItem(item.id, { admin_notes: e.target.value })}
                      />
                    </div>

                    <p style={styles.small}>
                      Confidence: {item.confidence || 'needs_review'} • Status:{' '}
                      {item.human_approved ? 'Human approved' : item.review_status || 'Needs review'}
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        style={styles.primaryButton}
                        onClick={() => saveEstimateItem(item)}
                        disabled={estimateSavingId === item.id}
                      >
                        {estimateSavingId === item.id ? 'Saving...' : 'Save Line Item'}
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => toggleEstimateItemApproved(item)}
                        disabled={isEstimateItemRejected(item)}
                      >
                        {item.human_approved ? 'Unapprove' : 'Approve'}
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => rejectEstimateItem(item)}
                        disabled={item.human_approved || estimateSavingId === item.id}
                      >
                        Reject / Remove
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => saveEstimateItemAsPricingMemory(item)}
                        disabled={!item.human_approved || isEstimateItemRejected(item)}
                      >
                        Use this price next time
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        onClick={() => recordHumanPricingMemory(item, item.confidence || 'needs_review')}
                        disabled={!item.human_approved || isEstimateItemRejected(item)}
                      >
                        Save as verified memory
                      </button>
                      {item.source_url && (
                        <button
                          style={styles.linkButton}
                          onClick={() => window.open(item.source_url || '', '_blank')}
                        >
                          Open Source
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {estimateResearchRows.length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <h3>Research Screenshots</h3>
                    <div style={styles.fileGrid}>
                      {estimateResearchRows.map((row) => (
                        <div key={row.id} style={styles.fileBox}>
                          <strong>{row.source || 'Source'}</strong>
                          <p style={styles.small}>{row.search_query}</p>
                          {row.screenshot_url ? (
                            <button
                              style={styles.linkButton}
                              onClick={() => window.open(row.screenshot_url || '', '_blank')}
                            >
                              Open Screenshot
                            </button>
                          ) : (
                            <p style={styles.small}>No screenshot saved.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
      {materialEditorItem && materialEditorDraft && (
        <div style={styles.overlay} onClick={closeMaterialEditor}>
          <div style={{ ...styles.modal, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Material Cost</h2>
            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Material name"
                value={materialEditorDraft.name}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, name: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Unit"
                value={materialEditorDraft.unit}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, unit: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Typical price"
                value={materialEditorDraft.typicalPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, typicalPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Category"
                value={materialEditorDraft.category}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, category: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Low price"
                value={materialEditorDraft.lowPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, lowPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="High price"
                value={materialEditorDraft.highPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, highPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="ZIP or service area"
                value={materialEditorDraft.zip}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, zip: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Source / store"
                value={materialEditorDraft.source}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, source: e.target.value } : draft)
                }
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={styles.secondaryButton} onClick={closeMaterialEditor}>
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={materialSavingId === materialEditorItem.id}
                onClick={saveMaterialEditor}
              >
                {materialSavingId === materialEditorItem.id ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sellerPrepReview && (
  <div style={styles.overlay} onClick={() => setSellerPrepReview(null)}>
    <div
      style={{
        ...styles.modal,
        maxWidth: 980,
        maxHeight: '90vh',
        overflow: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ marginTop: 0, color: '#06542d' }}>
            Seller Prep Review
          </h2>
          <p style={{ marginTop: 0 }}>
            Powered by AI. Approved by humans.
          </p>
        </div>
        <button
  type="button"
  style={{
    background: '#06542d',
    color: '#ffffff',
    border: '1px solid #06542d',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  }}
  onClick={printSellerPrepReport}
>
  Print / Save PDF Report
</button>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => setSellerPrepReview(null)}
        >
          Close
        </button>
      </div>

      <div
        style={{
          background: '#e8f5eb',
          border: '1px solid #b7dfc1',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <strong>Total Repair Range:</strong>{' '}
        ${sellerPrepReview.analysis.total_repair_low || 0} - $
        {sellerPrepReview.analysis.total_repair_high || 0}
        <br />

        <strong>Possible Value / Negotiation Impact:</strong>{' '}
        ${sellerPrepReview.analysis.total_value_impact_low || 0} - $
        {sellerPrepReview.analysis.total_value_impact_high || 0}
        <br />

        <strong>Seller Net Impact:</strong>{' '}
        ${sellerPrepReview.analysis.seller_net_low || 0} - $
        {sellerPrepReview.analysis.seller_net_high || 0}
        <br />

        <strong>Average Buyer Impact:</strong>{' '}
        {sellerPrepReview.analysis.average_buyer_impact_score || 0}/10
        <br />

        <strong>Average Inspection Risk:</strong>{' '}
        {sellerPrepReview.analysis.average_inspection_risk_score || 0}/10
      </div>

      <div
        style={{
          background: '#fff7df',
          border: '1px solid #eed38a',
          borderRadius: 16,
          padding: 14,
          marginBottom: 16,
          color: '#6b4a00',
        }}
      >
        AI-assisted analysis only. Human review is required before sending,
        approving, ordering, submitting, or making final recommendations.
      </div>

      <h3>Agent Summary</h3>
      <p>{sellerPrepReview.analysis.agent_summary || 'No summary available.'}</p>

      <h3>Seller Summary</h3>
      <p>{sellerPrepReview.analysis.seller_summary || 'No summary available.'}</p>

      <h3>Repair Items</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        {sellerPrepReview.items.length === 0 ? (
          <div>No seller prep items found.</div>
        ) : (
          sellerPrepReview.items.map((item: any) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', color: '#06542d' }}>
                {item.repair_item}
              </h4>

              <p style={{ marginTop: 0 }}>
                {item.scope_summary || 'No scope summary.'}
              </p>

              <div style={{ display: 'grid', gap: 6 }}>
                <div>
                  <strong>Trade:</strong> {item.trade_category || 'General'}
                </div>

                <div>
                  <strong>Cost Range:</strong> ${item.estimated_cost_low || 0} - $
                  {item.estimated_cost_high || 0}
                </div>

                <div>
                  <strong>Buyer Impact Score:</strong>{' '}
                  {item.buyer_impact_score || 0}/10
                </div>

                <div>
                  <strong>Inspection Risk Score:</strong>{' '}
                  {item.inspection_risk_score || 0}/10
                </div>

                <div>
                  <strong>Possible Value / Negotiation Impact:</strong>{' '}
                  ${item.estimated_value_impact_low || 0} - $
                  {item.estimated_value_impact_high || 0}
                </div>

                <div>
                  <strong>Seller Net Impact:</strong>{' '}
                  ${item.seller_net_impact_low || 0} - $
                  {item.seller_net_impact_high || 0}
                </div>

                <div>
                  <strong>Recommendation:</strong>{' '}
                  {String(item.recommendation || 'needs_human_review').replace(/_/g, ' ')}
                </div>

                <div>
                  <strong>Confidence:</strong>{' '}
                  {String(item.confidence || 'needs_review').replace(/_/g, ' ')}
                </div>

                <div>
                  <strong>Human Review:</strong>{' '}
                  {String(item.human_review_status || 'needs_review').replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Supabase Admin Login</h2>
            <p style={styles.muted}>Sign in with your Shelter Prep admin account before saving protected records.</p>

            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />

            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSupabaseLogin()
              }}
            />

            {authMessage && <div style={styles.noticeBox}>{authMessage}</div>}

            <button style={styles.primaryButton} disabled={authLoading} onClick={() => void handleSupabaseLogin()}>
              {authLoading ? 'Signing in...' : 'Sign In with Supabase'}
            </button>

            <hr style={styles.divider} />

            <h3>Temporary PIN Fallback</h3>
            <p style={styles.muted}>PIN mode can view admin screens, but it cannot save source lessons through Supabase RLS.</p>

            <input
              style={styles.input}
              placeholder="Enter admin PIN"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
            />

            <button style={styles.primaryButton} onClick={handleLogin}>
              Continue with PIN
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              onClick={() => setShowLogin(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {

  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 8,
    margin: '8px 0 12px',
  },
  checkboxLabel: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    fontSize: 13,
    lineHeight: 1.35,
    color: '#173425',
  },
  smallDanger: {
    fontSize: 13,
    lineHeight: 1.45,
    color: '#8a2f2f',
  },
  warningBox: {
    border: '1px solid #d9b35f',
    background: '#fff8e8',
    color: '#5b410b',
    borderRadius: 14,
    padding: 14,
    margin: '14px 0 18px',
    lineHeight: 1.5,
  },
  reviewBox: {
    border: '1px solid #d7dfd3',
    background: '#fbfdf9',
    borderRadius: 18,
    padding: 18,
  },
  intakeFlow: {
    display: 'grid',
    gap: 14,
  },
  intakeStepCard: {
    border: '1px solid #d7dfd3',
    background: '#fbfcfa',
    borderRadius: 18,
    padding: 16,
  },
  intakeStepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
    color: '#173425',
  },
  intakeMediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  intakeMediaButton: {
    minHeight: 68,
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    color: '#173425',
    borderRadius: 16,
    padding: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontWeight: 900,
    cursor: 'pointer',
    lineHeight: 1.25,
  },
  hiddenFileInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: 'none',
  },
  mediaSummaryBox: {
    display: 'grid',
    gap: 6,
    marginTop: 12,
    padding: 12,
    border: '1px solid #e5ecdf',
    background: '#ffffff',
    borderRadius: 14,
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.45,
  },
  propertyFactsSummary: {
    display: 'grid',
    gap: 6,
    padding: 12,
    border: '1px solid #dfe8da',
    background: '#ffffff',
    borderRadius: 14,
    color: '#173425',
    fontWeight: 800,
    lineHeight: 1.45,
  },
  progressiveFieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    paddingTop: 10,
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    alignItems: 'start',
  },
  applicationFilterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 12,
    alignItems: 'start',
  },
  intakeDisclosure: {
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    borderRadius: 16,
    padding: '0 12px 8px',
  },
  intakeStatusCard: {
    border: '1px solid #dfe8da',
    background: '#f7faf5',
    borderRadius: 18,
    padding: 16,
    color: '#173425',
  },
  intakeActionRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  scopeText: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
    color: '#123524',
    background: '#f7faf5',
    border: '1px solid #dfe8da',
    borderRadius: 12,
    padding: 12,
  },
  segmentedControl: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 6,
    padding: 5,
    border: '1px solid #d7dfd3',
    borderRadius: 16,
    background: '#f7faf5',
    margin: '16px 0',
  },
  segmentedButton: {
    border: 'none',
    background: 'transparent',
    color: '#5f6f63',
    borderRadius: 12,
    minHeight: 48,
    padding: '10px 8px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },
  segmentedActive: {
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    color: '#173425',
    borderRadius: 8,
    minHeight: 48,
    padding: '10px 8px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },
  messageEmptyState: {
    border: '1px solid #dfe8da',
    background: '#fbfcfa',
    borderRadius: 18,
    padding: 18,
    color: '#5f6f63',
    lineHeight: 1.5,
  },
  messageCard: {
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    maxWidth: 920,
  },
  messageCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  messagePropertyTitle: {
    margin: 0,
    color: '#173425',
    fontSize: 21,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  messagePropertyMeta: {
    margin: '4px 0 0',
    color: '#7a857d',
    fontSize: 13,
    lineHeight: 1.3,
  },
  workflowStateChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 30,
    borderRadius: 8,
    background: '#eef6ec',
    color: '#0f542d',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
  },
  messagePurposeRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 12,
    color: '#5f6f63',
    fontSize: 13,
    lineHeight: 1.4,
  },
  messagePreview: {
    whiteSpace: 'pre-wrap',
    margin: '12px 0',
    color: '#273b2f',
    fontSize: 15,
    lineHeight: 1.5,
  },
  messageNote: {
    margin: '0 0 12px',
    color: '#5f6f63',
    fontSize: 13,
    lineHeight: 1.4,
  },
  messageActionRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, auto) minmax(120px, 1fr)',
    gap: 10,
    alignItems: 'start',
  },
  messageMore: {
    minWidth: 0,
  },
  messageMoreSummary: {
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 14px',
    border: '1px solid #d7dfd3',
    borderRadius: 8,
    color: '#173425',
    background: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  messageMoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 8,
    marginTop: 8,
  },
  mutedList: {
    color: '#536056',
    lineHeight: 1.6,
    marginTop: 8,
  },
  replyDraftBox: {
    marginTop: 8,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
    background: '#f5f7fb',
    border: '1px solid #dce3ee',
    borderRadius: 12,
    padding: 12,
    color: '#1f2a30',
  },
  linkPanel: {
    border: '1px solid #cbd8ca',
    background: '#ffffff',
    borderRadius: 8,
    padding: 14,
    textAlign: 'left',
    cursor: 'pointer',
    color: '#173425',
    display: 'grid',
    gap: 6,
    lineHeight: 1.4,
  },
  propertyProfileCard: {
    border: '1px solid #cbd8ca',
    background: '#fbfdf9',
    borderRadius: 8,
    padding: 12,
    margin: '12px 0',
  },
  mobilePropertyProfileCard: {
    borderRadius: 20,
    padding: 14,
    background: '#fbfdf9',
  },
  compactFactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    color: '#36463b',
  },
  mobileCompactFactGrid: {
    gridTemplateColumns: '1fr',
    gap: 7,
    fontSize: 15,
  },
  intelligencePanel: {
    border: '1px solid #9fc6a7',
    background: '#f4fbf5',
    borderRadius: 8,
    padding: 16,
    margin: '16px 0',
  },
  workflowCard: {
    border: '1px solid #d7dfd3',
    background: '#fbfcfa',
    borderRadius: 14,
    padding: 16,
    margin: '16px 0',
  },
  mobileWorkflowCard: {
    padding: 14,
    borderRadius: 18,
  },
  workflowHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 16,
  },
  workflowStage: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    color: '#5f6f63',
    borderRadius: 8,
    padding: '5px 9px',
    fontSize: 12,
    fontWeight: 900,
  },
  workflowTitle: {
    margin: '10px 0 4px',
    color: '#173425',
    fontSize: 18,
    lineHeight: 1.25,
  },
  workflowBody: {
    margin: 0,
    color: '#4c5b50',
    fontSize: 14,
    lineHeight: 1.5,
  },
  workflowFootnote: {
    margin: '8px 0 0',
    color: '#7a857d',
    fontSize: 12,
    lineHeight: 1.4,
  },
  workflowPrimaryButton: {
    border: '1px solid #0f542d',
    background: '#0f542d',
    color: '#ffffff',
    padding: '13px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 48,
    minWidth: 168,
  },
  intelligenceSummary: {
    border: '1px solid #dfe8da',
    background: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  logisticsAlert: {
    display: 'grid',
    gap: 6,
    marginTop: 10,
    padding: 10,
    border: '1px solid #ecd9a7',
    background: '#fff8e8',
    borderRadius: 10,
    color: '#6f4f14',
    fontSize: 12,
    lineHeight: 1.4,
  },
  logisticsSummaryBox: {
    borderTop: '1px solid #edf1ea',
    marginTop: 12,
    paddingTop: 12,
  },
  logisticsFactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 8,
    margin: '10px 0',
    color: '#5f6f63',
    fontSize: 13,
    fontWeight: 800,
    textTransform: 'capitalize',
  },
  workflowSecondaryButton: {
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    color: '#173425',
    padding: '12px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 800,
    minHeight: 48,
    textAlign: 'left',
  },
  moreActions: {
    marginTop: 14,
  },
  moreActionsSummary: {
    cursor: 'pointer',
    color: '#0f542d',
    fontWeight: 900,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
  },
  moreActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    paddingTop: 8,
  },
  agentOutputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    paddingTop: 8,
  },
  agentOutputCard: {
    border: '1px solid #d7dfd3',
    background: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  packetBox: {
    whiteSpace: 'pre-wrap',
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 8,
    padding: 12,
    color: '#173425',
    fontFamily: 'Inter, Arial, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
  },
  page: {
    minHeight: '100vh',
    background: '#f6f4ef',
    color: '#173425',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", Arial, sans-serif',
    WebkitTextSizeAdjust: '100%' as any,
  },
  mobilePage: {
    background: '#f7f5f0',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1fr',
    gap: 20,
    alignItems: 'center',
    padding: '28px 42px 18px',
  },
  mobileHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    padding: '18px 16px 10px',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(247,245,240,0.96)',
    backdropFilter: 'blur(18px)',
    borderBottom: '1px solid rgba(15,84,45,0.08)',
  },
  brand: {
    fontSize: 30,
    letterSpacing: 3,
    fontWeight: 900,
    color: '#0f542d',
  },
  mobileBrand: {
    fontSize: 22,
    letterSpacing: 1.5,
  },
  subBrand: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 5,
    fontWeight: 800,
    color: '#0f542d',
  },
  mobileSubBrand: {
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 3,
  },
  nav: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  mobileNav: {
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch' as any,
    paddingBottom: 4,
    marginLeft: -2,
    marginRight: -2,
  },
  navButton: {
    border: 'none',
    background: 'transparent',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 800,
    cursor: 'pointer',
    color: '#173425',
    minHeight: 44,
  },
  navActive: {
    border: '1px solid #0f542d',
    background: '#e7f3e5',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#0f542d',
    minHeight: 44,
  },
  mobileNavPill: {
    flex: '0 0 auto',
    padding: '11px 15px',
    minHeight: 48,
    whiteSpace: 'nowrap',
  },
  moreMenu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: 250,
    maxHeight: 'min(70vh, 620px)',
    overflowY: 'auto' as any,
    background: '#ffffff',
    border: '1px solid #d8cfc4',
    borderRadius: 8,
    boxShadow: '0 8px 18px rgba(0,0,0,0.10)',
    padding: 8,
    zIndex: 100,
  },
  moreMenuLabel: {
    padding: '10px 12px 6px',
    color: '#5f6f63',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase' as any,
  },
  moreMenuItem: {
    width: '100%',
    textAlign: 'left' as any,
    padding: '12px 14px',
    border: 'none',
    borderRadius: 10,
    background: '#ffffff',
    color: '#123225',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 48,
  },
  moreMenuItemActive: {
    width: '100%',
    textAlign: 'left' as any,
    padding: '12px 14px',
    border: 'none',
    borderRadius: 10,
    background: '#e8f5eb',
    color: '#123225',
    fontWeight: 900,
    cursor: 'pointer',
    minHeight: 48,
  },
  headerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  mobileHeaderActions: {
    justifyContent: 'stretch',
  },
  main: {
    padding: '12px 42px 60px',
  },
  mobileMain: {
    padding: '12px 14px calc(env(safe-area-inset-bottom) + 28px)',
  },
  previewBanner: {
    margin: '0 42px 18px',
    padding: '14px 18px',
    border: '1px solid #d9b35f',
    borderRadius: 16,
    background: '#fff8e8',
    color: '#5b410b',
    lineHeight: 1.45,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.45fr',
    gap: 22,
  },
  card: {
    background: 'white',
    border: '1px solid #d7dfd3',
    borderRadius: 8,
    padding: 20,
    boxShadow: 'none',
    marginBottom: 16,
  },
  mobileCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    boxShadow: 'none',
  },
  sideCard: {
    background: '#eef3ea',
    border: '1px solid #d7dfd3',
    borderRadius: 8,
    padding: 20,
    alignSelf: 'start',
  },
  healthGrid: {
    display: 'grid',
    gap: 10,
    margin: '12px 0 16px',
  },
  healthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 12,
    padding: '10px 12px',
  },
  healthOk: {
    color: '#0f542d',
  },
  healthNeedsSetup: {
    color: '#8a5b00',
  },
  dashboardHero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 18,
  },
  dashboardMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
    gap: 12,
    marginBottom: 18,
  },
  dashboardMetricCard: {
    border: '1px solid #d7dfd3',
    background: '#fbfcfa',
    borderRadius: 14,
    padding: 14,
    display: 'grid',
    gap: 4,
  },
  hero: {
    background: '#173425',
    color: 'white',
    padding: 24,
    borderRadius: 8,
    fontSize: 30,
    fontWeight: 900,
    marginBottom: 18,
  },
  muted: {
    color: '#5f6f63',
    lineHeight: 1.5,
  },
  small: {
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.4,
  },
  smallList: {
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 18,
  },
  input: {
    width: '100%',
    minHeight: 52,
    padding: '14px 16px',
    borderRadius: 8,
    border: '1px solid #d7dfd3',
    marginBottom: 12,
    boxSizing: 'border-box',
    fontSize: 16,
    color: '#173425',
    background: '#ffffff',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: 12,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gap: 12,
  },
  grid5: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
    gap: 10,
    marginBottom: 12,
  },
  mobileStack: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
  },
  propertyInfoPanel: {
    border: '1px solid #d7dfd3',
    background: '#fbfcfa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  factCard: {
    border: '1px solid #d7dfd3',
    background: '#f7faf5',
    borderRadius: 14,
    padding: 12,
    display: 'grid',
    gap: 4,
    color: '#173425',
  },
  uploadBox: {
    border: '1px solid #d7dfd3',
    borderRadius: 16,
    padding: 16,
    background: '#fbfcfa',
    marginBottom: 12,
  },
  primaryButton: {
    border: 'none',
    background: '#0f542d',
    color: 'white',
    padding: '13px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 48,
  },
  outlineButton: {
    border: '1px solid #d7dfd3',
    background: 'white',
    color: '#173425',
    padding: '13px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 48,
  },
  secondaryButton: {
    border: '1px solid #d7dfd3',
    background: '#f8faf7',
    color: '#173425',
    padding: '10px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 800,
    minHeight: 48,
  },
  wideButton: {
    width: '100%',
    border: 'none',
    background: '#0f542d',
    color: 'white',
    padding: '13px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 900,
    marginTop: 10,
    minHeight: 50,
  },
  success: {
    background: '#e7f3e5',
    color: '#0f542d',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    fontWeight: 800,
  },
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 18,
  },
  mobileKanban: {
    gap: 14,
  },
  column: {
    borderRadius: 8,
    padding: 16,
    minHeight: 0,
  },
  mobileColumn: {
    borderRadius: 8,
    padding: 12,
  },
  empty: {
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    padding: 14,
    color: '#5f6f63',
  },
  requestCard: {
    background: '#fffdfa',
    border: '1px solid #e3e0d8',
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
    maxWidth: 920,
  },
  propertyCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
  },
  nextActionPanel: {
    background: '#f7f6f1',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    marginBottom: 8,
    display: 'grid',
    gap: 8,
  },
  mobileRequestCard: {
    borderRadius: 8,
    padding: 16,
    maxWidth: 'none',
    marginBottom: 12,
    boxShadow: 'none',
  },
  mobileRequestTitle: {
    display: 'block',
    fontSize: 20,
    lineHeight: 1.2,
    marginBottom: 6,
    letterSpacing: 0,
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 14,
  },
  fileBox: {
    background: '#fbfcfa',
    border: '1px solid #d7dfd3',
    borderRadius: 14,
    padding: 14,
  },
  fileActionRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #edf1ea',
  },
  mobileFileActionRow: {
    gridTemplateColumns: '1fr',
    gap: 8,
    padding: '12px 0',
  },
  fileName: {
    color: '#173425',
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: 'anywhere',
    minWidth: 0,
  },
  mediaPanel: {
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    padding: 0,
    marginTop: 10,
    marginBottom: 10,
  },
  mediaPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 12,
  },
  mediaItem: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: 12,
    alignItems: 'start',
    background: '#fffdfa',
    border: '1px solid #e8e4dc',
    borderRadius: 12,
    padding: 10,
  },
  compactMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 8,
    color: '#5f625b',
    fontSize: 13,
    lineHeight: 1.4,
  },
  thumbnailButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
  },
  mediaThumbnail: {
    width: 72,
    height: 72,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid #d7dfd3',
    display: 'block',
    background: '#edf1ea',
  },
  mediaThumbnailFallback: {
    width: 72,
    height: 72,
    borderRadius: 8,
    border: '1px solid #d7dfd3',
    background: '#edf1ea',
    display: 'grid',
    placeItems: 'center',
    color: '#5f6f63',
    fontSize: 12,
    fontWeight: 800,
  },
  documentIcon: {
    width: 72,
    height: 72,
    borderRadius: 8,
    border: '1px solid #d7dfd3',
    background: '#f4f1ec',
    display: 'grid',
    placeItems: 'center',
    color: '#173425',
    fontSize: 12,
    fontWeight: 900,
  },
  mediaMeta: {
    display: 'grid',
    gap: 4,
    minWidth: 0,
  },
  mediaActions: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  revealCard: {
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 14,
    marginTop: 12,
    overflow: 'hidden',
  },
  revealSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    minHeight: 56,
    padding: '14px 14px',
    cursor: 'pointer',
    listStyle: 'none',
    color: '#173425',
  },
  revealChevron: {
    flex: '0 0 auto',
    minHeight: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    background: '#eef6ec',
    color: '#0f542d',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 900,
  },
  revealBody: {
    borderTop: '1px solid #edf1ea',
    padding: 14,
  },
  revealAction: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  revealItemList: {
    display: 'grid',
    gap: 8,
    marginBottom: 12,
  },
  revealLineItem: {
    display: 'grid',
    gap: 4,
    background: '#fbfcfa',
    border: '1px solid #edf1ea',
    borderRadius: 10,
    padding: 10,
  },
  questionList: {
    margin: 0,
    paddingLeft: 20,
    display: 'grid',
    gap: 8,
    color: '#173425',
    lineHeight: 1.45,
  },
  linkButton: {
    display: 'block',
    border: 'none',
    background: 'transparent',
    color: '#0f542d',
    padding: '4px 0',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  mobileLinkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    padding: '10px 12px',
    borderRadius: 14,
    background: '#eef6ec',
    textDecoration: 'none',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 30,
    borderRadius: 8,
    background: '#e8efe4',
    color: '#274331',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'capitalize',
  },
  badgeMuted: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 30,
    borderRadius: 8,
    background: '#f1eee8',
    color: '#5f625b',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
  },
  badgeDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 30,
    borderRadius: 8,
    background: '#f1e3dc',
    color: '#7a3b2d',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'capitalize',
  },
  noticeBox: {
    background: '#f8f5ee',
    border: '1px solid #e5dfd3',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    color: '#3d423b',
    fontSize: 12,
    lineHeight: 1.45,
  },
  aiBox: {
    background: '#f7f6f1',
    border: '1px solid #e5dfd3',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  inspectionTaskPanel: {
    background: '#fffdfa',
    border: '1px solid #e5dfd3',
    borderRadius: 8,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  inspectionTaskGrid: {
    display: 'grid',
    gap: 12,
  },
  inspectionTaskCard: {
    background: '#fffdfa',
    border: '1px solid #e8e4dc',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 12,
  },
  siteMediaPanel: {
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  siteMediaSourceList: {
    display: 'grid',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  siteMediaSourceRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
    gap: 10,
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #edf1ea',
  },
  siteMediaFindingGrid: {
    display: 'grid',
    gap: 12,
    marginTop: 8,
  },
  siteMediaFindingCard: {
    background: '#fffdfa',
    border: '1px solid #e8e4dc',
    borderRadius: 8,
    padding: 14,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #d7dfd3',
    margin: '22px 0',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: 'white',
    borderRadius: 20,
    padding: 24,
  },
}
