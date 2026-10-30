const serviceRoleCredentialPattern =
  /(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\s*(?:=|:)\s*["'`]?((?:sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}))["'`]?/gi

export function findServiceRoleCredentialExposures(content) {
  return Array.from(content.matchAll(serviceRoleCredentialPattern), (match) => match.index ?? 0)
}
