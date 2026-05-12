import { TAXONOMY, buildTaxonomyPromptSummary } from "../modules/taxonomy/taxonomy.service"

async function main() {
  console.log("KAs loaded:", TAXONOMY.length)
  console.log("KUs total:", TAXONOMY.reduce((s, ka) => s + ka.units.length, 0))
  console.log("Domains:", TAXONOMY.map((ka) => `${ka.id}: ${ka.name}`).join("\n  "))
  console.log("\nPrompt summary (first 300 chars):\n", buildTaxonomyPromptSummary().slice(0, 300))
}

main()
