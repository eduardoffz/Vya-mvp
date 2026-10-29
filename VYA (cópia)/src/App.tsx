import { useEffect, useRef, useState } from "react"
import pradoMap from "./prado-map.json"
import "./transport.css"
import {
  calculateStreetRoute,
  getTransport,
  loadPradoMapData,
  pointAlongRoute,
  searchPradoPlaces,
  toMapPoint,
  TRANSPORT_MODES,
  type MapPlace,
  type SearchPlace,
  type StreetFeature,
  type StreetRoute,
  type TransportMode,
} from "./routing"

type Screen = "welcome" | "location" | "map" | "route" | "navigation" | "finish"
type Point = {
  x: number
  y: number
  name: string
}
const defaultOrigin: Point = { x: 500, y: 420, name: "Centro de Prado Ferreira" }
const verifiedPlaces: MapPlace[] = pradoMap.places.map((place, index) => ({
  ...place,
  id: `verified-${index}`,
  category: place.address.split(" · ")[1] || "Ponto de referência",
}))

function Icon({ name, size = 22 }: {
  name: string
  size?: number
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="m14 5-7 7 7 7" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    locate: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    turn: <path d="M6 21V10a4 4 0 0 1 4-4h10m-5-5 5 5-5 5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    road: <path d="m6 2-3 20M18 2l3 20M12 3v3m0 4v4m0 4v3" />,
    pause: <path d="M8 5v14M16 5v14" />,
    play: <path d="m7 4 14 8-14 8Z" />,
    exit: (
      <>
        <path d="M9 3H4v18h5m5-14 5 5-5 5M8 12h12" />
      </>
    ),
    // --- tipos de locomoção ---
    car: (
      <>
        <path d="M5 17H3v-5l2-5h14l2 5v5h-2M7 17h10M3 12h18" />
        <circle cx="7.5" cy="17" r="1.8" />
        <circle cx="16.5" cy="17" r="1.8" />
      </>
    ),
    moto: (
      <>
        <circle cx="5.5" cy="16.5" r="3" />
        <circle cx="18.5" cy="16.5" r="3" />
        <path d="M5.5 16.5 9 9h4l3 7.5M9 9 7.5 6H5M13 9l1-3h3" />
      </>
    ),
    bike: (
      <>
        <circle cx="5.5" cy="16.5" r="3.5" />
        <circle cx="18.5" cy="16.5" r="3.5" />
        <path d="M5.5 16.5 10 8h5M12 16.5 15 8l3.5 8.5M9 6h3" />
      </>
    ),
    walk: (
      <>
        <circle cx="13" cy="4.5" r="1.8" />
        <path d="m10 21 2-6-2-3 1-4 3 2 3 1M12 15l3 2 1 4M11 8l-3 2" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.pin}
    </svg>
  )
}

function Logo({
  light = false,
  compact = false,
}: {
  light?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={`logo ${light ? "light" : ""} ${compact ? "compact" : ""}`}
      aria-label="Vya. Siga a Vya."
    >
      <svg viewBox="0 0 76 85" fill="none">
        <path
          d="m10 25 27 48 27-48"
          stroke={light ? "white" : "var(--purple)"}
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="25" r="3" fill="white" />
        <path
          d="M65 3c-12 0-18 9-18 18 0 11 18 24 18 24s18-13 18-24C83 12 77 3 65 3Z"
          transform="translate(-9 0)"
          fill="var(--lime)"
          stroke={light ? "var(--lime)" : "var(--night)"}
          strokeWidth="2.5"
        />
        <circle
          cx="56"
          cy="20"
          r="5"
          fill={light ? "var(--purple)" : "var(--night)"}
        />
      </svg>
      <div>
        <strong>Vya</strong>
        {!compact && <span>Siga a Vya.</span>}
      </div>
    </div>
  )
}

function TransportPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TransportMode
  onChange: (mode: TransportMode) => void
  disabled?: boolean
}) {
  return (
    <div
      className="transport-picker"
      role="radiogroup"
      aria-label="Tipo de locomoção"
    >
      {TRANSPORT_MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={value === item.id}
          className={value === item.id ? "active" : ""}
          disabled={disabled}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function MapCanvas({
  destination,
  progress = 0,
  interactive = false,
  onPick,
  origin,
  places,
  streets,
  followRoute = false,
  zoom,
  streetRoute,
}: {
  destination: Point | null
  progress?: number
  interactive?: boolean
  onPick?: (point: Point) => void
  origin: Point
  places: MapPlace[]
  streets: StreetFeature[]
  followRoute?: boolean
  zoom: number
  streetRoute: StreetRoute | null
}) {
  const [center, setCenter] = useState({ x: 500, y: 420 })
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; scale: number } | null>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (zoom === 1) setCenter({ x: 500, y: 420 })
  }, [zoom])
  const width = 1000 / zoom
  const height = 840 / zoom
  const cx = Math.min(1000 - width / 2, Math.max(width / 2, center.x))
  const cy = Math.min(840 - height / 2, Math.max(height / 2, center.y))
  const route = destination ? streetRoute?.points ?? [] : []
  const marker = route.length ? pointAlongRoute(route, progress) : origin
  const markerAhead = route.length
    ? pointAlongRoute(route, Math.min(1, progress + 0.002))
    : marker
  const markerRotation = Math.atan2(
    markerAhead.y - marker.y,
    markerAhead.x - marker.x,
  ) * 180 / Math.PI + 90
  useEffect(() => {
    if (followRoute && route.length && zoom > 1) {
      setCenter({ x: marker.x, y: marker.y })
    }
  }, [followRoute, marker.x, marker.y, route.length, zoom])
  function pick(e: React.MouseEvent<SVGSVGElement>) {
    if (moved.current || !interactive || !onPick) return
    const matrix = e.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    )
    if (point.x < 0 || point.x > 1000 || point.y < 0 || point.y > 840) return
    const x = Math.min(980, Math.max(20, Math.round(point.x)))
    const y = Math.min(820, Math.max(20, Math.round(point.y)))
    onPick({ x, y, name: `Ponto em Prado Ferreira · ${x}, ${y}` })
  }
  return (
    <svg
      className={`map-canvas ${interactive ? "interactive" : ""}`}
      viewBox={`${cx - width / 2} ${cy - height / 2} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={e => {
        moved.current = false
        const matrix = e.currentTarget.getScreenCTM()
        if (!matrix) return
        drag.current = { x: e.clientX, y: e.clientY, cx, cy, scale: matrix.a }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const start = drag.current
        if (!start) return
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.hypot(dx, dy) > 5) moved.current = true
        if (moved.current && zoom > 1) setCenter({
          x: Math.min(1000-width/2, Math.max(width/2, start.cx-dx/start.scale)),
          y: Math.min(840-height/2, Math.max(height/2, start.cy-dy/start.scale)),
        })
      }}
      onPointerUp={() => { drag.current = null }}
      onPointerCancel={() => { drag.current = null; moved.current = true }}
      onClick={pick}
      role="img"
      aria-label={
        interactive
          ? "Mapa de Prado Ferreira–PR. Clique em qualquer ponto para escolher um destino; também é possível buscar pelo campo de texto."
          : "Mapa de Prado Ferreira–PR com rota pela rede viária"
      }
    >
      <defs>
        <filter id="mapShadow">
          <feDropShadow
            dy="3"
            stdDeviation="4"
            floodColor="#14112e"
            floodOpacity=".15"
          />
        </filter>
      </defs>
      <rect width="1000" height="840" fill="#e9eddc" />
      {pradoMap.tiles.map(tile => <image key={tile.url} x={tile.x} y={tile.y} width="256" height="256" href={tile.url} />)}
      {streets.map((street) => (
        <g
          className="street-feature"
          key={street.id}
          role="button"
          tabIndex={interactive ? 0 : -1}
          aria-label={`Traçar rota para ${street.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (interactive) onPick?.({ ...street.center, name: street.name })
          }}
          onKeyDown={(event) => {
            if (interactive && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault()
              onPick?.({ ...street.center, name: street.name })
            }
          }}
        >
          <polyline
            className="street-hit-area"
            points={street.points.map((point) => `${point.x},${point.y}`).join(" ")}
          />
          {street.showLabel && (
            <text
              className="street-label"
              x={street.center.x}
              y={street.center.y}
              textAnchor="middle"
            >
              {street.name}
            </text>
          )}
        </g>
      ))}
      {places.map((p, i) => (
        <g key={p.name} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={interactive ? 0 : -1}
          aria-label={`Traçar rota para ${p.name}`} style={{cursor: interactive ? 'pointer' : 'default'}}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {e.stopPropagation(); if (interactive) onPick?.(p)}}
          onKeyDown={e => {if (interactive && (e.key === 'Enter' || e.key === ' ')){e.preventDefault();onPick?.(p)}}}>
          <title>{p.name} — {p.address}</title>
          <circle r={i < verifiedPlaces.length ? 14 : 9} fill="var(--purple)" stroke="white" strokeWidth="3" filter="url(#mapShadow)" />
          {i < verifiedPlaces.length && <text y="4" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" fontSize="11" fill="white">{i+1}</text>}
        </g>
      ))}
      {destination && (
        <>
          <polyline
            points={route.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke="white"
            strokeWidth="17"
            strokeLinejoin="round"
            fill="none"
          />
          <polyline
            points={route.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke="var(--purple)"
            strokeWidth="9"
            strokeLinejoin="round"
            fill="none"
          />
          <g
            transform={`translate(${destination.x} ${destination.y})`}
            filter="url(#mapShadow)"
          >
            <path
              d="M0-38c-13 0-21 9-21 21C-21-4 0 12 0 12S21-4 21-17c0-12-8-21-21-21Z"
              fill="var(--lime)"
              stroke="var(--night)"
              strokeWidth="2"
            />
            <circle cy="-18" r="6" fill="var(--night)" />
          </g>
        </>
      )}
      <g
        className="vehicle-marker"
        transform={`translate(${marker.x} ${marker.y}) rotate(${markerRotation})`}
      >
        <circle r="42" fill="var(--purple)" opacity=".08" />
        <circle r="27" fill="var(--purple)" opacity=".1" />
        <circle r="17" fill="white" filter="url(#mapShadow)" />
        <path d="m0-11 10 20L0 4l-10 5Z" fill="var(--purple)" />
      </g>
    </svg>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [destination, setDestination] = useState<Point | null>(null)
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [cityPlaces, setCityPlaces] = useState<MapPlace[]>(verifiedPlaces)
  const [streets, setStreets] = useState<StreetFeature[]>([])
  const [mapDataStatus, setMapDataStatus] = useState("Atualizando ruas e locais…")
  const [showAllPlaces, setShowAllPlaces] = useState(false)
  const [locationStatus, setLocationStatus] = useState("")
  const [locating, setLocating] = useState(false)
  const [originPoint, setOriginPoint] = useState<Point>(defaultOrigin)
  const [originLabel, setOriginLabel] = useState("Centro · Prado Ferreira–PR")
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [streetRoute, setStreetRoute] = useState<StreetRoute | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState("")
  // Tipo de locomoção escolhido (carro, moto, bicicleta ou a pé)
  const [mode, setMode] = useState<TransportMode>("driving")
  const lastPick = useRef<Point | null>(null)
  const routeRequest = useRef<AbortController | null>(null)
  const searchRequest = useRef<AbortController | null>(null)
  const transport = getTransport(mode)
  const distance = (streetRoute?.distanceMeters ?? 0) / 1000
  const totalSeconds = Math.max(1, streetRoute?.durationSeconds ?? 1)
  const duration = Math.max(1, Math.ceil(totalSeconds / 60))
  useEffect(() => () => {
    routeRequest.current?.abort()
    searchRequest.current?.abort()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    loadPradoMapData(controller.signal).then((data) => {
      const verifiedNames = new Set(verifiedPlaces.map((place) =>
        place.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
      ))
      setCityPlaces([
        ...verifiedPlaces,
        ...data.places.filter((place) => !verifiedNames.has(
          place.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
        )),
      ])
      setStreets(data.streets)
      setMapDataStatus(data.streets.length || data.places.length
        ? `${data.streets.length} trechos de ruas · ${data.places.length + verifiedPlaces.length} locais`
        : "Mapa urbano local")
    }).catch(() => {
      if (!controller.signal.aborted) {
        setMapDataStatus("Mapa urbano local")
      }
    })
    return () => controller.abort()
  }, [])
  const progress = Math.min(1, elapsed / totalSeconds)
  const currentStep = (streetRoute?.steps ?? []).reduce(
    (active, step) => progress >= step.startProgress ? step : active,
    streetRoute?.steps[0] ?? null,
  )
  const currentStreet = currentStep?.street || destination?.name || "Rota em andamento"
  // Velocidade exibida na simulação, de acordo com o tipo de locomoção
  const cruise = transport.cruiseKmh
  const simulatedSpeed = paused
    ? 0
    : Math.max(2, Math.round(
        (progress > .94 ? cruise * .5 : cruise) +
          cruise * .35 * Math.sin(progress * Math.PI * 5) ** 2,
      ))
  const remaining = Math.max(0, Math.ceil((totalSeconds - elapsed) / 60))
  const arrival = new Date(Date.now() + remaining * 60000).toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )
  const isAuth =
    screen === "welcome" || screen === "location"
  useEffect(() => {
    if (screen !== "navigation" || paused) return
    const timer = window.setInterval(
      () => setElapsed((t) => Math.min(t + .5, totalSeconds)),
      250,
    )
    return () => window.clearInterval(timer)
  }, [screen, paused, totalSeconds])
  useEffect(() => {
    if (screen === "navigation" && progress >= 1) setScreen("finish")
  }, [progress, screen])
  function go(next: Screen) {
    routeRequest.current?.abort()
    routeRequest.current = null
    setRouteLoading(false)
    setScreen(next)
  }
  function requestLocation() {
    setLocating(true)
    setLocationStatus("")
    if (!navigator.geolocation) {
      setLocating(false)
      setLocationStatus(
        "Seu navegador não oferece localização. Você pode usar o mapa de Prado Ferreira.",
      )
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const gpsPoint = toMapPoint(coords.longitude, coords.latitude)
        const isInsideMap = gpsPoint.x >= 0 && gpsPoint.x <= 1000
          && gpsPoint.y >= 0 && gpsPoint.y <= 840
        if (isInsideMap) {
          setOriginPoint({ ...gpsPoint, name: "Sua localização atual" })
          setOriginLabel("Localização atual · Prado Ferreira–PR")
          setLocationStatus("Localização encontrada. Abrindo o mapa…")
          window.setTimeout(() => go("map"), 450)
        } else {
          setOriginPoint(defaultOrigin)
          setOriginLabel("Centro · Prado Ferreira–PR")
          setLocationStatus(
            "Localização autorizada, mas você está fora da área mapeada. O Centro de Prado Ferreira será usado como partida.",
          )
        }
      },
      (error) => {
        setLocating(false)
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? "Permissão de localização negada. Você ainda pode usar o Centro de Prado Ferreira como partida."
            : "Não foi possível obter sua localização. Verifique o GPS e tente novamente.",
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }
  // Calcula a rota até o destino usando o tipo de locomoção escolhido.
  // Devolve true quando a rota foi calculada com sucesso.
  async function choose(point: Point, routeMode: TransportMode = mode): Promise<boolean> {
    routeRequest.current?.abort()
    const controller = new AbortController()
    routeRequest.current = controller
    lastPick.current = point
    setRouteLoading(true)
    setRouteError("")
    setMapExpanded(false)
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const result = await calculateStreetRoute(originPoint, point, controller.signal, routeMode)
      if (routeRequest.current !== controller) return false
      if (result.distanceMeters < 1) throw new Error("Escolha um destino diferente do ponto de partida.")
      setStreetRoute(result)
      // The destination marker sits on the reachable street, not inside a building.
      const manualMapPoint = point.name.startsWith("Ponto em Prado Ferreira")
      setDestination({
        ...point,
        ...result.points[result.points.length - 1],
        name: manualMapPoint ? result.destinationStreet : point.name,
      })
      setElapsed(0)
      setPaused(false)
      go("route")
      return true
    } catch (error) {
      if (routeRequest.current !== controller) return false
      setRouteError(controller.signal.aborted
        ? "O cálculo demorou mais que o esperado. Verifique sua conexão e selecione o destino novamente."
        : error instanceof Error ? error.message : "Não foi possível calcular a rota. Tente novamente.")
      return false
    } finally {
      window.clearTimeout(timeout)
      if (routeRequest.current === controller) {
        routeRequest.current = null
        setRouteLoading(false)
      }
    }
  }
  // Troca o tipo de locomoção. Se já existe uma rota na tela, recalcula
  // (rota e tempo de chegada mudam). Se falhar, volta ao modo anterior.
  async function changeMode(next: TransportMode) {
    if (next === mode) return
    const previous = mode
    setMode(next)
    if (screen !== "route" || !lastPick.current) return
    const ok = await choose(lastPick.current, next)
    if (!ok) setMode(previous)
  }
  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    const normalizedQuery = normalize(query.trim())
    const known = cityPlaces.find((p) =>
      normalize(p.name).includes(normalizedQuery)
      || normalize(p.address).includes(normalizedQuery),
    )
    if (known) {
      setSearchResults([])
      choose(known)
      return
    }
    const knownStreet = streets.find((street) =>
      normalize(street.name).includes(normalizedQuery),
    )
    if (knownStreet) {
      setSearchResults([])
      choose({ ...knownStreet.center, name: knownStreet.name })
      return
    }

    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    setSearching(true)
    setRouteError("")
    setSearchResults([])
    try {
      const results = await searchPradoPlaces(query.trim(), controller.signal)
      if (searchRequest.current !== controller) return
      setSearchResults(results)
      if (!results.length) {
        setRouteError("Nenhuma rua ou endereço foi encontrado em Prado Ferreira.")
      }
    } catch (error) {
      if (searchRequest.current !== controller || controller.signal.aborted) return
      setRouteError(error instanceof Error ? error.message : "Não foi possível pesquisar este endereço.")
    } finally {
      if (searchRequest.current === controller) {
        searchRequest.current = null
        setSearching(false)
      }
    }
  }
  function newRoute() {
    setDestination(null)
    setStreetRoute(null)
    setRouteError("")
    setQuery("")
    setSearchResults([])
    setElapsed(0)
    lastPick.current = null
    go("map")
  }
  return (
    <div className={`app screen-${screen} ${isAuth ? "auth-app" : ""}`}>
      <header className="app-header">
        <button
          className="logo-button"
          onClick={() => (isAuth ? go("welcome") : newRoute())}
        >
          <Logo compact />
        </button>
        <div className="header-center">
          <span className="status-dot" />
          {isAuth
            ? "Seu próximo caminho começa aqui"
            : "Prado Ferreira · Paraná"}
        </div>
        <span className="prototype-badge">PROTÓTIPO INTERATIVO</span>
        {!isAuth && (
          <button
            className="profile"
            aria-label="Voltar à tela inicial"
            onClick={() => {
              go("welcome")
            }}
          >
            <span>V</span>
            <Icon name="exit" size={17} />
          </button>
        )}
      </header>
      {isAuth ? (
        <main className="auth-layout">
          <section className="brand-panel">
            <div className="brand-panel-top">
              <span className="little-label">
                MENOS COMPLICAÇÃO. MAIS CAMINHO.
              </span>
              <span className="edition">01 / VYA</span>
            </div>
            <div className="brand-message">
              <Logo light />
              <h1>
                {screen === "location" ? "Sua posição." : "Seu caminho"}
                <br />
                {screen === "location" ? <>Seu ponto de <span>partida.</span></> : <>começa na <span>Vya.</span></>}
              </h1>
              <p>
                {screen === "location"
                  ? "Encontre sua posição e comece a explorar."
                  : "Navegue de um jeito mais simples."}
              </p>
            </div>
            <div className="route-art">
              <svg viewBox="0 0 600 280" fill="none">
                <path
                  d="M-40 240h200c60 0 80-45 80-85V95c0-35 35-50 65-50h330"
                  stroke="#ffffff12"
                  strokeWidth="70"
                />
                <path
                  d="M-40 240h200c60 0 80-45 80-85V95c0-35 35-50 65-50h330"
                  stroke="#ffffff28"
                  strokeWidth="2"
                  strokeDasharray="7 10"
                />
                <path
                  d="M120 240h40c60 0 80-45 80-85V95c0-35 35-50 65-50h128"
                  stroke="var(--lime)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="120" cy="240" r="10" fill="white" />
                <circle cx="120" cy="240" r="5" fill="var(--purple)" />
                <path
                  d="M433 10c-17 0-28 12-28 27 0 18 28 39 28 39s28-21 28-39c0-15-11-27-28-27Z"
                  fill="var(--lime)"
                />
                <circle cx="433" cy="36" r="8" fill="var(--purple)" />
              </svg>
              <div className="art-bubble">
                <span className="bubble-check">
                  <Icon name="check" size={16} />
                </span>
                <div>
                  <strong>O melhor caminho é o seu.</strong>
                  <small>A gente te acompanha até lá.</small>
                </div>
              </div>
            </div>
            <div className="brand-panel-footer">
              <span>Siga a Vya.</span>
              <span>
                Feito para ir além <Icon name="arrow" size={16} />
              </span>
            </div>
          </section>
          <section className="auth-content">
            <nav className="onboarding-steps" aria-label="Etapas de acesso">
              {["Boas-vindas", "Localização", "Vamos lá"].map((label, i) => (
                <div
                  className={
                    (screen === "location" ? i === 1 : i === 0) ? "active" : ""
                  }
                  key={label}
                >
                  <span>
                    {screen === "location" && i === 0 ? (
                      <Icon name="check" size={12} />
                    ) : (
                      `0${i + 1}`
                    )}
                  </span>
                  {label}
                </div>
              ))}
            </nav>
            <div className={`auth-card auth-card-${screen}`} key={screen}>
              {screen === "location" ? (
                <>
                  <span className="form-icon">
                    <Icon name="locate" size={28} />
                  </span>
                  <div className="eyebrow">UM PONTO DE PARTIDA</div>
                  <h2>
                    Onde começa
                    <br />o seu caminho?
                  </h2>
                  <p className="form-intro">
                    Permita o acesso à sua localização para começar. Você também
                    pode explorar com uma posição fictícia.
                  </p>
                  <div className="location-preview">
                    <Icon name="pin" size={26} />
                    <div>
                      <strong>Prado Ferreira, Paraná</strong>
                      <span>Ponto de partida da simulação</span>
                    </div>
                    <span className="status-dot" />
                  </div>
                  <button
                    className="primary"
                    onClick={requestLocation}
                    disabled={locating}
                  >
                    {locating
                      ? "Buscando sua localização…"
                      : "Permitir localização"}
                    <Icon name="locate" size={19} />
                  </button>
                  {locationStatus && (
                    <p className="notice" role="status">
                      {locationStatus}
                    </p>
                  )}
                  <button className="secondary" onClick={() => go("map")}>
                    {locationStatus
                      ? "Continuar para o mapa"
                      : "Usar localização fictícia"}
                    <Icon name="arrow" size={19} />
                  </button>
                  <p className="privacy-note">
                    <Icon name="shield" size={16} />
                    Sua localização não é armazenada.
                  </p>
                </>
              ) : (
                <>
                  <span className="form-icon"><Icon name="road" size={28} /></span>
                  <div className="eyebrow">BEM-VINDO AO VYA</div>
                  <h2>Pronto para<br />seguir caminho?</h2>
                  <p className="form-intro">Explore a cidade, encontre lugares e trace sua próxima rota sem precisar criar uma conta.</p>
                  <button className="primary" onClick={() => go("location")}>Começar agora<Icon name="arrow" size={20} /></button>
                  <div className="guest-benefits"><div><Icon name="check" size={16} />Todas as ruas da cidade</div><div><Icon name="check" size={16} />Comércios e serviços próximos</div><div><Icon name="check" size={16} />Rotas reais, passo a passo</div></div>
                  <div className="demo-banner"><Icon name="shield" size={18} /><p><strong>Seu caminho não precisa de uma conta.</strong>Cartografia real, navegação simulada. Nenhum dado de acesso é solicitado.</p></div>
                </>
              )}
            </div>
            <footer className="auth-footer">
              <span>© 2026 Vya</span>
              <span>Seu caminho, do seu jeito.</span>
            </footer>
          </section>
        </main>
      ) : (
        <main className="navigation-layout">
          <aside className="trip-sidebar">
            <div className="trip-heading">
              <span className="eyebrow">
                {screen === "finish"
                  ? "DESTINO ALCANÇADO"
                  : screen === "navigation"
                    ? "SIGA A VYA"
                    : "UM NOVO CAMINHO"}
              </span>
              <h1>
                {screen === "finish"
                  ? "Você chegou!"
                  : screen === "navigation"
                    ? "Vamos nessa."
                    : "Para onde vamos?"}
              </h1>
              <p>
                {screen === "map"
                  ? "Um endereço, um lugar ou um ponto no mapa."
                  : screen === "finish"
                    ? "Todo bom caminho merece uma boa chegada."
                    : "Seu destino está cada vez mais perto."}
              </p>
            </div>
            {screen === "map" && routeLoading && <p className="notice" role="status">Calculando rota pelas ruas…</p>}
            {screen === "map" && routeError && <p className="notice" role="alert">{routeError}</p>}
            {screen === "map" && (
              <>
                <form className="search-bar" onSubmit={search}>
                  <Icon name="search" size={20} />
                  <input
                    aria-label="Buscar destino"
                    placeholder="Busque uma rua ou endereço"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setSearchResults([])
                      setRouteError("")
                    }}
                  />
                  <button aria-label="Pesquisar endereço" disabled={searching}>
                    <Icon name="arrow" size={19} />
                  </button>
                </form>
                {searching && <p className="search-status" role="status">Buscando ruas em Prado Ferreira…</p>}
                {searchResults.length > 0 && (
                  <div className="search-results" aria-label="Resultados da busca">
                    {searchResults.map((result, index) => (
                      <button
                        key={`${result.x}-${result.y}-${index}`}
                        onClick={() => {
                          setQuery(result.name)
                          setSearchResults([])
                          choose(result)
                        }}
                      >
                        <Icon name="pin" size={18} />
                        <span>
                          <strong>{result.name}</strong>
                          <small>{result.address || "Prado Ferreira–PR"}</small>
                        </span>
                        <Icon name="arrow" size={16} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="origin-row">
                  <span className="origin-dot" />
                  <div>
                    <strong>Sua localização</strong>
                    <small>{originLabel}</small>
                  </div>
                  <Icon name="locate" size={18} />
                </div>
                <TransportPicker value={mode} onChange={setMode} disabled={routeLoading} />
                <div className="map-tip">
                  <Icon name="pin" size={25} />
                  <div>
                    <strong>O destino é você quem escolhe.</strong>
                    <p>
                      Toque em qualquer lugar do mapa para traçar uma rota até
                      lá.
                    </p>
                  </div>
                </div>
                <div className="section-title">
                  Locais em Prado Ferreira<span>{cityPlaces.length} destinos</span>
                </div>
                <div className="places-list">
                  {(showAllPlaces ? cityPlaces : cityPlaces.slice(0, 10)).map((p, i) => (
                    <button key={p.name} onClick={() => choose(p)}>
                      <span className={`place-icon place-${i}`}>
                        {i < verifiedPlaces.length ? i + 1 : <Icon name="pin" size={16} />}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.address} · {p.category}</small>
                      </div>
                      <Icon name="arrow" size={17} />
                    </button>
                  ))}
                </div>
                {cityPlaces.length > 10 && (
                  <button className="show-more-places" onClick={() => setShowAllPlaces((value) => !value)}>
                    {showAllPlaces ? "Mostrar menos locais" : `Ver todos os ${cityPlaces.length} locais`}
                  </button>
                )}
                <div className="simulation-note">
                  <Icon name="shield" size={17} />
                  <p>
                    Rotas calculadas pelas ruas com OSRM. Pontos fora das vias são conectados à rua acessível mais próxima. Tempo estimado de acordo com o tipo de locomoção, sem trânsito em tempo real.
                  </p>
                </div>
              </>
            )}
            {(screen === "route" || screen === "navigation") && destination && (
              <>
                <div className="destination-card">
                  <span className="origin-dot" />
                  <div>
                    <small>SAINDO DE</small>
                    <strong>{originPoint.name}</strong>
                  </div>
                  <span className="destination-connector" />
                  <Icon name="pin" size={21} />
                  <div>
                    <small>CHEGANDO EM</small>
                    <strong>{destination.name}</strong>
                  </div>
                </div>
                {screen === "route" && (
                  <>
                    <TransportPicker value={mode} onChange={changeMode} disabled={routeLoading} />
                    {routeLoading && <p className="notice" role="status">Recalculando rota…</p>}
                    {routeError && <p className="notice" role="alert">{routeError}</p>}
                  </>
                )}
                {screen === "navigation" && (
                  <div className={`turn-card ${paused ? "paused" : ""}`}>
                    <Icon name={currentStep?.maneuver === "turn" ? "turn" : "arrow"} size={32} />
                    <div>
                      <small>{paused ? "Navegação pausada" : currentStep?.instruction || "Siga a rota destacada"}</small>
                      <strong>{currentStreet}</strong>
                    </div>
                    <span className="live-speed">{simulatedSpeed}<small>km/h</small></span>
                  </div>
                )}
                <div className="route-title">
                  <span>
                    {screen === "route"
                      ? "Sua rota está pronta"
                      : "Viagem em andamento"}
                  </span>
                  <span className="transport-label">
                    <Icon name={transport.icon} size={14} />
                    {transport.label}
                  </span>
                </div>
                <div className="trip-stats">
                  <div>
                    <strong>
                      {screen === "route" ? duration : remaining}
                      <span> min</span>
                    </strong>
                    <small>
                      {screen === "route" ? "Tempo estimado" : "Tempo restante"}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {(distance * (screen === "navigation" ? 1 - progress : 1))
                        .toFixed(1)
                        .replace(".", ",")}
                      <span> km</span>
                    </strong>
                    <small>
                      {screen === "route" ? "Distância total" : "Até o destino"}
                    </small>
                  </div>
                </div>
                <div className="arrival-time">
                  <Icon name="clock" size={19} />
                  <span>Chegada prevista</span>
                  <strong>{arrival}</strong>
                </div>
                {screen === "navigation" && (
                  <>
                    <div className="progress-label">
                      <span>Percurso concluído</span>
                      <strong>{Math.round(progress * 100)}%</strong>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${progress * 100}%` }} />
                    </div>
                    <div className="sim-speed">
                      Simulação suave em ritmo 2× · velocidade variável ({transport.label.toLowerCase()})
                    </div>
                  </>
                )}
                <button
                  className="primary"
                  disabled={screen === "route" && routeLoading}
                  onClick={() => {
                    if (screen === "route") {
                      setElapsed(0)
                      setPaused(false)
                      setZoom(2.5)
                      go("navigation")
                    } else {
                      setElapsed(totalSeconds)
                      go("finish")
                    }
                  }}
                >
                  {screen === "route"
                    ? "Iniciar meu caminho"
                    : "Simular chegada agora"}
                  <Icon name={screen === "route" ? "arrow" : "check"} />
                </button>
                {screen === "navigation" && (
                  <button
                    className="secondary"
                    onClick={() => setPaused((v) => !v)}
                  >
                    {paused ? "Continuar viagem" : "Pausar simulação"}
                    <Icon name={paused ? "play" : "pause"} size={18} />
                  </button>
                )}
                <button className="text-button" onClick={newRoute}>
                  {screen === "route"
                    ? "Escolher outro destino"
                    : "Cancelar viagem"}
                </button>
                <p className="route-disclaimer">
                  Navegação fictícia. Não use para dirigir.
                </p>
              </>
            )}
            {screen === "finish" && destination && (
              <div className="finish-content">
                <div className="finish-check">
                  <Icon name="check" size={42} />
                </div>
                <h2>
                  O importante
                  <br />é chegar.
                </h2>
                <p>
                  Seu caminho até <strong>{destination.name}</strong> foi
                  concluído. Aproveite o destino!
                </p>
                <div className="finish-stats">
                  <div>
                    <Icon name="road" />
                    <strong>{distance.toFixed(1).replace(".", ",")} km</strong>
                    <small>Percorridos</small>
                  </div>
                  <div>
                    <Icon name={transport.icon} />
                    <strong>{duration} min</strong>
                    <small>Tempo simulado · {transport.label}</small>
                  </div>
                </div>
                <button className="primary" onClick={newRoute}>
                  Escolher um novo destino
                  <Icon name="arrow" />
                </button>
              </div>
            )}
            <div className="trip-footer">
              <Logo compact />
              <span>Siga a Vya.</span>
            </div>
          </aside>
          <section className={`map-section ${mapExpanded ? "expanded" : ""}`}>
            <MapCanvas
              destination={screen === "map" ? null : destination}
              progress={
                screen === "finish" ? 1 : screen === "navigation" ? progress : 0
              }
              interactive={screen === "map"}
              onPick={choose}
              origin={originPoint}
              places={cityPlaces}
              streets={streets}
              followRoute={screen === "navigation"}
              streetRoute={streetRoute}
              zoom={zoom}
            />
            <div className="map-controls" aria-label="Controles do mapa">
              <button aria-label="Aproximar mapa" disabled={zoom >= 4} onClick={() => setZoom(z => Math.min(4, z + .5))}>+</button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button aria-label="Afastar mapa" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - .5))}>−</button>
              <button className="map-overview" onClick={() => setZoom(1)} aria-label="Mostrar cidade inteira"><Icon name="locate" size={19} /></button>
              <button className="map-expand" onClick={() => setMapExpanded(v => !v)}>{mapExpanded ? "Fechar" : "Ampliar"}</button>
            </div>
            <div className="map-top-tag">
              <span className="status-dot" />
              {screen === "navigation" ? currentStreet : "Prado Ferreira–PR"}
              <span>{screen === "navigation" ? `${simulatedSpeed} KM/H` : mapDataStatus}</span>
            </div>
            {screen === "map" && (
              <div className="map-instruction">
                <Icon name="pin" size={18} />
                Toque para escolher · arraste para explorar
              </div>
            )}
            {screen === "finish" && (
              <div className="map-finish-tag">
                <span>
                  <Icon name="check" size={18} />
                </span>
                Você chegou ao seu destino.
              </div>
            )}
            <div className="map-bottom">
              <span>Região urbana · Prado Ferreira–PR</span>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}