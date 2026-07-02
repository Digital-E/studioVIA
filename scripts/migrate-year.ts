import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'r0r7pkb1',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_WRITE_TOKEN,
})

async function main() {
  const projects = await client.fetch<{ _id: string; year: unknown }[]>(
    `*[_type == "project" && defined(year)]{ _id, year }`
  )

  const toMigrate = projects.filter((p) => typeof p.year === 'number')
  console.log(`Found ${toMigrate.length} project(s) with numeric year`)

  for (const project of toMigrate) {
    const dateStr = `${project.year}-01-01`
    await client.patch(project._id).set({ year: dateStr }).commit()
    console.log(`  ${project._id}: ${project.year} → ${dateStr}`)
  }

  console.log('Done.')
}

main().catch(console.error)
