import { defineField, defineType, defineArrayMember } from 'sanity'

export const studioPageSchema = defineType({
  name: 'studioPage',
  type: 'document',
  title: 'Studio Page',
  fields: [
    defineField({
      name: 'projektText',
      type: 'object',
      title: '"Projekt" text',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'en', type: 'array', of: [{ type: 'block' }], title: 'English' }),
      ],
    }),
    defineField({
      name: 'teamMembers',
      type: 'array',
      title: 'Team members',
      of: [defineArrayMember({
        type: 'object',
        name: 'teamMember',
        fields: [
          defineField({ name: 'name', type: 'string', title: 'Name' }),
          defineField({ name: 'degree', type: 'string', title: 'Degree / Title' }),
          defineField({ name: 'bio', type: 'object', title: 'Bio', fields: [
            defineField({ name: 'de', type: 'text', title: 'German', rows: 4 }),
            defineField({ name: 'en', type: 'text', title: 'English', rows: 4 }),
          ]}),
        ],
        preview: { select: { title: 'name', subtitle: 'degree' } },
      })],
    }),
    defineField({
      name: 'contactInfo',
      type: 'object',
      title: 'Contact / Imprint',
      fields: [
        defineField({ name: 'address', type: 'text', title: 'Address', rows: 2 }),
        defineField({ name: 'email', type: 'string', title: 'Email' }),
        defineField({ name: 'phone', type: 'string', title: 'Phone' }),
        defineField({ name: 'foundingYear', type: 'string', title: 'Founding year' }),
        defineField({ name: 'legalForm', type: 'string', title: 'Legal form' }),
        defineField({ name: 'uid', type: 'string', title: 'UID / CHE number' }),
        defineField({ name: 'mwst', type: 'string', title: 'MWST number' }),
      ],
    }),
    defineField({
      name: 'legalText',
      type: 'object',
      title: 'Legal / Imprint text',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'en', type: 'array', of: [{ type: 'block' }], title: 'English' }),
      ],
    }),
    defineField({ name: 'photo', type: 'image', title: 'Team photo', options: { hotspot: true } }),
  ],
  preview: {
    prepare: () => ({ title: 'Studio Page' }),
  },
})
