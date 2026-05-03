import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BidMemoryFile, OldBidJob } from '../types/shelterprep-ai';

const money = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const cleanFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();

function guessRole(file: File): BidMemoryFile['role'] {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'photo';
  if (name.includes('invoice')) return 'invoice';
  if (name.includes('estimate') || name.includes('bid')) return 'estimate';
  if (name.includes('receipt')) return 'receipt';
  return 'other';
}

export default function BidMemory() {
  const [title, setTitle] = useState('');
  const [jobType, setJobType] = useState('');
  const [location, setLocation] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [hours, setHours] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [disposalCost, setDisposalCost] = useState('');
  const [outcome, setOutcome] = useState<'won' | 'lost' | 'completed' | 'unknown'>('completed');
  const [profitNotes, setProfitNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<OldBidJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadJobs() {
    const { data, error } = await supabase
      .from('old_bid_jobs')
      .select('id, created_at, title, job_type, location, scope_summary, bid_price, final_price, pricing_summary, pricing_lessons, risk_flags')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      setMessage(`Could not load old jobs: ${error.message}`);
      return;
    }
    setJobs((data || []) as OldBidJob[]);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function uploadFiles(): Promise<BidMemoryFile[]> {
    const uploaded: BidMemoryFile[] = [];

    for (const file of files) {
      const path = `old-jobs/${Date.now()}-${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      const { error } = await supabase.storage.from('bid-memory').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);

      uploaded.push({
        bucket: 'bid-memory',
        path,
        name: file.name,
        type: file.type,
        size: file.size,
        role: guessRole(file),
      });
    }

    return uploaded;
  }

  async function saveBidMemory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('Uploading files and building bid memory...');

    try {
      const uploadedFiles = await uploadFiles();
      const { data, error } = await supabase.functions.invoke('bid-memory-index', {
        body: {
          title,
          jobType,
          location,
          customerName,
          scopeNotes,
          bidPrice,
          finalPrice,
          hours,
          materialCost,
          disposalCost,
          outcome,
          profitNotes,
          files: uploadedFiles,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Bid memory function failed');

      setMessage(`Saved: ${data.job.title}`);
      setTitle('');
      setJobType('');
      setLocation('');
      setCustomerName('');
      setScopeNotes('');
      setBidPrice('');
      setFinalPrice('');
      setHours('');
      setMaterialCost('');
      setDisposalCost('');
      setOutcome('completed');
      setProfitNotes('');
      setFiles([]);
      await loadJobs();
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Shelter Prep AI</p>
            <h2 className="text-2xl font-bold text-slate-900">Bid Memory</h2>
            <p className="mt-1 text-slate-600">Upload old invoices, bids, photos, and job notes so the estimator can compare future leads against your real past jobs.</p>
          </div>
          <button
            type="button"
            onClick={loadJobs}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Refresh jobs
          </button>
        </div>
      </div>

      <form onSubmit={saveBidMemory} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Job title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Front door install with trim repair" className="w-full rounded-xl border p-3" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Job type *</span>
            <input value={jobType} onChange={(e) => setJobType(e.target.value)} required placeholder="Door install, junk removal, deck repair..." className="w-full rounded-xl border p-3" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lake Oswego / Portland / Beaverton" className="w-full rounded-xl border p-3" />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Customer / lead name</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" className="w-full rounded-xl border p-3" />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Scope / job notes</span>
          <textarea value={scopeNotes} onChange={(e) => setScopeNotes(e.target.value)} rows={5} placeholder="What was included? What was excluded? Any rot, access issues, dump runs, weather, stairs, height, customer-supplied materials?" className="w-full rounded-xl border p-3" />
        </label>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Original bid</span>
            <input value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} placeholder="$1,250" className="w-full rounded-xl border p-3" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Final price</span>
            <input value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="$1,850" className="w-full rounded-xl border p-3" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Hours / days</span>
            <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="8 or 1.5 days" className="w-full rounded-xl border p-3" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Materials cost</span>
            <input value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} placeholder="$325" className="w-full rounded-xl border p-3" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Dump / disposal cost</span>
            <input value={disposalCost} onChange={(e) => setDisposalCost(e.target.value)} placeholder="$125" className="w-full rounded-xl border p-3" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Outcome</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)} className="w-full rounded-xl border p-3">
              <option value="completed">Completed</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Private pricing lesson</span>
          <textarea value={profitNotes} onChange={(e) => setProfitNotes(e.target.value)} rows={3} placeholder="Example: underbid because threshold rot added 4 hours; charge extra for material pickup and dump run." className="w-full rounded-xl border p-3" />
        </label>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Invoices, estimates, receipts, and photos</span>
          <input type="file" multiple accept="image/*,.pdf,.txt,.docx" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full rounded-xl border p-3" />
          <p className="text-xs text-slate-500">Photos are analyzed. PDFs/invoices are stored and linked; enter the important price/scope info above so the AI has clean numbers.</p>
        </label>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <button disabled={loading} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60">
            {loading ? 'Saving...' : 'Save to AI Bid Memory'}
          </button>
          {message && <p className="text-sm text-slate-700">{message}</p>}
        </div>
      </form>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Recent bid memories</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900">{job.title}</h4>
                  <p className="text-sm text-slate-500">{job.job_type} {job.location ? `• ${job.location}` : ''}</p>
                </div>
                <div className="text-right text-sm font-semibold text-slate-700">{money(job.final_price || job.bid_price)}</div>
              </div>
              {job.scope_summary && <p className="mt-3 text-sm text-slate-700">{job.scope_summary}</p>}
              {job.pricing_lessons?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {job.pricing_lessons.slice(0, 3).map((lesson, idx) => <li key={idx}>{lesson}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
          {!jobs.length && <p className="text-sm text-slate-500">No old jobs saved yet.</p>}
        </div>
      </div>
    </div>
  );
}
