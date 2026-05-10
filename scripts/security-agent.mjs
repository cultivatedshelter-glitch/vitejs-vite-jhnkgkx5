#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css', '.html', '.sql'])
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'dist-ssr', 'coverage', '.vite'])
const findings = []

function addFinding(level, file, message, detail = '') {
  findings.push({ level, file, message, detail })
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue

    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }

    const ext = extname(entry.name)
    if (allowedExtensions.has(ext) || entry.name.startsWith('.env')) {
      files.push(fullPath)
    }
  }

  return files
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function relativeFile(path) {
  return relative(root, path) || path
}

function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length
}

function scanSecrets(files) {
  const secretPatterns = [
    {
      label: 'Supabase service role key',
      pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|service_role)/gi,
      level: 'error',
    },
    {
      label: 'Hard-coded agent key',
      pattern: /(AGENT_API_KEY|x-agent-key)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      level: 'error',
    },
    {
      label: 'Private key material',
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
      level: 'error',
    },
    {
      label: 'Live env value committed',
      pattern: /^VITE_[A-Z0-9_]+=((?!your-|change-me|$).{8,})$/gim,
      level: 'warn',
    },
  ]

  for (const file of files) {
    const rel = relativeFile(file)
    if (rel === '.env') {
      addFinding('warn', rel, 'Local .env file is present in the workspace.', 'Keep it ignored and never commit it.')
      continue
    }

    const content = read(file)
    for (const { label, pattern, level } of secretPatterns) {
      for (const match of content.matchAll(pattern)) {
        const line = lineNumber(content, match.index || 0)
        if (rel === '.env.example' && level === 'warn') continue
        addFinding(level, `${rel}:${line}`, label, 'Move secrets to Supabase/Railway server-side env vars.')
      }
    }
  }
}

function scanBrowserRisk(files) {
  for (const file of files) {
    const rel = relativeFile(file)
    if (!rel.startsWith('src/')) continue

    const content = read(file)
    const checks = [
      {
        pattern: /dangerouslySetInnerHTML/g,
        message: 'Raw HTML rendering found.',
        detail: 'Sanitize content before rendering HTML in React.',
      },
      {
        pattern: /\binnerHTML\s*=/g,
        message: 'Direct innerHTML assignment found.',
        detail: 'Prefer React rendering or sanitized HTML.',
      },
      {
        pattern: /\beval\s*\(|new Function\s*\(/g,
        message: 'Dynamic code execution found.',
        detail: 'Avoid eval/new Function in app code.',
      },
      {
        pattern: /localStorage\.(?:setItem|getItem)/g,
        message: 'Browser storage use found.',
        detail: 'Do not store secrets, access tokens, or sensitive lead data in localStorage.',
      },
    ]

    for (const check of checks) {
      for (const match of content.matchAll(check.pattern)) {
        addFinding('warn', `${rel}:${lineNumber(content, match.index || 0)}`, check.message, check.detail)
      }
    }
  }
}

function scanSupabaseFunctions(files) {
  for (const file of files) {
    const rel = relativeFile(file)
    if (!rel.startsWith('supabase/functions/')) continue

    const content = read(file)
    if (content.includes("'Access-Control-Allow-Origin': '*'") || content.includes('"Access-Control-Allow-Origin": "*"')) {
      addFinding(
        'warn',
        rel,
        'Supabase Edge Function allows every origin.',
        'Restrict CORS with an allowlist before production.'
      )
    }

    if (!/authorization/i.test(content)) {
      addFinding(
        'warn',
        rel,
        'No authorization handling found in Edge Function.',
        'Confirm the function is intentionally public or verify the Supabase user token.'
      )
    }
  }
}

function checkProjectHygiene() {
  const gitignore = existsSync(join(root, '.gitignore')) ? read(join(root, '.gitignore')) : ''
  if (!gitignore.includes('.env')) {
    addFinding('error', '.gitignore', '.env files are not ignored.', 'Add .env and .env.* while keeping .env.example.')
  }

  if (!existsSync(join(root, '.env.example'))) {
    addFinding('warn', '.env.example', 'No env example file found.', 'Document required non-secret configuration for setup.')
  }

  if (!existsSync(join(root, 'package-lock.json'))) {
    addFinding('warn', 'package-lock.json', 'No lockfile found.', 'Commit a lockfile so dependency security checks are repeatable.')
  }
}

function runCommand(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: false })
  if (result.error) {
    addFinding('warn', label, `${label} could not run.`, result.error.message)
    return
  }

  if (result.status !== 0) {
    addFinding('error', label, `${label} failed.`, (result.stderr || result.stdout).trim().slice(0, 600))
  }
}

function runLocalBin(label, binName, args) {
  const binPath = join(root, 'node_modules', '.bin', binName)
  if (!existsSync(binPath)) {
    addFinding('warn', label, `${label} could not run.`, `Missing ${binPath}. Run npm install first.`)
    return
  }

  const result = spawnSync(process.execPath, [binPath, ...args], { cwd: root, encoding: 'utf8', shell: false })
  if (result.status !== 0) {
    addFinding('error', label, `${label} failed.`, (result.stderr || result.stdout).trim().slice(0, 600))
  }
}

function runAuditIfAvailable() {
  const result = spawnSync('npm', ['audit', '--audit-level=high'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  })

  if (result.error) {
    addFinding('warn', 'npm audit', 'Dependency audit could not run.', result.error.message)
    return
  }

  if (result.status !== 0) {
    const output = (result.stdout || result.stderr).trim()
    addFinding('error', 'npm audit', 'High-severity dependency audit failed.', output.slice(0, 700))
  }
}

const files = walk(root)

checkProjectHygiene()
scanSecrets(files)
scanBrowserRisk(files)
scanSupabaseFunctions(files)
runLocalBin('TypeScript check', 'tsc', [])
runLocalBin('Vite build', 'vite', ['build'])
runAuditIfAvailable()

const errorCount = findings.filter((finding) => finding.level === 'error').length
const warnCount = findings.filter((finding) => finding.level === 'warn').length

console.log('\nSecurity agent report')
console.log('=====================')

if (findings.length === 0) {
  console.log('No issues found.')
} else {
  for (const finding of findings) {
    console.log(`\n[${finding.level.toUpperCase()}] ${finding.file}`)
    console.log(`- ${finding.message}`)
    if (finding.detail) console.log(`- ${finding.detail}`)
  }
}

console.log(`\nSummary: ${errorCount} error(s), ${warnCount} warning(s).`)
process.exit(errorCount > 0 ? 1 : 0)
