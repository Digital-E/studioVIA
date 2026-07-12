import { defineField, defineType, defineArrayMember } from 'sanity'

const yearGroup = defineArrayMember({
  name: 'yearGroup',
  type: 'object',
  title: 'Year',
  fields: [
    defineField({ name: 'year', type: 'string', title: 'Year (e.g. 2024)' }),
    defineField({
      name: 'projects',
      type: 'array',
      title: 'Projects',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'project' }] })],
    }),
  ],
  preview: {
    select: { title: 'year', projects: 'projects' },
    prepare: ({ title, projects }) => ({
      title: title || 'Year',
      subtitle: `${projects?.length ?? 0} project(s)`,
    }),
  },
})

export const allProjectsPageSchema = defineType({
  name: 'allProjectsPage',
  type: 'document',
  title: 'All Projects Page',
  fields: [
    defineField({
      name: 'years',
      type: 'array',
      title: 'Years',
      description: 'Projects not added to a year here are hidden from the All Projects list.',
      of: [yearGroup],
    }),
  ],
  preview: {
    prepare: () => ({ title: 'All Projects Page' }),
  },
})
