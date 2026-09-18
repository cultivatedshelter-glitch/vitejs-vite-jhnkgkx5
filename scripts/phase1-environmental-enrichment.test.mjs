import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichPhase1EnvironmentalContext } from '../server/phase1EnvironmentalEnrichment.mjs'

function artifact({ relevant = true, location = true } = {}) {
  return {
    propertyReportReconstruction: {
      property: location ? { city: 'Portland', state: 'OR', zip: '97201' } : {},
    },
    atomicObservations: [{
      id: 'observation-1',
      source_chronology: { observation_date: '2026-09-16' },
      environmental_context: { is_relevant_to_interpretation: relevant },
      finding_card: { weather_context: { is_relevant_to_interpretation: relevant } },
    }],
    external_sources: [],
  }
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

test('relevant findings receive bounded historical weather with provider provenance and no causal claim', async () => {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url.toString())
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      return response({ results: [{ name: 'Portland', admin1: 'Oregon', country_code: 'US', latitude: 45.52, longitude: -122.68 }] })
    }
    return response({
      latitude: 45.5,
      longitude: -122.7,
      daily: {
        precipitation_sum: [0, 0.12, 0, 0.03],
        temperature_2m_max: [72, 68, 70, 71],
        temperature_2m_min: [54, 52, 51, 53],
        wind_gusts_10m_max: [12, 18, 10, 11],
      },
    })
  }
  const result = await enrichPhase1EnvironmentalContext(artifact(), {
    fetchImpl,
    now: () => new Date('2026-09-18T12:00:00Z'),
  })
  const context = result.atomicObservations[0].environmental_context
  assert.equal(urls.length, 2)
  assert.equal(context.lookup_status, 'available')
  assert.equal(context.provider, 'Open-Meteo')
  assert.deepEqual(context.requested_window, { start_date: '2026-09-13', end_date: '2026-09-16' })
  assert.equal(context.measurements.precipitation_total, 0.15)
  assert.match(context.interpretation, /does not establish/i)
  assert.equal(context.weather_claims[0].causal_status, 'correlation_context_only')
  assert.match(result.external_sources[0].source_url, /archive-api\.open-meteo\.com/)
  assert.equal(result.external_sources[0].provider_location.precision, 'postal_code_geocode')
})

test('dry weather is negative evidence with explicit limits rather than proof', async () => {
  const fetchImpl = async (url) => url.hostname === 'geocoding-api.open-meteo.com'
    ? response({ results: [{ name: 'Portland', admin1: 'Oregon', country_code: 'US', latitude: 45.52, longitude: -122.68 }] })
    : response({ daily: { precipitation_sum: [0, 0, 0, 0], temperature_2m_max: [], temperature_2m_min: [], wind_gusts_10m_max: [] } })
  const result = await enrichPhase1EnvironmentalContext(artifact(), { fetchImpl })
  assert.match(result.atomicObservations[0].environmental_context.interpretation, /does not rule out older leakage/i)
})

test('lookup failures and missing coordinates stay explicit while irrelevant findings make no request', async () => {
  let calls = 0
  const irrelevant = await enrichPhase1EnvironmentalContext(artifact({ relevant: false }), { fetchImpl: async () => { calls += 1 } })
  assert.equal(calls, 0)
  assert.equal(irrelevant.atomicObservations[0].environmental_context.is_relevant_to_interpretation, false)

  const missing = await enrichPhase1EnvironmentalContext(artifact({ location: false }), { fetchImpl: async () => { calls += 1 } })
  assert.equal(missing.atomicObservations[0].environmental_context.lookup_status, 'failed')
  assert.equal(missing.atomicObservations[0].environmental_context.failure_reason, 'coordinates unavailable')
})
