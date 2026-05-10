import React, { FormEvent, useState } from 'react'
import { supabase } from '../supabase'

type StoredUpload = {
  name: string
  path: string
  url: string
  type: 'photo' | 'inspection_report'
}

type IntakeFormState = {
  clientAgentName: string
  email: string
  phone: string
  propertyAddress: string
  occupancyStatus: string
  listingStatus: string
  deadline: string
  repairCategories: string[]
  repairDescription: string
  preferredContractorCount: string
}

const REPAIR_CATEGORIES = [
  'Roofing',
  'Plumbing',
  'Electrical',
  'Drywall',
  'Painting',
  'Flooring',
  'Tile',
  'Framing',
  'Siding',
  'Windows / Doors',
  'Cleaning / Debris',
  'Landscaping',
  'Inspection Repairs',
  'Other',
]

const emptyForm: IntakeFormState = {
  clientAgentName: '',
  email: '',
  phone: '',
  propertyAddress: '',
  occupancyStatus: 'Unknown',
  listingStatus: 'Not listed yet',
  deadline: '',
  repairCategories: [],
  repairDescription: '',
  preferredContractorCount: '3',
}

const INTAKE_BUCKET = 'job-files'

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now())
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function uploadIntakeFiles(files: File[], submissionId: string, type: StoredUpload['type']) {
  const uploads: StoredUpload[] = []

  for (const file of files) {
    const path = `property-intake/${submissionId}/${type}/${Date.now()}-${safeFileName(file.name)}`
    const { error } = await supabase.storage.from(INTAKE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw error

    const { data } = supabase.storage.from(INTAKE_BUCKET).getPublicUrl(path)

    uploads.push({
      name: file.name,
      path,
      url: data.publicUrl,
      type,
    })
  }

  return uploads
}

export default function PropertyRepairIntakeForm() {
  const [form, setForm] = useState<IntakeFormState>(emptyForm)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [inspectionReportFiles, setInspectionReportFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function updateField<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleRepairCategory(category: string) {
    setForm((current) => {
      const exists = current.repairCategories.includes(category)
      return {
        ...current,
        repairCategories: exists
          ? current.repairCategories.filter((item) => item !== category)
          : [...current.repairCategories, category],
      }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    if (!form.clientAgentName.trim() || !form.email.trim() || !form.propertyAddress.trim()) {
      setErrorMessage('Please add client/agent name, email, and property address before submitting.')
      return
    }

    setSubmitting(true)

    try {
      const submissionId = makeId()
      const [photos, inspectionReports] = await Promise.all([
        uploadIntakeFiles(photoFiles, submissionId, 'photo'),
        uploadIntakeFiles(inspectionReportFiles, submissionId, 'inspection_report'),
      ])

      const payload = {
        id: submissionId,
        client_agent_name: form.clientAgentName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        property_address: form.propertyAddress.trim(),
        occupancy_status: form.occupancyStatus,
        listing_status: form.listingStatus,
        deadline: form.deadline || null,
        repair_categories: form.repairCategories,
        repair_description: form.repairDescription.trim(),
        photo_uploads: photos,
        inspection_report_uploads: inspectionReports,
        preferred_contractor_count: Number(form.preferredContractorCount || 0),
        status: 'new',
        source: 'property_repair_intake_form',
      }

      const { error } = await supabase.from('property_repair_intake').insert(payload)
      if (error) throw error

      // Also create a dashboard lead so the existing Shelter Prep dashboard can see the intake.
      await supabase.from('leads').insert({
        id: submissionId,
        name: payload.client_agent_name,
        email: payload.email,
        phone: payload.phone,
        property_address: payload.property_address,
        work_type: payload.repair_categories[0] || 'Inspection Repairs',
        occupancy: payload.occupancy_status,
        timeline: payload.deadline,
        description: payload.repair_description,
        status: 'new',
      })

      setForm(emptyForm)
      setPhotoFiles([])
      setInspectionReportFiles([])
      setSuccessMessage('Intake submitted. The request was saved in Supabase.')
    } catch (error: any) {
      console.error(error)
      setErrorMessage(error?.message || 'Could not submit intake. Please check Supabase table/storage setup.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMessage && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{successMessage}</div>}
      {errorMessage && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Client / Agent Name
          <input className="w-full rounded-lg border p-2" value={form.clientAgentName} onChange={(event) => updateField('clientAgentName', event.target.value)} required />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Email
          <input className="w-full rounded-lg border p-2" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Phone
          <input className="w-full rounded-lg border p-2" type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Property Address
          <input className="w-full rounded-lg border p-2" value={form.propertyAddress} onChange={(event) => updateField('propertyAddress', event.target.value)} required />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Occupancy Status
          <select className="w-full rounded-lg border p-2" value={form.occupancyStatus} onChange={(event) => updateField('occupancyStatus', event.target.value)}>
            <option>Unknown</option>
            <option>Occupied</option>
            <option>Vacant</option>
            <option>Tenant occupied</option>
            <option>Owner occupied</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium">
          Listing Status
          <select className="w-full rounded-lg border p-2" value={form.listingStatus} onChange={(event) => updateField('listingStatus', event.target.value)}>
            <option>Not listed yet</option>
            <option>Coming soon</option>
            <option>Active listing</option>
            <option>Pending sale</option>
            <option>Inspection period</option>
            <option>Post-inspection negotiation</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium">
          Deadline
          <input className="w-full rounded-lg border p-2" type="date" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Preferred Contractor Count
          <input className="w-full rounded-lg border p-2" type="number" min="1" max="10" value={form.preferredContractorCount} onChange={(event) => updateField('preferredContractorCount', event.target.value)} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Repair Categories</p>
        <div className="grid gap-2 md:grid-cols-3">
          {REPAIR_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <input type="checkbox" checked={form.repairCategories.includes(category)} onChange={() => toggleRepairCategory(category)} />
              {category}
            </label>
          ))}
        </div>
      </div>

      <label className="space-y-1 text-sm font-medium block">
        Repair Description
        <textarea className="min-h-32 w-full rounded-lg border p-2" value={form.repairDescription} onChange={(event) => updateField('repairDescription', event.target.value)} placeholder="Describe the repair list, inspection items, access notes, urgency, and anything the contractor should know." />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Photo Upload
          <input className="w-full rounded-lg border p-2" type="file" accept="image/*" multiple onChange={(event) => setPhotoFiles(Array.from(event.target.files || []))} />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Inspection Report Upload
          <input className="w-full rounded-lg border p-2" type="file" accept=".pdf,.doc,.docx,image/*" multiple onChange={(event) => setInspectionReportFiles(Array.from(event.target.files || []))} />
        </label>
      </div>

      <button type="submit" disabled={submitting} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? 'Submitting…' : 'Submit Property Intake'}
      </button>
    </form>
  )
}
