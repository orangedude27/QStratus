export type SteamDBMetadata = {
  title: string
  description: string
  shortDescription: string
  genres: string[]
  developer: string
  publisher: string
  releaseDate: string
  screenshots: string[]
  headerImage: string
  isFreeToPlay: boolean
}

type SteamStoreResponse = {
  [key: string]: {
    success: boolean
    data?: {
      name: string
      description?: string
      short_description?: string
      genres?: { description: string }[]
      developers?: string[]
      publishers?: string[]
      release_date?: { date: string }
      screenshots?: { id: string }[]
      header_image?: string
      is_free?: boolean
    }
  }
}

const cache = new Map<string, { data: SteamDBMetadata; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchSteamDBMetadata(
  appid: number,
): Promise<SteamDBMetadata | null> {
  const cached = cache.get(`steamdb_${appid}`)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return null
    }

    const json: SteamStoreResponse = await response.json()
    const appData = json[String(appid)]

    if (!appData?.success || !appData.data) {
      return null
    }

    const data = appData.data
    const metadata: SteamDBMetadata = {
      title: data.name,
      description: data.description || "",
      shortDescription: data.short_description || data.name || "",
      genres: data.genres?.map((g) => g.description) || [],
      developer: data.developers?.join(", ") || "",
      publisher: data.publishers?.join(", ") || "",
      releaseDate: data.release_date?.date || "",
      screenshots:
        data.screenshots?.map((s) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_${s.id}.jpg`) ||
        [],
      headerImage: data.header_image || "",
      isFreeToPlay: data.is_free || false,
    }

    cache.set(`steamdb_${appid}`, { data: metadata, timestamp: Date.now() })

    return metadata
  } catch (err) {
    console.warn(`Failed to fetch SteamDB metadata for appid ${appid}:`, err)
    return null
  }
}

export function clearMetadataCache(): void {
  cache.clear()
}
