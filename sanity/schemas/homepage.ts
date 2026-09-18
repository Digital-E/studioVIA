import { defineField, defineType, defineArrayMember } from 'sanity'

const canvasMediaItem = defineArrayMember({
  name: 'canvasMedia',
  type: 'object',
  title: 'Media',
  fields: [
    defineField({ name: 'image', type: 'image', title: 'Image', options: { hotspot: true } }),
    defineField({ name: 'video', type: 'file', title: 'Video (MP4)', description: 'If uploaded, this plays instead of the image.', options: { accept: 'video/*' } }),
    defineField({ name: 'credit', type: 'string', title: 'Credit' }),
    defineField({ name: 'linkedProject', type: 'reference', title: 'Linked project', to: [{ type: 'project' }] }),
  ],
  preview: { select: { media: 'image' } },
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
        defineField({ name: 'fr', type: 'array', of: [{ type: 'block' }], title: 'French' }),
      ],
    }),
    defineField({ name: 'backImage', type: 'image', title: 'Back image', options: { hotspot: true } }),
    defineField({
      name: 'backgroundColor',
      type: 'color',
      title: 'Background color',
      description: 'Leave empty for the default post-it yellow.',
    }),
    defineField({
      name: 'textColor',
      type: 'color',
      title: 'Text color',
      description: 'Leave empty for the default text color.',
    }),
    defineField({ name: 'linkedProject', type: 'reference', title: 'Linked project', to: [{ type: 'project' }] }),
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
        defineField({ name: 'fr', type: 'text', rows: 3, title: 'French', initialValue: 'Cabinet d’architecture\nZürich' }),
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
