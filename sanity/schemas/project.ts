import { defineField, defineType, defineArrayMember } from 'sanity'

const mediaSlide = defineArrayMember({
  name: 'mediaSlide',
  type: 'object',
  title: 'Image / Video slide',
  fields: [
    defineField({ name: 'image', type: 'image', title: 'Image', options: { hotspot: true } }),
    defineField({ name: 'video', type: 'file', title: 'Video (MP4)', description: 'If uploaded, this plays instead of the image.', options: { accept: 'video/*' } }),
    defineField({ name: 'caption', type: 'object', title: 'Caption (optional)', fields: [
      defineField({ name: 'de', type: 'string', title: 'German' }),
      defineField({ name: 'en', type: 'string', title: 'English' }),
    ]}),
  ],
  preview: {
    select: { media: 'image', video: 'video' },
    prepare: ({ media, video }) => ({ title: video ? 'Video slide' : 'Image slide', media }),
  },
})

const textSlide = defineArrayMember({
  name: 'textSlide',
  type: 'object',
  title: 'Text slide',
  fields: [
    defineField({
      name: 'credits',
      type: 'array',
      title: 'Credits',
      of: [defineArrayMember({
        type: 'object',
        name: 'credit',
        fields: [
          defineField({ name: 'text', type: 'array', title: 'Text', of: [{ type: 'block' }] }),
        ],
        preview: { prepare: () => ({ title: 'Credit' }) },
      })],
    }),
    defineField({
      name: 'description',
      type: 'object',
      title: 'Description',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'en', type: 'array', of: [{ type: 'block' }], title: 'English' }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Text slide' }) },
})

export const projectSchema = defineType({
  name: 'project',
  type: 'document',
  title: 'Project',
  fields: [
    defineField({
      name: 'title',
      type: 'object',
      title: 'Title',
      fields: [
        defineField({ name: 'de', type: 'string', title: 'German' }),
        defineField({ name: 'en', type: 'string', title: 'English' }),
      ],
    }),
    defineField({ name: 'slug', type: 'slug', title: 'Slug', options: { source: 'title.de' } }),
    defineField({ name: 'year', type: 'date', title: 'Year', options: { dateFormat: 'YYYY' } }),
    defineField({
      name: 'location',
      type: 'object',
      title: 'Location',
      fields: [
        defineField({ name: 'de', type: 'string', title: 'German' }),
        defineField({ name: 'en', type: 'string', title: 'English' }),
      ],
    }),
    defineField({
      name: 'prize',
      type: 'object',
      title: 'Prize (optional)',
      fields: [
        defineField({ name: 'de', type: 'string', title: 'German (e.g. 1. Preis)' }),
        defineField({ name: 'en', type: 'string', title: 'English (e.g. 1st Prize)' }),
      ],
    }),
    defineField({ name: 'thumbnail', type: 'image', title: 'List thumbnail', options: { hotspot: true } }),
    defineField({ name: 'thumbnailVideo', type: 'file', title: 'List thumbnail video (optional)', description: 'If uploaded, this plays instead of the thumbnail image.', options: { accept: 'video/*' } }),
    defineField({
      name: 'slides',
      type: 'array',
      title: 'Slides',
      of: [mediaSlide, textSlide],
    }),
  ],
  preview: {
    select: { title: 'title.de', subtitle: 'year', media: 'thumbnail' },
    prepare: ({ title, subtitle, media }) => ({ title, subtitle: String(subtitle), media }),
  },
  orderings: [
    { title: 'Year desc', name: 'yearDesc', by: [{ field: 'year', direction: 'desc' }] },
  ],
})
