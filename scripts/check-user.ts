import 'dotenv/config'
import { PrismaClient } from '../apps/web/src/generated/prisma/client'

async function main() {
  const p = new PrismaClient()
  const user = await p.user.findFirst({ where: { email: 'demo@smart-assistant.local' } })
  console.log('demo user:', user ? `id=${user.id}` : 'NOT FOUND')

  const chunks = await p.documentChunk.findMany({ where: { documentId: 26n }, take: 1, select: { id: true, chunkIndex: true } })
  console.log('DB chunks for doc 26:', chunks.length > 0 ? `found, first id=${chunks[0].id}` : 'NONE')

  await p.$disconnect()
}
main()
