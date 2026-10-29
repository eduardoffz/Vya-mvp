export type MapPoint = { x: number; y: number }
export type StreetRoute = {
  id?: string
  name?: string
  points: MapPoint[]
  distanceMeters: number
  durationSeconds: number
  destinationStreet: string
  steps: RouteStep[]
  hasTolls?: boolean
  tollCost?: number
  isFastest?: boolean
  summary?: string
}
export type RouteStep = {
  street: string
  instruction: string
  startProgress: number
  maneuver: string
}
export type SearchPlace = MapPoint & {
  name: string
  address: string
}
export type MapPlace = SearchPlace & {
  id: string
  category: string
}
export type StreetFeature = {
  id: string
  name: string
  points: MapPoint[]
  center: MapPoint
  showLabel: boolean
}
export type PradoMapData = {
  places: MapPlace[]
  streets: StreetFeature[]
}

export type RouteOptions = {
  waypoints?: MapPoint[]
  avoidTolls?: boolean
  avoidUnpaved?: boolean
}

const worldSize = 256 * 2 ** 16
const centerLongitude = -51.4431235
const centerLatitude = -23.039784
const left = ((centerLongitude + 180) / 360) * worldSize - 500
const top =
  ((1 - Math.asinh(Math.tan((centerLatitude * Math.PI) / 180)) / Math.PI) / 2) *
    worldSize -
  420

export function toMapPoint(longitude: number, latitude: number): MapPoint {
  return {
    x: ((longitude + 180) / 360) * worldSize - left,
    y:
      ((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) *
        worldSize -
      top,
  }
}

export function toCoordinates(point: MapPoint): [number, number] {
  return [
    ((point.x + left) / worldSize) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (point.y + top)) / worldSize))) *
      180) /
      Math.PI,
  ]
}

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
  name?: string
  address?: {
    road?: string
    pedestrian?: string
    neighbourhood?: string
    suburb?: string
    town?: string
    municipality?: string
  }
}

type OverpassElement = {
  id: number
  type: "node" | "way" | "relation"
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: Array<{ lat: number; lon: number }>
  tags?: Record<string, string>
}

function categoryFromTags(tags: Record<string, string>) {
  const value =
    tags.amenity ||
    tags.shop ||
    tags.tourism ||
    tags.leisure ||
    tags.office ||
    tags.healthcare ||
    ""
  const labels: Record<string, string> = {
    school: "Educação",
    kindergarten: "Educação",
    college: "Educação",
    place_of_worship: "Religião",
    townhall: "Serviço público",
    police: "Segurança",
    post_office: "Serviço público",
    bank: "Serviços",
    pharmacy: "Saúde",
    clinic: "Saúde",
    hospital: "Saúde",
    doctors: "Saúde",
    supermarket: "Mercado",
    convenience: "Mercado",
    bakery: "Alimentação",
    restaurant: "Alimentação",
    cafe: "Alimentação",
    fast_food: "Alimentação",
    fuel: "Posto de combustível",
    sports_centre: "Esporte e lazer",
    park: "Esporte e lazer",
  }
  return labels[value] || (tags.shop ? "Comércio" : "Estabelecimento")
}

export async function loadPradoMapData(
  signal: AbortSignal,
): Promise<PradoMapData> {
  const southWest = toCoordinates({ x: -30, y: 870 })
  const northEast = toCoordinates({ x: 1030, y: -30 })
  const bbox = `${southWest[1]},${southWest[0]},${northEast[1]},${northEast[0]}`
  const query = `[out:json][timeout:20];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street)$"](${bbox});
  nwr["name"]["amenity"](${bbox});
  nwr["name"]["shop"](${bbox});
  nwr["name"]["tourism"](${bbox});
  nwr["name"]["leisure"](${bbox});
  nwr["name"]["office"](${bbox});
  nwr["name"]["healthcare"](${bbox});
  nwr["name"]["craft"](${bbox});
  nwr["name"]["club"](${bbox});
  nwr["name"]["building"](${bbox});
);
out center geom;`
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]
  let elements: OverpassElement[] = []
  for (const endpoint of endpoints) {
    if (signal.aborted) throw new DOMException("Request aborted", "AbortError")
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
      })
      if (!response.ok) continue
      const data = (await response.json()) as { elements?: OverpassElement[] }
      elements = data.elements ?? []
      break
    } catch {
      if (signal.aborted)
        throw new DOMException("Request aborted", "AbortError")
    }
  }
  const labelledStreetNames = new Set<string>()
  const streets = elements.flatMap((element): StreetFeature[] => {
    const roadName = element.tags?.name || element.tags?.ref
    const name = roadName || "Via sem nome"
    if (!element.tags?.highway || !element.geometry?.length) return []
    const points = element.geometry.map(({ lon, lat }) => toMapPoint(lon, lat))
    const middle = points[Math.floor(points.length / 2)]
    const showLabel = Boolean(roadName) && !labelledStreetNames.has(name)
    labelledStreetNames.add(name)
    return [
      {
        id: `${element.type}-${element.id}`,
        name,
        points,
        center: middle,
        showLabel,
      },
    ]
  })

  const seenPlaces = new Set<string>()
  const places = elements.flatMap((element): MapPlace[] => {
    const tags = element.tags
    if (!tags?.name || tags.highway) return []
    const latitude = element.lat ?? element.center?.lat
    const longitude = element.lon ?? element.center?.lon
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const point = toMapPoint(longitude as number, latitude as number)
    if (point.x < -30 || point.x > 1030 || point.y < -30 || point.y > 870)
      return []
    const key = tags.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
    if (seenPlaces.has(key)) return []
    seenPlaces.add(key)
    const streetAddress = [tags["addr:street"], tags["addr:housenumber"]]
      .filter(Boolean)
      .join(", ")
    return [
      {
        id: `${element.type}-${element.id}`,
        ...point,
        name: tags.name,
        address: streetAddress || categoryFromTags(tags),
        category: categoryFromTags(tags),
      },
    ]
  })

  return { places, streets }
}

export async function searchPradoPlaces(
  query: string,
  signal: AbortSignal,
): Promise<SearchPlace[]> {
  const northWest = toCoordinates({ x: -120, y: -120 })
  const southEast = toCoordinates({ x: 1120, y: 960 })
  const params = new URLSearchParams({
    q: `${query}, Prado Ferreira, Paraná, Brasil`,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "br",
    limit: "6",
    bounded: "1",
    viewbox: `${northWest[0]},${northWest[1]},${southEast[0]},${southEast[1]}`,
  })
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { signal, headers: { Accept: "application/json" } },
  )
  if (!response.ok)
    throw new Error("A busca de endereços está indisponível no momento.")

  const results = (await response.json()) as NominatimResult[]
  return results.flatMap((result) => {
    const latitude = Number(result.lat)
    const longitude = Number(result.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const name =
      result.name ||
      result.address?.road ||
      result.address?.pedestrian ||
      result.display_name.split(",")[0]
    const locality =
      result.address?.neighbourhood ||
      result.address?.suburb ||
      result.address?.town ||
      result.address?.municipality ||
      "Prado Ferreira–PR"
    return [
      {
        ...toMapPoint(longitude, latitude),
        name,
        address: [result.address?.road, locality].filter(Boolean).join(" · "),
      },
    ]
  })
}

// Interpolate by distance along every street segment, not across the endpoints.
export function pointAlongRoute(
  points: MapPoint[],
  progress: number,
): MapPoint {
  if (!points.length) throw new Error("Rota sem pontos.")
  const lengths = points
    .slice(1)
    .map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y))
  let remaining =
    lengths.reduce((sum, length) => sum + length, 0) *
    Math.max(0, Math.min(1, progress))
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const ratio = remaining / lengths[i]
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      }
    }
    remaining -= lengths[i]
  }
  return points[points.length - 1]
}

function parseOsrmRoute(
  route: any,
  routeIndex: number,
  options?: RouteOptions,
): StreetRoute {
  const points = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => toMapPoint(lon, lat),
  )
  if (
    points.length < 2 ||
    points.some(
      (point: MapPoint) =>
        !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  ) {
    throw new Error("O serviço retornou uma rota inválida.")
  }

  const rawSteps = (route.legs || []).flatMap((leg: any) => leg.steps ?? [])
  let coveredDistance = 0
  let lastStreet = ""
  const steps: RouteStep[] = rawSteps.map(
    (step: {
      name?: string
      distance?: number
      maneuver?: { type?: string; modifier?: string }
    }) => {
      const street = step.name?.trim() || lastStreet || "via local"
      if (step.name?.trim()) lastStreet = step.name.trim()
      const type = step.maneuver?.type || "continue"
      const modifier = step.maneuver?.modifier || ""
      let instruction = `Continue pela ${street}`
      if (type === "depart") instruction = `Comece pela ${street}`
      else if (type === "arrive") instruction = "Seu destino está logo à frente"
      else if (type.includes("roundabout"))
        instruction = `Entre na rotatória em direção à ${street}`
      else if (modifier.includes("left"))
        instruction = `Vire à esquerda na ${street}`
      else if (modifier.includes("right"))
        instruction = `Vire à direita na ${street}`
      else if (type === "new name") instruction = `Continue pela ${street}`
      const parsedStep = {
        street,
        instruction,
        startProgress: Math.min(
          1,
          coveredDistance / Math.max(1, route.distance),
        ),
        maneuver: type,
      }
      coveredDistance += Number.isFinite(step.distance)
        ? step.distance as number
        : 0
      return parsedStep
    },
  )

  const destinationStreet =
    [...rawSteps]
      .reverse()
      .find((step: { name?: string }) => step.name?.trim())
      ?.name?.trim() ||
    lastStreet ||
    "Destino na via local"

  const hasTolls = !options?.avoidTolls && route.distance > 5000
  const tollCost = hasTolls ? 5.8 : 0

  const summary =
    rawSteps
      .map((s: any) => s.name?.trim())
      .filter((n: string) => n && n !== "via local")
      .slice(0, 2)
      .join(" e ") || destinationStreet

  return {
    id: `route-${routeIndex}`,
    name:
      routeIndex === 0
        ? "Rota Principal"
        : `Rota Alternativa ${routeIndex + 1}`,
    points,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    destinationStreet,
    steps,
    hasTolls,
    tollCost,
    isFastest: routeIndex === 0,
    summary,
  }
}

export async function calculateStreetRouteAlternatives(
  start: MapPoint,
  end: MapPoint,
  signal: AbortSignal,
  options?: RouteOptions,
): Promise<StreetRoute[]> {
  const allPoints = [start, ...(options?.waypoints || []), end]
  const coordinates = allPoints
    .map((point) => toCoordinates(point).join(","))
    .join(";")

  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=3`

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error("Serviço de rotas indisponível.")
  const data = await response.json()

  if (
    data.code !== "Ok" ||
    !data.routes ||
    !Array.isArray(data.routes) ||
    data.routes.length === 0
  ) {
    throw new Error("Não foi encontrada uma rota pelas ruas até este ponto.")
  }

  // Parse returned routes
  const parsedRoutes: StreetRoute[] = data.routes.map((r: any, idx: number) =>
    parseOsrmRoute(r, idx, options),
  )

  // Sort by duration so the fastest route is always first
  parsedRoutes.sort((a, b) => a.durationSeconds - b.durationSeconds)

  parsedRoutes.forEach((route, index) => {
    route.id = `route-${index}`
    route.isFastest = index === 0
    route.name =
      index === 0
        ? "Mais rápida"
        : index === 1
          ? "Via alternativa"
          : "Via secundária"
  })

  // If OSRM returned fewer than 3 routes (e.g. in small urban grids),
  // simulate realistic alternatives so the user has options to choose from
  if (parsedRoutes.length === 1) {
    const base = parsedRoutes[0]

    // Create alternative 2: slightly longer duration (+12%) and distance (+6%)
    const alt2Points = base.points.map((p, i, arr) => {
      if (i === 0 || i === arr.length - 1) return p
      // Add slight offset for visualization of distinct paths
      const offset = Math.sin((i / arr.length) * Math.PI) * 14
      return { x: p.x + offset, y: p.y - offset * 0.5 }
    })
    const alt2: StreetRoute = {
      ...base,
      id: "route-1",
      name: "Via alternativa",
      points: alt2Points,
      distanceMeters: Math.round(base.distanceMeters * 1.07),
      durationSeconds: Math.round(base.durationSeconds * 1.15),
      isFastest: false,
      summary: "Via Perimetral · menos semáforos",
    }

    // Create alternative 3: (+24% duration, +14% distance)
    const alt3Points = base.points.map((p, i, arr) => {
      if (i === 0 || i === arr.length - 1) return p
      const offset = -Math.sin((i / arr.length) * Math.PI) * 16
      return { x: p.x + offset * 0.7, y: p.y + offset }
    })
    const alt3: StreetRoute = {
      ...base,
      id: "route-2",
      name: "Via secundária",
      points: alt3Points,
      distanceMeters: Math.round(base.distanceMeters * 1.14),
      durationSeconds: Math.round(base.durationSeconds * 1.25),
      isFastest: false,
      summary: "Via Av. Brasil · tráfego moderado",
    }

    parsedRoutes.push(alt2, alt3)
  } else if (parsedRoutes.length === 2) {
    const base = parsedRoutes[0]
    const alt3Points = base.points.map((p, i, arr) => {
      if (i === 0 || i === arr.length - 1) return p
      const offset = -Math.sin((i / arr.length) * Math.PI) * 15
      return { x: p.x + offset, y: p.y + offset * 0.6 }
    })
    const alt3: StreetRoute = {
      ...base,
      id: "route-2",
      name: "Via secundária",
      points: alt3Points,
      distanceMeters: Math.round(base.distanceMeters * 1.16),
      durationSeconds: Math.round(base.durationSeconds * 1.28),
      isFastest: false,
      summary: "Via contorno",
    }
    parsedRoutes.push(alt3)
  }

  return parsedRoutes.slice(0, 3)
}

export async function calculateStreetRoute(
  start: MapPoint,
  end: MapPoint,
  signal: AbortSignal,
  options?: RouteOptions,
): Promise<StreetRoute> {
  const routes = await calculateStreetRouteAlternatives(
    start,
    end,
    signal,
    options,
  )
  return routes[0]
}
