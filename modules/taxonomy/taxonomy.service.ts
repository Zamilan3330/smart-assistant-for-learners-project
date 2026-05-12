/**
 * modules/taxonomy/taxonomy.service.ts
 *
 * Loads ALL *.yaml files from taxonomy/ at startup.
 * Adding a new domain (e.g. law.yaml) requires no TypeScript changes —
 * just drop the file in taxonomy/ with the same schema as it.yaml.
 */

import fs from "fs"
import path from "path"
import { parse } from "yaml"
import type { KnowledgeArea } from "./taxonomy.types"

// ─── YAML schema types (mirrors it.yaml structure) ────────────────────────────

interface YamlKU {
  id: string
  name: string
  core?: boolean
  topics?: string[]
  learning_outcomes?: string[]
}

interface YamlKA {
  id: string
  name: string
  description?: string
  core?: boolean
  knowledge_units?: YamlKU[]
}

interface YamlFile {
  knowledge_areas?: YamlKA[]
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function loadTaxonomyDir(): KnowledgeArea[] {
  const taxonomyDir = path.resolve(process.cwd(), "taxonomy")

  // When running from apps/web (Next.js), cwd is apps/web — walk up to project root
  const candidates = [
    taxonomyDir,
    path.resolve(process.cwd(), "..", "..", "taxonomy"),
  ]

  let dir: string | null = null
  for (const c of candidates) {
    if (fs.existsSync(c)) { dir = c; break }
  }

  if (!dir) {
    console.warn("[taxonomy] taxonomy/ directory not found — no KAs loaded")
    return []
  }

  const yamlFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))

  const areas: KnowledgeArea[] = []

  for (const file of yamlFiles) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8")
    let doc: YamlFile

    try {
      doc = parse(raw) as YamlFile
    } catch (e) {
      console.error(`[taxonomy] Failed to parse ${file}:`, e)
      continue
    }

    for (const ka of doc.knowledge_areas ?? []) {
      areas.push({
        id: ka.id,
        name: ka.name,
        description: (ka.description ?? "").trim(),
        units: (ka.knowledge_units ?? []).map((ku) => ({
          id: ku.id,
          name: ku.name,
          topics: ku.topics ?? [],
        })),
      })
    }
  }

  return areas
}

// Loaded once at module init — all *.yaml files in taxonomy/
export const TAXONOMY: KnowledgeArea[] = loadTaxonomyDir()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compact text summary of all KAs/KUs — used in the classifier prompt.
 * Includes ALL topics for each KU so the LLM has enough signal to
 * distinguish between domains (e.g. networking vs AI).
 */
export function buildTaxonomyPromptSummary(): string {
  return TAXONOMY.map((ka) => {
    const desc = ka.description ? ` — ${ka.description}` : ""
    const kuLines = ka.units
      .map((ku) => {
        const topicStr = ku.topics.length > 0 ? ` [${ku.topics.join("; ")}]` : ""
        return `    ${ku.id}: ${ku.name}${topicStr}`
      })
      .join("\n")
    return `  ${ka.id}: ${ka.name}${desc}\n${kuLines}`
  }).join("\n")
}

export function findKA(kaCode: string) {
  return TAXONOMY.find((ka) => ka.id === kaCode)
}

export function findKU(kuCode: string) {
  for (const ka of TAXONOMY) {
    const ku = ka.units.find((u) => u.id === kuCode)
    if (ku) return { ka, ku }
  }
  return null
}
