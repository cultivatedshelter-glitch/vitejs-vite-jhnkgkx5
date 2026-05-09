// 👉 FULL CLEAN SaaS VERSION (paste everything)

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { lookupProperty } from "./lib/propertyLookup"

type Job = {
  id: number
  address: string
  clientName: string
  phone: string
  yearBuilt: string
  squareFeet: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  projectType: string
  timeline: string
  priority: string
  budget: string
  access: string
  measurements: Measurement[]
  notes: string
  files: string[]
  status: "new" | "ready" | "review" | "needs_info"
}

type Measurement = {
  area: string
  length: string
  width: string
  notes: string
}

type IntakeForm = {
  address: string
  clientName: string
  phone: string
  yearBuilt: string
  squareFeet: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  projectType: string
  timeline: string
  priority: string
  budget: string
  access: string
  measurements: Measurement[]
  notes: string
  files: string[]
}

const statusStyles = {
  new: "bg-blue-950 text-blue-300 border-blue-700",
  ready: "bg-green-900 text-green-200 border-green-700",
  review: "bg-amber-950 text-amber-300 border-amber-700",
  needs_info: "bg-red-950 text-red-300 border-red-700",
}

function StatusBadge({ status }: { status: Job["status"] }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  )
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm transition ${
        active
          ? "bg-white text-black border-white"
          : "bg-[#111] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-300">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "w-full rounded-lg border border-[#333] bg-[#080808] px-3 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-green-600 focus:ring-2 focus:ring-green-900/60"

const projectTypes = ["Repairs", "Paint", "Flooring", "Roofing", "Cleanout", "Full prep"]
const timelineOptions = ["ASAP", "This week", "Before listing", "Flexible"]
const priorityOptions = ["Standard", "Time sensitive", "Client anxious"]
const budgetOptions = ["Not set", "Under $2.5k", "$2.5k-$10k", "$10k-$25k", "$25k+"]

const emptyForm: IntakeForm = {
  address: "",
  clientName: "",
  phone: "",
  yearBuilt: "",
  squareFeet: "",
  bedrooms: "",
  bathrooms: "",
  lotSize: "",
  projectType: "Repairs",
  timeline: "Before listing",
  priority: "Standard",
  budget: "Not set",
  access: "",
  measurements: [{ area: "", length: "", width: "", notes: "" }],
  notes: "",
  files: [],
}

export default function App() {
  const [mode, setMode] = useState<"agent" | "admin">("agent")
  const [view, setView] = useState("intake")
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [form, setForm] = useState<IntakeForm>(emptyForm)
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [propertyLookupLoading, setPropertyLookupLoading] = useState(false)
  const [propertyLookupError, setPropertyLookupError] = useState("")
  const [propertyLookupNote, setPropertyLookupNote] = useState("")

  const requiredComplete = form.address.trim().length > 0 && form.clientName.trim().length > 0
  const completedMeasurements = form.measurements.filter(
    (measurement) => measurement.area.trim() || measurement.length.trim() || measurement.width.trim()
  )
  const readinessItems = useMemo(
    () => [
      { label: "Property address", done: form.address.trim().length > 0 },
      { label: "Client name", done: form.clientName.trim().length > 0 },
      { label: "Property facts", done: form.squareFeet.trim().length > 0 || form.yearBuilt.trim().length > 0 },
      { label: "Measurements", done: completedMeasurements.length > 0 },
      { label: "Access details", done: form.access.trim().length > 0 },
      { label: "Scope notes", done: form.notes.trim().length > 12 },
      { label: "Photos or docs", done: form.files.length > 0 },
    ],
    [completedMeasurements.length, form]
  )
  const readinessScore = readinessItems.filter((item) => item.done).length
  const readinessPercent = Math.round((readinessScore / readinessItems.length) * 100)
  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) : jobs[0]

  const updateForm = (field: keyof IntakeForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateMeasurement = (index: number, field: keyof Measurement, value: string) => {
    setForm((current) => ({
      ...current,
      measurements: current.measurements.map((measurement, measurementIndex) =>
        measurementIndex === index ? { ...measurement, [field]: value } : measurement
      ),
    }))
  }

  const addMeasurement = () => {
    setForm((current) => ({
      ...current,
      measurements: [...current.measurements, { area: "", length: "", width: "", notes: "" }],
    }))
  }

  const removeMeasurement = (index: number) => {
    setForm((current) => ({
      ...current,
      measurements:
        current.measurements.length === 1
          ? [{ area: "", length: "", width: "", notes: "" }]
          : current.measurements.filter((_, measurementIndex) => measurementIndex !== index),
    }))
  }

  const prefillPropertyInfo = async () => {
    setPropertyLookupError("")
    setPropertyLookupNote("")
    setPropertyLookupLoading(true)

    try {
      const property = await lookupProperty(form.address)

      setForm((current) => ({
        ...current,
        address: property.address || current.address,
        yearBuilt: property.yearBuilt,
        squareFeet: property.squareFeet,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        lotSize: property.lotSize,
      }))
      setPropertyLookupNote(
        property.source === "api"
          ? `Property info pulled with ${property.confidence} confidence.`
          : property.notes || "Using local fallback property fields."
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Property lookup failed."
      setPropertyLookupError(message)
    } finally {
      setPropertyLookupLoading(false)
    }
  }

  const addJob = () => {
    setSubmittedOnce(true)
    if (!requiredComplete) return

    setJobs([
      {
        id: Date.now(),
        address: form.address.trim(),
        clientName: form.clientName.trim(),
        phone: form.phone.trim(),
        yearBuilt: form.yearBuilt.trim(),
        squareFeet: form.squareFeet.trim(),
        bedrooms: form.bedrooms.trim(),
        bathrooms: form.bathrooms.trim(),
        lotSize: form.lotSize.trim(),
        projectType: form.projectType,
        timeline: form.timeline,
        priority: form.priority,
        budget: form.budget,
        access: form.access.trim(),
        measurements: form.measurements.filter(
          (measurement) =>
            measurement.area.trim() ||
            measurement.length.trim() ||
            measurement.width.trim() ||
            measurement.notes.trim()
        ),
        notes: form.notes.trim(),
        files: form.files,
        status: readinessScore >= 5 ? "ready" : "needs_info",
      },
      ...jobs,
    ])
    setForm(emptyForm)
    setSubmittedOnce(false)
    setView("listings")
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white px-4 py-5 sm:px-6 sm:py-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h1 className="text-2xl font-semibold">
              Shelter<span className="text-green-600">Prep</span>
            </h1>
            <p className="text-sm text-gray-400">
              Pre-listing coordination, scope, and reporting
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setMode("agent"); setView("intake") }}
              className={`rounded-lg px-3 py-2 text-sm transition ${mode === "agent" ? "bg-green-700" : "bg-[#111] hover:bg-[#1a1a1a]"}`}
            >
              Agent
            </button>
            <button
              onClick={() => { setMode("admin"); setView("dashboard") }}
              className={`rounded-lg px-3 py-2 text-sm transition ${mode === "admin" ? "bg-green-700" : "bg-[#111] hover:bg-[#1a1a1a]"}`}
            >
              Admin
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="mb-8 flex flex-wrap gap-3">
          {mode === "agent" ? (
            <>
              <NavTab active={view === "intake"} onClick={() => setView("intake")}>
                New Property
              </NavTab>
              <NavTab active={view === "listings"} onClick={() => setView("listings")}>
                My Listings
              </NavTab>
              <NavTab active={view === "reports"} onClick={() => setView("reports")}>
                Reports
              </NavTab>
            </>
          ) : (
            <>
              <NavTab active={view === "dashboard"} onClick={() => setView("dashboard")}>
                Operations
              </NavTab>
              <NavTab active={view === "analytics"} onClick={() => setView("analytics")}>
                Insights
              </NavTab>
            </>
          )}
        </div>

        {/* VIEWS */}

        {/* INTAKE */}
        {view === "intake" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className="rounded-xl border border-[#333] bg-[#111] p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">New Property</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Capture the details operations needs to scope the prep work.
                  </p>
                </div>
                <span className="w-fit rounded-full border border-green-800 bg-green-950 px-3 py-1 text-xs text-green-200">
                  Agent intake
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Property address">
                  <input
                    value={form.address}
                    onChange={(event) => updateForm("address", event.target.value)}
                    placeholder="123 Cedar St, Seattle, WA"
                    className={inputClass}
                  />
                  {submittedOnce && !form.address.trim() && (
                    <span className="mt-2 block text-xs text-red-300">Property address is required.</span>
                  )}
                </Field>

                <Field label="Client name">
                  <input
                    value={form.clientName}
                    onChange={(event) => updateForm("clientName", event.target.value)}
                    placeholder="Homeowner or seller"
                    className={inputClass}
                  />
                  {submittedOnce && !form.clientName.trim() && (
                    <span className="mt-2 block text-xs text-red-300">Client name is required.</span>
                  )}
                </Field>

                <Field label="Client phone">
                  <input
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </Field>

                <Field label="Timeline">
                  <select
                    value={form.timeline}
                    onChange={(event) => updateForm("timeline", event.target.value)}
                    className={inputClass}
                  >
                    {timelineOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Budget signal">
                  <select
                    value={form.budget}
                    onChange={(event) => updateForm("budget", event.target.value)}
                    className={inputClass}
                  >
                    {budgetOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) => updateForm("priority", event.target.value)}
                    className={inputClass}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="block text-sm font-medium text-gray-300">Property facts</span>
                  <button
                    type="button"
                    onClick={prefillPropertyInfo}
                    disabled={propertyLookupLoading}
                    className="w-fit rounded-lg border border-[#444] px-3 py-2 text-xs text-gray-200 transition hover:border-green-600 hover:text-white"
                  >
                    {propertyLookupLoading ? "Pulling..." : "Pull property info"}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-5">
                  <Field label="Sq ft">
                    <input
                      value={form.squareFeet}
                      onChange={(event) => updateForm("squareFeet", event.target.value)}
                      placeholder="2,140"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Built">
                    <input
                      value={form.yearBuilt}
                      onChange={(event) => updateForm("yearBuilt", event.target.value)}
                      placeholder="1987"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Beds">
                    <input
                      value={form.bedrooms}
                      onChange={(event) => updateForm("bedrooms", event.target.value)}
                      placeholder="3"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Baths">
                    <input
                      value={form.bathrooms}
                      onChange={(event) => updateForm("bathrooms", event.target.value)}
                      placeholder="2.5"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Lot">
                    <input
                      value={form.lotSize}
                      onChange={(event) => updateForm("lotSize", event.target.value)}
                      placeholder="6,000 sf"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Public-record lookup can connect to a property data API later; these fields feed the agent report now.
                </p>
                {propertyLookupNote && (
                  <p className="mt-2 text-xs text-green-300">{propertyLookupNote}</p>
                )}
                {propertyLookupError && (
                  <p className="mt-2 text-xs text-red-300">{propertyLookupError}</p>
                )}
              </div>

              <div className="mt-5">
                <span className="mb-2 block text-sm font-medium text-gray-300">Main scope</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {projectTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("projectType", type)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        form.projectType === type
                          ? "border-green-500 bg-green-900/70 text-white"
                          : "border-[#333] bg-[#080808] text-gray-300 hover:border-[#555]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Measurements</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Add rooms, exterior runs, surfaces, or repair areas for report-ready scope notes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMeasurement}
                    className="w-fit rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white"
                  >
                    Add measurement
                  </button>
                </div>

                <div className="space-y-3">
                  {form.measurements.map((measurement, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-[#222] bg-[#111] p-3 sm:grid-cols-[1.2fr_0.7fr_0.7fr_1.4fr_auto]">
                      <input
                        value={measurement.area}
                        onChange={(event) => updateMeasurement(index, "area", event.target.value)}
                        placeholder="Area, room, or item"
                        className={inputClass}
                      />
                      <input
                        value={measurement.length}
                        onChange={(event) => updateMeasurement(index, "length", event.target.value)}
                        placeholder="Length"
                        className={inputClass}
                      />
                      <input
                        value={measurement.width}
                        onChange={(event) => updateMeasurement(index, "width", event.target.value)}
                        placeholder="Width"
                        className={inputClass}
                      />
                      <input
                        value={measurement.notes}
                        onChange={(event) => updateMeasurement(index, "notes", event.target.value)}
                        placeholder="Notes"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => removeMeasurement(index)}
                        className="rounded-lg border border-[#333] px-3 py-2 text-sm text-gray-400 transition hover:border-red-800 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Access details">
                  <textarea
                    value={form.access}
                    onChange={(event) => updateForm("access", event.target.value)}
                    placeholder="Lockbox, gate code, showing windows"
                    className={`${inputClass} min-h-28 resize-y`}
                  />
                </Field>

                <Field label="Scope notes">
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Rooms, photos needed, known issues, client priorities"
                    className={`${inputClass} min-h-28 resize-y`}
                  />
                </Field>
              </div>

              <div className="mt-5 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Photos and documents</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Add room photos, inspection notes, disclosures, or repair lists for scoping.
                    </p>
                  </div>
                  <label className="w-fit cursor-pointer rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white">
                    Add files
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        const selectedFiles = Array.from(event.target.files ?? []).map(
                          (file) => file.name
                        )
                        setForm((current) => ({
                          ...current,
                          files: [...current.files, ...selectedFiles],
                        }))
                        event.target.value = ""
                      }}
                    />
                  </label>
                </div>

                {form.files.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.files.map((file, index) => (
                      <button
                        key={`${file}-${index}`}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            files: current.files.filter((_, fileIndex) => fileIndex !== index),
                          }))
                        }
                        className="rounded-full border border-[#333] bg-[#111] px-3 py-1 text-xs text-gray-300 transition hover:border-red-800 hover:text-red-200"
                        title="Remove file"
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-gray-600">No files added yet.</p>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-[#262626] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-400">
                  Required: address and client name. Files can be added later.
                </p>
                <button
                  onClick={addJob}
                  disabled={!requiredComplete}
                  className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-[#222] disabled:text-gray-500"
                >
                  Submit Property
                </button>
              </div>
            </section>

            <aside className="rounded-xl border border-[#333] bg-[#111] p-5">
              <h3 className="text-sm font-semibold text-gray-200">Submission readiness</h3>
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-[#080808]">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{ width: `${readinessPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {readinessScore} of {readinessItems.length} key details captured
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {readinessItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        item.done ? "bg-green-500" : "bg-[#444]"
                      }`}
                    />
                    <span className={item.done ? "text-gray-200" : "text-gray-500"}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Preview
                </p>
                <p className="mt-2 text-sm text-white">
                  {form.address || "No address entered"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {form.projectType} - {form.timeline} - {form.priority}
                </p>
                <p className="mt-2 text-xs text-gray-600">
                  {form.files.length} file{form.files.length === 1 ? "" : "s"} attached
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* LISTINGS */}
        {view === "listings" && (
          <div className="space-y-4">
            {jobs.length === 0 && (
              <div className="text-center text-gray-500">
                No listings yet
              </div>
            )}

            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-4 rounded-xl border border-[#333] bg-[#111] p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="font-medium">{job.address}</div>
                  <div className="mt-1 text-sm text-gray-400">
                    {job.clientName} - {job.projectType} - {job.timeline} - {job.priority}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-[#080808] px-2.5 py-1">{job.budget}</span>
                    {job.phone && <span className="rounded-full bg-[#080808] px-2.5 py-1">{job.phone}</span>}
                    {job.files.length > 0 && (
                      <span className="rounded-full bg-[#080808] px-2.5 py-1">
                        {job.files.length} attachment{job.files.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {job.measurements.length > 0 && (
                      <span className="rounded-full bg-[#080808] px-2.5 py-1">
                        {job.measurements.length} measurement{job.measurements.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {job.access && (
                    <p className="mt-3 max-w-2xl text-sm text-gray-500">Access: {job.access}</p>
                  )}
                  {job.notes && (
                    <p className="mt-3 max-w-2xl text-sm text-gray-500">{job.notes}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                  <StatusBadge status={job.status} />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id)
                      setView("reports")
                    }}
                    className="rounded-lg border border-[#444] px-3 py-2 text-sm text-gray-200 transition hover:border-green-600 hover:text-white"
                  >
                    View report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REPORTS */}
        {view === "reports" && (
          <div className="rounded-xl border border-[#333] bg-[#111] p-5 sm:p-6">
            {selectedJob ? (
              <>
                <div className="flex flex-col gap-4 border-b border-[#262626] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-green-300">
                      Agent prep report
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{selectedJob.address}</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Prepared for {selectedJob.clientName} - {selectedJob.projectType}
                    </p>
                  </div>
                  <StatusBadge status={selectedJob.status} />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-5">
                  {[
                    ["Sq ft", selectedJob.squareFeet || "Not provided"],
                    ["Built", selectedJob.yearBuilt || "Not provided"],
                    ["Beds", selectedJob.bedrooms || "Not provided"],
                    ["Baths", selectedJob.bathrooms || "Not provided"],
                    ["Lot", selectedJob.lotSize || "Not provided"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm text-gray-100">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
                  <section>
                    <h3 className="text-sm font-semibold text-gray-200">Measurements</h3>
                    <div className="mt-3 space-y-3">
                      {selectedJob.measurements.length > 0 ? (
                        selectedJob.measurements.map((measurement, index) => (
                          <div key={index} className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-medium text-gray-100">
                                {measurement.area || "Unnamed area"}
                              </p>
                              <p className="text-sm text-gray-400">
                                {[measurement.length, measurement.width].filter(Boolean).join(" x ") ||
                                  "Dimensions not provided"}
                              </p>
                            </div>
                            {measurement.notes && (
                              <p className="mt-2 text-sm text-gray-500">{measurement.notes}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4 text-sm text-gray-500">
                          No measurements captured yet.
                        </p>
                      )}
                    </div>
                  </section>

                  <aside className="rounded-lg border border-[#2a2a2a] bg-[#080808] p-4">
                    <h3 className="text-sm font-semibold text-gray-200">Scope summary</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-400">
                      <p>Timeline: {selectedJob.timeline}</p>
                      <p>Priority: {selectedJob.priority}</p>
                      <p>Budget: {selectedJob.budget}</p>
                      <p>Attachments: {selectedJob.files.length}</p>
                      {selectedJob.access && <p>Access: {selectedJob.access}</p>}
                    </div>
                    {selectedJob.notes && (
                      <div className="mt-5 border-t border-[#222] pt-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</p>
                        <p className="mt-2 text-sm text-gray-400">{selectedJob.notes}</p>
                      </div>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500">
                Submit a property first, then the agent report will appear here.
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111] p-5 rounded-xl">New Leads: {jobs.length}</div>
            <div className="bg-[#111] p-5 rounded-xl">In Review</div>
          </div>
        )}

      </div>
    </div>
  )
}
