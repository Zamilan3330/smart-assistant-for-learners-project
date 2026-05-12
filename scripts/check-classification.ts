/**
 * Usage: npx tsx scripts/check-classification.ts [documentId]
 * If no documentId given, shows1 the 5 most recently indexed chunks.
 */
//COMMAND                                  documentId
// npx tsx scripts/check-classification.ts 22
import "dotenv/config";
import { prisma } from "../lib/db/prisma";

async function main() {
  const docId = process.argv[2] ? BigInt(process.argv[2]) : null;

  const chunks = await prisma.documentChunk.findMany({
    where: docId ? { documentId: docId } : undefined,
    orderBy: { id: "desc" },
    take: 10,
    include: { document: { select: { title: true } } },
  });

  if (chunks.length === 0) {
    console.log("No chunks found.");
    return;
  }

  console.log(`\nShowing ${chunks.length} chunk(s):\n`);

  for (const c of chunks) {
    const meta = c.taxonomyMetadata as Record<string, string> | null;
    const kaCode = meta?.kaCode || "(empty)";
    const kuCode = meta?.kuCode || "(empty)";
    const classified = kaCode !== "(empty)";

    console.log(
      `[Chunk #${c.id}] Doc: "${c.document?.title}" | Page ${c.pageNumber}`,
    );
    console.log(
      `  KA: ${kaCode}  KU: ${kuCode}  ${classified ? "✓" : "✗ NOT CLASSIFIED"}`,
    );
    console.log(`  Text: "${c.chunkText.slice(0, 80).replace(/\n/g, " ")}..."`);
    console.log();
  }

  const total = chunks.length;
  const classified = chunks.filter((c) => {
    const meta = c.taxonomyMetadata as Record<string, string> | null;
    return meta?.kaCode;
  }).length;

  console.log(`Classification rate: ${classified}/${total} chunks`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
