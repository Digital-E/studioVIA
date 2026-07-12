export const homepageQuery = `
  *[_type == "homepage"][0] {
    centerText,
    canvasItems[] {
      _key,
      _type,
      image { ..., asset-> },
      video { asset-> },
      credit,
      date,
      category,
      title,
      backImage { ..., asset-> },
      linkedProject-> { slug }
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
    information1,
    information2,
    information3,
    thumbnail { asset-> },
    thumbnailVideo { asset-> },
  }
`

export const allProjectsPageQuery = `
  *[_type == "allProjectsPage"][0] {
    years[] {
      year,
      projects[]-> {
        _id,
        title,
        slug,
        location,
        information1,
        information2,
        information3,
        thumbnail { asset-> },
        thumbnailVideo { asset-> },
      }
    }
  }
`

export const projectQuery = `
  *[_type == "project" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    year,
    location,
    information1,
    information2,
    information3,
    slides[] {
      _key,
      _type,
      image { ..., asset-> },
      video { asset-> },
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
    photo { ..., asset-> }
  }
`
