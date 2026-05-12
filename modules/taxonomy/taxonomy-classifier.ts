/**
 * modules/taxonomy/taxonomy-classifier.ts
 *
 * Classifies a text chunk into a KA + KU using Claude (Anthropic API).
 * Falls back to empty strings if the text is not IT-related or on error.
 */

import Anthropic from "@anthropic-ai/sdk"
import { buildTaxonomyPromptSummary, TAXONOMY } from "./taxonomy.service"
import type { ClassificationResult } from "./taxonomy.types"

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) throw new Error("CLAUDE_API_KEY is not set")
    _client = new Anthropic({ apiKey })
  }
  return _client
}

const TAXONOMY_SUMMARY = buildTaxonomyPromptSummary()

const SYSTEM_PROMPT = `You are a precise taxonomy classifier for an IT learning system.
Given a text chunk from a student's study material, classify it into exactly one Knowledge Area (KA) and one Knowledge Unit (KU) from the taxonomy below.

CRITICAL RULES:
1. Read the text carefully and match it to the KA whose TOPICS best fit the content.
2. Pay close attention to domain-specific keywords:
   - Networking terms (TCP, UDP, IP, DNS, routing, subnet, OSI, HTTP, packets, bandwidth, latency, firewall, VLAN, switch, router) → IT-KA-05
   - Security terms (encryption, authentication, vulnerability, threat, malware, access control) → IT-KA-07
   - Database terms (SQL, query, schema, normalization, transaction, index, DBMS) → IT-KA-03
   - OS terms (process, thread, kernel, memory management, file system, scheduling) → IT-KA-06
   - AI/ML terms (neural network, training data, classification model, regression, deep learning, NLP) → IT-KA-11
   - Programming terms (variable, function, loop, class, object, compiler, debugging) → IT-KA-01
   - Algorithm terms (sorting, searching, graph traversal, complexity, Big-O, recursion) → IT-KA-02
   - Software engineering terms (requirements, testing, design patterns, SDLC, agile, UML) → IT-KA-04
   - Web/mobile terms (HTML, CSS, JavaScript, React, API, REST, frontend, backend, responsive) → IT-KA-08
   - Cloud terms (virtualization, container, Docker, Kubernetes, microservices, serverless, AWS) → IT-KA-09
   - Data science terms (statistics, data visualization, pandas, data cleaning, exploratory analysis) → IT-KA-10
3. Do NOT default to AI/ML (IT-KA-11) unless the text genuinely discusses machine learning, AI models, or data science.
4. Return ONLY valid codes from the taxonomy list. If unsure, pick the BEST match — do not guess randomly.
5. If the text is NOT related to IT/computing at all, return empty strings.
6. Return JSON: {"kaCode": "...", "kuCode": "..."}

IT Taxonomy:
${TAXONOMY_SUMMARY}`

/**
 * Classify a single text chunk → { kaCode, kuCode }.
 * Uses claude-haiku-4-5 for speed and cost efficiency (runs per-chunk on every upload).
 */
export async function classifyChunk(text: string): Promise<ClassificationResult> {
  try {
    const client = getClient()
    const truncated = text.slice(0, 1500)

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Classify this text chunk. Return JSON with keys "kaCode" and "kuCode".\n\nText:\n${truncated}`,
        },
      ],
    })

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!textBlock) return { kaCode: "", kuCode: "" }

    // Extract JSON from the response (may be wrapped in markdown code fences)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { kaCode: "", kuCode: "" }

    const parsed = JSON.parse(jsonMatch[0]) as { kaCode?: string; kuCode?: string }
    const kaCode = parsed.kaCode ?? ""
    const kuCode = parsed.kuCode ?? ""

    // Validate codes exist in taxonomy
    const validKA = TAXONOMY.some((ka) => ka.id === kaCode)
    const validKU =
      validKA && TAXONOMY.find((ka) => ka.id === kaCode)!.units.some((ku) => ku.id === kuCode)

    return {
      kaCode: validKA ? kaCode : "",
      kuCode: validKU ? kuCode : "",
    }
  } catch (err) {
    console.error("[taxonomy-classifier] classification failed:", err)
    return { kaCode: "", kuCode: "" }
  }
}

/**
 * Classify multiple chunks with bounded concurrency.
 */
export async function classifyChunks(
  texts: string[],
  concurrency = 5,
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(classifyChunk))
    results.push(...batchResults)
  }

  return results
}
