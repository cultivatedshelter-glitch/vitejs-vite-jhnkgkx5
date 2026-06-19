import { supabase } from './supabaseClient'
import type { StoredFile, WorkRequest } from '../../types/app'

export const REQUEST_FILES_BUCKET = 'shelter-prep-files'
export function storagePathFromPublicUrl(fileUrl = '', bucket = REQUEST_FILES_BUCKET) {
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ]
  const marker = markers.find((item) => fileUrl.includes(item))
  if (!marker) return ''
  const value = fileUrl.slice(fileUrl.indexOf(marker) + marker.length).split('?')[0]
  return decodeURIComponent(value)
}
export function inferStoredFileType(row: any): 'photo' | 'document' {
  const rawType = String(row.file_kind || row.file_type || row.type || '').toLowerCase()
  const path = String(row.storage_path || row.file_url || row.original_name || row.original_filename || row.file_name || '').toLowerCase()
  const mime = String(row.mime_type || '').toLowerCase()

  if (rawType === 'photo' || path.includes('/photos/') || mime.startsWith('image/')) return 'photo'
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(path)) return 'photo'
  return 'document'
}
export function mapFileRowToStoredFile(row: any): StoredFile {
  const bucket = row.storage_bucket || row.bucket || REQUEST_FILES_BUCKET
  const path = row.storage_path || storagePathFromPublicUrl(row.file_url || '', bucket)
  const sizeValue = row.file_size ?? row.size_bytes ?? null
  const sizeBytes = sizeValue === null || sizeValue === undefined || sizeValue === ''
    ? null
    : Number(sizeValue)

  return {
    id: row.id,
    name: row.original_name || row.original_filename || row.file_name || row.name || path.split('/').pop() || 'Uploaded file',
    path,
    bucket,
    mimeType: row.mime_type || null,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    propertyId: row.property_id || row.linked_property_id || null,
    workRequestId: row.work_request_id || row.linked_request_id || row.linked_work_request_id || row.lead_id || null,
    uploadedBy: row.uploaded_by || null,
    reviewStatus: row.review_status || null,
    type: inferStoredFileType(row),
    createdAt: row.created_at || row.uploaded_at || null,
    source: row.source || 'files',
  }
}
async function logFileAccessEvent(file: StoredFile, download: boolean) {
  if (!file.id) return

  try {
    const { data } = await supabase.auth.getUser()
    const actorId = data?.user?.id || null

    const { error } = await supabase.from('file_access_events').insert({
      file_id: file.id,
      work_request_id: file.workRequestId || null,
      user_id: actorId,
      actor_id: actorId,
      accessed_by: actorId,
      action: download ? 'download' : 'open',
      access_type: download ? 'downloaded' : 'viewed',
      signed_url_created: true,
      metadata: {
        storage_bucket: file.bucket || REQUEST_FILES_BUCKET,
        storage_path: file.path,
        original_name: file.name,
      },
    })

    if (error) console.warn('File access event could not be logged:', error)
  } catch (error) {
    console.warn('File access event could not be logged:', error)
  }
}
export async function resolveStoredFileUrl(file: StoredFile, download = false) {
  const bucket = file.bucket || REQUEST_FILES_BUCKET
  const path = file.path || storagePathFromPublicUrl(file.url || '', bucket)

  if (!path) {
    throw new Error('Missing file storage path.')
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10, download ? { download: file.name } : undefined)

  if (error || !data?.signedUrl) {
    throw error || new Error('Signed URL was not returned.')
  }

  await logFileAccessEvent({ ...file, bucket, path }, download)

  return data.signedUrl
}
export async function attachPreviewUrls(files: StoredFile[]) {
  return Promise.all(
    files.map(async (file) => {
      if (file.type !== 'photo') return file

      try {
        return { ...file, previewUrl: await resolveStoredFileUrl(file) }
      } catch (error) {
        console.warn('Photo thumbnail URL could not be created.', error)
        return { ...file, previewUrl: '' }
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
  return /property_id|work_request_id|lead_id|linked_property_id|linked_lead_id|linked_request_id|property_files|schema cache|column .* does not exist|relation .* does not exist|table .* does not exist/i.test(text)
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
    for (const column of ['work_request_id', 'lead_id', 'linked_request_id', 'linked_lead_id']) {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .in(column, ids)
        .order('created_at', { ascending: false })

      if (error) {
        if (!isOptionalFileSchemaError(error)) {
          console.warn(`Uploaded files could not be loaded by ${column}; continuing with other links.`, error)
        }
      } else {
        fileRows.push(...(data || []))
      }
    }
  }

  if (propertyIds.length > 0) {
    for (const column of ['property_id', 'linked_property_id']) {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .in(column, propertyIds)
        .order('created_at', { ascending: false })

      if (error) {
        if (!isOptionalFileSchemaError(error)) {
          console.warn(`Property-linked files could not be loaded by ${column}; continuing with request files.`, error)
        }
      } else {
        fileRows.push(...(data || []))
      }
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
    const leadId = row.work_request_id || row.lead_id || row.linked_request_id || row.linked_work_request_id || row.linked_lead_id || row.request_id
    if (!leadId) return acc
    const key = String(leadId)
    acc[key] = [...(acc[key] || []), mapFileRowToStoredFile(row)]
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
