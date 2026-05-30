import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const existing = await db.user.findFirst({ where: { username: 'admin' } })
  if (existing) {
    console.log('Seed already applied — admin user exists.')
    return
  }

  const password = await bcrypt.hash('Admin@1234', 12)
  const admin = await db.user.create({
    data: {
      username: 'admin',
      name: 'مدیر سیستم',
      email: 'admin@tarebar.local',
      password,
      role: 'ORG_ADMIN',
    },
  })

  console.log(`Created ORG_ADMIN: ${admin.username} (id: ${admin.id})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
