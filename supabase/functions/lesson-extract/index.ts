type LessonExtractRequest = {
  sourceLinks?: string[]
  transcriptText?: string
  learningGoal?: string
  tradeCategory?: string
  memoryDestination?: string
}

type SourceLessonConfidence = 'low' | 'medium' | 'high'
type TranscriptSource = 'pasted' | 'youtube' | 'fallback' | 'unavailable'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ status: 'error', errorCode: 'method_not_allowed', error: 'Use POST for lesson extraction.' }, 405)
  }

  let body: LessonExtractRequest = {}
  try {
    const authResult = await validateLearningUser(request)
    if (!authResult.ok) {
      return jsonResponse({ status: 'error', errorCode: authResult.errorCode, error: authResult.error }, authResult.status)
    }

    body = await readJsonBody(request)
    const sourceLinks = Array.isArray(body.sourceLinks)
      ? body.sourceLinks.map((url) => String(url || '').trim()).filter(Boolean)
      : []
    const learningGoal = String(body.learningGoal || '').trim()
    const tradeCategory = String(body.tradeCategory || 'General Repair').trim() || 'General Repair'
    let transcript = String(body.transcriptText || '').trim()
    let transcriptSource: TranscriptSource = transcript ? 'pasted' : 'youtube'

    if (!learningGoal) {
      return jsonResponse({ status: 'error', errorCode: 'missing_learning_goal', error: 'Add the learning goal first.' }, 400)
    }

    if (!transcript && sourceLinks.length) {
      transcript = await getFirstAvailableTranscript(sourceLinks)
    }

    if (!transcript) {
      return jsonResponse(
        {
          status: 'needs_review',
          warning: 'Transcript unavailable. Generated a safe fallback draft from the learning goal and source links.',
          errorCode: 'transcript_unavailable_fallback',
          transcriptSource: 'fallback',
          draft: buildFallbackLessonDraft({ sourceLinks, learningGoal, tradeCategory }),
        },
        200
      )
    }

    if (transcriptSource === 'youtube' && body.transcriptText?.trim()) {
      transcriptSource = 'pasted'
    }

    return jsonResponse({
      status: 'needs_review',
      transcriptSource,
      draft: buildLessonDraft(transcript, learningGoal, tradeCategory),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lesson extraction failed.'
    console.log('[lesson-extract] request failed', { message })

    const learningGoal = String(body.learningGoal || '').trim()
    const tradeCategory = String(body.tradeCategory || 'General Repair').trim() || 'General Repair'
    const sourceLinks = Array.isArray(body.sourceLinks)
      ? body.sourceLinks.map((url) => String(url || '').trim()).filter(Boolean)
      : []

    if (learningGoal) {
      return jsonResponse(
        {
          status: 'needs_review',
          warning: 'Live lesson extraction failed. Generated a safe fallback draft for human review.',
          errorCode: 'fallback_after_extract_error',
          error: message,
          transcriptSource: 'fallback',
          draft: buildFallbackLessonDraft({ sourceLinks, learningGoal, tradeCategory }),
        },
        200
      )
    }

    return jsonResponse(
      {
        status: 'error',
        errorCode: 'lesson_extract_failed',
        error: message,
      },
      500
    )
  }
})

async function validateLearningUser(request: Request): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; status: number; errorCode: string; error: string }
> {
  const authorization = request.headers.get('authorization') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, errorCode: 'missing_auth', error: 'Please sign in with Supabase before generating lessons.' }
  }

  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 503, errorCode: 'supabase_env_missing', error: 'Lesson extraction is not configured.' }
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization,
    },
  })

  if (!userResponse.ok) {
    return { ok: false, status: 401, errorCode: 'invalid_auth', error: 'Please sign in with Supabase before generating lessons.' }
  }

  const user = await userResponse.json() as { id?: string }
  const userId = user.id || ''

  if (!userId) {
    return { ok: false, status: 401, errorCode: 'missing_user', error: 'Please sign in with Supabase before generating lessons.' }
  }

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, {
    headers: {
      apikey: anonKey,
      authorization,
      accept: 'application/json',
    },
  })

  if (!profileResponse.ok) {
    return { ok: false, status: 403, errorCode: 'role_lookup_failed', error: 'Could not verify your learning role.' }
  }

  const profiles = await profileResponse.json() as Array<{ role?: string }>
  const role = profiles[0]?.role || 'viewer'

  if (!['owner', 'admin', 'estimator'].includes(role)) {
    return { ok: false, status: 403, errorCode: 'insufficient_role', error: 'Only admin, owner, or estimator users can generate curated lessons.' }
  }

  return { ok: true, userId, role }
}

async function readJsonBody(request: Request): Promise<LessonExtractRequest> {
  try {
    return (await request.json()) as LessonExtractRequest
  } catch (_error) {
    throw new Error('Request body must be valid JSON.')
  }
}

async function getFirstAvailableTranscript(sourceLinks: string[]) {
  for (const url of sourceLinks) {
    const videoId = getYouTubeVideoId(url)
    if (!videoId) continue
    const transcript = await fetchYouTubeTranscript(videoId)
    if (transcript) return transcript
  }
  return ''
}

function getYouTubeVideoId(url: string) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return match?.[1] || ''
}

async function fetchYouTubeTranscript(videoId: string) {
  try {
    const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const watchHtml = await watchResponse.text()
    const captionTrackMatch = watchHtml.match(/"captionTracks":(\[.*?\])\s*,\s*"audioTracks"/)
    if (!captionTrackMatch?.[1]) return ''

    const captionTracks = JSON.parse(captionTrackMatch[1].replace(/\\"/g, '"')) as Array<{ baseUrl?: string; languageCode?: string }>
    const track = captionTracks.find((item) => item.languageCode?.startsWith('en')) || captionTracks[0]
    if (!track?.baseUrl) return ''

    const transcriptResponse = await fetch(track.baseUrl)
    const transcriptXml = await transcriptResponse.text()
    return decodeHtml(
      Array.from(transcriptXml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
        .map((match) => match[1].replace(/<[^>]+>/g, ' '))
        .join(' ')
    )
  } catch (error) {
    console.log('[lesson-extract] transcript unavailable', { videoId, error: error instanceof Error ? error.message : String(error) })
    return ''
  }
}

function buildLessonDraft(transcript: string, learningGoal: string, tradeCategory: string) {
  const cleanTranscript = cleanText(transcript)
  const sentences = splitSentences(cleanTranscript)
  const sourceText = sentences.length ? sentences : [cleanTranscript]
  const keySentences = pickSentences(sourceText, [
    'install',
    'remove',
    'repair',
    'measure',
    'cut',
    'prep',
    'fasten',
    'seal',
    'paint',
    'dry',
    'clean',
    'check',
    'because',
  ], 3)
  const laborSentences = pickSentences(sourceText, ['prep', 'protect', 'mask', 'setup', 'dry', 'return', 'haul', 'cleanup', 'remove', 'scrape', 'sand'], 2)
  const materialSentences = pickSentences(sourceText, ['material', 'tool', 'screw', 'nail', 'adhesive', 'caulk', 'paint', 'primer', 'blade', 'drill', 'saw', 'lumber', 'compound'], 4)
  const cleanupSentences = pickSentences(sourceText, ['clean', 'cleanup', 'debris', 'dust', 'dispose', 'haul', 'vacuum', 'protect'], 2)
  const estimateSentences = pickSentences(sourceText, ['hour', 'cost', 'price', 'estimate', 'labor', 'material', 'return', 'measure', 'quantity', 'risk'], 3)
  const confidence: SourceLessonConfidence = cleanTranscript.length > 1200 ? 'medium' : 'low'

  return {
    lesson_summary: concise(
      [
        `${tradeCategory}: ${learningGoal}`,
        keySentences.join(' '),
      ].filter(Boolean).join(' '),
      520
    ),
    operational_meaning: concise(
      `Before estimating, translate the source into verified field steps: ${keySentences.join(' ') || 'confirm prep, sequence, measurements, site constraints, and finish expectations.'}`,
      420
    ),
    estimate_impact: concise(
      estimateSentences.join(' ') || 'Estimate labor, materials, access, protection, return trips, cleanup/disposal, and contingency separately before approval.',
      420
    ),
    hidden_labor: concise(
      laborSentences.join(' ') || 'Watch for prep, masking/protection, setup, dry or cure time, material handling, rework risk, cleanup, and haul-off.',
      360
    ),
    materials_tools_equipment: materialSentences.length
      ? materialSentences.map((item) => concise(item, 130))
      : ['Extract materials, tools, equipment, sizes, quantities, and product assumptions from the source during admin review.'],
    cleanup_disposal: concise(
      cleanupSentences.join(' ') || 'Confirm dust control, debris handling, protection removal, final cleanup, and disposal/haul-off responsibility.',
      320
    ),
    confidence,
    observed_method: concise(keySentences.join(' ') || 'Source transcript/notes were reviewed for estimating-relevant method.', 360),
    job_steps: keySentences.length ? keySentences.map((item) => concise(item, 140)) : ['Review transcript/notes.', 'Confirm field conditions.', 'Edit and grade before saving memory.'],
    tools_materials: materialSentences.length ? materialSentences.map((item) => concise(item, 140)) : ['Verify tools and materials before pricing.'],
    safety_notes: concise(
      pickSentences(sourceText, ['safe', 'safety', 'glove', 'mask', 'dust', 'ladder', 'electric', 'utility', 'hazard'], 2).join(' ') ||
        'Human review required for PPE, utilities, dust, ladder/fall exposure, code, and licensed-trade limits.',
      320
    ),
    access_notes: concise(
      pickSentences(sourceText, ['access', 'space', 'stair', 'parking', 'entry', 'outside', 'inside', 'tight'], 2).join(' ') ||
        'Confirm access, staging, parking, work hours, occupied-area constraints, and material path.',
      300
    ),
    cleanup_notes: concise(cleanupSentences.join(' ') || 'Include cleanup and disposal in labor review.', 260),
    missing_info_questions: [
      'What dimensions, quantities, substrate conditions, and finish expectations are still missing?',
      'What site conditions would change labor hours or invalidate the source lesson?',
      'What cleanup, disposal, protection, or return-trip labor should be priced separately?',
    ],
    applies_when: `Use only for ${tradeCategory} work matching the source conditions, material system, access, and finish quality.`,
    does_not_apply_when: 'Do not apply when substrate, moisture/structural risk, code/licensed trade requirements, access, materials, or client expectations differ.',
  }
}

function buildFallbackLessonDraft(params: {
  sourceLinks: string[]
  learningGoal: string
  tradeCategory: string
}) {
  const sourceContext = params.sourceLinks.length
    ? `Source links provided: ${params.sourceLinks.slice(0, 3).join(' ')}`
    : 'No source transcript was available.'
  return buildLessonDraft(
    [
      `${params.tradeCategory}: ${params.learningGoal}.`,
      sourceContext,
      'Transcript or live extraction was unavailable, so this is a safe fallback draft.',
      'Human review must confirm the actual source, field conditions, sequence, quantities, materials, safety limits, cleanup, and estimating impact before any memory save.',
      'Do not treat this fallback as verified. Keep it needs review.',
    ].join(' '),
    params.learningGoal,
    params.tradeCategory
  )
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => cleanText(item))
    .filter((item) => item.length > 30)
    .slice(0, 120)
}

function pickSentences(sentences: string[], keywords: string[], limit: number) {
  const picked = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase()
    return keywords.some((keyword) => lower.includes(keyword))
  })
  return Array.from(new Set(picked)).slice(0, limit)
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function concise(value: string, limit: number) {
  const clean = cleanText(value)
  return clean.length > limit ? `${clean.slice(0, limit - 3).trim()}...` : clean
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
