import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { presentationTool } from 'sanity/presentation'
import { colorInput } from '@sanity/color-input'
import { schemas } from './sanity/schemas'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'r0r7pkb1'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  title: 'Studio VIA',
  schema: { types: schemas },
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem().title('Homepage').id('homepage').child(
              S.document().schemaType('homepage').documentId('homepage')
            ),
            S.listItem().title('Studio Page').id('studioPage').child(
              S.document().schemaType('studioPage').documentId('studioPage')
            ),
            S.listItem().title('All Projects Page').id('allProjectsPage').child(
              S.document().schemaType('allProjectsPage').documentId('allProjectsPage')
            ),
            S.divider(),
            S.documentTypeListItem('project').title('Projects'),
          ]),
    }),
    visionTool(),
    colorInput(),
    presentationTool({
      previewUrl: {
        previewMode: {
          enable: '/api/draft-mode/enable',
        },
      },
      resolve: {
        locations: {
          homepage: {
            locations: [
              { title: 'Homepage (DE)', href: '/de' },
              { title: 'Homepage (FR)', href: '/fr' },
            ],
          },
          studioPage: {
            locations: [
              { title: 'Studio Page (DE)', href: '/de/studio' },
              { title: 'Studio Page (FR)', href: '/fr/studio' },
            ],
          },
          allProjectsPage: {
            locations: [
              { title: 'All Projects Page (DE)', href: '/de/projects' },
              { title: 'All Projects Page (FR)', href: '/fr/projects' },
            ],
          },
          project: {
            select: { title: 'title.de', slug: 'slug.current' },
            resolve: (doc) => ({
              locations: [
                {
                  title: `${doc?.title ?? 'Untitled project'} (DE)`,
                  href: `/de/projects/${doc?.slug}`,
                },
                {
                  title: `${doc?.title ?? 'Untitled project'} (FR)`,
                  href: `/fr/projects/${doc?.slug}`,
                },
                { title: 'All Projects Page (DE)', href: '/de/projects' },
                { title: 'All Projects Page (FR)', href: '/fr/projects' },
              ],
            }),
          },
        },
      },
    }),
  ],
})
