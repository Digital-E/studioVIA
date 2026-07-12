import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { presentationTool } from 'sanity/presentation'
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
    presentationTool({
      previewUrl: {
        draftMode: {
          enable: '/api/draft-mode/enable',
        },
      },
    }),
  ],
})
