import type { PropertyFacts } from '../lib/db/propertyLookup'

export type EstimateIntelligenceRequest = {
  id: string
  workType: string
  description: string
  urgency: string
  occupancy: string
  timeline: string
  city: string
  state: string
  zip: string
  propertyFacts?: PropertyFacts
  photoCount: number
  documentCount: number
}

export type DraftEstimateItem = {
  itemName: string
  source: string
  quantity: number
  unitPrice: number
  unit: string
  confidence: string
}

export type EstimateIntelligenceResult = {
  primaryTrade: string
  tradeBreakdown: string[]
  quantityBasis: string[]
  draftItems: DraftEstimateItem[]
  laborRate: number
  laborHours: number
  urgencyMultiplier: number
  overheadPercent: number
  coordinationPercent: number
  riskPercent: number
  materialSubtotal: number
  laborSubtotal: number
  suggestedLow: number
  suggestedStandard: number
  suggestedHigh: number
  missingInfo: string[]
  riskFlags: string[]
  contractorPacket: string
}

type Rule = {
  trade: string
  words: string[]
  laborRate: number
  baseHours: number
  items: DraftEstimateItem[]
}

const TRADE_RULES: Rule[] = [
  {
    trade: 'Roofing',
    words: ['roof', 'roofing', 'shingle', 'flashing', 'gutter', 'leak'],
    laborRate: 125,
    baseHours: 8,
    items: [
      item('Roof repair materials allowance', 1, 350, 'allowance'),
      item('Flashing / sealant / fasteners', 1, 120, 'allowance'),
      item('Roof access and protection', 1, 175, 'allowance'),
    ],
  },
  {
    trade: 'Concrete',
    words: ['concrete', 'slab', 'walkway', 'driveway', 'footing', 'post base'],
    laborRate: 115,
    baseHours: 10,
    items: [
      item('Concrete / mix allowance', 1, 450, 'allowance'),
      item('Forming lumber and stakes', 1, 150, 'allowance'),
      item('Demo, haul, and disposal allowance', 1, 275, 'allowance'),
    ],
  },
  {
    trade: 'Tile',
    words: ['tile', 'grout', 'thinset', 'backsplash', 'shower', 'bath surround'],
    laborRate: 110,
    baseHours: 12,
    items: [
      item('Tile material allowance', 60, 5.5, 'sq ft'),
      item('Thinset, grout, spacers, trim', 1, 185, 'allowance'),
      item('Surface prep / backer board allowance', 1, 260, 'allowance'),
    ],
  },
  {
    trade: 'Carpentry',
    words: ['carpentry', 'framing', 'trim', 'door', 'deck', 'stairs', 'railing', 'wood'],
    laborRate: 105,
    baseHours: 8,
    items: [
      item('Lumber and trim allowance', 1, 425, 'allowance'),
      item('Fasteners, adhesive, hardware', 1, 115, 'allowance'),
      item('Cutting, fitting, and protection supplies', 1, 90, 'allowance'),
    ],
  },
  {
    trade: 'Painting',
    words: ['paint', 'painting', 'primer', 'drywall patch', 'touch up'],
    laborRate: 85,
    baseHours: 7,
    items: [
      item('Paint and primer', 3, 58, 'gallon'),
      item('Masking, rollers, trays, plastic', 1, 95, 'allowance'),
      item('Patch and prep materials', 1, 75, 'allowance'),
    ],
  },
  {
    trade: 'Plumbing',
    words: ['plumb', 'toilet', 'sink', 'faucet', 'leak', 'water heater', 'fixture'],
    laborRate: 135,
    baseHours: 5,
    items: [
      item('Fixture / repair parts allowance', 1, 325, 'allowance'),
      item('Supply lines, valves, fittings', 1, 95, 'allowance'),
      item('Leak testing and cleanup supplies', 1, 65, 'allowance'),
    ],
  },
  {
    trade: 'Electrical',
    words: ['electric', 'electrical', 'outlet', 'breaker', 'panel', 'light', 'fixture'],
    laborRate: 140,
    baseHours: 5,
    items: [
      item('Electrical devices / fixtures allowance', 1, 250, 'allowance'),
      item('Wire, boxes, connectors, plates', 1, 115, 'allowance'),
      item('Testing and safety supplies', 1, 55, 'allowance'),
    ],
  },
  {
    trade: 'General Repair',
    words: ['repair', 'inspection', 'seller', 'punch', 'misc', 'handyman'],
    laborRate: 95,
    baseHours: 6,
    items: [
      item('General repair materials allowance', 1, 300, 'allowance'),
      item('Fasteners, adhesives, patch supplies', 1, 95, 'allowance'),
      item('Small tool / protection / cleanup allowance', 1, 85, 'allowance'),
    ],
  },
]

function item(itemName: string, quantity: number, unitPrice: number, unit: string): DraftEstimateItem {
  return {
    itemName,
    quantity,
    unitPrice,
    unit,
    source: 'Shelter Prep Estimate Intelligence',
    confidence: 'draft_assumption_needs_review',
  }
}

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function extractFirstNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

function getMatchedRules(text: string) {
  const matches = TRADE_RULES.filter((rule) => rule.words.some((word) => text.includes(word)))
  return matches.length ? matches : [TRADE_RULES[TRADE_RULES.length - 1]]
}

export function buildEstimateIntelligence(request: EstimateIntelligenceRequest): EstimateIntelligenceResult {
  const text = normalize([request.workType, request.description, request.urgency, request.timeline].join(' '))
  const matchedRules = getMatchedRules(text)
  const primary = matchedRules[0]
  const tradeBreakdown = [...new Set(matchedRules.map((rule) => rule.trade))]

  const sqft =
    extractFirstNumber(text, [/(\d{2,5})\s*(?:sqft|sq ft|square feet|sf)/]) ||
    Number(String(request.propertyFacts?.squareFeet || '').replace(/,/g, '').match(/\d+/)?.[0] || 0)
  const linearFeet = extractFirstNumber(text, [/(\d{1,4})\s*(?:linear feet|lf|lineal feet|feet|ft)/])
  const count = extractFirstNumber(text, [/(\d{1,3})\s*(?:windows|doors|fixtures|outlets|items|repairs|holes|patches)/])

  const quantityBasis = [
    sqft ? `${sqft.toLocaleString()} sq ft referenced or inferred` : 'No confirmed square footage in scope',
    linearFeet ? `${linearFeet} linear feet referenced` : 'No confirmed linear footage in scope',
    count ? `${count} count-based items referenced` : 'No confirmed item count in scope',
    `${request.photoCount} photo(s) and ${request.documentCount} document(s) uploaded`,
  ]

  const scaledItems = matchedRules.flatMap((rule) =>
    rule.items.map((draft) => {
      let quantity = draft.quantity
      if (draft.unit === 'sq ft' && sqft) quantity = Math.max(draft.quantity, Math.round(sqft * 0.08))
      if (draft.unit === 'allowance' && sqft > 2000) quantity = 1.2
      if (count && draft.unit === 'allowance') quantity = Math.max(quantity, Math.min(count, 4))
      return { ...draft, quantity }
    })
  )

  const urgencyWords = ['urgent', 'asap', 'rush', 'tomorrow', 'today', 'inspection', 'deadline', 'seller']
  const urgent = urgencyWords.some((word) => text.includes(word))
  const urgencyMultiplier = urgent ? 1.35 : 1
  const oldOrUnknown = !request.propertyFacts?.yearBuilt || normalize(request.propertyFacts.yearBuilt).includes('pending')
  const occupied = normalize(request.occupancy).includes('occupied')
  const riskPercent = (oldOrUnknown ? 8 : 4) + (occupied ? 4 : 0) + (request.photoCount === 0 ? 6 : 0)
  const overheadPercent = 18
  const coordinationPercent = urgent ? 14 : 10

  const laborHours =
    matchedRules.reduce((sum, rule) => sum + rule.baseHours, 0) +
    (sqft > 2500 ? 4 : 0) +
    (count && count > 3 ? 2 : 0) +
    (request.photoCount === 0 ? 2 : 0)
  const blendedLaborRate =
    matchedRules.reduce((sum, rule) => sum + rule.laborRate, 0) / matchedRules.length
  const laborRate = roundMoney(blendedLaborRate * urgencyMultiplier)

  const materialSubtotal = roundMoney(
    scaledItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)
  )
  const laborSubtotal = roundMoney(laborHours * laborRate)
  const directCost = materialSubtotal + laborSubtotal
  const standard =
    directCost *
    (1 + overheadPercent / 100) *
    (1 + coordinationPercent / 100) *
    (1 + riskPercent / 100)

  const missingInfo = [
    !request.propertyFacts?.squareFeet ? 'confirmed square footage' : '',
    !request.propertyFacts?.propertyType ? 'property type' : '',
    !request.propertyFacts?.jurisdiction ? 'jurisdiction / permit office' : '',
    request.photoCount === 0 ? 'photos' : '',
    text.length < 80 ? 'scope detail' : '',
  ].filter(Boolean)

  const riskFlags = [
    urgent ? 'Urgent timeline: higher labor and coordination rate applied.' : '',
    occupied ? 'Occupied property: protection, access, and cleanup risk included.' : '',
    oldOrUnknown ? 'Year built is unknown/pending: older-home risk buffer included.' : '',
    request.photoCount === 0 ? 'No photos uploaded: quantity assumptions are lower confidence.' : '',
    matchedRules.length > 1 ? 'Multi-trade job: coordination overhead applied.' : '',
  ].filter(Boolean)

  const contractorPacket = [
    `Project: ${request.workType || primary.trade}`,
    `Location: ${[request.city, request.state, request.zip].filter(Boolean).join(', ') || 'Location needs review'}`,
    `Trades: ${tradeBreakdown.join(', ')}`,
    `Draft budget range: ${money(standard * 0.88)} - ${money(standard * 1.18)}`,
    `Labor assumption: ${laborHours} hours at ${money(laborRate)}/hr blended ${urgent ? 'urgent' : 'standard'} rate`,
    `Materials assumption: ${money(materialSubtotal)} draft allowance`,
    `Missing info: ${missingInfo.join(', ') || 'none obvious'}`,
    `Human review required before quote, purchase, scheduling, or client-facing estimate.`,
  ].join('\n')

  return {
    primaryTrade: primary.trade,
    tradeBreakdown,
    quantityBasis,
    draftItems: scaledItems,
    laborRate,
    laborHours,
    urgencyMultiplier,
    overheadPercent,
    coordinationPercent,
    riskPercent,
    materialSubtotal,
    laborSubtotal,
    suggestedLow: roundMoney(standard * 0.88),
    suggestedStandard: roundMoney(standard),
    suggestedHigh: roundMoney(standard * 1.18),
    missingInfo,
    riskFlags,
    contractorPacket,
  }
}
