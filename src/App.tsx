// 👉 FULL CLEAN SaaS VERSION (paste everything)

import { useState } from "react"

type Job = {
  id: number
  address: string
  status: "new" | "ready" | "review" | "needs_info"
}

const statusStyles = {
  new: "bg-blue-950 text-blue-300 border-blue-700",
  ready: "bg-green-900 text-green-200 border-green-700",
  review: "bg-amber-950 text-amber-300 border-amber-700",
  needs_info: "bg-red-950 text-red-300 border-red-700",
}

function StatusBadge({ status }: { status: Job["status"] }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  )
}

function NavTab({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border text-sm ${
        active
          ? "bg-white text-black border-white"
          : "bg-[#111] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  )
}

export default function App() {
  const [mode, setMode] = useState<"agent" | "admin">("agent")
  const [view, setView] = useState("intake")
  const [jobs, setJobs] = useState<Job[]>([])

  const addJob = () => {
    setJobs([
      {
        id: Date.now(),
        address: "123 Example St",
        status: "new",
      },
      ...jobs,
    ])
    setView("listings")
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white px-6 py-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">

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
              className={`px-3 py-2 rounded-lg ${mode === "agent" ? "bg-green-700" : "bg-[#111]"}`}
            >
              Agent
            </button>
            <button
              onClick={() => { setMode("admin"); setView("dashboard") }}
              className={`px-3 py-2 rounded-lg ${mode === "admin" ? "bg-green-700" : "bg-[#111]"}`}
            >
              Admin
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-3 mb-8">
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
          <div className="bg-[#111] border border-[#333] rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">New Property</h2>

            <input
              placeholder="Property Address"
              className="w-full mb-4 p-3 bg-[#080808] border border-[#333] rounded-xl"
            />

            <button
              onClick={addJob}
              className="bg-green-700 hover:bg-green-800 px-4 py-2 rounded-xl"
            >
              Submit Property
            </button>
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
                className="bg-[#111] border border-[#333] rounded-xl p-4 flex justify-between"
              >
                <div>{job.address}</div>
                <StatusBadge status={job.status} />
              </div>
            ))}
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
