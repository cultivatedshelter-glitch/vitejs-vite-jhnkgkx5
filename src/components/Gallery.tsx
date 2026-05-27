import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'

type GalleryVisibility = 'private' | 'internal' | 'public'
type GalleryFilter = 'all' | 'public' | 'internal' | 'hidden' | 'featured'
type GalleryRole = 'owner' | 'admin' | 'estimator' | 'contractor' | 'agent' | 'client' | 'viewer'

type GalleryPhoto = {
  id: string
  created_at?: string | null
  file_name: string
  file_url?: string | null
  storage_bucket?: string | null
  storage_path?: string | null
  display_title?: string | null
  caption?: string | null
  category?: string | null
  trade?: string | null
  visibility?: GalleryVisibility | string | null
  featured?: boolean | null
  hidden?: boolean | null
  admin_notes?: string | null
  photo_memory_candidate?: boolean | null
  linked_property_id?: string | null
  linked_work_request_id?: string | null
  linked_repair_item_id?: string | null
  url?: string
}

type GalleryDraft = {
  display_title: string
  caption: string
  category: string
  trade: string
  visibility: GalleryVisibility
  featured: boolean
  hidden: boolean
  admin_notes: string
  linked_property_id: string
  linked_work_request_id: string
  linked_repair_item_id: string
}

type GalleryProps = {
  currentUserId?: string | null
  currentUserRole?: GalleryRole
  isAdmin?: boolean
  canManageGallery?: boolean
  localAdminMode?: boolean
}

const BUCKET = 'job-files'

const PHOTO_CATEGORIES = [
  'Before',
  'During',
  'After',
  'Damage',
  'Materials',
  'Access / Site Conditions',
  'Equipment',
  'Completed Work',
  'Estimate Evidence',
  'Other',
]

const PHOTO_TRADES = [
  'General',
  'Painting',
  'Drywall',
  'Plumbing',
  'Electrical',
  'Roofing',
  'Tile',
  'Flooring',
  'Carpentry',
  'Landscaping',
  'Masonry',
  'Other',
]

function isAdminRole(role?: string | null) {
  return role === 'owner' || role === 'admin'
}

function canManageGalleryFor(role?: string | null) {
  return role === 'admin' || role === 'owner'
}

function isPhotoRow(row: GalleryPhoto) {
  const path = `${row.storage_path || ''} ${row.file_url || ''} ${row.file_name || ''}`.toLowerCase()
  return path.includes('/photos/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(path)
}

function draftFromPhoto(photo: GalleryPhoto): GalleryDraft {
  return {
    display_title: photo.display_title || '',
    caption: photo.caption || '',
    category: photo.category || 'Other',
    trade: photo.trade || 'General',
    visibility: (photo.visibility as GalleryVisibility) || 'internal',
    featured: Boolean(photo.featured),
    hidden: Boolean(photo.hidden),
    admin_notes: photo.admin_notes || '',
    linked_property_id: photo.linked_property_id || '',
    linked_work_request_id: photo.linked_work_request_id || '',
    linked_repair_item_id: photo.linked_repair_item_id || '',
  }
}

export default function Gallery({
  currentUserId = null,
  currentUserRole = 'viewer',
  isAdmin = false,
  canManageGallery: canManageGalleryOverride,
  localAdminMode = false,
}: GalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [manageMode, setManageMode] = useState(false)
  const [filter, setFilter] = useState<GalleryFilter>('all')
  const [profileRole, setProfileRole] = useState<GalleryRole>(currentUserRole)
  const [userId, setUserId] = useState<string | null>(currentUserId)
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null)
  const [draft, setDraft] = useState<GalleryDraft | null>(null)

  const effectiveRole = currentUserRole !== 'viewer' ? currentUserRole : profileRole
  const adminDebugRole = effectiveRole || currentUserRole || profileRole || 'viewer'
  const galleryCanManage =
    canManageGalleryOverride ?? (isAdmin || localAdminMode || canManageGalleryFor(adminDebugRole))

  async function loadActor() {
    if (currentUserId) setUserId(currentUserId)
    if (currentUserRole !== 'viewer') {
      setProfileRole(currentUserRole)
      return
    }

    const { data } = await supabase.auth.getUser()
    const user = data?.user
    setUserId(user?.id || currentUserId || null)

    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = String((profile as { role?: string } | null)?.role || currentUserRole || 'viewer') as GalleryRole
    setProfileRole(isAdminRole(role) ? role : currentUserRole)
  }

  async function signedUrlFor(photo: GalleryPhoto) {
    const bucket = photo.storage_bucket || BUCKET
    const path = photo.storage_path

    if (!path) return photo.file_url || ''

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) return photo.file_url || ''
    return data.signedUrl
  }

  async function loadGallery() {
    setLoading(true)

    try {
      const query = supabase
        .from('files')
        .select(
          'id, created_at, file_name, file_url, storage_bucket, storage_path, file_type, mime_type, display_title, caption, category, trade, visibility, featured, hidden, admin_notes, photo_memory_candidate, linked_property_id, linked_work_request_id, linked_repair_item_id'
        )
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      const imageRows = ((data || []) as GalleryPhoto[]).filter(isPhotoRow)
      const visibleRows = galleryCanManage
        ? imageRows
        : imageRows.filter((photo) => photo.visibility === 'public' && !photo.hidden)

      const signedPhotos = await Promise.all(
        visibleRows.map(async (photo) => ({
          ...photo,
          visibility: (photo.visibility || 'internal') as GalleryVisibility,
          url: await signedUrlFor(photo),
        }))
      )

      setPhotos(signedPhotos)
    } catch (err) {
      console.error(err)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActor()
  }, [currentUserId, currentUserRole])

  useEffect(() => {
    loadGallery()
  }, [galleryCanManage])

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (!galleryCanManage) return !photo.hidden && photo.visibility === 'public'
      if (filter === 'public') return photo.visibility === 'public' && !photo.hidden
      if (filter === 'internal') return photo.visibility === 'internal' && !photo.hidden
      if (filter === 'hidden') return Boolean(photo.hidden)
      if (filter === 'featured') return Boolean(photo.featured) && !photo.hidden
      return !photo.hidden
    })
  }, [galleryCanManage, filter, photos])

  async function writeAudit(actionType: string, photo: GalleryPhoto, previousValue: unknown, newValue: unknown) {
    if (!userId) return

    const { error } = await supabase.from('agent_memory_audit_log').insert({
      actor_id: userId,
      actor_role: isAdminRole(effectiveRole) ? effectiveRole : 'admin',
      action_type: actionType,
      target_table: 'files',
      target_id: photo.id,
      previous_value: previousValue,
      new_value: newValue,
      property_id: photo.linked_property_id || null,
      work_request_id: photo.linked_work_request_id || null,
    })

    if (error) console.warn('Gallery audit log was not saved:', error)
  }

  async function updatePhoto(photo: GalleryPhoto, changes: Partial<GalleryPhoto>, actionType = 'gallery_photo_updated') {
    if (!galleryCanManage) {
      alert('Only an admin or owner can manage gallery photos.')
      return false
    }

    setSavingId(photo.id)
    const previousValue = { ...photo }
    const nextValues = {
      ...changes,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }

    try {
      const { data, error } = await supabase
        .from('files')
        .update(nextValues)
        .eq('id', photo.id)
        .select('*')
        .single()

      if (error) throw error

      const updatedPhoto = {
        ...(data as GalleryPhoto),
        url: photo.url,
        visibility: ((data as GalleryPhoto).visibility || 'internal') as GalleryVisibility,
      }

      setPhotos((current) => current.map((item) => (item.id === photo.id ? updatedPhoto : item)))
      await writeAudit(actionType, photo, previousValue, nextValues)
      return true
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update this gallery photo.')
      return false
    } finally {
      setSavingId(null)
    }
  }

  function openEditor(photo: GalleryPhoto) {
    setEditingPhoto(photo)
    setDraft(draftFromPhoto(photo))
  }

  async function saveEditor() {
    if (!editingPhoto || !draft) return

    const saved = await updatePhoto(editingPhoto, {
      display_title: draft.display_title.trim() || null,
      caption: draft.caption.trim() || null,
      category: draft.category,
      trade: draft.trade,
      visibility: draft.visibility,
      featured: draft.featured,
      hidden: draft.hidden,
      admin_notes: draft.admin_notes.trim() || null,
      linked_property_id: draft.linked_property_id.trim() || null,
      linked_work_request_id: draft.linked_work_request_id.trim() || null,
      linked_repair_item_id: draft.linked_repair_item_id.trim() || null,
    })
    if (!saved) return
    setEditingPhoto(null)
    setDraft(null)
  }

  async function softDeletePhoto(photo: GalleryPhoto) {
    const confirmed = window.confirm(
      'Delete this gallery photo? For now this safely hides it instead of removing the storage file.'
    )
    if (!confirmed) return

    await updatePhoto(
      photo,
      {
        hidden: true,
        admin_notes: `${photo.admin_notes ? `${photo.admin_notes}\n` : ''}TODO: Permanently delete storage object after storage deletion is wired.`,
      },
      'gallery_photo_deleted'
    )
  }

  async function linkToProperty(photo: GalleryPhoto) {
    const propertyId = window.prompt('Property ID to link this photo to:', photo.linked_property_id || '')
    if (propertyId === null) return

    await updatePhoto(
      photo,
      { linked_property_id: propertyId.trim() || null },
      'gallery_photo_linked_to_property'
    )
  }

  async function saveAsPhotoMemory(photo: GalleryPhoto) {
    if (!galleryCanManage) return

    setSavingId(photo.id)

    try {
      const memoryDraft = {
        property_id: photo.linked_property_id || '',
        work_request_id: photo.linked_work_request_id || '',
        file_id: photo.id,
        photo_description: photo.caption || photo.display_title || photo.file_name,
        trade_category: photo.trade || 'General',
        work_phase: photo.category || 'needs_review',
        field_consequence: 'Needs admin review before this affects future estimates.',
        estimate_impact: 'Needs admin review before this affects future estimates.',
        required_line_items: [],
        risk_flags: [],
        human_verified: false,
        status: 'needs_review',
        caption: photo.caption || null,
        admin_notes: photo.admin_notes || null,
        reviewed_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('photo_field_memory').insert(memoryDraft)
      if (error) throw error

      await updatePhoto(
        photo,
        { photo_memory_candidate: true },
        'gallery_photo_saved_as_memory_candidate'
      )
      alert('Saved as a Photo Memory draft for admin review.')
    } catch (error: any) {
      console.error(error)
      await updatePhoto(
        photo,
        {
          photo_memory_candidate: true,
          admin_notes: `${photo.admin_notes ? `${photo.admin_notes}\n` : ''}TODO: Create Photo Memory draft after photo_field_memory is available.`,
        },
        'gallery_photo_saved_as_memory_candidate'
      )
      alert(error?.message || 'Marked as a Photo Memory candidate. Photo Memory table may need its migration.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Property Evidence Gallery</h2>
          <p style={textStyle}>
            Property photos and job evidence, reviewed before they become public or reusable memory.
          </p>
        </div>

        <div style={topActionsStyle}>
          {galleryCanManage && (
            <button
              style={manageMode ? secondaryButtonStyle : buttonStyle}
              onClick={() => setManageMode((value) => !value)}
            >
              {manageMode ? 'Done Managing' : 'Manage Gallery'}
            </button>
          )}
          <button style={buttonStyle} onClick={loadGallery}>
            {loading ? 'Loading...' : 'Refresh Gallery'}
          </button>
        </div>
      </div>

      {galleryCanManage && manageMode && (
        <div style={filterRowStyle}>
          {(['all', 'public', 'internal', 'hidden', 'featured'] as GalleryFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              style={filter === item ? filterButtonActiveStyle : filterButtonStyle}
              onClick={() => setFilter(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      )}

      {filteredPhotos.length === 0 && !loading && (
        <div style={emptyStyle}>
          No gallery photos match this view.
        </div>
      )}

      <div style={gridStyle}>
        {filteredPhotos.map((photo) => (
          <div key={photo.id} style={photo.hidden ? hiddenPhotoCardStyle : photoCardStyle}>
            <img src={photo.url} alt={photo.display_title || photo.file_name} style={imageStyle} />
            <div style={captionStyle}>
              <strong>{photo.display_title || photo.file_name}</strong>
              {photo.caption && <span style={captionTextStyle}>{photo.caption}</span>}
              <span style={metaTextStyle}>
                {[photo.category, photo.trade, photo.visibility, photo.featured ? 'Featured' : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>

            {galleryCanManage && manageMode && (
              <div style={adminControlsStyle}>
                <a href={photo.url} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                  Open / View
                </a>
                <button style={smallButtonStyle} onClick={() => openEditor(photo)}>
                  Edit
                </button>
                <button
                  style={smallButtonStyle}
                  disabled={savingId === photo.id}
                  onClick={() => updatePhoto(photo, { hidden: true }, 'gallery_photo_hidden')}
                >
                  Hide
                </button>
                <button
                  style={smallButtonStyle}
                  disabled={savingId === photo.id}
                  onClick={() =>
                    updatePhoto(photo, { hidden: true, admin_notes: 'Marked as duplicate by admin.' }, 'gallery_photo_hidden')
                  }
                >
                  Hide Duplicate
                </button>
                <button
                  style={smallButtonStyle}
                  disabled={savingId === photo.id}
                  onClick={() => softDeletePhoto(photo)}
                >
                  Delete
                </button>
                <button
                  style={smallButtonStyle}
                  disabled={savingId === photo.id}
                  onClick={() => updatePhoto(photo, { featured: true }, 'gallery_photo_featured')}
                >
                  Set Featured
                </button>
                <button style={smallButtonStyle} disabled={savingId === photo.id} onClick={() => linkToProperty(photo)}>
                  Link to Property
                </button>
                <button style={smallButtonStyle} disabled={savingId === photo.id} onClick={() => saveAsPhotoMemory(photo)}>
                  Save as Photo Memory
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingPhoto && draft && (
        <div style={modalBackdropStyle} role="dialog" aria-modal="true" aria-label="Edit gallery photo">
          <div style={modalStyle}>
            <img src={editingPhoto.url} alt={editingPhoto.file_name} style={modalImageStyle} />
            <div style={fileNameStyle}>{editingPhoto.file_name}</div>

            <label style={labelStyle}>
              Display title
              <input
                style={inputStyle}
                value={draft.display_title}
                onChange={(event) => setDraft({ ...draft, display_title: event.target.value })}
              />
            </label>

            <label style={labelStyle}>
              Caption
              <textarea
                style={textareaStyle}
                value={draft.caption}
                onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
              />
            </label>

            <div style={fieldGridStyle}>
              <label style={labelStyle}>
                Category
                <select
                  style={inputStyle}
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                >
                  {PHOTO_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Trade
                <select
                  style={inputStyle}
                  value={draft.trade}
                  onChange={(event) => setDraft({ ...draft, trade: event.target.value })}
                >
                  {PHOTO_TRADES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <label style={labelStyle}>
              Visibility
              <select
                style={inputStyle}
                value={draft.visibility}
                onChange={(event) => setDraft({ ...draft, visibility: event.target.value as GalleryVisibility })}
              >
                <option value="private">Private</option>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
              </select>
            </label>

            <div style={toggleRowStyle}>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
                />
                Featured
              </label>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={draft.hidden}
                  onChange={(event) => setDraft({ ...draft, hidden: event.target.checked })}
                />
                Hidden
              </label>
            </div>

            <div style={fieldGridStyle}>
              <label style={labelStyle}>
                Property ID
                <input
                  style={inputStyle}
                  value={draft.linked_property_id}
                  onChange={(event) => setDraft({ ...draft, linked_property_id: event.target.value })}
                />
              </label>
              <label style={labelStyle}>
                Work request ID
                <input
                  style={inputStyle}
                  value={draft.linked_work_request_id}
                  onChange={(event) => setDraft({ ...draft, linked_work_request_id: event.target.value })}
                />
              </label>
            </div>

            <label style={labelStyle}>
              Repair item ID
              <input
                style={inputStyle}
                value={draft.linked_repair_item_id}
                onChange={(event) => setDraft({ ...draft, linked_repair_item_id: event.target.value })}
              />
            </label>

            <label style={labelStyle}>
              Admin notes
              <textarea
                style={textareaStyle}
                value={draft.admin_notes}
                onChange={(event) => setDraft({ ...draft, admin_notes: event.target.value })}
              />
            </label>

            <div style={modalActionsStyle}>
              <button style={secondaryButtonStyle} onClick={() => setEditingPhoto(null)}>
                Cancel
              </button>
              <button style={buttonStyle} disabled={savingId === editingPhoto.id} onClick={saveEditor}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 8,
  padding: 20,
  border: '1px solid #d7dfd3',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  color: '#173425',
}

const textStyle: React.CSSProperties = {
  color: '#5f6f63',
  fontSize: 16,
}

const topActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const buttonStyle: React.CSSProperties = {
  background: '#0f542d',
  color: 'white',
  padding: '12px 16px',
  borderRadius: 8,
  border: 'none',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#eef3ea',
  color: '#173425',
  border: '1px solid #c5d2c0',
}

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 18,
}

const filterButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  padding: '9px 12px',
}

const filterButtonActiveStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '9px 12px',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 12,
  marginTop: 16,
}

const photoCardStyle: React.CSSProperties = {
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid #d7dfd3',
  background: '#ffffff',
}

const hiddenPhotoCardStyle: React.CSSProperties = {
  ...photoCardStyle,
  opacity: 0.68,
}

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 240,
  objectFit: 'cover',
  display: 'block',
}

const captionStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
  color: '#173425',
  fontWeight: 700,
  wordBreak: 'break-word',
  display: 'grid',
  gap: 5,
}

const captionTextStyle: React.CSSProperties = {
  color: '#435548',
  fontWeight: 500,
  lineHeight: 1.35,
}

const metaTextStyle: React.CSSProperties = {
  color: '#6a786d',
  fontSize: 12,
  fontWeight: 700,
}

const adminControlsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 8,
  padding: 12,
  borderTop: '1px solid #d7dfd3',
}

const smallButtonStyle: React.CSSProperties = {
  background: '#eef3ea',
  color: '#173425',
  border: '1px solid #c5d2c0',
  borderRadius: 8,
  padding: '10px 8px',
  fontWeight: 800,
  cursor: 'pointer',
}

const linkButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  textAlign: 'center',
  textDecoration: 'none',
}

const emptyStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 18,
  borderRadius: 8,
  background: '#fbfcfa',
  color: '#5f6f63',
  fontWeight: 800,
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(11, 22, 15, 0.45)',
  zIndex: 80,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  overflowY: 'auto',
  padding: 16,
}

const modalStyle: React.CSSProperties = {
  width: 'min(680px, 100%)',
  background: 'white',
  borderRadius: 8,
  padding: 18,
  display: 'grid',
  gap: 12,
  border: '1px solid #d7dfd3',
}

const modalImageStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 320,
  objectFit: 'cover',
  borderRadius: 8,
}

const fileNameStyle: React.CSSProperties = {
  color: '#5f6f63',
  fontSize: 13,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#173425',
  fontSize: 13,
  fontWeight: 800,
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #c5d2c0',
  borderRadius: 8,
  padding: '11px 12px',
  fontSize: 15,
  color: '#173425',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 86,
  resize: 'vertical',
}

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 12,
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
}

const toggleStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  color: '#173425',
  fontWeight: 800,
}

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
}
