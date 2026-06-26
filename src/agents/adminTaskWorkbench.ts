import type { InspectionDraftStatus, InspectionRepairBundleDraft } from './inspectionIntelligence'

export type AdminTaskType =
  | 'estimate_bundle'
  | 'generate_material_list'
  | 'research_material_costs'
  | 'draft_contractor_scope'
  | 'draft_seller_summary'
  | 'identify_missing_info'
  | 'compare_to_memory'
  | 'review_contractor_upload'
  | 'create_repair_vs_credit_options'

export type AdminTaskStatus =
  | 'draft_created'
  | 'needs_review'
  | 'admin_reviewing'
  | 'needs_more_info'
  | 'approved'
  | 'rejected'

export type AdminTaskReviewStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'human_reviewed'
  | 'needs_more_info'
  | 'rejected'

export type AdminEstimateMaterialItem = {
  material_name: string
  quantity_assumption: string
  unit_cost_low: number
  unit_cost_likely: number
  unit_cost_high: number
  source: string
  source_date: string
  confidence: 'low' | 'medium' | 'high'
  substitution_notes: string
}

export type AdminEstimateDraft = {
  bundle_id: string
  trade_owner: string
  scope_summary: string
  labor_steps: string[]
  labor_hours_low: number
  labor_hours_likely: number
  labor_hours_high: number
  material_items: AdminEstimateMaterialItem[]
  material_cost_low: number
  material_cost_likely: number
  material_cost_high: number
  equipment_or_access_notes: string[]
  hidden_damage_risks: string[]
  missing_info: string[]
  pricing_sources: string[]
  confidence: 'low' | 'medium' | 'high'
  review_status: InspectionDraftStatus | AdminTaskReviewStatus
  admin_notes: string
  known_facts: string[]
  unknowns: string[]
  assumptions: string[]
  task_focus: AdminTaskType
  draft_response: string
}

export type AdminTaskDraft = {
  id: string
  property_id: string
  bundle_id?: string
  task_type: AdminTaskType
  admin_prompt: string
  input_evidence_ids: string[]
  status: AdminTaskStatus
  output_summary: string
  output_json: AdminEstimateDraft
  review_status: AdminTaskReviewStatus
  created_at: string
  reviewed_by?: string
  approved_at?: string
}

type BundleEstimateRule = {
  keywords: string[]
  laborSteps: string[]
  laborHours: [number, number, number]
  materials: Array<Omit<AdminEstimateMaterialItem, 'source' | 'source_date' | 'confidence'>>
  equipmentNotes: string[]
  hiddenDamageRisks: string[]
  confidence: 'low' | 'medium'
}

export const ADMIN_TASK_TYPES: AdminTaskType[] = [
  'estimate_bundle',
  'generate_material_list',
  'research_material_costs',
  'draft_contractor_scope',
  'draft_seller_summary',
  'identify_missing_info',
  'compare_to_memory',
  'review_contractor_upload',
  'create_repair_vs_credit_options',
]

const PLACEHOLDER_SOURCE = 'Placeholder local draft - live source verification not implemented'

const BUNDLE_ESTIMATE_RULES: BundleEstimateRule[] = [
  {
    keywords: ['roof', 'water intrusion', 'gutter', 'downspout', 'flashing'],
    laborSteps: [
      'Verify roof penetrations, vent flashings, gutter leak area, and downspout drainage.',
      'Repair or reseal penetrations only after roof-side review confirms scope.',
      'Document whether interior ceiling review is needed before seller-ready pricing.',
    ],
    laborHours: [4, 8, 14],
    materials: [
      material('Roof sealant / compatible flashing sealant', 'Allowance for penetrations and minor flashing repairs', 45, 125, 260),
      material('Plumbing vent flashing components', 'Allowance pending roof material and vent count verification', 60, 175, 420),
      material('Gutter/downspout repair materials', 'Allowance for sealant, fasteners, elbows, extensions, or small replacement parts', 35, 140, 360),
    ],
    equipmentNotes: ['Roof access, ladder safety, roof pitch, and manufactured-home roof details may change labor.'],
    hiddenDamageRisks: ['Possible ceiling/cavity damage remains unknown until interior and roof-side verification.'],
    confidence: 'low',
  },
  {
    keywords: ['exterior', 'siding', 'skirting', 'pest', 'window', 'flashing', 'vegetation'],
    laborSteps: [
      'Map affected siding, trim, window flashing, skirting, vegetation, and pest-entry locations.',
      'Prioritize water-management and pest-exclusion repairs before cosmetic finish work.',
      'Separate siding repair, skirting repair, and pest-exclusion scope for admin review.',
    ],
    laborHours: [6, 14, 28],
    materials: [
      material('Siding/skirting repair materials', 'Allowance pending affected elevations and panel/skirting dimensions', 120, 380, 950),
      material('Exterior fasteners, flashing, sealant, and trim supplies', 'Allowance pending location count', 60, 210, 520),
      material('Pest-exclusion materials', 'Allowance for mesh, backing, sealants, and small perimeter repairs', 45, 160, 420),
    ],
    equipmentNotes: ['Access around vegetation, skirting clearance, and window/trim reach may change labor.'],
    hiddenDamageRisks: ['Moisture or pest damage behind siding/skirting is unknown until opened or inspected.'],
    confidence: 'low',
  },
  {
    keywords: ['bathroom', 'plumbing', 'p-trap', 'toilet', 'shower', 'moisture', 'drain', 'shutoff'],
    laborSteps: [
      'Stop active leak and verify source before broader finish repair assumptions.',
      'Review toilet wax ring/moisture concern, shower penetrations, caulk, shutoffs, and drain materials.',
      'Decide whether subfloor or hidden moisture verification is required.',
    ],
    laborHours: [4, 10, 22],
    materials: [
      material('Plumbing repair parts allowance', 'Allowance for P-trap, fittings, supply lines, valves, and minor fixture parts', 85, 260, 680),
      material('Toilet reset / wax ring supplies', 'Allowance pending toilet condition and floor review', 25, 80, 180),
      material('Bath sealant / caulk / waterproofing supplies', 'Allowance pending shower surround and floor condition', 20, 90, 240),
    ],
    equipmentNotes: ['Fixture access, shutoff condition, and moisture/subfloor verification may change labor.'],
    hiddenDamageRisks: ['Elevated moisture may indicate hidden subfloor or finish damage that is not priced here.'],
    confidence: 'low',
  },
  {
    keywords: ['ceiling', 'hidden damage', 'sagging', 'concealed'],
    laborSteps: [
      'Document sagging location and relationship to roof, plumbing, and adjacent ceiling areas.',
      'Perform non-destructive review where accessible before assigning cause.',
      'Draft repair path only after moisture/support/panel-failure cause is better understood.',
    ],
    laborHours: [3, 8, 18],
    materials: [
      material('Ceiling patch/finish material allowance', 'Placeholder only; actual materials depend on cause and affected area', 45, 180, 520),
      material('Protection and containment supplies', 'Allowance for interior protection during review or minor repair', 25, 90, 220),
    ],
    equipmentNotes: ['Interior access, ceiling height, containment, and need for cavity access may change labor.'],
    hiddenDamageRisks: ['Cause is unknown: moisture, support, panel failure, or concealed condition may change scope.'],
    confidence: 'low',
  },
  {
    keywords: ['crawlspace', 'underfloor', 'belly wrap', 'dryer vent', 'insulation', 'rodent'],
    laborSteps: [
      'Inspect belly wrap damage, access door fit, pest openings, dryer vent route, and visible insulation.',
      'Sequence pest exclusion, dryer vent correction, and belly wrap/insulation repair.',
      'Document visibility limitations and any need for follow-up crawlspace trade review.',
    ],
    laborHours: [4, 10, 20],
    materials: [
      material('Belly wrap / underfloor repair materials', 'Allowance pending damaged area size and fastening method', 80, 260, 760),
      material('Dryer vent connection materials', 'Allowance for vent hose/duct, clamps, termination parts, and fastening', 35, 120, 320),
      material('Pest-exclusion and access-door materials', 'Allowance pending opening count and door condition', 45, 180, 480),
    ],
    equipmentNotes: ['Crawlspace clearance, PPE, pest activity, and access constraints may change labor.'],
    hiddenDamageRisks: ['Pest, moisture, insulation, duct, or underfloor damage may be hidden by visibility limits.'],
    confidence: 'low',
  },
  {
    keywords: ['hvac', 'electrical', 'heat pump', 'wiring', 'filter'],
    laborSteps: [
      'Have licensed HVAC technician review heat pump wiring and service condition.',
      'Replace filter and document whether wiring is HVAC low-voltage/control wiring or electrical scope.',
      'Escalate to electrician if licensed HVAC review identifies electrical work outside HVAC scope.',
    ],
    laborHours: [1, 3, 8],
    materials: [
      material('HVAC service materials allowance', 'Placeholder for filter, connectors, minor wire-management materials, or service parts', 25, 110, 360),
      material('Electrical safety correction allowance', 'Placeholder only; depends on licensed review and wiring type', 35, 180, 620),
    ],
    equipmentNotes: ['Licensed HVAC/electrical review, disconnect access, and equipment condition may change labor.'],
    hiddenDamageRisks: ['Wiring type and equipment condition are unknown until licensed review.'],
    confidence: 'low',
  },
  {
    keywords: ['general maintenance', 'minor', 'door', 'closet', 'dishwasher', 'laundry', 'stopper', 'handyman'],
    laborSteps: [
      'Separate simple handyman punch-list items from items requiring plumber, appliance, or flooring review.',
      'Verify dishwasher after shutoff decision and document laundry floor condition.',
      'Complete minor adjustments only after unknowns are separated from higher-risk bundles.',
    ],
    laborHours: [2, 6, 12],
    materials: [
      material('General punch-list materials allowance', 'Allowance for fasteners, small hardware, door/closet adjustment parts, and stopper linkage parts', 35, 140, 360),
      material('Laundry flooring repair allowance', 'Placeholder pending floor-dip cause and material match', 40, 220, 720),
    ],
    equipmentNotes: ['Access, material matching, and dishwasher test condition may change labor.'],
    hiddenDamageRisks: ['Laundry floor dips and dishwasher non-test condition may reveal additional scope.'],
    confidence: 'low',
  },
]

function material(
  material_name: string,
  quantity_assumption: string,
  unit_cost_low: number,
  unit_cost_likely: number,
  unit_cost_high: number,
  substitution_notes = 'Verify compatible product, dimensions, and supplier availability before use.'
) {
  return {
    material_name,
    quantity_assumption,
    unit_cost_low,
    unit_cost_likely,
    unit_cost_high,
    substitution_notes,
  }
}

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9\s/.-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function sumMaterials(items: AdminEstimateMaterialItem[], key: 'unit_cost_low' | 'unit_cost_likely' | 'unit_cost_high') {
  return items.reduce((sum, item) => sum + Number(item[key] || 0), 0)
}

function findRule(bundle: InspectionRepairBundleDraft) {
  const text = normalize([
    bundle.bundle_id,
    bundle.title,
    bundle.trade_owner,
    bundle.recommended_trade,
    bundle.system_category,
    bundle.source_text,
    bundle.finding_summary,
  ].filter(Boolean).join(' '))
  return BUNDLE_ESTIMATE_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword))) ||
    BUNDLE_ESTIMATE_RULES[BUNDLE_ESTIMATE_RULES.length - 1]
}

function getTaskSummary(taskType: AdminTaskType, bundle: InspectionRepairBundleDraft) {
  const title = bundle.title || 'selected bundle'
  if (taskType === 'generate_material_list') return `AI Draft material list for ${title}. Source verification required before pricing.`
  if (taskType === 'research_material_costs') return `AI Draft material-cost research prompt for ${title}. Live source research is not implemented, so prices remain placeholders.`
  if (taskType === 'draft_contractor_scope') return `AI Draft contractor scope for ${title}. Contractor-ready use requires review.`
  if (taskType === 'draft_seller_summary') return `AI Draft seller summary for ${title}. Seller-ready use requires review.`
  if (taskType === 'identify_missing_info') return `AI Draft missing-information list for ${title}.`
  if (taskType === 'compare_to_memory') return `AI Draft pricing-memory comparison for ${title}. No memory is applied automatically.`
  if (taskType === 'review_contractor_upload') return `AI Draft contractor-upload review scaffold for ${title}. Contractor facts require source confirmation.`
  if (taskType === 'create_repair_vs_credit_options') return `AI Draft repair-vs-credit options for ${title}. Agent/seller-facing use requires review.`
  return `AI Draft estimate assumptions for ${title}. No final pricing.`
}

export function buildAdminTaskDraft(params: {
  propertyId?: string | number | null
  bundle: InspectionRepairBundleDraft
  taskType: AdminTaskType
  adminPrompt: string
  inputEvidenceIds?: string[]
  now?: Date
}): AdminTaskDraft {
  const now = params.now || new Date()
  const sourceDate = now.toISOString().slice(0, 10)
  const bundle = params.bundle
  const rule = findRule(bundle)
  const materialItems: AdminEstimateMaterialItem[] = rule.materials.map((item) => ({
    ...item,
    source: PLACEHOLDER_SOURCE,
    source_date: sourceDate,
    confidence: 'low',
  }))
  const knownFacts = [
    ...safeArray(bundle.known_facts),
    bundle.evidence_summary || '',
  ].filter(Boolean)
  const unknowns = [
    ...safeArray(bundle.unknowns),
    ...safeArray(bundle.missing_information),
  ].filter(Boolean)
  const missingInfo = [
    ...unknowns,
    ...safeArray(bundle.next_evidence_needed),
    'Admin must verify quantities, labor conditions, and source pricing before external use.',
  ].filter(Boolean)
  const assumptions = [
    'Draft assumes repair scope stays within visible/report-described conditions.',
    'Draft assumes no destructive discovery, permit requirement, or concealed damage unless listed as a risk.',
    'Draft material costs are placeholder assumptions because live source research is not implemented in this prototype.',
  ]
  const pricingSources = [
    PLACEHOLDER_SOURCE,
    'Uploaded/property evidence and inspection bundle context',
    'Reviewed pricing memory may be compared later but is not applied automatically',
  ]
  const estimate: AdminEstimateDraft = {
    bundle_id: bundle.bundle_id || bundle.id,
    trade_owner: bundle.trade_owner || bundle.recommended_trade || 'Admin review needed',
    scope_summary: bundle.finding_summary || bundle.summary || bundle.title,
    labor_steps: rule.laborSteps,
    labor_hours_low: rule.laborHours[0],
    labor_hours_likely: rule.laborHours[1],
    labor_hours_high: rule.laborHours[2],
    material_items: materialItems,
    material_cost_low: sumMaterials(materialItems, 'unit_cost_low'),
    material_cost_likely: sumMaterials(materialItems, 'unit_cost_likely'),
    material_cost_high: sumMaterials(materialItems, 'unit_cost_high'),
    equipment_or_access_notes: rule.equipmentNotes,
    hidden_damage_risks: [
      ...rule.hiddenDamageRisks,
      ...safeArray(bundle.clues).filter((item) => /hidden|unknown|verify|possible|clue/i.test(item)),
    ],
    missing_info: missingInfo,
    pricing_sources: pricingSources,
    confidence: rule.confidence,
    review_status: 'needs_review',
    admin_notes: 'AI Draft / Needs Review. Not seller-ready, contractor-ready, contractor-verified, or memory-ready until reviewed.',
    known_facts: knownFacts,
    unknowns,
    assumptions,
    task_focus: params.taskType,
    draft_response: getTaskSummary(params.taskType, bundle),
  }

  const id = `admin-task-${bundle.id}-${params.taskType}-${now.getTime()}`

  return {
    id,
    property_id: String(params.propertyId || bundle.property_id || ''),
    bundle_id: bundle.bundle_id || bundle.id,
    task_type: params.taskType,
    admin_prompt: params.adminPrompt,
    input_evidence_ids: safeArray(params.inputEvidenceIds).length
      ? safeArray(params.inputEvidenceIds)
      : [
          ...safeArray(bundle.evidence_references),
          ...safeArray(bundle.finding_ids),
          bundle.source_page || '',
        ].filter(Boolean),
    status: 'needs_review',
    output_summary: getTaskSummary(params.taskType, bundle),
    output_json: estimate,
    review_status: 'needs_review',
    created_at: now.toISOString(),
  }
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}
