export type MapPoint = { x: number; y: number }
export type TollBooth = {
  point: MapPoint
  name: string
  price: number
}
export type StreetRoute = {
  points: MapPoint[]
  distanceMeters: number
  durationSeconds: number
  destinationStreet: string
  steps: RouteStep[]
  // Paradas intermediárias já "coladas" na rua mais próxima
  stopPoints: MapPoint[]
  // Em que fração (0 a 1) do percurso cada parada é alcançada
  stopProgress: number[]
  // Pedágios (simulados) e total
  tolls: TollBooth[]
  tollTotal: number
  // Nomes de vias de terra que a rota atravessa
  unpavedNames: string[]
  // Avisos em texto sobre a escolha da rota
  notes: string[]
  // --- Rotas alternativas (tipo de rota) ---
  id: string
  // atraso causado pelo trânsito (já somado em durationSeconds)
  trafficDelaySeconds: number
  // trechos desta rota com trânsito intenso (para pintar no mapa)
  trafficSegments: MapPoint[][]
  // os mesmos trechos em fração do percurso (0 a 1)
  trafficRanges: Array<[number, number]>
  // buracos que ficam nesta rota
  potholes: MapPoint[]
  // buracos e trânsito da região (iguais para todas as alternativas)
  worldPotholes: MapPoint[]
  worldTraffic: MapPoint[][]
  worldTolls: TollBooth[]
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
  // true quando a via é de terra/cascalho (tag surface do OpenStreetMap)
  unpaved: boolean
}
export type PradoMapData = {
  places: MapPlace[]
  streets: StreetFeature[]
}

// ---------------------------------------------------------------------------
// Tipos de locomoção
// ---------------------------------------------------------------------------
export type TransportMode = "driving" | "motorcycle" | "cycling" | "walking"

export type TransportConfig = {
  id: TransportMode
  label: string
  icon: string        // nome do ícone usado no componente <Icon />
  baseUrl: string     // servidor de rotas com o perfil certo (carro, bike, a pé)
  cruiseKmh: number   // velocidade mostrada durante a simulação
  speedKmh?: number   // se existir: tempo = distância ÷ velocidade
  timeFactor: number  // multiplica o tempo vindo do servidor (carro e moto)
}

export const TRANSPORT_MODES: TransportConfig[] = [
  {
    id: "driving",
    label: "Carro",
    icon: "car",
    baseUrl: "https://router.project-osrm.org/route/v1/driving",
    cruiseKmh: 32,
    timeFactor: 1,
  },
  {
    // Não existe perfil de moto: usa a rota do carro com tempo ~15% menor.
    id: "motorcycle",
    label: "Moto",
    icon: "moto",
    baseUrl: "https://router.project-osrm.org/route/v1/driving",
    cruiseKmh: 36,
    timeFactor: 0.85,
  },
  {
    id: "cycling",
    label: "Bicicleta",
    icon: "bike",
    baseUrl: "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
    cruiseKmh: 15,
    speedKmh: 15,
    timeFactor: 1,
  },
  {
    id: "walking",
    label: "A pé",
    icon: "walk",
    baseUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
    cruiseKmh: 5,
    speedKmh: 5,
    timeFactor: 1,
  },
]

export function getTransport(mode: TransportMode): TransportConfig {
  return TRANSPORT_MODES.find((item) => item.id === mode) ?? TRANSPORT_MODES[0]
}

// ---------------------------------------------------------------------------
// Opções de rota (Sprint 2)
// ---------------------------------------------------------------------------
export type RouteOptions = {
  mode: TransportMode
  stops: MapPoint[]        // paradas intermediárias, na ordem
  avoidTolls: boolean      // evitar pedágios
  avoidUnpaved: boolean    // evitar estradas de terra
  avoidPotholes?: boolean  // evitar buracos
  avoidTraffic?: boolean   // preferir menos trânsito
}

// Valores SIMULADOS de pedágio (apenas para a apresentação do protótipo)
const TOLL_PRICES: Partial<Record<TransportMode, number>> = {
  driving: 8.5,
  motorcycle: 4.25,
}

const UNPAVED_SURFACES = new Set([
  "unpaved", "dirt", "gravel", "ground", "sand", "earth", "mud", "grass",
  "compacted", "fine_gravel", "pebblestone", "dirt/sand",
])

const worldSize = 256 * 2 ** 16
const centerLongitude = -51.4431235
const centerLatitude = -23.039784
const left = ((centerLongitude + 180) / 360) * worldSize - 500
const top =
  ((1 - Math.asinh(Math.tan(centerLatitude * Math.PI / 180)) / Math.PI) / 2) *
    worldSize - 420

export function toMapPoint(longitude: number, latitude: number): MapPoint {
  return {
    x: ((longitude + 180) / 360) * worldSize - left,
    y: ((1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2) *
      worldSize - top,
  }
}

export function toCoordinates(point: MapPoint): [number, number] {
  return [
    ((point.x + left) / worldSize) * 360 - 180,
    Math.atan(Math.sinh(Math.PI * (1 - 2 * (point.y + top) / worldSize))) *
      180 / Math.PI,
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
  const value = tags.amenity || tags.shop || tags.tourism || tags.leisure
    || tags.office || tags.healthcare || ""
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
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|track)$"](${bbox});
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
    "https://overpass.private.coffee/api/interpreter",
  ]
  let elements: OverpassElement[] = []
  for (const endpoint of endpoints) {
    if (signal.aborted) throw new DOMException("Request aborted", "AbortError")
    // cada servidor tem até 12 s para responder; se não, tenta o próximo
    const attempt = new AbortController()
    const stop = () => attempt.abort()
    signal.addEventListener("abort", stop)
    const timer = setTimeout(stop, 12000)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: attempt.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
      })
      if (!response.ok) continue
      const data = await response.json() as { elements?: OverpassElement[] }
      elements = data.elements ?? []
      break
    } catch {
      if (signal.aborted) throw new DOMException("Request aborted", "AbortError")
    } finally {
      clearTimeout(timer)
      signal.removeEventListener("abort", stop)
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
    const unpaved = UNPAVED_SURFACES.has(element.tags.surface ?? "")
      || element.tags.highway === "track"
    return [{
      id: `${element.type}-${element.id}`,
      name,
      points,
      center: middle,
      showLabel,
      unpaved,
    }]
  })

  const seenPlaces = new Set<string>()
  const places = elements.flatMap((element): MapPlace[] => {
    const tags = element.tags
    if (!tags?.name || tags.highway) return []
    const latitude = element.lat ?? element.center?.lat
    const longitude = element.lon ?? element.center?.lon
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const point = toMapPoint(longitude as number, latitude as number)
    if (point.x < -30 || point.x > 1030 || point.y < -30 || point.y > 870) return []
    const key = tags.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    if (seenPlaces.has(key)) return []
    seenPlaces.add(key)
    const streetAddress = [
      tags["addr:street"],
      tags["addr:housenumber"],
    ].filter(Boolean).join(", ")
    return [{
      id: `${element.type}-${element.id}`,
      ...point,
      name: tags.name,
      address: streetAddress || categoryFromTags(tags),
      category: categoryFromTags(tags),
    }]
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
  if (!response.ok) throw new Error("A busca de endereços está indisponível no momento.")

  const results = await response.json() as NominatimResult[]
  return results.flatMap((result) => {
    const latitude = Number(result.lat)
    const longitude = Number(result.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const name = result.name
      || result.address?.road
      || result.address?.pedestrian
      || result.display_name.split(",")[0]
    const locality = result.address?.neighbourhood
      || result.address?.suburb
      || result.address?.town
      || result.address?.municipality
      || "Prado Ferreira–PR"
    return [{
      ...toMapPoint(longitude, latitude),
      name,
      address: [result.address?.road, locality].filter(Boolean).join(" · "),
    }]
  })
}

// Interpolate by distance along every street segment, not across the endpoints.
export function pointAlongRoute(points: MapPoint[], progress: number): MapPoint {
  if (!points.length) throw new Error("Rota sem pontos.")
  const lengths = points.slice(1).map((point, i) =>
    Math.hypot(point.x - points[i].x, point.y - points[i].y),
  )
  let remaining = lengths.reduce((sum, length) => sum + length, 0) *
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

// Projeta um ponto sobre uma linha (rota ou rua): devolve em que fração (0 a 1)
// da linha ele cai e a que distância (em unidades do mapa) ele está dela.
export function projectOnRoute(
  points: MapPoint[],
  target: MapPoint,
): { progress: number; distance: number } {
  if (points.length < 2) return { progress: 0, distance: Infinity }
  const lengths = points.slice(1).map((point, i) =>
    Math.hypot(point.x - points[i].x, point.y - points[i].y),
  )
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1
  let best = { progress: 0, distance: Infinity }
  let covered = 0
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const squared = dx * dx + dy * dy
    const t = squared === 0
      ? 0
      : Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / squared))
    const distance = Math.hypot(target.x - (a.x + t * dx), target.y - (a.y + t * dy))
    if (distance < best.distance) {
      best = { progress: (covered + t * lengths[i]) / total, distance }
    }
    covered += lengths[i]
  }
  return best
}

// Quais vias de terra a rota atravessa (compara pontos da rota com cada via)
function unpavedHits(points: MapPoint[], unpavedStreets: StreetFeature[]): string[] {
  const names = new Set<string>()
  const step = Math.max(1, Math.floor(points.length / 120))
  for (const street of unpavedStreets) {
    if (!street.unpaved || street.points.length < 2) continue
    for (let i = 0; i < points.length; i += step) {
      if (projectOnRoute(street.points, points[i]).distance <= 10) {
        names.add(street.name)
        break
      }
    }
  }
  return [...names]
}

type BaseRoute = Pick<StreetRoute,
  "points" | "distanceMeters" | "durationSeconds" | "destinationStreet" | "steps" | "stopPoints" | "stopProgress">

type OsrmStep = {
  name?: string
  distance?: number
  maneuver?: { type?: string; modifier?: string }
}
type OsrmRoute = {
  distance: number
  duration: number
  geometry?: { coordinates?: Array<[number, number]> }
  legs?: Array<{ distance?: number; steps?: OsrmStep[] }>
}
type OsrmWaypoint = { location?: [number, number] }

function parseRoute(
  route: OsrmRoute,
  transport: TransportConfig,
  waypoints: OsrmWaypoint[],
): BaseRoute {
  if (!route?.geometry?.coordinates ||
      !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new Error("Não foi encontrada uma rota pelas ruas até este ponto.")
  }
  const points = route.geometry.coordinates.map(([lon, lat]) =>
    toMapPoint(lon, lat),
  )
  if (points.length < 2 || points.some((point) =>
    !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("O serviço retornou uma rota inválida.")
  }
  const legs = route.legs ?? []
  const rawSteps = legs.flatMap((leg, legIndex) =>
    (leg.steps ?? []).map((step) => ({ ...step, isLastLeg: legIndex === legs.length - 1 })),
  )
  let coveredDistance = 0
  let lastStreet = ""
  const steps: RouteStep[] = rawSteps.map((step) => {
    const street = step.name?.trim() || lastStreet || "via local"
    if (step.name?.trim()) lastStreet = step.name.trim()
    const type = step.maneuver?.type || "continue"
    const modifier = step.maneuver?.modifier || ""
    let instruction = `Continue pela ${street}`
    if (type === "depart") instruction = `Comece pela ${street}`
    else if (type === "arrive") {
      instruction = step.isLastLeg
        ? "Seu destino está logo à frente"
        : "Você chegou a uma parada"
    }
    else if (type.includes("roundabout")) instruction = `Entre na rotatória em direção à ${street}`
    else if (modifier.includes("left")) instruction = `Vire à esquerda na ${street}`
    else if (modifier.includes("right")) instruction = `Vire à direita na ${street}`
    else if (type === "new name") instruction = `Continue pela ${street}`
    const parsedStep = {
      street,
      instruction,
      startProgress: Math.min(1, coveredDistance / route.distance),
      maneuver: type,
    }
    coveredDistance += Number.isFinite(step.distance) ? step.distance as number : 0
    return parsedStep
  })
  const destinationStreet = [...rawSteps].reverse().find(
    (step) => step.name?.trim(),
  )?.name?.trim() || lastStreet || "Destino na via local"

  // Paradas: posição já ajustada à rua e em que fração do caminho cada uma cai
  const stopPoints = waypoints.slice(1, -1).flatMap((waypoint) =>
    waypoint.location ? [toMapPoint(waypoint.location[0], waypoint.location[1])] : [],
  )
  let legCovered = 0
  const stopProgress = legs.slice(0, -1).map((leg) => {
    legCovered += Number.isFinite(leg.distance) ? leg.distance as number : 0
    return Math.min(1, legCovered / route.distance)
  })

  // O tempo depende do tipo de locomoção:
  // a pé / bicicleta -> distância ÷ velocidade média
  // carro / moto     -> tempo do servidor × fator do veículo
  const durationSeconds = transport.speedKmh
    ? Math.max(1, (route.distance / 1000 / transport.speedKmh) * 3600)
    : Math.max(1, route.duration * transport.timeFactor)

  return {
    points,
    distanceMeters: route.distance,
    durationSeconds,
    destinationStreet,
    steps,
    stopPoints,
    stopProgress,
  }
}

// Pedágio SIMULADO: no meio da rota principal, apenas para carro e moto,
// em trajetos com mais de 600 m. Serve para demonstrar valores e desvio.
function simulateToll(route: BaseRoute, mode: TransportMode): TollBooth | null {
  const price = TOLL_PRICES[mode]
  if (!price || route.distanceMeters < 400) return null
  return {
    point: pointAlongRoute(route.points, 0.5),
    name: "Praça de pedágio (simulada)",
    price,
  }
}

// ---------------------------------------------------------------------------
// Rotas alternativas
// Gera até 3 caminhos diferentes (alternativas do servidor + desvios por ruas
// paralelas) e mede em cada um: tempo, pedágio, buracos, trânsito e terra.
// Pedágio, buracos e trânsito são SIMULADOS para a apresentação, mas ficam
// fixos no lugar — por isso uma rota alternativa consegue desviar deles.
// ---------------------------------------------------------------------------
type OsrmResponse = {
  code?: string
  routes?: OsrmRoute[]
  waypoints?: OsrmWaypoint[]
}

// Junta o ponto de passagem extra (desvio) aos trechos vizinhos, para ele
// não virar uma "parada" na rota
function mergeVia(data: OsrmResponse, viaIndex: number): OsrmResponse {
  const routes = (data.routes ?? []).map((route) => {
    const legs = route.legs ?? []
    if (viaIndex < 1 || viaIndex >= legs.length) return route
    const before = legs[viaIndex - 1]
    const after = legs[viaIndex]
    const merged = {
      distance: (before.distance ?? 0) + (after.distance ?? 0),
      steps: [
        ...(before.steps ?? []).filter((step) => step.maneuver?.type !== "arrive"),
        ...(after.steps ?? []).filter((step) => step.maneuver?.type !== "depart"),
      ],
    }
    return { ...route, legs: [...legs.slice(0, viaIndex - 1), merged, ...legs.slice(viaIndex + 1)] }
  })
  const waypoints = [...(data.waypoints ?? [])]
  waypoints.splice(viaIndex, 1)
  return { ...data, routes, waypoints }
}

async function fetchRoutes(
  waypointList: MapPoint[],
  transport: TransportConfig,
  signal: AbortSignal,
  alternatives: boolean,
  viaIndex = -1,
): Promise<BaseRoute[]> {
  const coordinates = waypointList
    .map((point) => toCoordinates(point).join(","))
    .join(";")
  const response = await fetch(
    `${transport.baseUrl}/${coordinates}?overview=full&geometries=geojson&steps=true${alternatives ? "&alternatives=true" : ""}`,
    { signal },
  )
  if (!response.ok) throw new Error("Serviço de rotas indisponível.")
  let data = await response.json() as OsrmResponse
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("Não foi encontrada uma rota pelas ruas até este ponto.")
  }
  if (viaIndex > 0) data = mergeVia(data, viaIndex)
  const waypoints = data.waypoints ?? []
  return (data.routes ?? []).slice(0, 3).map((route) => parseRoute(route, transport, waypoints))
}

// Pedaço de uma linha entre duas frações do percurso (0 a 1)
function slicePolyline(points: MapPoint[], from: number, to: number): MapPoint[] {
  if (points.length < 2) return points
  const lengths = points.slice(1).map((point, i) =>
    Math.hypot(point.x - points[i].x, point.y - points[i].y),
  )
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1
  const result: MapPoint[] = [pointAlongRoute(points, from)]
  let covered = 0
  for (let i = 0; i < lengths.length; i++) {
    covered += lengths[i]
    const fraction = covered / total
    if (fraction > from && fraction < to) result.push(points[i + 1])
  }
  result.push(pointAlongRoute(points, to))
  return result
}

// Pontos a cada ~4 unidades ao longo da rota, com a fração de cada um
function samplesAlong(points: MapPoint[], step = 4) {
  const lengths = points.slice(1).map((point, i) =>
    Math.hypot(point.x - points[i].x, point.y - points[i].y),
  )
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1
  const count = Math.max(2, Math.min(600, Math.ceil(total / step)))
  return Array.from({ length: count + 1 }, (_, i) => {
    const progress = i / count
    return { progress, point: pointAlongRoute(points, progress) }
  })
}

// Dois caminhos são "o mesmo" quando passam praticamente pelas mesmas ruas
function sameGeometry(a: BaseRoute, b: BaseRoute) {
  if (Math.abs(a.distanceMeters - b.distanceMeters) > Math.max(a.distanceMeters, b.distanceMeters) * 0.04) {
    return false
  }
  for (let i = 1; i < 12; i++) {
    const pa = pointAlongRoute(a.points, i / 12)
    if (projectOnRoute(b.points, pa).distance > 10) return false
  }
  return true
}

// Ponto de desvio ao lado do trecho mais longo (força passar por ruas paralelas)
function detourPoints(waypointList: MapPoint[]): Array<{ via: MapPoint; index: number }> {
  let longest = 0
  for (let i = 1; i < waypointList.length - 1; i++) {
    const a = waypointList[i], b = waypointList[i + 1]
    const best = waypointList[longest], next = waypointList[longest + 1]
    if (Math.hypot(b.x - a.x, b.y - a.y) > Math.hypot(next.x - best.x, next.y - best.y)) longest = i
  }
  const a = waypointList[longest]
  const b = waypointList[longest + 1]
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length < 30) return []
  const offset = Math.min(170, Math.max(45, length * 0.38))
  const nx = -(b.y - a.y) / length
  const ny = (b.x - a.x) / length
  const clamp = (value: number, max: number) => Math.min(max - 20, Math.max(20, value))
  return [1, -1].map((side) => ({
    index: longest + 1,
    via: {
      x: clamp((a.x + b.x) / 2 + nx * offset * side, 1000),
      y: clamp((a.y + b.y) / 2 + ny * offset * side, 840),
    },
  }))
}

export async function calculateRouteAlternatives(
  start: MapPoint,
  end: MapPoint,
  signal: AbortSignal,
  options: Partial<RouteOptions> = {},
  unpavedStreets: StreetFeature[] = [],
): Promise<StreetRoute[]> {
  const opts: RouteOptions = {
    mode: "driving",
    stops: [],
    avoidTolls: false,
    avoidUnpaved: false,
    ...options,
  }
  const transport = getTransport(opts.mode)
  const waypointList = [start, ...opts.stops, end]

  // 1) caminho principal (+ alternativas do servidor, quando não há paradas)
  const primary = await fetchRoutes(waypointList, transport, signal, waypointList.length === 2)
  // 2) desvios por ruas paralelas (se falharem, seguimos sem eles)
  const detours = await Promise.all(detourPoints(waypointList).map(async ({ via, index }) => {
    try {
      const list = [...waypointList.slice(0, index), via, ...waypointList.slice(index)]
      const [route] = await fetchRoutes(list, transport, signal, false, index)
      return route
    } catch (error) {
      if (signal.aborted) throw error
      return null
    }
  }))
  const base = primary[0]
  const candidates: BaseRoute[] = [base]
  for (const route of [...primary.slice(1), ...detours]) {
    if (!route) continue
    if (route.distanceMeters > base.distanceMeters * 2.3) continue
    if (candidates.some((other) => sameGeometry(other, route))) continue
    candidates.push(route)
  }

  // 3) "mundo" simulado, fixo no lugar, a partir do caminho principal
  const booth = simulateToll(base, opts.mode)
  const worldPotholes = base.distanceMeters >= 150
    ? [0.3, 0.72].map((fraction) => pointAlongRoute(base.points, fraction))
    : []
  const worldTraffic = base.distanceMeters >= 250
    ? [slicePolyline(base.points, 0.42, 0.66)]
    : []
  // o trânsito só atrasa carro e moto (a moto passa entre os carros)
  const trafficFactor = opts.mode === "driving" ? 0.35 : opts.mode === "motorcycle" ? 0.6 : 1

  // 4) mede cada caminho
  const measured = candidates.slice(0, 3).map((route): StreetRoute => {
    const tollHit = booth ? projectOnRoute(route.points, booth.point).distance <= 20 : false
    const potholes = worldPotholes.filter((pothole) =>
      projectOnRoute(route.points, pothole).distance <= 16)
    const ranges: Array<[number, number]> = []
    if (worldTraffic.length) {
      let open: number | null = null
      for (const sample of samplesAlong(route.points)) {
        const inside = worldTraffic.some((segment) =>
          projectOnRoute(segment, sample.point).distance <= 12)
        if (inside && open === null) open = sample.progress
        if (!inside && open !== null) {
          if (sample.progress - open > 0.01) ranges.push([open, sample.progress])
          open = null
        }
      }
      if (open !== null && 1 - open > 0.01) ranges.push([open, 1])
    }
    const congestedMeters = ranges.reduce((sum, [a, b]) => sum + (b - a), 0) * route.distanceMeters
    const pace = route.durationSeconds / Math.max(1, route.distanceMeters)
    const trafficDelaySeconds = trafficFactor < 1
      ? congestedMeters * pace * (1 / trafficFactor - 1)
      : 0
    const tolls = tollHit && booth ? [booth] : []
    return {
      ...route,
      id: "",
      durationSeconds: route.durationSeconds + trafficDelaySeconds,
      trafficDelaySeconds,
      trafficRanges: ranges,
      trafficSegments: ranges.map(([a, b]) => slicePolyline(route.points, a, b)),
      potholes,
      worldPotholes,
      worldTraffic,
      worldTolls: booth ? [booth] : [],
      tolls,
      tollTotal: tolls.reduce((sum, toll) => sum + toll.price, 0),
      unpavedNames: unpavedHits(route.points, unpavedStreets),
      notes: [],
    }
  })
  return measured
    .sort((a, b) => a.durationSeconds - b.durationSeconds)
    .map((route, index) => ({ ...route, id: `rota-${index + 1}` }))
}

// Nota de cada caminho segundo o que o usuário quer evitar (menor = melhor)
export function routeScore(route: StreetRoute, options: Partial<RouteOptions>) {
  return route.durationSeconds
    + (options.avoidTolls && route.tolls.length ? 100000 : 0)
    + (options.avoidPotholes ? route.potholes.length * 40000 : 0)
    + (options.avoidUnpaved ? route.unpavedNames.length * 30000 : 0)
    + (options.avoidTraffic ? route.trafficDelaySeconds * 60 : 0)
}

export function pickBestRoute(routes: StreetRoute[], options: Partial<RouteOptions>): StreetRoute {
  return routes.reduce((best, route) =>
    routeScore(route, options) < routeScore(best, options) ? route : best, routes[0])
}

// Avisos sobre o caminho escolhido em relação às alternativas
export function routeNotes(
  chosen: StreetRoute,
  routes: StreetRoute[],
  options: Partial<RouteOptions>,
): string[] {
  const notes: string[] = []
  const fastest = routes[0]
  if (options.avoidTolls) {
    if (chosen.tolls.length) notes.push("Não há caminho sem pedágio para este trajeto.")
    else if (routes.some((route) => route.tolls.length)) notes.push("Rota alternativa escolhida para evitar o pedágio.")
  }
  if (options.avoidPotholes) {
    if (chosen.potholes.length) notes.push(`Nenhum caminho evita todos os buracos (${chosen.potholes.length} nesta rota).`)
    else if (routes.some((route) => route.potholes.length)) notes.push("Rota alternativa escolhida para desviar dos buracos.")
  }
  if (options.avoidTraffic && chosen.trafficDelaySeconds < (fastest?.trafficDelaySeconds ?? 0)) {
    notes.push("Rota alternativa escolhida para fugir do trânsito.")
  }
  if (options.avoidUnpaved) {
    if (chosen.unpavedNames.length) notes.push(`Trecho de terra inevitável: ${chosen.unpavedNames.join(", ")}.`)
    else if (routes.some((route) => route.unpavedNames.length)) notes.push("Rota alternativa escolhida para evitar estradas de terra.")
  } else if (chosen.unpavedNames.length) {
    notes.push(`Atenção: a rota passa por via de terra (${chosen.unpavedNames.join(", ")}).`)
  }
  return notes
}

// Usado no recálculo (desvio): já devolve o melhor caminho segundo as preferências
export async function calculateStreetRoute(
  start: MapPoint,
  end: MapPoint,
  signal: AbortSignal,
  options: Partial<RouteOptions> = {},
  unpavedStreets: StreetFeature[] = [],
): Promise<StreetRoute> {
  const routes = await calculateRouteAlternatives(start, end, signal, options, unpavedStreets)
  const chosen = pickBestRoute(routes, options)
  return { ...chosen, notes: routeNotes(chosen, routes, options) }
}