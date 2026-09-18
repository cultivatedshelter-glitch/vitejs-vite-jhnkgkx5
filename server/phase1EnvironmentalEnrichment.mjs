import { createHash } from 'node:crypto'

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive'

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isoDate(value) {
  const text = String(value || '').trim()
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function failureContext(existing, observationDate, reason) {
  return {
    ...existing,
    relevance_status: 'relevant',
    lookup_status: 'failed',
    provider: 'Open-Meteo',
    requested_window: observationDate ? { start_date: shiftDate(observationDate, -3), end_date: observationDate } : null,
    observation_date: observationDate,
    provider_location: null,
    measurements: null,
    units: null,
    source_url: null,
    retrieval_time: new Date().toISOString(),
    interpretation: null,
    limitation: 'Weather context can inform timing and exposure questions but cannot establish cause.',
    failure_reason: reason,
    weather_observation: null,
    weather_sources: [],
    weather_claims: [],
    causal_claim_policy: 'No causal claim may be made from weather correlation alone.',
  }
}

async function fetchJson(fetchImpl, url, label) {
  let response
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'ShelterPrep-Phase1/1.0' } })
  } catch (error) {
    throw new Error(`${label} network failure: ${error instanceof Error ? error.message : 'request failed'}`)
  }
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
  return response.json()
}

function sourceId(url) {
  return `weather-source-${createHash('sha256').update(url).digest('hex').slice(0, 20)}`
}

function unique(values) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

export async function enrichPhase1EnvironmentalContext(artifact, { fetchImpl = fetch, now = () => new Date() } = {}) {
  const output = structuredClone(artifact)
  const observations = Array.isArray(output.atomicObservations) ? output.atomicObservations : []
  const relevant = observations.filter((item) => asRecord(item.environmental_context).is_relevant_to_interpretation === true)
  if (!relevant.length) return output

  const property = asRecord(asRecord(output.propertyReportReconstruction).property)
  const locationQuery = property.zip || [property.city, property.state].filter(Boolean).join(', ')
  const dates = unique(relevant.map((item) => isoDate(asRecord(item.source_chronology).observation_date)).filter(Boolean))

  if (!locationQuery) {
    for (const item of relevant) {
      const context = failureContext(asRecord(item.environmental_context), isoDate(asRecord(item.source_chronology).observation_date), 'coordinates unavailable')
      item.environmental_context = context
      if (item.finding_card) item.finding_card.weather_context = context
    }
    return output
  }
  if (!dates.length) {
    for (const item of relevant) {
      const context = failureContext(asRecord(item.environmental_context), null, 'observation date unsupported')
      item.environmental_context = context
      if (item.finding_card) item.finding_card.weather_context = context
    }
    return output
  }

  try {
    const geocodingUrl = new URL(GEOCODING_ENDPOINT)
    geocodingUrl.searchParams.set('name', locationQuery)
    geocodingUrl.searchParams.set('count', '1')
    geocodingUrl.searchParams.set('language', 'en')
    geocodingUrl.searchParams.set('format', 'json')
    geocodingUrl.searchParams.set('countryCode', 'US')
    const geocoding = await fetchJson(fetchImpl, geocodingUrl, 'Geocoding provider')
    const match = Array.isArray(geocoding.results) ? geocoding.results[0] : null
    if (!Number.isFinite(match?.latitude) || !Number.isFinite(match?.longitude)) throw new Error('coordinates unavailable')

    const recordsByDate = new Map()
    const catalog = Array.isArray(output.external_sources) ? [...output.external_sources] : []
    for (const observationDate of dates) {
      const startDate = shiftDate(observationDate, -3)
      const weatherUrl = new URL(ARCHIVE_ENDPOINT)
      weatherUrl.searchParams.set('latitude', String(match.latitude))
      weatherUrl.searchParams.set('longitude', String(match.longitude))
      weatherUrl.searchParams.set('start_date', startDate)
      weatherUrl.searchParams.set('end_date', observationDate)
      weatherUrl.searchParams.set('daily', 'precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max')
      weatherUrl.searchParams.set('timezone', 'auto')
      weatherUrl.searchParams.set('temperature_unit', 'fahrenheit')
      weatherUrl.searchParams.set('wind_speed_unit', 'mph')
      weatherUrl.searchParams.set('precipitation_unit', 'inch')
      const payload = await fetchJson(fetchImpl, weatherUrl, 'Historical weather provider')
      const daily = asRecord(payload.daily)
      const precipitation = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum.filter(Number.isFinite) : []
      if (!precipitation.length) throw new Error('provider returned no observations')
      const totalPrecipitation = precipitation.reduce((sum, value) => sum + value, 0)
      const id = sourceId(weatherUrl.toString())
      const retrievedAt = now().toISOString()
      const providerLocation = {
        label: [match.name, match.admin1, match.country_code].filter(Boolean).join(', '),
        latitude: match.latitude,
        longitude: match.longitude,
        precision: property.zip ? 'postal_code_geocode' : 'city_geocode',
        weather_grid_latitude: payload.latitude,
        weather_grid_longitude: payload.longitude,
      }
      const measurements = {
        precipitation_total: Number(totalPrecipitation.toFixed(3)),
        daily_precipitation: precipitation,
        temperature_max: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [],
        temperature_min: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [],
        wind_gust_max: Array.isArray(daily.wind_gusts_10m_max) ? daily.wind_gusts_10m_max : [],
      }
      const dry = totalPrecipitation <= 0.01
      const claimText = dry
        ? 'No meaningful precipitation was recorded in the selected window. This reduces support for an immediately rain-driven observation but does not rule out older leakage, plumbing, condensation, or intermittent exposure.'
        : 'Rainfall occurred shortly before inspection and is relevant to evaluating the reported moisture or exterior condition. This timing context does not establish what caused the condition.'
      const source = {
        id,
        source_id: id,
        source_name: 'Open-Meteo Historical Weather API',
        source_type: 'historical_weather_reanalysis',
        provider: 'Open-Meteo',
        source_url: weatherUrl.toString(),
        retrieved_at: retrievedAt,
        provider_location: providerLocation,
        requested_window: { start_date: startDate, end_date: observationDate },
        measurements,
        units: { precipitation: 'inch', temperature: 'fahrenheit', wind_speed: 'mph' },
        limitations: ['Reanalysis/grid data may not represent conditions at the exact structure.', 'Weather correlation does not establish causation.'],
        review_status: 'external_source_retrieved',
      }
      catalog.push(source)
      recordsByDate.set(observationDate, { source, claimText })
    }
    output.external_sources = catalog

    for (const item of relevant) {
      const observationDate = isoDate(asRecord(item.source_chronology).observation_date)
      const record = recordsByDate.get(observationDate)
      if (!record) continue
      const context = {
        ...asRecord(item.environmental_context),
        relevance_status: 'relevant',
        lookup_status: 'available',
        provider: record.source.provider,
        requested_window: record.source.requested_window,
        observation_date: observationDate,
        provider_location: record.source.provider_location,
        measurements: record.source.measurements,
        units: record.source.units,
        source_url: record.source.source_url,
        retrieval_time: record.source.retrieved_at,
        interpretation: record.claimText,
        limitation: record.source.limitations.join(' '),
        failure_reason: null,
        weather_observation: record.source.measurements,
        weather_sources: [record.source.id],
        weather_claims: [{
          claim_text: record.claimText,
          source_refs: [record.source.id],
          causal_status: 'correlation_context_only',
        }],
        claim: {
          claim_text: record.claimText,
          source_refs: [record.source.id],
          causal_status: 'correlation_context_only',
        },
        causal_claim_policy: 'No causal claim may be made from weather correlation alone.',
      }
      item.environmental_context = context
      if (item.finding_card) item.finding_card.weather_context = context
    }
    return output
  } catch (error) {
    const message = error instanceof Error ? error.message : 'weather lookup failed'
    for (const item of relevant) {
      const context = failureContext(asRecord(item.environmental_context), isoDate(asRecord(item.source_chronology).observation_date), message)
      item.environmental_context = context
      if (item.finding_card) item.finding_card.weather_context = context
    }
    return output
  }
}
