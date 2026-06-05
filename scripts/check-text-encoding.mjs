import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MAX_FINDINGS = 50

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
])

const SKIP_DIRS = new Set([
  '.git',
  'dist',
  'node_modules',
])

const CP1251_TRAIL = new Set([
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
  0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045e, 0x045f, 0x00a0,
  0x040e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7, 0x0401, 0x00a9,
  0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407, 0x00b0, 0x00b1,
  0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7, 0x0451, 0x2116,
  0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
])

const CP1252_TRAIL = new Set([
  0x0080, 0x0081, 0x008d, 0x008f, 0x0090, 0x009d,
  0x00a0, 0x00a1, 0x00a2, 0x00a3, 0x00a4, 0x00a5, 0x00a6, 0x00a7,
  0x00a8, 0x00a9, 0x00aa, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x00af,
  0x00b0, 0x00b1, 0x00b2, 0x00b3, 0x00b4, 0x00b5, 0x00b6, 0x00b7,
  0x00b8, 0x00b9, 0x00ba, 0x00bb, 0x00bc, 0x00bd, 0x00be, 0x00bf,
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192,
  0x02c6, 0x02dc, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e,
  0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac,
  0x2122,
])

const findings = []

for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8')
  scanFile(file, text)
}

if (findings.length) {
  console.error('Encoding check failed. Suspicious mojibake or replacement characters were found:')
  for (const finding of findings.slice(0, MAX_FINDINGS)) {
    console.error(`- ${path.relative(ROOT, finding.file)}:${finding.line}:${finding.column} ${finding.reason}`)
  }
  if (findings.length > MAX_FINDINGS) {
    console.error(`...and ${findings.length - MAX_FINDINGS} more finding(s).`)
  }
  process.exit(1)
}

console.log('Encoding check passed.')

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walk(path.join(dir, entry.name))
      }
      continue
    }

    const file = path.join(dir, entry.name)
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      yield file
    }
  }
}

function scanFile(file, text) {
  const lines = text.split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const chars = [...line]
    for (let index = 0; index < chars.length; index += 1) {
      const current = chars[index].codePointAt(0)
      const next = chars[index + 1]?.codePointAt(0)

      if (current === 0xfffd) {
        addFinding(file, lineIndex, index, 'contains U+FFFD replacement character')
        continue
      }

      if (isCp1251MojibakePair(current, next)) {
        addFinding(file, lineIndex, index, 'looks like UTF-8 decoded as Windows-1251')
        continue
      }

      if (isCp1252MojibakePair(current, next)) {
        addFinding(file, lineIndex, index, 'looks like UTF-8 decoded as Windows-1252/Latin-1')
      }
    }
  }
}

function isCp1251MojibakePair(current, next) {
  if (!CP1251_TRAIL.has(next)) return false
  return current === 0x0420 || current === 0x0421 || current === 0x0432 || current === 0x0412
}

function isCp1252MojibakePair(current, next) {
  if (!CP1252_TRAIL.has(next)) return false
  return current === 0x00d0 || current === 0x00d1 || current === 0x00c2 || current === 0x00c3 || current === 0x00e2
}

function addFinding(file, lineIndex, index, reason) {
  findings.push({
    file,
    line: lineIndex + 1,
    column: index + 1,
    reason,
  })
}
