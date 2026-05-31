import { supabase } from './supabaseClient'
import type { StoredFile, WorkRequest } from '../../types/app'

export const REQUEST_FILES_BUCKET = 'job-files'
export function storagePathFromPublicUrl(fileUrl = '', bucket = REQUEST_FILES_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return ''
  return decodeURIComponent(fileUrl.slice(index + marker.length))
}
export function inferStoredFileType(row: any): 'photo' | 'document' {
  const rawType = String(row.file_type || row.type || '').toLowerCase()
  const path = String(row.storage_path || row.file_url || row.file_name || '').toLowerCase()
  const mime = String(row.mime_type || '').toLowerCase()

  if (rawType === 'photo' || path.includes('/photos/') || mime.startsWith('image/')) return 'photo'
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(path)) return 'photo'
  return 'document'
}
export function mapFileRowToStoredFile(row: any): StoredFile {
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
export async function resolveStoredFileUrl(file: StoredFile, download = false) {
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
export async function attachPreviewUrls(files: StoredFile[]) {
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
export function uniqueStoredFiles(files: StoredFile[]) {
  const seen = new Set<string>()

  return files.filter((file) => {
    const key = file.id || `${file.bucket || REQUEST_FILES_BUCKET}:${file.path || file.url || file.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
export function isOptionalFileSchemaError(error: unknown) {
  const text = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error || '')
  return /linked_property_id|linked_lead_id|linked_request_id|property_files|schema cache|column .* does not exist|relation .* does not exist|table .* does not exist/i.test(text)
}
export async function attachFilesToRequests(items: WorkRequest[]) {
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
      if (!isOptionalFileSchemaError(error)) {
        console.warn('Property-linked files could not be loaded; continuing with lead files.', error)
      }
    } else {
      fileRows.push(...(data || []))
    }

    const { data: propertyFileRows, error: propertyFilesError } = await supabase
      .from('property_files')
      .select('*')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })

    if (propertyFilesError) {
      if (!isOptionalFileSchemaError(propertyFilesError)) {
        console.warn('property_files could not be loaded; continuing with files table rows.', propertyFilesError)
      }
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
