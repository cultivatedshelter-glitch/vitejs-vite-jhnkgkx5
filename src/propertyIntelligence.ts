export type PropertyResearchLink = {
  label: string
  url: string
  note: string
}

export type PropertyResearchPack = {
  jurisdiction: string
  permitOffice: string
  links: PropertyResearchLink[]
  riskFlags: string[]
}

function encodedAddress(address: string, city = '', state = '', zip = '') {
  return encodeURIComponent([address, city, state, zip].filter(Boolean).join(' '))
}

export function inferJurisdiction(city = '', zip = '') {
  const normalizedCity = city.trim().toLowerCase()
  const cleanZip = zip.trim()

  if (normalizedCity.includes('portland') || cleanZip.startsWith('972')) return 'Portland / Multnomah County'
  if (normalizedCity.includes('lake oswego') || cleanZip === '97034' || cleanZip === '97035') return 'Lake Oswego / Clackamas County'
  if (normalizedCity.includes('beaverton') || cleanZip === '97005' || cleanZip === '97006' || cleanZip === '97007' || cleanZip === '97008') return 'Beaverton / Washington County'
  if (normalizedCity.includes('tigard') || cleanZip === '97223' || cleanZip === '97224') return 'Tigard / Washington County'
  if (normalizedCity.includes('oregon city') || cleanZip === '97045') return 'Oregon City / Clackamas County'
  if (normalizedCity.includes('gresham') || cleanZip === '97030' || cleanZip === '97080') return 'Gresham / Multnomah County'

  return cleanZip.startsWith('97') ? 'Oregon jurisdiction to verify' : 'Jurisdiction needs review'
}

export function buildPropertyResearchPack(address: string, city = '', state = 'OR', zip = ''): PropertyResearchPack {
  const query = encodedAddress(address, city, state, zip)
  const jurisdiction = inferJurisdiction(city, zip)
  const lowerJurisdiction = jurisdiction.toLowerCase()

  const links: PropertyResearchLink[] = [
    {
      label: 'Google Maps',
      url: `https://www.google.com/maps/search/?api=1&query=${query}`,
      note: 'Street view, access, slope, parking, and site context.',
    },
    {
      label: 'ORMAP',
      url: `https://ormap.net/gis/index.html`,
      note: 'Oregon parcel map starting point.',
    },
  ]

  if (lowerJurisdiction.includes('portland')) {
    links.unshift({
      label: 'PortlandMaps',
      url: `https://www.portlandmaps.com/search/${query}`,
      note: 'Property, permits, taxes, zoning, and neighborhood context.',
    })
    links.push({
      label: 'Portland Permit Search',
      url: 'https://aca.portlandoregon.gov/RecordSearch',
      note: 'Permit history and active permit lookup.',
    })
  } else if (lowerJurisdiction.includes('washington county')) {
    links.unshift({
      label: 'Washington County Property Search',
      url: `https://washcotax.co.washington.or.us/search`,
      note: 'Tax lot, assessment, and ownership research.',
    })
    links.push({
      label: 'Washington County Permits',
      url: 'https://www.washingtoncountyor.gov/lut/permits',
      note: 'Permit office and permit application information.',
    })
  } else if (lowerJurisdiction.includes('clackamas')) {
    links.unshift({
      label: 'Clackamas Property Search',
      url: 'https://ascendweb.clackamas.us/',
      note: 'Assessor and property record research.',
    })
    links.push({
      label: 'Clackamas Permits',
      url: 'https://www.clackamas.us/building',
      note: 'Permit office and building code information.',
    })
  } else {
    links.push({
      label: 'Oregon Building Codes',
      url: 'https://www.oregon.gov/bcd',
      note: 'State building code and permit reference.',
    })
  }

  const riskFlags = [
    'Verify jurisdiction before quoting permit-sensitive work.',
    'Confirm property facts with public records, MLS/listing data, or owner documentation.',
    'Check permit history when scope includes structural, electrical, plumbing, roofing, additions, or conversions.',
  ]

  const permitOffice = links.find((link) => link.label.toLowerCase().includes('permit'))?.label || 'Permit office needs review'

  return {
    jurisdiction,
    permitOffice,
    links,
    riskFlags,
  }
}
