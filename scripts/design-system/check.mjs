#!/usr/bin/env node
/**
 * Design System Policy Checker
 * Enforces design-system-agent-builder.md §8 rules by scanning className strings
 * in TSX/JSX files against the policy manifest.
 *
 * Usage: node scripts/design-system/check.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ROOT = join(__dirname, "..", "..")
const POLICY_PATH = join(__dirname, "policy.json")

const policy = JSON.parse(readFileSync(POLICY_PATH, "utf-8"))

const SRC_DIR = join(ROOT, "src")
const EXTENSIONS = [".tsx", ".jsx"]

function matchesGlob(filePath, glob) {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/")
  const pattern = glob.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
  return new RegExp(`^${pattern}$`).test(rel)
}

function isExcluded(filePath) {
  return policy.excludedPaths.some((exc) => matchesGlob(filePath, exc.glob))
}

function isRoundedFullAllowed(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/")
  return policy.roundedFullAllowlist.some((entry) =>
    rel.startsWith(entry.split(" —")[0].split(" —")[0].trim()),
  )
}

function collectFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectFiles(full))
    } else if (EXTENSIONS.some((ext) => full.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

function extractClassNameStrings(line) {
  const strings = []
  const regex = /(?:className|cn\(|clsx\(|cva\().*?["'`]([^"'`]+)["'`]/g
  let match
  while ((match = regex.exec(line)) !== null) {
    strings.push(match[1])
  }
  return strings
}

const violations = []

for (const file of collectFiles(SRC_DIR)) {
  if (isExcluded(file)) continue

  const content = readFileSync(file, "utf-8")
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const classStrings = extractClassNameStrings(line)

    for (const cls of classStrings) {
      for (const rule of policy.rules) {
        if (rule.id === "no-rounded-full-buttons" && isRoundedFullAllowed(file)) continue

        for (const pattern of rule.patterns) {
          const isRegex = pattern.startsWith("#")
          const regex = isRegex ? new RegExp(pattern) : null

          if (isRegex ? regex.test(cls) : cls.includes(pattern)) {
            violations.push({
              file: relative(ROOT, file),
              line: i + 1,
              rule: rule.id,
              severity: rule.severity,
              pattern,
              match: cls.substring(0, 80),
              reference: rule.reference,
            })
          }
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n  Design System Policy: ${violations.length} violation(s) found\n`)
  for (const v of violations) {
    const icon = v.severity === "error" ? "✖" : "⚠"
    console.error(`  ${icon} ${v.file}:${v.line}`)
    console.error(`    Rule: ${v.rule} (${v.severity})`)
    console.error(`    Pattern: "${v.pattern}" found in: "${v.match}"`)
    console.error(`    Ref: ${v.reference}\n`)
  }
  process.exit(1)
} else {
  console.log("\n  ✔ Design System Policy: All checks passed\n")
  process.exit(0)
}
