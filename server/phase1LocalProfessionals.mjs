const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

function tradeGroups(artifact, reviewedOnly = false) {
  const values = new Set()
  for (const item of artifact?.atomicObservations || []) {
    if (reviewedOnly && artifact?.reviewState?.[item.id]?.event?.review_action !== 'approve') continue
    const corrections = item && artifact.reviewState[item.id]?.event?.new_value?.corrections
    const trade = String(corrections?.likely_trade || item.finding_card?.next_step_owner || '').trim()
    if (trade && !/human|review|owner|agent/i.test(trade)) values.add(trade)
  }
  return [...values].slice(0, 12)
}

export function createLocalProfessionalResearch({ apiKey = process.env.GOOGLE_PLACES_API_KEY, fetchImpl = fetch } = {}) {
  return async function research({ artifact, propertyAddress, reviewedOnly = false }) {
    const trades = tradeGroups(artifact, reviewedOnly)
    if (!apiKey) return { groups: [], lookups: trades.map((trade) => ({ trade, status: 'skipped_not_configured', provider: 'Google Places' })) }
    const seen = new Set()
    const groups = []
    const lookups = []
    for (const trade of trades) {
      try {
        const response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
            'x-goog-fieldmask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.businessStatus,places.rating,places.userRatingCount,places.reviews.publishTime',
          },
          body: JSON.stringify({ textQuery: `${trade} near ${propertyAddress}`, includePureServiceAreaBusinesses: true, pageSize: 8 }),
        })
        if (!response.ok) throw new Error(`Google Places returned ${response.status}`)
        const body = await response.json()
        const candidates = (body.places || []).filter((place) => place.businessStatus !== 'CLOSED_PERMANENTLY' && !seen.has(place.id))
          .sort((a, b) => {
            const recency = (place) => Date.parse(place.reviews?.[0]?.publishTime || '') || 0
            const score = (place) => (place.rating || 0) * Math.log10((place.userRatingCount || 0) + 10) + recency(place) / 1e14
            return score(b) - score(a)
          })
          .slice(0, 2)
        candidates.forEach((place) => seen.add(place.id))
        if (candidates.length) groups.push({ trade, professionals: candidates.map((place) => ({
          providerId: place.id,
          name: place.displayName?.text || 'Local professional',
          address: place.formattedAddress || null,
          rating: Number.isFinite(place.rating) ? place.rating : null,
          reviewCount: Number.isFinite(place.userRatingCount) ? place.userRatingCount : null,
          latestReviewAt: place.reviews?.[0]?.publishTime || null,
          source: 'Google Places',
          sourceUrl: place.googleMapsUri || null,
          retrievedAt: new Date().toISOString(),
          qualificationStatus: 'Not verified by Shelter Prep',
        })) })
        lookups.push({ trade, status: candidates.length ? 'sourced' : 'no_defensible_results', provider: 'Google Places', retrievedAt: new Date().toISOString() })
      } catch (error) {
        lookups.push({ trade, status: 'lookup_failed', provider: 'Google Places', failure: error instanceof Error ? error.message : 'Lookup failed' })
      }
    }
    return { groups, lookups }
  }
}
