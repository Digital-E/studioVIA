export const homepageQuery = `
  *[_type == "homepage"][0] {
    centerText,
    canvasItems[] {
      _key,
      _type,
      mediaType,
      image { asset->, ...},
      videoUrl,
      credit,
      date,
      category,
      title,
      backImage { asset->, ... }
    }
  }
`

export const projectsListQuery = `
  *[_type == "project"] | order(year desc) {
    _id,
    title,
    slug,
    year,
    location,
    prize,
    thumbnail { asset-> },
  }
`

export const projectQuery = `
  *[_type == "project" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    year,
    location,
    prize,
    slides[] {
      _key,
      _type,
      slideType,
      image { asset->, ...},
      videoUrl,
      caption,
      credits[] { _key, text },
      description,
    }
  }
`

export const studioPageQuery = `
  *[_type == "studioPage"][0] {
    leftColumn,
    rightColumn,
    photo { asset->, ... }
  }
`
