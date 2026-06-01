import { useEffect, useMemo, useState } from "react"
import type { FocusEvent, ReactNode } from "react"
import { createSignedFileUrl, hasSupabaseConfig, insertRows, selectRows, updateRows, uploadPropertyFile } from "./lib/supabase"
import { lookupProperty } from "./lib/propertyLookup"

type PropertyStatus = "new" | "ready" | "review" | "needs_info" | "resolved"
type HealthState = "active" | "at_risk" | "stalled" | "abandoned" | "resolved"

type Measurement = {
  area: string
  length: string
  width: string
  notes: string
}

type PropertyRecord = {
  id: string
  created_at: string
  address: string
  client_name: string
  phone: string | null
  year_built: string | null
  square_feet: string | null
  bedrooms: string | null
  bathrooms: string | null
  lot_size: string | null
  project_type: string
  timeline: string
  priority: string
  budget: string
  access: string | null
  measurements: Measurement[]
  notes: string | null
  status: PropertyStatus
  health_state: HealthState
  readiness_score: number
  readiness_total: number
}

type PropertyFile = {
  id: string
  property_id: string
  created_at: string
  file_name: string
  file_type: string
  mime_type: string | null
  file_size: number | null
  storage_bucket: string
  storage_path: string
  review_status: string
}

type RiskScan = {
  id: string
  property_id: string
  created_at: string
  readiness_score: number
  confidence: string
  visible_concerns: string[]
  likely_repair_categories: string[]
  likely_trades: string[]
  missing_information: string[]
  risk_flags: string[]
  scope_assumptions: string[]
  contractor_review_notes: string | null
  client_summary: string | null
  estimate_prep_recommendations: string | null
  disclaimer: string
  human_reviewed: boolean
}

type RepairItem = {
  id: string
  property_id: number | string
  category: string | null
  location: string | null
  description: string
  source_text?: string | null
  trade?: string | null
  likely_trade?: string | null
  status: string
  review_status?: string | null
  recommendation?: string | null
}

type EstimatePrepItem = {
  id: string
  property_id: string
  repair_item_id: string | null
  item: string
  needed_before_estimate: string | null
  confidence: string
  status: string
}

type EstimateMaterialItem = {
  id: string
  property_id: string
  job_id: string
  request_id: string | null
  repair_item_id: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number | null
  scope_source: string
  relevance_reason: string
  relevance_confidence: number
  source_status: string
  review_status: string
}

type WorkflowEvent = {
  id: string
  property_id: string | null
  created_at: string
  event_type: string
  actor: string
  summary: string
}

type IntakeForm = {
  addressLine1: string
  city: string
  state: string
  zip: string
  clientName: string
  phone: string
  yearBuilt: string
  squareFeet: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  projectType: string
  timeline: string
  priority: string
  budget: string
  access: string
  measurements: Measurement[]
  notes: string
}

const projectTypes = ["Repairs", "Paint", "Flooring", "Roofing", "Cleanout", "Full prep"]
const timelineOptions = ["ASAP", "This week", "Before listing", "Flexible"]
const priorityOptions = ["Standard", "Time sensitive", "Client anxious"]
const budgetOptions = ["Not set", "Under $2.5k", "$2.5k-$10k", "$10k-$25k", "$25k+"]
const materialRelevanceThreshold = 0.65

const scopedMaterialRules = [
  {
    words: ["paint", "primer", "drywall patch", "touch up"],
    items: ["Paint and primer", "Masking, rollers, trays, and plastic", "Patch and prep materials"],
    reason: "paint repair scope",
  },
  {
    words: ["floor", "flooring", "lvp", "hardwood", "carpet"],
    items: ["Flooring material allowance", "Floor prep and transition materials", "Adhesive, underlayment, or fasteners"],
    reason: "flooring repair scope",
  },
  {
    words: ["roof", "shingle", "flashing", "gutter", "leak"],
    items: ["Roof repair material allowance", "Flashing, sealant, and fasteners", "Roof access and protection supplies"],
    reason: "roof repair scope",
  },
  {
    words: ["deck", "framing", "railing", "stairs", "wood", "trim", "door"],
    items: ["Lumber and framing allowance", "Fasteners, connectors, and hardware", "Cutting, fitting, and protection supplies"],
    reason: "deck or carpentry scope",
  },
  {
    words: ["tile", "grout", "thinset", "backsplash", "bathroom", "shower"],
    items: ["Tile material allowance", "Thinset, grout, spacers, and trim", "Surface prep and backer board allowance"],
    reason: "bathroom tile repair",
  },
  {
    words: ["cleanout", "haul", "debris", "trash", "disposal"],
    items: ["Debris bags and protection supplies", "Dump or disposal allowance", "Cleanup and site protection materials"],
    reason: "cleanout scope",
  },
]

const statusStyles: Record<PropertyStatus, string> = {
  new: "bg-blue-950 text-blue-300 border-blue-700",
  ready: "bg-green-900 text-green-200 border-green-700",
  review: "bg-amber-950 text-amber-300 border-amber-700",
  needs_info: "bg-red-950 text-red-300 border-red-700",
  resolved: "bg-zinc-800 text-zinc-200 border-zinc-600",
}

const healthStyles: Record<HealthState, string> = {
  active: "bg-green-950 text-green-200 border-green-800",
  at_risk: "bg-amber-950 text-amber-200 border-amber-800",
  stalled: "bg-orange-950 text-orange-200 border-orange-800",
  abandoned: "bg-red-950 text-red-200 border-red-800",
  resolved: "bg-zinc-800 text-zinc-200 border-zinc-600",
}

const emptyForm: IntakeForm = {
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
  clientName: "",
  phone: "",
  yearBuilt: "",
  squareFeet: "",
  bedrooms: "",
  bathrooms: "",
  lotSize: "",
  projectType: "Repairs",
  timeline: "Before listing",
  priority: "Standard",
  budget: "Not set",
  access: "",
  measurements: [{ area: "", length: "", width: "", notes: "" }],
  notes: "",
}

const inputClass =
  "w-full min-h-[52px] scroll-mt-28 rounded-2xl border border-[#3a3a3a] bg-[#090909] px-4 py-3 text-base text-white outline-none transition placeholder:text-gray-500 focus:border-green-500 focus:bg-[#101010] focus:ring-2 focus:ring-green-900/70"

function StatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  )
}

function HealthBadge({ health }: { health: HealthState }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${healthStyles[health]}`}>
      {health.replace("_", " ")}
    </span>
  )
}

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 flex-1 whitespace-nowrap rounded-lg border px-4 py-2 text-sm transition sm:flex-none ${
        active ? "bg-white text-black border-white" : "bg-[#111] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block scroll-mt-28">
      <span className="mb-2 block text-[15px] font-medium text-gray-100">{label}</span>
      {children}
    </label>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  )
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function sourceStatusLabel(status: string) {
  if (status === "needs_source_review" || status === "fallback_product_search") return "Needs source review"
  if (status === "pricing_memory") return "Pricing memory price suggestion"
  return status.replace(/_/g, " ")
}

function composeDisplayAddress(form: IntakeForm) {
  const cityStateZip = [form.city.trim(), [form.state.trim().toUpperCase(), form.zip.trim()].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")

  return [form.addressLine1.trim(), cityStateZip].filter(Boolean).join(", ")
}

function normalizeText(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

type RepairItemInsertStatus = "ai_draft" | "needs_review" | "approved" | "rejected"
type RepairItemReviewStatus =
  | "ai_draft"
  | "needs_review"
  | "in_review"
  | "needs_more_info"
  | "research_requested"
  | "research_drafted"
  | "answered"
  | "queued"
  | "researching"
  | "human_reviewed"
  | "approved"
  | "human_verified"
  | "rejected"
  | "deprecated"
type RepairItemRecommendation = "repair_before_listing" | "buyer_credit" | "optional" | "monitor" | "contractor_review"

type ProductionRepairItemInsert = {
  property_id: number
  description: string
  source_text: string
  status: RepairItemInsertStatus
  category?: string
  trade?: string
  location?: string
  review_status?: RepairItemReviewStatus
  inspection_report_id?: string
  repair_bundle_id?: string
  recommendation?: RepairItemRecommendation
  confidence?: string
  missing_info?: string[]
}

const repairItemAllowedStatuses: ReadonlySet<RepairItemInsertStatus> = new Set(["ai_draft", "needs_review", "approved", "rejected"])
const repairItemAllowedReviewStatuses: ReadonlySet<RepairItemReviewStatus> = new Set([
  "ai_draft",
  "needs_review",
  "in_review",
  "needs_more_info",
  "research_requested",
  "research_drafted",
  "answered",
  "queued",
  "researching",
  "human_reviewed",
  "approved",
  "human_verified",
  "rejected",
  "deprecated",
])
const repairItemAllowedRecommendations: ReadonlySet<RepairItemRecommendation> = new Set([
  "repair_before_listing",
  "buyer_credit",
  "optional",
  "monitor",
  "contractor_review",
])

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getNonEmptyString(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function parseBigintLikeId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed
  }
  return null
}

function toProductionRepairItemStatus(rawStatus: unknown, index: number) {
  const statusText = getNonEmptyString(rawStatus)
  if (!statusText) return { status: "needs_review" as RepairItemInsertStatus, reviewStatus: undefined }
  if (repairItemAllowedStatuses.has(statusText as RepairItemInsertStatus)) {
    return { status: statusText as RepairItemInsertStatus, reviewStatus: undefined }
  }
  if (repairItemAllowedReviewStatuses.has(statusText as RepairItemReviewStatus)) {
    return {
      status: statusText === "approved" ? "approved" : statusText === "rejected" ? "rejected" : ("needs_review" as RepairItemInsertStatus),
      reviewStatus: statusText as RepairItemReviewStatus,
    }
  }
  throw new Error(
    `[repair_items] Row ${index + 1}: invalid status '${statusText}'. Allowed status values: ai_draft, needs_review, approved, rejected.`
  )
}

function normalizeRepairItemsForInsert(rows: unknown[]) {
  return rows.map((row, index): ProductionRepairItemInsert => {
    const payload = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
    const propertyId = parseBigintLikeId(payload.property_id)
    if (propertyId === null) {
      throw new Error(
        `[repair_items] Row ${index + 1}: property_id must be a positive bigint-compatible number. Do not use lead/work-request UUIDs.`
      )
    }

    const description = getNonEmptyString(payload.description) || getNonEmptyString(payload.source_text)
    if (!description) {
      throw new Error(`[repair_items] Row ${index + 1}: description is required before insert.`)
    }
    const sourceText = getNonEmptyString(payload.source_text) || description

    const normalizedStatus = toProductionRepairItemStatus(payload.status, index)
    const reviewStatusInput = getNonEmptyString(payload.review_status)
    if (reviewStatusInput && !repairItemAllowedReviewStatuses.has(reviewStatusInput as RepairItemReviewStatus)) {
      throw new Error(`[repair_items] Row ${index + 1}: invalid review_status '${reviewStatusInput}'.`)
    }

    const recommendationInput = getNonEmptyString(payload.recommendation)
    if (recommendationInput && !repairItemAllowedRecommendations.has(recommendationInput as RepairItemRecommendation)) {
      throw new Error(
        `[repair_items] Row ${index + 1}: invalid recommendation '${recommendationInput}'.`
      )
    }

    const inspectionReportId = getNonEmptyString(payload.inspection_report_id)
    if (inspectionReportId && !isUuid(inspectionReportId)) {
      throw new Error(`[repair_items] Row ${index + 1}: inspection_report_id must be a valid UUID when provided.`)
    }

    const repairBundleId = getNonEmptyString(payload.repair_bundle_id)
    if (repairBundleId && !isUuid(repairBundleId)) {
      throw new Error(`[repair_items] Row ${index + 1}: repair_bundle_id must be a valid UUID when provided.`)
    }

    const normalized: ProductionRepairItemInsert = {
      property_id: propertyId,
      description,
      source_text: sourceText,
      status: normalizedStatus.status,
    }

    const category = getNonEmptyString(payload.category)
    if (category) normalized.category = category

    const trade = getNonEmptyString(payload.trade) || getNonEmptyString(payload.likely_trade)
    if (trade) normalized.trade = trade

    const location = getNonEmptyString(payload.location)
    if (location) normalized.location = location

    const confidence = getNonEmptyString(payload.confidence)
    if (confidence) normalized.confidence = confidence

    const missingInfo = Array.isArray(payload.missing_info)
      ? payload.missing_info.map((item) => getNonEmptyString(item)).filter(Boolean)
      : []
    if (missingInfo.length > 0) normalized.missing_info = missingInfo

    const reviewStatus = (reviewStatusInput || normalizedStatus.reviewStatus) as RepairItemReviewStatus | undefined
    if (reviewStatus) normalized.review_status = reviewStatus

    if (inspectionReportId) normalized.inspection_report_id = inspectionReportId
    if (repairBundleId) normalized.repair_bundle_id = repairBundleId
    if (recommendationInput) normalized.recommendation = recommendationInput as RepairItemRecommendation

    return normalized
  })
}

function validateMaterialForCurrentScope(
  materialName: string,
  property: PropertyRecord,
  repairItem: RepairItem,
  propertyFiles: PropertyFile[]
) {
  const workTypeText = normalizeText(
    `${property.project_type} ${repairItem.category || ""} ${repairItem.trade || repairItem.likely_trade || ""}`
  )
  const repairText = normalizeText(`${repairItem.description} ${repairItem.location || ""}`)
  const contextText = normalizeText(`${property.notes || ""} ${property.access || ""} ${propertyFiles.map((file) => file.file_name).join(" ")}`)
  const materialText = normalizeText(materialName)
  const rule = scopedMaterialRules.find((candidate) =>
    candidate.words.some((word) => workTypeText.includes(word) || repairText.includes(word))
  )

  const matchesCurrentWorkType = Boolean(rule?.words.some((word) => workTypeText.includes(word)))
  const matchesRepairDescription = Boolean(rule?.words.some((word) => repairText.includes(word)))
  const matchesInspectionNotes = Boolean(
    rule?.words.some((word) => contextText.includes(word)) ||
      propertyFiles.length > 0 ||
      contextText.length > 20
  )
  const hasLinkedRepairItem = Boolean(repairItem.id)
  const itemMatchesRule = Boolean(rule?.items.some((item) => normalizeText(item) === materialText))
  const confidence =
    (matchesCurrentWorkType ? 0.3 : 0) +
    (matchesRepairDescription ? 0.25 : 0) +
    (matchesInspectionNotes ? 0.2 : 0) +
    (hasLinkedRepairItem ? 0.2 : 0) +
    (itemMatchesRule ? 0.1 : 0)

  return {
    rule,
    isValid: Boolean(rule && hasLinkedRepairItem && confidence >= materialRelevanceThreshold),
    confidence,
  }
}

function buildCurrentScopeMaterialRows(
  property: PropertyRecord,
  repairItemsForProperty: RepairItem[],
  propertyFiles: PropertyFile[]
) {
  return repairItemsForProperty.flatMap((repairItem) => {
    const scopeText = normalizeText(`${property.project_type} ${repairItem.category} ${repairItem.description}`)
    const rule = scopedMaterialRules.find((candidate) => candidate.words.some((word) => scopeText.includes(word)))

    if (!rule) return []

    return rule.items.flatMap((itemName) => {
      const validation = validateMaterialForCurrentScope(itemName, property, repairItem, propertyFiles)

      if (!validation.isValid) return []

      return [
        {
          property_id: property.id,
          job_id: property.id,
          request_id: property.id,
          repair_item_id: repairItem.id,
          item_name: itemName,
          quantity: 1,
          unit: "allowance",
          unit_price: null,
          scope_source: "repair_item_scope",
          relevance_reason: `Included because: ${validation.rule?.reason || repairItem.category}`,
          relevance_confidence: Number(validation.confidence.toFixed(2)),
          source_status: "needs_source_review",
          review_status: "current_scope",
        },
      ]
    })
  })
}

function materialBelongsToCurrentJob(
  item: EstimateMaterialItem,
  property: PropertyRecord,
  repairItemsForProperty: RepairItem[],
  propertyFiles: PropertyFile[],
  verifiedOnly: boolean
) {
  const repairItem = repairItemsForProperty.find((repair) => repair.id === item.repair_item_id)

  if (!repairItem) return false
  if (item.property_id !== property.id || item.job_id !== property.id) return false
  if (item.review_status === "removed_from_job") return false
  if (item.scope_source !== "repair_item_scope" && item.review_status !== "human_approved") return false
  if (item.relevance_confidence < materialRelevanceThreshold) return false
  if (verifiedOnly && item.review_status !== "current_scope_verified" && item.review_status !== "human_approved") return false

  return validateMaterialForCurrentScope(item.item_name, property, repairItem, propertyFiles).isValid
}

function toStatusHealth(status: PropertyStatus, readinessScore: number, fileCount: number): HealthState {
  if (status === "resolved") return "resolved"
  if (status === "needs_info" && readinessScore < 4) return "at_risk"
  if (status === "review" && fileCount === 0) return "stalled"
  return "active"
}

function getReadinessItems(form: IntakeForm, filesLength: number) {
  const completedMeasurements = form.measurements.filter(
    (measurement) => measurement.area.trim() || measurement.length.trim() || measurement.width.trim()
  )

  return [
    { label: "Property address", done: Boolean(form.addressLine1.trim() && form.city.trim() && form.state.trim() && form.zip.trim()) },
    { label: "Client name", done: form.clientName.trim().length > 0 },
    { label: "Property facts", done: form.squareFeet.trim().length > 0 || form.yearBuilt.trim().length > 0 },
    { label: "Measurements", done: completedMeasurements.length > 0 },
    { label: "Access details", done: form.access.trim().length > 0 },
    { label: "Scope notes", done: form.notes.trim().length > 12 },
    { label: "Photos or docs", done: filesLength > 0 },
  ]
}

function buildRiskDraft(property: PropertyRecord, files: PropertyFile[]) {
  const notes = `${property.notes || ""} ${property.access || ""}`.toLowerCase()
  const categories = new Set<string>()
  const trades = new Set<string>()
  const concerns = new Set<string>()
  const missing = new Set<string>()
  const flags = new Set<string>()

  if (property.project_type) categories.add(property.project_type)
  if (notes.includes("roof")) {
    categories.add("Roofing")
    trades.add("Roofer")
    concerns.add("Roof condition needs contractor review.")
  }
  if (notes.includes("paint") || property.project_type === "Paint") {
    categories.add("Paint")
    trades.add("Painter")
  }
  if (notes.includes("floor") || property.project_type === "Flooring") {
    categories.add("Flooring")
    trades.add("Flooring contractor")
  }
  if (notes.includes("water") || notes.includes("leak") || notes.includes("mold")) {
    flags.add("Moisture-related condition mentioned.")
    concerns.add("Moisture context should be verified before estimate signoff.")
  }
  if (files.length === 0) missing.add("Upload photos or inspection documents.")
  if (!property.access) missing.add("Confirm access instructions.")
  if (property.measurements.length === 0) missing.add("Add measurements for main repair areas.")
  if (!property.square_feet && !property.year_built) missing.add("Confirm basic property facts.")
  if (property.priority === "Client anxious") flags.add("Client anxiety may require tighter review cadence.")
  if (property.timeline === "ASAP") flags.add("Compressed timeline may increase coordination risk.")

  if (trades.size === 0) trades.add("General repair review")
  if (concerns.size === 0) concerns.add("No specific visible concern recorded yet; review uploaded files and field notes.")

  return {
    visible_concerns: Array.from(concerns),
    likely_repair_categories: Array.from(categories),
    likely_trades: Array.from(trades),
    missing_information: Array.from(missing),
    risk_flags: Array.from(flags),
    scope_assumptions: ["Human review required before client-facing scope, pricing, or contractor approval."],
    confidence: missing.size > 2 ? "low" : missing.size > 0 ? "medium" : "ready_for_review",
    client_summary: `${property.address} has been organized for repair coordination review. The current record includes ${files.length} uploaded file${files.length === 1 ? "" : "s"} and ${property.measurements.length} measurement note${property.measurements.length === 1 ? "" : "s"}.`,
    contractor_review_notes: "Review uploaded files, confirm missing information, and validate scope before estimate prep is shared.",
    estimate_prep_recommendations: missing.size
      ? `Resolve: ${Array.from(missing).join("; ")}`
      : "Ready for human-reviewed estimate prep.",
  }
}

export default function App() {
  const [mode, setMode] = useState<"agent" | "admin">("agent")
  const [view, setView] = useState("intake")
  const [properties, setProperties] = useState<PropertyRecord[]>([])
  const [files, setFiles] = useState<PropertyFile[]>([])
  const [riskScans, setRiskScans] = useState<RiskScan[]>([])
  const [repairItems, setRepairItems] = useState<RepairItem[]>([])
  const [estimatePrepItems, setEstimatePrepItems] = useState<EstimatePrepItem[]>([])
  const [estimateMaterialItems, setEstimateMaterialItems] = useState<EstimateMaterialItem[]>([])
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [form, setForm] = useState<IntakeForm>(emptyForm)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [propertyLookupLoading, setPropertyLookupLoading] = useState(false)
  const [propertyLookupNote, setPropertyLookupNote] = useState("")
  const [propertyLookupTone, setPropertyLookupTone] = useState<"success" | "warning" | "error">("warning")
  const [verifiedScopeOnly, setVerifiedScopeOnly] = useState(false)

  const displayAddress = composeDisplayAddress(form)
  const requiredComplete =
    Boolean(form.addressLine1.trim() && form.city.trim() && form.state.trim() && form.zip.trim() && form.clientName.trim())
  const readinessItems = useMemo(() => getReadinessItems(form, selectedFiles.length), [form, selectedFiles.length])
  const readinessScore = readinessItems.filter((item) => item.done).length
  const readinessPercent = Math.round((readinessScore / readinessItems.length) * 100)
  const selectedProperty = selectedPropertyId
    ? properties.find((property) => property.id === selectedPropertyId)
    : properties[0]
  const selectedFilesForProperty = selectedProperty ? files.filter((file) => file.property_id === selectedProperty.id) : []
  const selectedScan = selectedProperty
    ? riskScans.find((scan) => scan.property_id === selectedProperty.id)
    : undefined
  const selectedRepairItems = selectedProperty
    ? repairItems.filter((item) => item.property_id === selectedProperty.id)
    : []
  const selectedEstimatePrepItems = selectedProperty
    ? estimatePrepItems.filter((item) => item.property_id === selectedProperty.id)
    : []
  const selectedEstimateMaterialItems = selectedProperty
    ? estimateMaterialItems.filter((item) =>
        materialBelongsToCurrentJob(item, selectedProperty, selectedRepairItems, selectedFilesForProperty, verifiedScopeOnly)
      )
    : []
  const selectedEvents = selectedProperty
    ? workflowEvents.filter((event) => event.property_id === selectedProperty.id).slice(0, 8)
    : []
  const selectedFilePreviews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      })),
    [selectedFiles]
  )
  const navTabs =
    mode === "agent"
      ? [
          { view: "intake", label: "New" },
          { view: "listings", label: "Properties" },
          { view: "reports", label: "Reports" },
        ]
      : [
          { view: "dashboard", label: "Review" },
          { view: "analytics", label: "Health" },
        ]

  useEffect(() => {
    return () => {
      selectedFilePreviews.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [selectedFilePreviews])

  const loadData = async () => {
    if (!hasSupabaseConfig) {
      setLoading(false)
      setError("Supabase environment variables are missing, so saved records cannot load yet.")
      return
    }

    try {
      setLoading(true)
      setError("")
      const [propertyRows, fileRows, scanRows, repairRows, estimateRows, materialRows, eventRows] = await Promise.all([
        selectRows<PropertyRecord>("properties", { order: "created_at.desc" }),
        selectRows<PropertyFile>("property_files", { order: "created_at.desc" }),
        selectRows<RiskScan>("property_risk_scans", { order: "created_at.desc" }),
        selectRows<RepairItem>("repair_items", { order: "created_at.desc" }),
        selectRows<EstimatePrepItem>("estimate_prep_items", { order: "created_at.desc" }),
        selectRows<EstimateMaterialItem>("estimate_material_items", { order: "created_at.desc" }),
        selectRows<WorkflowEvent>("workflow_events", { order: "created_at.desc" }),
      ])

      setProperties(propertyRows)
      setFiles(fileRows)
      setRiskScans(scanRows)
      setRepairItems(repairRows)
      setEstimatePrepItems(estimateRows)
      setEstimateMaterialItems(materialRows)
      setWorkflowEvents(eventRows)
      setSelectedPropertyId((current) => current || propertyRows[0]?.id || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load saved property records.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const updateForm = (field: keyof IntakeForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const addSelectedUploadFiles = (incomingFiles: FileList | null) => {
    const nextFiles = Array.from(incomingFiles ?? [])

    if (nextFiles.length === 0) return

    setSelectedFiles((current) => [...current, ...nextFiles])
  }

  const scrollFocusedFieldIntoView = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" })
      }, 180)
    }
  }

  const updateMeasurement = (index: number, field: keyof Measurement, value: string) => {
    setForm((current) => ({
      ...current,
      measurements: current.measurements.map((measurement, measurementIndex) =>
        measurementIndex === index ? { ...measurement, [field]: value } : measurement
      ),
    }))
  }

  const addMeasurement = () => {
    setForm((current) => ({
      ...current,
      measurements: [...current.measurements, { area: "", length: "", width: "", notes: "" }],
    }))
  }

  const removeMeasurement = (index: number) => {
    setForm((current) => ({
      ...current,
      measurements:
        current.measurements.length === 1
          ? [{ area: "", length: "", width: "", notes: "" }]
          : current.measurements.filter((_, measurementIndex) => measurementIndex !== index),
    }))
  }

  const prefillPropertyInfo = async () => {
    setError("")
    setPropertyLookupNote("")
    setPropertyLookupLoading(true)

    try {
      const property = await lookupProperty(form.addressLine1, form.city, form.state, form.zip)
      setForm((current) => ({
        ...current,
        addressLine1: property.addressLine1 || current.addressLine1,
        city: property.city || current.city,
        state: property.state || current.state,
        zip: property.zip || current.zip,
        yearBuilt: property.yearBuilt,
        squareFeet: property.squareFeet,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        lotSize: property.lotSize,
      }))
      setPropertyLookupNote(
        property.source === "api"
          ? `Lookup success: property info pulled with ${property.confidence} confidence.`
          : property.notes || "Provider not configured. Enter property facts manually."
      )
      setPropertyLookupTone(property.source === "api" ? "success" : "warning")
    } catch (lookupError) {
      setPropertyLookupNote(
        lookupError instanceof Error
          ? `${lookupError.message} Manual property facts are still editable.`
          : "Property lookup failed. Manual property facts are still editable."
      )
      setPropertyLookupTone("error")
    } finally {
      setPropertyLookupLoading(false)
    }
  }

  const logEvent = async (propertyId: string, eventType: string, summary: string, actor = "system") => {
    const [event] = await insertRows<WorkflowEvent>("workflow_events", [
      { property_id: propertyId, event_type: eventType, summary, actor },
    ])
    setWorkflowEvents((current) => [event, ...current])
    return event
  }

  const saveProperty = async () => {
    setSubmittedOnce(true)
    setMessage("")
    setError("")

    if (!requiredComplete) return

    try {
      setSaving(true)
      const status: PropertyStatus = readinessScore >= 5 ? "ready" : "needs_info"
      const cleanMeasurements = form.measurements.filter(
        (measurement) =>
          measurement.area.trim() || measurement.length.trim() || measurement.width.trim() || measurement.notes.trim()
      )

      const [property] = await insertRows<PropertyRecord>("properties", [
        {
          address: displayAddress,
          client_name: form.clientName.trim(),
          phone: form.phone.trim() || null,
          year_built: form.yearBuilt.trim() || null,
          square_feet: form.squareFeet.trim() || null,
          bedrooms: form.bedrooms.trim() || null,
          bathrooms: form.bathrooms.trim() || null,
          lot_size: form.lotSize.trim() || null,
          project_type: form.projectType,
          timeline: form.timeline,
          priority: form.priority,
          budget: form.budget,
          access: form.access.trim() || null,
          measurements: cleanMeasurements,
          notes: form.notes.trim() || null,
          status,
          health_state: toStatusHealth(status, readinessScore, selectedFiles.length),
          readiness_score: readinessScore,
          readiness_total: readinessItems.length,
        },
      ])

      const uploadedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const filePath = `${property.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`
          const storage = await uploadPropertyFile(filePath, file)

          const [fileRow] = await insertRows<PropertyFile>("property_files", [
            {
              property_id: property.id,
              file_name: file.name,
              file_type: file.type.startsWith("image/") ? "photo" : "document",
              mime_type: file.type || null,
              file_size: file.size,
              storage_bucket: storage.bucket,
              storage_path: storage.path,
              review_status: "uploaded",
            },
          ])
          return fileRow
        })
      )

      await logEvent(property.id, "property_submitted", "Property intake submitted by agent.", "agent")
      if (uploadedFiles.length > 0) {
        await logEvent(property.id, "files_uploaded", `${uploadedFiles.length} file(s) uploaded to the property record.`, "agent")
      }

      setProperties((current) => [property, ...current])
      setFiles((current) => [...uploadedFiles, ...current])
      setSelectedPropertyId(property.id)
      setForm(emptyForm)
      setSelectedFiles([])
      setSubmittedOnce(false)
      setMessage("Property saved. Admin can now review files and create the risk scan.")
      setView("listings")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the property.")
    } finally {
      setSaving(false)
    }
  }

  const updatePropertyStatus = async (property: PropertyRecord, status: PropertyStatus) => {
    setMessage("")
    setError("")

    try {
      const healthState = toStatusHealth(status, property.readiness_score, selectedFilesForProperty.length)
      const [updated] = await updateRows<PropertyRecord>("properties", { id: `eq.${property.id}` }, {
        status,
        health_state: healthState,
        updated_at: new Date().toISOString(),
      })
      await insertRows("project_health_records", [
        { property_id: property.id, health_state: healthState, reason: `Status updated to ${status.replace("_", " ")}.` },
      ])
      await logEvent(property.id, "status_updated", `Status updated to ${status.replace("_", " ")}.`, "admin")
      setProperties((current) => current.map((item) => (item.id === property.id ? updated : item)))
      setMessage("Status and project health saved.")
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update status.")
    }
  }

  const openFile = async (file: PropertyFile) => {
    setError("")

    try {
      const url = await createSignedFileUrl(file.storage_path)
      window.open(url, "_blank", "noopener,noreferrer")
      await logEvent(file.property_id, "file_opened", `Admin opened ${file.file_name}.`, "admin")
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Could not open this file.")
    }
  }

  const saveRiskScan = async (property: PropertyRecord) => {
    setMessage("")
    setError("")

    try {
      setSaving(true)
      const propertyFiles = files.filter((file) => file.property_id === property.id)
      const draft = buildRiskDraft(property, propertyFiles)

      const [scan] = await insertRows<RiskScan>("property_risk_scans", [
        {
          property_id: property.id,
          readiness_score: property.readiness_score,
          ...draft,
          human_reviewed: true,
        },
      ])

      const repairRows = draft.likely_repair_categories.slice(0, 4).map((category) => ({
        property_id: property.id,
        risk_scan_id: scan.id,
        category,
        location: property.measurements[0]?.area || null,
        description: `${category} review needed for ${property.address}.`,
        likely_trade: draft.likely_trades[0] || "General repair review",
        priority: property.priority === "Time sensitive" ? "high" : "standard",
        status: "needs_review",
      }))

      const prepRows = [
        {
          property_id: property.id,
          repair_item_id: null,
          item: "Confirm complete photo set and field context.",
          needed_before_estimate: draft.missing_information.join("; ") || "Human scope review.",
          confidence: draft.confidence,
          status: "open",
        },
        {
          property_id: property.id,
          repair_item_id: null,
          item: "Prepare contractor-ready scope draft.",
          needed_before_estimate: "Validate assumptions and missing measurements.",
          confidence: draft.confidence,
          status: "open",
        },
      ]

      let insertedRepairItems: RepairItem[] = []
      if (repairRows.length) {
        const normalizedRepairRows = normalizeRepairItemsForInsert(repairRows)
        insertedRepairItems = await insertRows<RepairItem>("repair_items", normalizedRepairRows)
      }
      const insertedPrepItems = await insertRows<EstimatePrepItem>("estimate_prep_items", prepRows)
      const materialRows = buildCurrentScopeMaterialRows(property, insertedRepairItems, propertyFiles)
      const insertedMaterialItems = materialRows.length
        ? await insertRows<EstimateMaterialItem>("estimate_material_items", materialRows)
        : []
      const event = await logEvent(property.id, "risk_scan_saved", "Property Risk Scan, repair items, and estimate prep saved.", "admin")

      if (draft.missing_information.length > 0) {
        await insertRows("failure_patterns", [
          {
            property_id: property.id,
            pattern_type: "missing_information",
            summary: draft.missing_information.join("; "),
            severity: "watch",
            source_event_id: event.id,
          },
        ])
      } else {
        await insertRows("winning_patterns", [
          {
            property_id: property.id,
            pattern_type: "complete_intake",
            summary: "Property record has files, field notes, access context, and measurements before estimate prep.",
            confidence: "observed",
            source_event_id: event.id,
          },
        ])
      }

      const [updated] = await updateRows<PropertyRecord>("properties", { id: `eq.${property.id}` }, {
        status: "review",
        health_state: toStatusHealth("review", property.readiness_score, propertyFiles.length),
        updated_at: new Date().toISOString(),
      })

      setRiskScans((current) => [scan, ...current.filter((item) => item.property_id !== property.id)])
      setRepairItems((current) => [...insertedRepairItems, ...current.filter((item) => item.property_id !== property.id)])
      setEstimatePrepItems((current) => [...insertedPrepItems, ...current.filter((item) => item.property_id !== property.id)])
      setEstimateMaterialItems((current) => [...insertedMaterialItems, ...current.filter((item) => item.property_id !== property.id)])
      setProperties((current) => current.map((item) => (item.id === property.id ? updated : item)))
      setMessage("Property Risk Scan saved with current-scope repair items, estimate prep, and scoped materials.")
    } catch (scanError) {
      console.error("[repair_items] saveRiskScan failed before/while insert.", scanError)
      setError(scanError instanceof Error ? scanError.message : "Could not save the Property Risk Scan.")
    } finally {
      setSaving(false)
    }
  }

  const removeMaterialFromCurrentJob = async (item: EstimateMaterialItem) => {
    setMessage("")
    setError("")

    try {
      const [updated] = await updateRows<EstimateMaterialItem>("estimate_material_items", { id: `eq.${item.id}` }, {
        review_status: "removed_from_job",
        updated_at: new Date().toISOString(),
      })
      setEstimateMaterialItems((current) => current.map((material) => (material.id === item.id ? updated : material)))
      setMessage("Material removed from this job estimate.")
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this material from the job.")
    }
  }

  return (
    <div
      className={`min-h-screen bg-[#030303] px-3 pt-4 text-white sm:px-6 sm:py-6 ${
        view === "intake" ? "pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" : "pb-28"
      }`}
      onFocusCapture={scrollFocusedFieldIntoView}
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Shelter<span className="text-green-600">Prep</span>
            </h1>
            <p className="text-sm text-gray-400">Repair coordination without the chaos</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={() => {
                setMode("agent")
                setView("intake")
              }}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm transition ${mode === "agent" ? "bg-green-700" : "bg-[#111] hover:bg-[#1a1a1a]"}`}
            >
              Agent
            </button>
            <button
              onClick={() => {
                setMode("admin")
                setView("dashboard")
              }}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm transition ${mode === "admin" ? "bg-green-700" : "bg-[#111] hover:bg-[#1a1a1a]"}`}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="mb-5 hidden flex-wrap gap-3 sm:flex">
          {navTabs.map((tab) => (
            <NavTab key={tab.view} active={view === tab.view} onClick={() => setView(tab.view)}>
              {tab.label === "New" ? "New Property" : tab.label}
            </NavTab>
          ))}
        </div>

        {(message || error || loading) && (
          <div className="mb-5 rounded-lg border border-[#2a2a2a] bg-[#0b0b0b] p-3 text-sm">
            {loading && <p className="text-gray-400">Loading saved property records...</p>}
            {message && <p className="text-green-300">{message}</p>}
            {error && <p className="text-red-300">{error}</p>}
          </div>
        )}

        {view === "intake" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className="rounded-2xl border border-[#333] bg-[#111] p-4 sm:p-6">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">New Property</h2>
                  <p className="mt-1 text-sm text-gray-400">Create the operational record before estimate prep begins.</p>
                </div>
                <span className="w-fit rounded-full border border-green-800 bg-green-950 px-3 py-1 text-xs text-green-200">
                  Saved to Supabase
                </span>
              </div>

              <div className="grid gap-4">
                <Field label="Street address">
                  <input
                    value={form.addressLine1}
                    onChange={(event) => updateForm("addressLine1", event.target.value)}
                    placeholder="123 Cedar St"
                    autoComplete="street-address"
                    className={inputClass}
                  />
                  {submittedOnce && !form.addressLine1.trim() && (
                    <span className="mt-2 block text-xs text-red-300">Street address is required.</span>
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-[1fr_96px_132px]">
                  <Field label="City">
                    <input
                      value={form.city}
                      onChange={(event) => updateForm("city", event.target.value)}
                      placeholder="Seattle"
                      autoComplete="address-level2"
                      className={inputClass}
                    />
                    {submittedOnce && !form.city.trim() && (
                      <span className="mt-2 block text-xs text-red-300">City is required.</span>
                    )}
                  </Field>

                  <Field label="State">
                    <input
                      value={form.state}
                      onChange={(event) => updateForm("state", event.target.value.toUpperCase().slice(0, 2))}
                      placeholder="WA"
                      autoComplete="address-level1"
                      inputMode="text"
                      className={inputClass}
                    />
                    {submittedOnce && !form.state.trim() && (
                      <span className="mt-2 block text-xs text-red-300">State is required.</span>
                    )}
                  </Field>

                  <Field label="Zip">
                    <input
                      value={form.zip}
                      onChange={(event) => updateForm("zip", event.target.value)}
                      placeholder="98101"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      className={inputClass}
                    />
                    {submittedOnce && !form.zip.trim() && (
                      <span className="mt-2 block text-xs text-red-300">Zip is required.</span>
                    )}
                  </Field>
                </div>

                <Field label="Client name">
                  <input
                    value={form.clientName}
                    onChange={(event) => updateForm("clientName", event.target.value)}
                    placeholder="Homeowner or seller"
                    autoComplete="name"
                    className={inputClass}
                  />
                  {submittedOnce && !form.clientName.trim() && (
                    <span className="mt-2 block text-xs text-red-300">Client name is required.</span>
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Client phone">
                    <input
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      placeholder="Optional"
                      autoComplete="tel"
                      inputMode="tel"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Timeline">
                    <select value={form.timeline} onChange={(event) => updateForm("timeline", event.target.value)} className={inputClass}>
                      {timelineOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Budget signal">
                    <select value={form.budget} onChange={(event) => updateForm("budget", event.target.value)} className={inputClass}>
                      {budgetOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value)} className={inputClass}>
                      {priorityOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="block text-sm font-medium text-gray-300">Property facts</span>
                  <button
                    type="button"
                    onClick={prefillPropertyInfo}
                    disabled={propertyLookupLoading}
                    className="min-h-[52px] w-full rounded-2xl border border-[#444] px-4 py-3 text-sm text-gray-100 transition hover:border-green-600 hover:text-white sm:w-fit"
                  >
                    {propertyLookupLoading ? "Pulling..." : "Pull property info"}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-5">
                  <Field label="Sq ft">
                    <input value={form.squareFeet} onChange={(event) => updateForm("squareFeet", event.target.value)} placeholder="2,140" className={inputClass} />
                  </Field>
                  <Field label="Built">
                    <input value={form.yearBuilt} onChange={(event) => updateForm("yearBuilt", event.target.value)} placeholder="1987" className={inputClass} />
                  </Field>
                  <Field label="Beds">
                    <input value={form.bedrooms} onChange={(event) => updateForm("bedrooms", event.target.value)} placeholder="3" className={inputClass} />
                  </Field>
                  <Field label="Baths">
                    <input value={form.bathrooms} onChange={(event) => updateForm("bathrooms", event.target.value)} placeholder="2.5" className={inputClass} />
                  </Field>
                  <Field label="Lot">
                    <input value={form.lotSize} onChange={(event) => updateForm("lotSize", event.target.value)} placeholder="6,000 sf" className={inputClass} />
                  </Field>
                </div>
                {propertyLookupNote && (
                  <p
                    className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                      propertyLookupTone === "success"
                        ? "border-green-800 bg-green-950/50 text-green-200"
                        : propertyLookupTone === "error"
                          ? "border-red-900 bg-red-950/40 text-red-200"
                          : "border-amber-900 bg-amber-950/40 text-amber-100"
                    }`}
                  >
                    {propertyLookupNote}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <span className="mb-2 block text-sm font-medium text-gray-300">Main scope</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {projectTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("projectType", type)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        form.projectType === type
                          ? "border-green-500 bg-green-900/70 text-white"
                          : "border-[#333] bg-[#080808] text-gray-300 hover:border-[#555]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Measurements</p>
                    <p className="mt-1 text-xs text-gray-500">Rooms, exterior runs, surfaces, or repair areas.</p>
                  </div>
                  <button type="button" onClick={addMeasurement} className="w-fit rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white">
                    Add measurement
                  </button>
                </div>

                <div className="space-y-3">
                  {form.measurements.map((measurement, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-[#222] bg-[#111] p-3 sm:grid-cols-[1.2fr_0.7fr_0.7fr_1.4fr_auto]">
                      <input value={measurement.area} onChange={(event) => updateMeasurement(index, "area", event.target.value)} placeholder="Area, room, or item" className={inputClass} />
                      <input value={measurement.length} onChange={(event) => updateMeasurement(index, "length", event.target.value)} placeholder="Length" className={inputClass} />
                      <input value={measurement.width} onChange={(event) => updateMeasurement(index, "width", event.target.value)} placeholder="Width" className={inputClass} />
                      <input value={measurement.notes} onChange={(event) => updateMeasurement(index, "notes", event.target.value)} placeholder="Notes" className={inputClass} />
                      <button type="button" onClick={() => removeMeasurement(index)} className="rounded-lg border border-[#333] px-3 py-2 text-sm text-gray-400 transition hover:border-red-800 hover:text-red-200">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Access details">
                  <textarea value={form.access} onChange={(event) => updateForm("access", event.target.value)} placeholder="Lockbox, gate code, showing windows" className={`${inputClass} min-h-28 resize-y`} />
                </Field>

                <Field label="Scope notes">
                  <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Known issues, client priorities, inspection concerns" className={`${inputClass} min-h-28 resize-y`} />
                </Field>
              </div>

              <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Photos and documents</p>
                    <p className="mt-1 text-xs text-gray-500">Take iPhone photos on site or attach inspection files.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-green-700 bg-green-950 px-3 py-2 text-sm text-green-100 transition hover:border-green-500 hover:text-white">
                      Take photos
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          addSelectedUploadFiles(event.target.files)
                          event.target.value = ""
                        }}
                      />
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white">
                      Add files
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.heic,.heif"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          addSelectedUploadFiles(event.target.files)
                          event.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                </div>

                {selectedFiles.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedFilePreviews.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#111]">
                        <div className="aspect-[4/3] bg-[#050505]">
                          {item.previewUrl ? (
                            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-500">
                              Document
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs text-gray-200">{item.file.name}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-600">{formatFileSize(item.file.size)}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                              className="min-h-9 rounded-md border border-[#333] px-2 text-xs text-gray-400 transition hover:border-red-800 hover:text-red-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-gray-600">No files added yet.</p>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-[#262626] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-400">Phase 1 saves the property, files, status, events, health, scan, repair items, and estimate prep.</p>
                <button onClick={saveProperty} disabled={saving || !hasSupabaseConfig} className="min-h-[52px] w-full rounded-2xl bg-green-700 px-5 py-3 text-base font-medium text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-[#222] disabled:text-gray-500 sm:w-auto sm:text-sm">
                  {saving ? "Saving..." : "Submit Property"}
                </button>
              </div>
            </section>

            <aside className="rounded-2xl border border-[#333] bg-[#111] p-5">
              <h3 className="text-sm font-semibold text-gray-200">Submission readiness</h3>
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-[#080808]">
                  <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${readinessPercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">{readinessScore} of {readinessItems.length} key details captured</p>
              </div>

              <div className="mt-5 space-y-3">
                {readinessItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.done ? "bg-green-500" : "bg-[#444]"}`} />
                    <span className={item.done ? "text-gray-200" : "text-gray-500"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {view === "listings" && (
          <div className="space-y-4">
            {properties.length === 0 && <div className="text-center text-gray-500">No properties saved yet</div>}
            {properties.map((property) => {
              const fileCount = files.filter((file) => file.property_id === property.id).length
              return (
                <div key={property.id} className="flex flex-col gap-4 rounded-xl border border-[#333] bg-[#111] p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{property.address}</div>
                    <div className="mt-1 text-sm text-gray-400">
                      {property.client_name} - {property.project_type} - {property.timeline} - {property.priority}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-[#080808] px-2.5 py-1">{property.budget}</span>
                      <span className="rounded-full bg-[#080808] px-2.5 py-1">{fileCount} file{fileCount === 1 ? "" : "s"}</span>
                      <span className="rounded-full bg-[#080808] px-2.5 py-1">{property.readiness_score}/{property.readiness_total} ready</span>
                    </div>
                    {property.notes && <p className="mt-3 max-w-2xl text-sm text-gray-500">{property.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                    <StatusBadge status={property.status} />
                    <HealthBadge health={property.health_state} />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPropertyId(property.id)
                        setView("reports")
                      }}
                      className="rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white"
                    >
                      View record
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === "reports" && (
          <div className="rounded-xl border border-[#333] bg-[#111] p-5 sm:p-6">
            {selectedProperty ? (
              <>
                <div className="flex flex-col gap-4 border-b border-[#262626] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-green-300">Property operational record</p>
                    <h2 className="mt-2 text-xl font-semibold">{selectedProperty.address}</h2>
                    <p className="mt-1 text-sm text-gray-400">Prepared for {selectedProperty.client_name} - {selectedProperty.project_type}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={selectedProperty.status} />
                    <HealthBadge health={selectedProperty.health_state} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-5">
                  {[
                    ["Sq ft", selectedProperty.square_feet || "Not provided"],
                    ["Built", selectedProperty.year_built || "Not provided"],
                    ["Beds", selectedProperty.bedrooms || "Not provided"],
                    ["Baths", selectedProperty.bathrooms || "Not provided"],
                    ["Lot", selectedProperty.lot_size || "Not provided"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm text-gray-100">{value}</p>
                    </div>
                  ))}
                </div>

                {selectedScan && (
                  <section className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Property Risk Scan</h3>
                        <p className="mt-1 text-xs text-gray-500">{selectedScan.disclaimer}</p>
                      </div>
                      <span className="rounded-full border border-[#333] px-2.5 py-1 text-xs text-gray-300">{selectedScan.confidence}</span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Visible concerns</p>
                        <p className="mt-2 text-sm text-gray-300">{selectedScan.visible_concerns.join("; ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Missing information</p>
                        <p className="mt-2 text-sm text-gray-300">{selectedScan.missing_information.join("; ") || "No major missing information recorded."}</p>
                      </div>
                    </div>
                  </section>
                )}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <section>
                    <h3 className="text-sm font-semibold text-gray-200">Repair items</h3>
                    <div className="mt-3 space-y-3">
                      {selectedRepairItems.length > 0 ? (
                        selectedRepairItems.map((item) => (
                          <div key={item.id} className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-gray-100">{item.category}</p>
                              <span className="text-xs text-gray-500">{item.status.replace("_", " ")}</span>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4 text-sm text-gray-500">No repair items saved yet.</p>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Current Job Items</h3>
                        <p className="mt-1 text-xs text-gray-500">Only materials tied to this property and a current repair item are shown.</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={verifiedScopeOnly}
                          onChange={(event) => setVerifiedScopeOnly(event.target.checked)}
                          className="h-4 w-4 accent-green-600"
                        />
                        Show only verified current-scope items
                      </label>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedEstimateMaterialItems.length > 0 ? (
                        selectedEstimateMaterialItems.map((item) => (
                          <div key={item.id} className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-medium text-gray-100">{item.item_name}</p>
                                <p className="mt-2 text-sm text-green-200">{item.relevance_reason}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {sourceStatusLabel(item.source_status)} - confidence {Math.round(item.relevance_confidence * 100)}%
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMaterialFromCurrentJob(item)}
                                className="min-h-10 rounded-lg border border-[#333] px-3 py-2 text-sm text-gray-300 transition hover:border-red-800 hover:text-red-200"
                              >
                                Remove from this job
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4 text-sm text-gray-500">
                          No current-scope material items. Pricing memory and fallback search results stay hidden unless they match a repair item for this property.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">Estimate prep checklist</h4>
                      <div className="mt-3 space-y-2">
                        {selectedEstimatePrepItems.length > 0 ? (
                          selectedEstimatePrepItems.map((item) => (
                            <div key={item.id} className="text-sm text-gray-400">
                              <p className="text-gray-200">{item.item}</p>
                              <p className="mt-1 text-xs text-gray-600">{item.needed_before_estimate}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No estimate prep saved yet.</p>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500">Submit a property first, then the operational record will appear here.</div>
            )}
          </div>
        )}

        {view === "dashboard" && (
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-xl border border-[#333] bg-[#111] p-4">
              <h2 className="text-sm font-semibold text-gray-200">Admin review</h2>
              <div className="mt-4 space-y-2">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedPropertyId(property.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                      selectedProperty?.id === property.id ? "border-green-600 bg-green-950/40" : "border-[#2a2a2a] bg-[#080808] hover:border-[#444]"
                    }`}
                  >
                    <span className="block font-medium text-gray-100">{property.address}</span>
                    <span className="mt-1 block text-xs text-gray-500">{property.status.replace("_", " ")} - {property.health_state.replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-xl border border-[#333] bg-[#111] p-5">
              {selectedProperty ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-[#262626] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedProperty.address}</h2>
                      <p className="mt-1 text-sm text-gray-400">{selectedProperty.client_name} - created {formatDate(selectedProperty.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={selectedProperty.status} />
                      <HealthBadge health={selectedProperty.health_state} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-5">
                    {(["new", "ready", "review", "needs_info", "resolved"] as PropertyStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => updatePropertyStatus(selectedProperty, status)}
                        className="rounded-lg border border-[#333] bg-[#080808] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600"
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                      <h3 className="text-sm font-semibold text-gray-200">Files</h3>
                      <div className="mt-3 space-y-2">
                        {selectedFilesForProperty.length > 0 ? (
                          selectedFilesForProperty.map((file) => (
                            <button
                              key={file.id}
                              onClick={() => openFile(file)}
                              className="w-full rounded-lg border border-[#222] bg-[#111] px-3 py-2 text-left text-sm text-gray-300 transition hover:border-green-700 hover:text-white"
                            >
                              {file.file_name}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No files uploaded.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                      <h3 className="text-sm font-semibold text-gray-200">Property Risk Scan</h3>
                      <p className="mt-2 text-xs text-gray-500">
                        Preliminary organization only. Human review remains mandatory before pricing, reports, or contractor-approved scope.
                      </p>
                      <button
                        onClick={() => saveRiskScan(selectedProperty)}
                        disabled={saving}
                        className="mt-4 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:bg-[#222] disabled:text-gray-500"
                      >
                        {selectedScan ? "Save updated scan" : "Save risk scan"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                    <h3 className="text-sm font-semibold text-gray-200">Workflow events</h3>
                    <div className="mt-3 space-y-3">
                      {selectedEvents.length > 0 ? (
                        selectedEvents.map((event) => (
                          <div key={event.id} className="border-l border-[#333] pl-3">
                            <p className="text-sm text-gray-300">{event.summary}</p>
                            <p className="mt-1 text-xs text-gray-600">{formatDate(event.created_at)} - {event.actor}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No workflow events recorded yet.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500">No property selected.</div>
              )}
            </section>
          </div>
        )}

        {view === "analytics" && (
          <div className="grid gap-4 sm:grid-cols-5">
            {(["active", "at_risk", "stalled", "abandoned", "resolved"] as HealthState[]).map((health) => (
              <div key={health} className="rounded-xl border border-[#333] bg-[#111] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{health.replace("_", " ")}</p>
                <p className="mt-3 text-3xl font-semibold">{properties.filter((property) => property.health_state === health).length}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {view !== "intake" && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#222] bg-[#050505]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-md gap-2" style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}>
            {navTabs.map((tab) => (
              <button
                key={tab.view}
                type="button"
                onClick={() => setView(tab.view)}
                className={`min-h-12 rounded-lg border px-2 text-sm transition ${
                  view === tab.view
                    ? "border-white bg-white text-black"
                    : "border-[#333] bg-[#111] text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
