import { defineField, defineType, defineArrayMember } from 'sanity'

const canvasMediaItem = defineArrayMember({
  name: 'canvasMedia',
  type: 'object',
  title: 'Media',
  fields: [
    defineField({ name: 'mediaType', type: 'string', title: 'Type', options: { list: ['image', 'video'], layout: 'radio' }, initialValue: 'image' }),
    defineField({ name: 'image', type: 'image', title: 'Image', options: { hotspot: true } }),
    defineField({ name: 'videoUrl', type: 'url', title: 'Video URL (MP4)' }),
    defineField({ name: 'credit', type: 'string', title: 'Credit' }),
  ],
  preview: { select: { media: 'image', title: 'mediaType' } },
})

const canvasPostitItem = defineArrayMember({
  name: 'canvasPostit',
  type: 'object',
  title: 'Post-it',
  fields: [
    defineField({ name: 'date', type: 'string', title: 'Date label (e.g. 10.01.27)' }),
    defineField({ name: 'category', type: 'string', title: 'Category (e.g. News)' }),
    defineField({
      name: 'title',
      type: 'object',
      title: 'Title',
      fields: [
        defineField({ name: 'de', type: 'array', of: [{ type: 'block' }], title: 'German' }),
        defineField({ name: 'en', type: 'array', of: [{ type: 'block' }], title: 'English' }),
      ],
    }),
    defineField({ name: 'backImage', type: 'image', title: 'Back image', options: { hotspot: true } }),
  ],
  preview: { select: { title: 'category' } },
})

export const homepageSchema = defineType({
  name: 'homepage',
  type: 'document',
  title: 'Homepage',
  fields: [
    defineField({
      name: 'centerText',
      type: 'object',
      title: 'Center text',
      fields: [
        defineField({ name: 'de', type: 'text', rows: 3, title: 'German', initialValue: 'Architekturbüro\nZürich' }),
        defineField({ name: 'en', type: 'text', rows: 3, title: 'English', initialValue: 'Architecture Practice\nZürich' }),
      ],
    }),
    defineField({
      name: 'canvasItems',
      type: 'array',
      title: 'Canvas items',
      of: [canvasMediaItem, canvasPostitItem],
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Homepage' }),
  },
})
