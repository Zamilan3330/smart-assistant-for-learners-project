import "dotenv/config"
import { classifyChunk, classifyChunks } from "../modules/taxonomy/taxonomy-classifier"

async function main() {
  console.log("Testing taxonomy classifier with Claude...\n")

  const tests = [
    "Arrays, linked lists, stacks, queues are fundamental data structures used in programming.",
    "SQL SELECT JOIN GROUP BY query optimization and database indexing strategies.",
    "TCP vs UDP protocols, HTTP/HTTPS, client-server model and REST APIs.",
    "CIA triad, authentication vs authorization, TLS/HTTPS encryption basics.",
    "ББСБ Суурин компьютер: Dell Optiflex 3000 CPU Intel Core i5-14500, RAM 8GB DDR5", // Mongolian non-IT
  ]

  const results = await classifyChunks(tests)

  tests.forEach((text, i) => {
    const r = results[i]
    console.log(`Text: "${text.slice(0, 60)}..."`)
    console.log(`  → kaCode: ${r.kaCode || "(empty)"}, kuCode: ${r.kuCode || "(empty)"}`)
    console.log()
  })
}

main().catch(console.error)
