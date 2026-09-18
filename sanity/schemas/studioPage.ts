import { defineField, defineType } from 'sanity'

export const studioPageSchema = defineType({
  name: 'studioPage',
  type: 'document',
  title: 'Studio Page',
  fields: [
    defineField({
      name: 'leftColumn',
      type: 'object',
      title: 'Left column',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'fr', type: 'array', of: [{ type: 'block' }], title: 'French' }),
      ],
    }),
    defineField({
      name: 'rightColumn',
      type: 'object',
      title: 'Right column',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'fr', type: 'array', of: [{ type: 'block' }], title: 'French' }),
      ],
    }),
    defineField({ name: 'photo', type: 'image', title: 'Team photo', options: { hotspot: true } }),
  ],
  preview: {
    prepare: () => ({ title: 'Studio Page' }),
  },
})
