import 'dotenv/config'
import { PrismaClient } from '../apps/web/src/generated/prisma/client'
import fs from 'fs'

async function main() {
  const p = new PrismaClient()
  const docs = await p.document.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    select: { id: true, title: true, storagePath: true, status: true },
  })

  for (const d of docs) {
    const exists = d.storagePath ? fs.existsSync(d.storagePath) : false
    console.log(`id=${d.id} status=${d.status} exists=${exists} path=${d.storagePath}`)
  }

  await p.$disconnect()
}

main()
