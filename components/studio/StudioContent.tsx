import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import { urlFor } from '@/lib/sanity'
import type { StudioPageData } from '@/lib/types'

interface StudioContentProps {
  data: StudioPageData
  locale: string
}

export default function StudioContent({ data, locale }: StudioContentProps) {
  const projektText = locale === 'de' ? data.projektText?.de : (data.projektText?.en ?? data.projektText?.de)
  const legalText = locale === 'de' ? data.legalText?.de : (data.legalText?.en ?? data.legalText?.de)
  const contact = data.contactInfo
  const photoUrl = data.photo ? urlFor(data.photo).width(900).url() : null

  return (
    <div className="pt-20 pb-28 px-5">
      <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Left column: Projekt + Team */}
        <div>
          <h2 className="font-build text-2xl mb-6">
            {locale === 'de' ? 'Projekt' : 'Project'}
          </h2>
          <div className="prose-via">
            {projektText && (
              <PortableText value={projektText as Parameters<typeof PortableText>[0]['value']} />
            )}
          </div>

          {data.teamMembers && data.teamMembers.length > 0 && (
            <div className="mt-12">
              <h2 className="font-build text-2xl mb-6">Team</h2>
              <div className="space-y-8">
                {data.teamMembers.map((member) => {
                  const bio = locale === 'de' ? member.bio?.de : (member.bio?.en ?? member.bio?.de)
                  return (
                    <div key={member._key}>
                      <p className="font-build text-sm font-medium">{member.name}</p>
                      {member.degree && <p className="font-build text-sm">{member.degree}</p>}
                      {bio && (
                        <p className="font-minion text-sm leading-relaxed mt-2" style={{ fontFamily: 'Minion-Pro, Georgia, serif', textAlign: 'justify' }}>
                          {bio}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Middle column: Studio VIA contact + legal */}
        <div>
          <h2 className="font-build text-2xl mb-6">Studio VIA</h2>
          {contact && (
            <div className="font-build text-sm space-y-1 mb-8">
              {contact.address && <p className="whitespace-pre-line">{contact.address}</p>}
              {contact.email && <p>{contact.email}</p>}
              {contact.phone && <p>{contact.phone}</p>}
              {(contact.foundingYear || contact.legalForm || contact.uid || contact.mwst) && (
                <div className="mt-4 space-y-0.5">
                  {contact.foundingYear && <p>{locale === 'de' ? 'Gründung' : 'Founded'} {contact.foundingYear}</p>}
                  {contact.legalForm && <p>{locale === 'de' ? 'Rechtsform' : 'Legal form'} {contact.legalForm}</p>}
                  {contact.uid && <p>{contact.uid}</p>}
                  {contact.mwst && <p>{contact.mwst}</p>}
                </div>
              )}
            </div>
          )}

          {legalText && (
            <div className="prose-via text-xs">
              <PortableText value={legalText as Parameters<typeof PortableText>[0]['value']} />
            </div>
          )}
        </div>

        {/* Right column: photo */}
        <div>
          {photoUrl && (
            <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
              <Image
                src={photoUrl}
                alt="Studio VIA team"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
