import { useEffect, useRef, useState } from "react"
import pradoMap from "./prado-map.json"
import {
  calculateStreetRoute,
  calculateStreetRouteAlternatives,
  loadPradoMapData,
  pointAlongRoute,
  searchPradoPlaces,
  toMapPoint,
  type MapPlace,
  type SearchPlace,
  type StreetFeature,
  type StreetRoute,
} from "./routing"

type Screen = "welcome" | "login" | "register" | "location" | "map" | "route" | "navigation" | "finish"

type Point = {
  x: number
  y: number
  name: string
}

type User = {
  name: string
  email: string
}

type TrafficReport = {
  id: string
  type: "accident" | "construction" | "pothole" | "closure"
  label: string
  x: number
  y: number
  timestamp: number
}

const defaultOrigin: Point = {
  x: 500,
  y: 420,
  name: "Centro de Prado Ferreira",
}
const verifiedPlaces: MapPlace[] = pradoMap.places.map((place, index) => ({
  ...place,
  id: `verified-${index}`,
  category: place.address.split(" · ")[1] || "Ponto de referência",
}))

const CATEGORIES = [
  "Todos",
  "Alimentação",
  "Saúde",
  "Mercado",
  "Educação",
  "Esporte e lazer",
  "Comércio",
  "Serviços",
  "Segurança",
]

function getStoredItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) as T : fallback
  } catch {
    return fallback
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage quota issues
  }
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
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
    exit: <path d="M9 3H4v18h5m5-14 5 5-5 5M8 12h12" />,
    home: (
      <>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
    briefcase: (
      <>
        <rect width="20" height="14" x="2" y="7" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
    warning: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    toll: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M8 14h2m4 0h2" />
      </>
    ),
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    plus: <path d="M5 12h14m-7-7v14" />,
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    star: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
    google: (
      <g>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </g>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={name === "google" ? "none" : "currentColor"}
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

function MapCanvas({
  destination,
  waypoints = [],
  progress = 0,
  interactive = false,
  onPick,
  origin,
  places,
  streets,
  followRoute = false,
  zoom,
  streetRoute,
  routeAlternatives = [],
  selectedRouteIndex = 0,
  trafficReports = [],
}: {
  destination: Point | null
  waypoints?: Point[]
  progress?: number
  interactive?: boolean
  onPick?: (point: Point) => void
  origin: Point
  places: MapPlace[]
  streets: StreetFeature[]
  followRoute?: boolean
  zoom: number
  streetRoute: StreetRoute | null
  routeAlternatives?: StreetRoute[]
  selectedRouteIndex?: number
  trafficReports?: TrafficReport[]
}) {
  const [center, setCenter] = useState({ x: 500, y: 420 })
  const drag = useRef<{
    x: number
    y: number
    cx: number
    cy: number
    scale: number
  } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (zoom === 1) setCenter({ x: 500, y: 420 })
  }, [zoom])

  const width = 1000 / zoom
  const height = 840 / zoom
  const cx = Math.min(1000 - width / 2, Math.max(width / 2, center.x))
  const cy = Math.min(840 - height / 2, Math.max(height / 2, center.y))
  const route = destination ? (streetRoute?.points ?? []) : []
  const marker = route.length ? pointAlongRoute(route, progress) : origin
  const markerAhead = route.length
    ? pointAlongRoute(route, Math.min(1, progress + 0.002))
    : marker
  const markerRotation =
    (Math.atan2(markerAhead.y - marker.y, markerAhead.x - marker.x) * 180) /
      Math.PI +
    90

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
      onPointerDown={(e) => {
        moved.current = false
        const matrix = e.currentTarget.getScreenCTM()
        if (!matrix) return
        drag.current = { x: e.clientX, y: e.clientY, cx, cy, scale: matrix.a }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const start = drag.current
        if (!start) return
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.hypot(dx, dy) > 5) moved.current = true
        if (moved.current && zoom > 1) {
          setCenter({
            x: Math.min(
              1000 - width / 2,
              Math.max(width / 2, start.cx - dx / start.scale),
            ),
            y: Math.min(
              840 - height / 2,
              Math.max(height / 2, start.cy - dy / start.scale),
            ),
          })
        }
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
        moved.current = true
      }}
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
      {pradoMap.tiles.map((tile) => (
        <image
          key={tile.url}
          x={tile.x}
          y={tile.y}
          width="256"
          height="256"
          href={tile.url}
        />
      ))}
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
            points={street.points
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
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
        <g
          key={p.name}
          transform={`translate(${p.x} ${p.y})`}
          role="button"
          tabIndex={interactive ? 0 : -1}
          aria-label={`Traçar rota para ${p.name}`}
          style={{ cursor: interactive ? "pointer" : "default" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            if (interactive) onPick?.(p)
          }}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onPick?.(p)
            }
          }}
        >
          <title>
            {p.name} — {p.address}
          </title>
          <circle
            r={i < verifiedPlaces.length ? 14 : 9}
            fill="var(--purple)"
            stroke="white"
            strokeWidth="3"
            filter="url(#mapShadow)"
          />
          {i < verifiedPlaces.length && (
            <text
              y="4"
              textAnchor="middle"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="11"
              fill="white"
            >
              {i + 1}
            </text>
          )}
        </g>
      ))}

      {/* Traffic hazard and obstacle reports */}
      {trafficReports.map((report) => (
        <g
          key={report.id}
          transform={`translate(${report.x} ${report.y})`}
          filter="url(#mapShadow)"
        >
          <circle r="14" fill="#ff7a00" stroke="white" strokeWidth="2.5" />
          <text
            y="4"
            textAnchor="middle"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="700"
            fontSize="10"
            fill="white"
          >
            !
          </text>
          <title>{report.label} reportado</title>
        </g>
      ))}

      {/* Alternative routes (rendered in subtle gray/purple for contrast) */}
      {destination &&
        routeAlternatives.map((alt, idx) => {
          if (idx === selectedRouteIndex) return null
          return (
            <polyline
              key={alt.id || idx}
              points={alt.points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="#9587bf"
              strokeWidth="6"
              strokeDasharray="9 6"
              strokeLinejoin="round"
              opacity="0.65"
              fill="none"
            />
          )
        })}

      {/* Active route */}
      {destination && route.length > 0 && (
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
        </>
      )}

      {/* Waypoints markers */}
      {destination &&
        waypoints.map((wp, idx) => (
          <g
            key={`wp-${idx}`}
            transform={`translate(${wp.x} ${wp.y})`}
            filter="url(#mapShadow)"
          >
            <circle r="13" fill="#3b82f6" stroke="white" strokeWidth="3" />
            <text
              y="4"
              textAnchor="middle"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="11"
              fill="white"
            >
              {idx + 1}
            </text>
            <title>
              Parada {idx + 1}: {wp.name}
            </title>
          </g>
        ))}

      {/* Destination marker (ver o destino marcado no mapa) */}
      {destination && (
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
      )}

      {/* Vehicle position marker */}
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
  const [user, setUser] = useState<User | null>(() =>
    getStoredItem<User | null>("vya_user", null),
  )

  // Auth forms state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginError, setLoginError] = useState("")

  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regError, setRegError] = useState("")

  // Destination & Multi-route state
  const [destination, setDestination] = useState<Point | null>(null)
  const [waypoints, setWaypoints] = useState<Point[]>([])
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [avoidUnpaved, setAvoidUnpaved] = useState(false)
  const [routeAlternatives, setRouteAlternatives] = useState<StreetRoute[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [streetRoute, setStreetRoute] = useState<StreetRoute | null>(null)

  // Places, streets, search
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [cityPlaces, setCityPlaces] = useState<MapPlace[]>(verifiedPlaces)
  const [streets, setStreets] = useState<StreetFeature[]>([])
  const [mapDataStatus, setMapDataStatus] = useState(
    "Atualizando ruas e locais…",
  )
  const [showAllPlaces, setShowAllPlaces] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("Todos")

  // Location and GPS status
  const [locationStatus, setLocationStatus] = useState("")
  const [locating, setLocating] = useState(false)
  const [originPoint, setOriginPoint] = useState<Point>(defaultOrigin)
  const [originLabel, setOriginLabel] = useState("Centro · Prado Ferreira–PR")
  const [showGpsModal, setShowGpsModal] = useState(false)

  // Saved shortcuts (Casa / Trabalho)
  const [homePlace, setHomePlace] = useState<Point | null>(() =>
    getStoredItem<Point | null>("vya_home_place", null),
  )
  const [workPlace, setWorkPlace] = useState<Point | null>(() =>
    getStoredItem<Point | null>("vya_work_place", null),
  )
  const [shortcutModalType, setShortcutModalType] =
    useState<"home" | "work" | null>(null)
  const [shortcutInputName, setShortcutInputName] = useState("")

  // Waypoints modal
  const [showAddStopModal, setShowAddStopModal] = useState(false)
  const [stopQuery, setStopQuery] = useState("")

  // Simulation & Map view
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState("")

  // Traffic reports & Navigation warnings
  const [trafficReports, setTrafficReports] = useState<TrafficReport[]>(() =>
    getStoredItem<TrafficReport[]>("vya_traffic_reports", []),
  )
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportSuccessToast, setReportSuccessToast] = useState<string | null>(
    null,
  )
  const [potholeWarning, setPotholeWarning] = useState<string | null>(null)
  const [recalcBanner, setRecalcBanner] =
    useState<"recalculating" | "recalculated" | null>(null)
  const [triggeredPotholes, setTriggeredPotholes] = useState<Set<number>>(
    new Set(),
  )
  const [hasRecalculated, setHasRecalculated] = useState(false)

  const routeRequest = useRef<AbortController | null>(null)
  const searchRequest = useRef<AbortController | null>(null)

  const distance = (streetRoute?.distanceMeters ?? 0) / 1000
  const totalSeconds = Math.max(1, streetRoute?.durationSeconds ?? 1)
  const duration = Math.max(1, Math.ceil(totalSeconds / 60))

  useEffect(
    () => () => {
      routeRequest.current?.abort()
      searchRequest.current?.abort()
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadPradoMapData(controller.signal)
      .then((data) => {
        const verifiedNames = new Set(
          verifiedPlaces.map((place) =>
            place.name
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ),
        )
        setCityPlaces([
          ...verifiedPlaces,
          ...data.places.filter(
            (place) =>
              !verifiedNames.has(
                place.name
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase(),
              ),
          ),
        ])
        setStreets(data.streets)
        setMapDataStatus(
          data.streets.length || data.places.length
            ? `${data.streets.length} trechos de ruas · ${
                data.places.length + verifiedPlaces.length
              } locais`
            : "Mapa urbano local",
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMapDataStatus("Mapa urbano local")
        }
      })
    return () => controller.abort()
  }, [])

  const progress = Math.min(1, elapsed / totalSeconds)
  const currentStep = (streetRoute?.steps ?? []).reduce(
    (active, step) => (progress >= step.startProgress ? step : active),
    streetRoute?.steps[0] ?? null,
  )
  const currentStreet =
    currentStep?.street || destination?.name || "Rota em andamento"

  const simulatedSpeed = paused
    ? 0
    : Math.max(
        8,
        Math.round(
          (progress > 0.94 ? 14 : 27) +
            10 * Math.sin(progress * Math.PI * 5) ** 2,
        ),
      )
  const remaining = Math.max(0, Math.ceil((totalSeconds - elapsed) / 60))
  const arrival = new Date(Date.now() + remaining * 60000).toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )

  const isAuth =
    screen === "welcome" ||
    screen === "login" ||
    screen === "register" ||
    screen === "location"

  // Navigation tick
  useEffect(() => {
    if (screen !== "navigation" || paused) return
    const timer = window.setInterval(
      () => setElapsed((t) => Math.min(t + 0.5, totalSeconds)),
      250,
    )
    return () => window.clearInterval(timer)
  }, [screen, paused, totalSeconds])

  // Navigation completion
  useEffect(() => {
    if (screen === "navigation" && progress >= 1) setScreen("finish")
  }, [progress, screen])

  // Pothole warnings simulation at ~25%, ~55%, ~80%
  useEffect(() => {
    if (screen !== "navigation" || paused) return

    const checkPoint = (threshold: number, id: number) => {
      if (progress >= threshold && !triggeredPotholes.has(id)) {
        setTriggeredPotholes((prev) => new Set(prev).add(id))
        setPotholeWarning("⚠️ Atenção: Buraco reportado à frente na via!")
        window.setTimeout(() => setPotholeWarning(null), 3000)
      }
    }

    checkPoint(0.25, 1)
    checkPoint(0.55, 2)
    checkPoint(0.8, 3)
  }, [progress, screen, paused, triggeredPotholes])

  // Route recalculation simulation at ~40% progress
  useEffect(() => {
    if (screen !== "navigation" || paused || hasRecalculated) return

    if (progress >= 0.4 && progress < 0.46) {
      setHasRecalculated(true)
      setRecalcBanner("recalculating")
      const t1 = window.setTimeout(() => {
        setRecalcBanner("recalculated")
        const t2 = window.setTimeout(() => {
          setRecalcBanner(null)
        }, 2000)
        return () => window.clearTimeout(t2)
      }, 2000)
      return () => window.clearTimeout(t1)
    }
  }, [progress, screen, paused, hasRecalculated])

  function go(next: Screen) {
    routeRequest.current?.abort()
    routeRequest.current = null
    setRouteLoading(false)
    setScreen(next)
  }

  // Location request with prominent GPS modal on failure
  function requestLocation() {
    setLocating(true)
    setLocationStatus("")
    setShowGpsModal(false)

    if (!navigator.geolocation) {
      setLocating(false)
      setLocationStatus("Seu navegador não oferece suporte à geolocalização.")
      setShowGpsModal(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const gpsPoint = toMapPoint(coords.longitude, coords.latitude)
        const isInsideMap =
          gpsPoint.x >= 0 &&
          gpsPoint.x <= 1000 &&
          gpsPoint.y >= 0 &&
          gpsPoint.y <= 840
        if (isInsideMap) {
          setOriginPoint({ ...gpsPoint, name: "Sua localização atual" })
          setOriginLabel("Localização atual · Prado Ferreira–PR")
          setLocationStatus("Localização encontrada com sucesso. Abrindo mapa…")
          window.setTimeout(() => go("map"), 450)
        } else {
          setOriginPoint(defaultOrigin)
          setOriginLabel("Centro · Prado Ferreira–PR")
          setLocationStatus(
            "Localização autorizada. Como você está fora do perímetro de Prado Ferreira, o Centro será usado como partida.",
          )
          window.setTimeout(() => go("map"), 1000)
        }
      },
      (error) => {
        setLocating(false)
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? "Permissão de localização negada pelo dispositivo ou navegador."
            : "GPS desligado ou indisponível no momento.",
        )
        // Show prominent instructions modal
        setShowGpsModal(true)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }

  // Calculate route alternatives (supporting stops & avoid parameters)
  async function computeRoutes(
    targetDest: Point,
    targetWaypoints: Point[],
    tollsAvoided: boolean,
    unpavedAvoided: boolean,
  ) {
    routeRequest.current?.abort()
    const controller = new AbortController()
    routeRequest.current = controller
    setRouteLoading(true)
    setRouteError("")
    setMapExpanded(false)

    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const results = await calculateStreetRouteAlternatives(
        originPoint,
        targetDest,
        controller.signal,
        {
          waypoints: targetWaypoints,
          avoidTolls: tollsAvoided,
          avoidUnpaved: unpavedAvoided,
        },
      )
      if (routeRequest.current !== controller) return
      if (!results.length) {
        throw new Error("Não foi possível calcular o trajeto até este destino.")
      }

      setRouteAlternatives(results)
      setSelectedRouteIndex(0)
      setStreetRoute(results[0])

      const manualMapPoint = targetDest.name.startsWith(
        "Ponto em Prado Ferreira",
      )
      setDestination({
        ...targetDest,
        ...results[0].points[results[0].points.length - 1],
        name: manualMapPoint ? results[0].destinationStreet : targetDest.name,
      })

      setElapsed(0)
      setPaused(false)
      setTriggeredPotholes(new Set())
      setHasRecalculated(false)
      go("route")
    } catch (error) {
      if (routeRequest.current !== controller) return
      setRouteError(
        controller.signal.aborted
          ? "O cálculo da rota demorou mais que o esperado. Verifique sua conexão e tente novamente."
          : error instanceof Error
            ? error.message
            : "Não foi possível calcular a rota.",
      )
    } finally {
      window.clearTimeout(timeout)
      if (routeRequest.current === controller) {
        routeRequest.current = null
        setRouteLoading(false)
      }
    }
  }

  function choose(point: Point) {
    setWaypoints([])
    computeRoutes(point, [], avoidTolls, avoidUnpaved)
  }

  // Handle route selection between alternatives
  function selectAlternativeRoute(index: number) {
    if (routeAlternatives[index]) {
      setSelectedRouteIndex(index)
      setStreetRoute(routeAlternatives[index])
    }
  }

  // Handle add stop
  function addWaypoint(stop: Point) {
    if (waypoints.length >= 2 || !destination) return
    const updated = [...waypoints, stop]
    setWaypoints(updated)
    setShowAddStopModal(false)
    setStopQuery("")
    computeRoutes(destination, updated, avoidTolls, avoidUnpaved)
  }

  // Handle remove stop
  function removeWaypoint(index: number) {
    if (!destination) return
    const updated = waypoints.filter((_, i) => i !== index)
    setWaypoints(updated)
    computeRoutes(destination, updated, avoidTolls, avoidUnpaved)
  }

  // Handle toll avoidance toggle
  function handleToggleAvoidTolls(avoid: boolean) {
    setAvoidTolls(avoid)
    if (destination) {
      computeRoutes(destination, waypoints, avoid, avoidUnpaved)
    }
  }

  // Handle unpaved roads toggle
  function handleToggleAvoidUnpaved(avoid: boolean) {
    setAvoidUnpaved(avoid)
    if (destination) {
      computeRoutes(destination, waypoints, avoidTolls, avoid)
    }
  }

  // Shortcut setter for Casa/Trabalho
  function saveShortcut(point: Point) {
    if (!shortcutModalType) return
    if (shortcutModalType === "home") {
      setHomePlace(point)
      setStoredItem("vya_home_place", point)
    } else {
      setWorkPlace(point)
      setStoredItem("vya_work_place", point)
    }
    setShortcutModalType(null)
    setShortcutInputName("")
  }

  // Traffic report creation
  function createTrafficReport(
    type: "accident" | "construction" | "pothole" | "closure",
    label: string,
  ) {
    const currentPos = streetRoute?.points?.length
      ? pointAlongRoute(streetRoute.points, progress)
      : originPoint
    const newReport: TrafficReport = {
      id: `report-${Date.now()}`,
      type,
      label,
      x: currentPos.x,
      y: currentPos.y,
      timestamp: Date.now(),
    }
    const updated = [newReport, ...trafficReports]
    setTrafficReports(updated)
    setStoredItem("vya_traffic_reports", updated)
    setShowReportModal(false)
    setReportSuccessToast(`Alerta de "${label}" reportado com sucesso!`)
    window.setTimeout(() => setReportSuccessToast(null), 3500)
  }

  // Login handler
  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError("")
    const email = loginEmail.trim().toLowerCase()
    const password = loginPassword.trim()

    if (!email || !password) {
      setLoginError("Preencha todos os campos para entrar.")
      return
    }

    const registeredUsers = getStoredItem<Array<{
      name: string
      email: string
      password?: string
    }>>("vya_users", [])
    const found = registeredUsers.find(
      (u) => u.email.toLowerCase() === email && u.password === password,
    )

    if (found) {
      const sessionUser: User = { name: found.name, email: found.email }
      setUser(sessionUser)
      setStoredItem("vya_user", sessionUser)
      go("location")
    } else {
      // Allow demo login if user typed any valid-looking credentials
      if (email.includes("@") && password.length >= 4) {
        const fallbackName = email.split("@")[0]
        const formattedName =
          fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
        const sessionUser: User = { name: formattedName, email }
        setUser(sessionUser)
        setStoredItem("vya_user", sessionUser)
        go("location")
      } else {
        setLoginError(
          "E-mail ou senha incorretos. Verifique e tente novamente.",
        )
      }
    }
  }

  // Register handler
  function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegError("")
    const name = regName.trim()
    const email = regEmail.trim().toLowerCase()
    const password = regPassword.trim()

    if (!name || !email || !password) {
      setRegError("Preencha seu nome, e-mail e crie uma senha.")
      return
    }
    if (password.length < 6) {
      setRegError("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    const registeredUsers = getStoredItem<Array<{
      name: string
      email: string
      password?: string
    }>>("vya_users", [])

    if (registeredUsers.some((u) => u.email.toLowerCase() === email)) {
      setRegError("Este e-mail já está cadastrado. Faça login.")
      return
    }

    const newUserRecord = { name, email, password }
    const updatedList = [...registeredUsers, newUserRecord]
    setStoredItem("vya_users", updatedList)

    const sessionUser: User = { name, email }
    setUser(sessionUser)
    setStoredItem("vya_user", sessionUser)
    go("location")
  }

  // Google simulated login
  function handleGoogleLogin() {
    const googleUser: User = {
      name: "Usuário Google",
      email: "usuario@gmail.com",
    }
    setUser(googleUser)
    setStoredItem("vya_user", googleUser)
    go("location")
  }

  // Logout
  function handleLogout() {
    setUser(null)
    localStorage.removeItem("vya_user")
    go("welcome")
  }

  // Address search
  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    const normalizedQuery = normalize(query.trim())

    const known = cityPlaces.find(
      (p) =>
        normalize(p.name).includes(normalizedQuery) ||
        normalize(p.address).includes(normalizedQuery),
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
        setRouteError(
          "Nenhuma rua ou endereço foi encontrado em Prado Ferreira.",
        )
      }
    } catch (error) {
      if (searchRequest.current !== controller || controller.signal.aborted)
        return
      setRouteError(
        error instanceof Error
          ? error.message
          : "Não foi possível pesquisar este endereço.",
      )
    } finally {
      if (searchRequest.current === controller) {
        searchRequest.current = null
        setSearching(false)
      }
    }
  }

  function newRoute() {
    setDestination(null)
    setWaypoints([])
    setStreetRoute(null)
    setRouteAlternatives([])
    setSelectedRouteIndex(0)
    setRouteError("")
    setQuery("")
    setSearchResults([])
    setElapsed(0)
    setTriggeredPotholes(new Set())
    setHasRecalculated(false)
    go("map")
  }

  // Filter city places by category
  const filteredCityPlaces =
    selectedCategory === "Todos"
      ? cityPlaces
      : cityPlaces.filter((p) =>
          p.category.toLowerCase().includes(selectedCategory.toLowerCase()),
        )

  return (
    <div className={`app screen-${screen} ${isAuth ? "auth-app" : ""}`}>
      {/* App Header */}
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
            : user
              ? `Olá, ${user.name.split(" ")[0]} · Prado Ferreira`
              : "Prado Ferreira · Paraná"}
        </div>
        <span className="prototype-badge">PROTÓTIPO INTERATIVO</span>
        {!isAuth && (
          <button
            className="profile"
            aria-label={
              user ? `Conta de ${user.name}` : "Voltar à tela inicial"
            }
            title={
              user
                ? `${user.name} (${user.email}) - Clique para sair`
                : "Voltar ao início"
            }
            onClick={() => {
              if (user) {
                if (window.confirm(`Deseja sair da conta ${user.name}?`)) {
                  handleLogout()
                }
              } else {
                go("welcome")
              }
            }}
          >
            <span>{user ? user.name.charAt(0).toUpperCase() : "V"}</span>
            <Icon name="exit" size={17} />
          </button>
        )}
      </header>

      {/* Auth Layout: Welcome, Login, Register, Location */}
      {isAuth ? (
        <main className="auth-layout">
          <section className="brand-panel">
            <div className="brand-panel-top">
              <span className="little-label">
                MENOS COMPLICAÇÃO. MAIS CAMINHO.
              </span>
              <span className="edition">02 / SPRINT 2</span>
            </div>
            <div className="brand-message">
              <Logo light />
              <h1>
                {screen === "location"
                  ? "Sua posição."
                  : screen === "login"
                    ? "Acesse sua conta."
                    : screen === "register"
                      ? "Crie seu perfil."
                      : "Seu caminho"}
                <br />
                {screen === "location" ? (
                  <>
                    Seu ponto de <span>partida.</span>
                  </>
                ) : screen === "login" ? (
                  <>
                    Bem-vindo de <span>volta.</span>
                  </>
                ) : screen === "register" ? (
                  <>
                    Navegue <span>conosco.</span>
                  </>
                ) : (
                  <>
                    começa na <span>Vya.</span>
                  </>
                )}
              </h1>
              <p>
                {screen === "location"
                  ? "Encontre sua posição e comece a explorar."
                  : screen === "login"
                    ? "Acesse seus destinos salvos, atalhos de Casa e Trabalho."
                    : screen === "register"
                      ? "Cadastre-se para personalizar seus trajetos e evitar pedágios."
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
            {/* Step 1: Login Screen */}
            {screen === "login" && (
              <div className="auth-card auth-card-login">
                <span className="form-icon">
                  <Icon name="user" size={28} />
                </span>
                <div className="eyebrow">ACESSO À CONTA</div>
                <h2>Bem-vindo de volta</h2>
                <p className="form-intro">
                  Entre com suas credenciais ou continue com sua conta Google.
                </p>

                <form className="auth-form" onSubmit={handleLogin}>
                  <div>
                    <label htmlFor="login-email">E-mail</label>
                    <div className="input-wrap">
                      <Icon name="mail" size={18} />
                      <input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password">Senha</label>
                    <div className="input-wrap">
                      <Icon name="lock" size={18} />
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label={
                          showLoginPassword ? "Ocultar senha" : "Ver senha"
                        }
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <p className="error" role="alert">
                      {loginError}
                    </p>
                  )}

                  <button type="submit" className="primary">
                    Entrar na Vya <Icon name="arrow" size={18} />
                  </button>
                </form>

                <div className="auth-divider">
                  <span>ou continue com</span>
                </div>

                <button
                  type="button"
                  className="secondary google-login-btn"
                  onClick={handleGoogleLogin}
                >
                  <Icon name="google" size={20} />
                  <span>Continuar com o Google</span>
                </button>

                <div className="auth-switch">
                  <span>Não tem uma conta?</span>
                  <button type="button" onClick={() => go("register")}>
                    Cadastre-se
                  </button>
                </div>

                <button
                  type="button"
                  className="secondary guest-btn"
                  onClick={() => go("location")}
                >
                  Entrar sem conta <Icon name="arrow" size={16} />
                </button>
              </div>
            )}

            {/* Step 2: Register Screen */}
            {screen === "register" && (
              <div className="auth-card auth-card-register">
                <span className="form-icon">
                  <Icon name="user" size={28} />
                </span>
                <div className="eyebrow">CRIAR NOVA CONTA</div>
                <h2>Comece sua jornada</h2>
                <p className="form-intro">
                  Cadastre-se para salvar seus atalhos de Casa, Trabalho e
                  rotas.
                </p>

                <form className="auth-form" onSubmit={handleRegister}>
                  <div>
                    <label htmlFor="reg-name">Nome completo</label>
                    <div className="input-wrap">
                      <Icon name="user" size={18} />
                      <input
                        id="reg-name"
                        type="text"
                        placeholder="Como prefere ser chamado"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-email">E-mail</label>
                    <div className="input-wrap">
                      <Icon name="mail" size={18} />
                      <input
                        id="reg-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password">Senha</label>
                    <div className="input-wrap">
                      <Icon name="lock" size={18} />
                      <input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((v) => !v)}
                        aria-label={
                          showRegPassword ? "Ocultar senha" : "Ver senha"
                        }
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </div>

                  {regError && (
                    <p className="error" role="alert">
                      {regError}
                    </p>
                  )}

                  <button type="submit" className="primary">
                    Criar minha conta <Icon name="arrow" size={18} />
                  </button>
                </form>

                <div className="auth-divider">
                  <span>ou continue com</span>
                </div>

                <button
                  type="button"
                  className="secondary google-login-btn"
                  onClick={handleGoogleLogin}
                >
                  <Icon name="google" size={20} />
                  <span>Continuar com o Google</span>
                </button>

                <div className="auth-switch">
                  <span>Já tem uma conta?</span>
                  <button type="button" onClick={() => go("login")}>
                    Entrar
                  </button>
                </div>

                <button
                  type="button"
                  className="secondary guest-btn"
                  onClick={() => go("location")}
                >
                  Entrar sem conta <Icon name="arrow" size={16} />
                </button>
              </div>
            )}

            {/* Step 3: Location Screen */}
            {screen === "location" && (
              <div className="auth-card auth-card-location">
                <span className="form-icon">
                  <Icon name="locate" size={28} />
                </span>
                <div className="eyebrow">UM PONTO DE PARTIDA</div>
                <h2>
                  Onde começa
                  <br />o seu caminho?
                </h2>
                <p className="form-intro">
                  Permita o acesso ao GPS do seu dispositivo para começar. Você
                  também pode explorar com uma posição fictícia no centro.
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
                    ? "Buscando sinal do GPS…"
                    : "Ativar e permitir GPS"}
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
                    : "Usar localização simulada"}
                  <Icon name="arrow" size={19} />
                </button>
                <p className="privacy-note">
                  <Icon name="shield" size={16} />
                  Sua localização é utilizada apenas localmente no navegador.
                </p>
              </div>
            )}

            {/* Step 4: Welcome Screen */}
            {screen === "welcome" && (
              <div className="auth-card auth-card-welcome">
                <span className="form-icon">
                  <Icon name="road" size={28} />
                </span>
                <div className="eyebrow">BEM-VINDO AO VYA</div>
                <h2>
                  Pronto para
                  <br />
                  seguir caminho?
                </h2>
                <p className="form-intro">
                  Explore ruas, comércios e trace rotas inteligentes com alertas
                  da comunidade e estimativas de pedágio.
                </p>

                <button className="primary" onClick={() => go("location")}>
                  Começar agora <Icon name="arrow" size={20} />
                </button>

                <div
                  className="auth-actions-row"
                  style={{ display: "flex", gap: "10px", marginTop: "12px" }}
                >
                  <button
                    className="secondary"
                    style={{ flex: 1 }}
                    onClick={() => go("login")}
                  >
                    Já tenho conta
                  </button>
                  <button
                    className="secondary"
                    style={{ flex: 1 }}
                    onClick={() => go("register")}
                  >
                    Criar conta
                  </button>
                </div>

                <div className="guest-benefits">
                  <div>
                    <Icon name="check" size={16} />
                    Até 3 rotas alternativas com identificação da mais rápida
                  </div>
                  <div>
                    <Icon name="check" size={16} />
                    Atalhos inteligentes para Casa e Trabalho
                  </div>
                  <div>
                    <Icon name="check" size={16} />
                    Adicione paradas e evite pedágios ou estradas de terra
                  </div>
                  <div>
                    <Icon name="check" size={16} />
                    Reporte acidentes, obras e receba avisos de buracos
                  </div>
                </div>

                <div className="demo-banner">
                  <Icon name="shield" size={18} />
                  <p>
                    <strong>Cartografia real de Prado Ferreira.</strong>
                    Navegação passo a passo simulada para prototipagem rápida.
                  </p>
                </div>
              </div>
            )}

            <footer className="auth-footer">
              <span>© 2026 Vya</span>
              <span>Seu caminho, do seu jeito.</span>
            </footer>
          </section>
        </main>
      ) : (
        /* Navigation & Map Layout */
        <main className="navigation-layout">
          <aside className="trip-sidebar">
            <div className="trip-heading">
              <span className="eyebrow">
                {screen === "finish"
                  ? "DESTINO ALCANÇADO"
                  : screen === "navigation"
                    ? "SIGA A VYA"
                    : screen === "route"
                      ? "DETALHES DO TRAJETO"
                      : "PARA ONDE VAMOS?"}
              </span>
              <h1>
                {screen === "finish"
                  ? "Você chegou!"
                  : screen === "navigation"
                    ? "Vamos nessa."
                    : screen === "route"
                      ? "Escolha seu caminho"
                      : "Encontre seu destino"}
              </h1>
              <p>
                {screen === "map"
                  ? "Busque um endereço, use os atalhos ou toque no mapa."
                  : screen === "route"
                    ? "Compare as rotas disponíveis e personalize suas preferências."
                    : screen === "finish"
                      ? "Todo bom caminho merece uma boa chegada."
                      : "Acompanhe as instruções e alertas no mapa."}
              </p>
            </div>

            {/* Map screen notifications */}
            {screen === "map" && routeLoading && (
              <p className="notice" role="status">
                Calculando até 3 rotas pelas ruas de Prado Ferreira…
              </p>
            )}
            {screen === "map" && routeError && (
              <p className="notice" role="alert">
                {routeError}
              </p>
            )}

            {/* Map Screen controls */}
            {screen === "map" && (
              <>
                {/* Search Bar */}
                <form className="search-bar" onSubmit={search}>
                  <Icon name="search" size={20} />
                  <input
                    aria-label="Buscar destino"
                    placeholder="Busque uma rua, praça ou comércio"
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

                {searching && (
                  <p className="search-status" role="status">
                    Buscando ruas em Prado Ferreira…
                  </p>
                )}

                {/* Search results list */}
                {searchResults.length > 0 && (
                  <div
                    className="search-results"
                    aria-label="Resultados da busca"
                  >
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

                {/* Casa / Trabalho Shortcuts */}
                <div
                  className="shortcuts-container"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    margin: "18px 0 14px",
                  }}
                >
                  <button
                    type="button"
                    className="shortcut-button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "white",
                      border: "1px solid var(--border)",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      textAlign: "left",
                      color: "var(--night)",
                    }}
                    onClick={() => {
                      if (homePlace) choose(homePlace)
                      else setShortcutModalType("home")
                    }}
                  >
                    <span
                      style={{
                        padding: "8px",
                        background: "#f1eeff",
                        color: "var(--purple)",
                        borderRadius: "10px",
                        display: "flex",
                      }}
                    >
                      <Icon name="home" size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: "11px" }}>
                        Casa
                      </strong>
                      <small
                        style={{
                          display: "block",
                          color: "var(--muted)",
                          fontSize: "9px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {homePlace
                          ? homePlace.name.split(" · ")[0]
                          : "Definir endereço"}
                      </small>
                    </div>
                    {homePlace && (
                      <span
                        role="button"
                        tabIndex={0}
                        style={{ color: "var(--muted)", padding: "2px" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShortcutModalType("home")
                        }}
                        title="Editar Casa"
                      >
                        <Icon name="edit" size={14} />
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="shortcut-button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "white",
                      border: "1px solid var(--border)",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      textAlign: "left",
                      color: "var(--night)",
                    }}
                    onClick={() => {
                      if (workPlace) choose(workPlace)
                      else setShortcutModalType("work")
                    }}
                  >
                    <span
                      style={{
                        padding: "8px",
                        background: "#eaf9d3",
                        color: "#5b8a05",
                        borderRadius: "10px",
                        display: "flex",
                      }}
                    >
                      <Icon name="briefcase" size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: "11px" }}>
                        Trabalho
                      </strong>
                      <small
                        style={{
                          display: "block",
                          color: "var(--muted)",
                          fontSize: "9px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {workPlace
                          ? workPlace.name.split(" · ")[0]
                          : "Definir endereço"}
                      </small>
                    </div>
                    {workPlace && (
                      <span
                        role="button"
                        tabIndex={0}
                        style={{ color: "var(--muted)", padding: "2px" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShortcutModalType("work")
                        }}
                        title="Editar Trabalho"
                      >
                        <Icon name="edit" size={14} />
                      </span>
                    )}
                  </button>
                </div>

                {/* Origin Location Display */}
                <div className="origin-row">
                  <span className="origin-dot" />
                  <div>
                    <strong>Sua localização</strong>
                    <small>{originLabel}</small>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      color: "var(--purple)",
                      padding: "4px",
                    }}
                    onClick={requestLocation}
                    title="Atualizar GPS"
                  >
                    <Icon name="locate" size={18} />
                  </button>
                </div>

                {/* Category Filter Chips */}
                <div
                  className="category-filter-section"
                  style={{ margin: "16px 0 10px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      overflowX: "auto",
                      paddingBottom: "8px",
                      scrollbarWidth: "none",
                    }}
                  >
                    {CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`category-chip ${
                            isActive ? "active" : ""
                          }`}
                          style={{
                            padding: "7px 13px",
                            borderRadius: "20px",
                            fontSize: "10px",
                            fontWeight: 650,
                            whiteSpace: "nowrap",
                            background: isActive ? "var(--purple)" : "white",
                            color: isActive ? "white" : "var(--night)",
                            border: `1px solid ${
                              isActive ? "var(--purple)" : "var(--border)"
                            }`,
                            boxShadow: "0 2px 6px #14112e06",
                          }}
                          onClick={() =>
                            setSelectedCategory(
                              selectedCategory === cat ? "Todos" : cat,
                            )
                          }
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Places list title */}
                <div className="section-title">
                  Locais em Prado Ferreira
                  <span>{filteredCityPlaces.length} destinos</span>
                </div>

                {/* Places list */}
                <div className="places-list">
                  {(showAllPlaces
                    ? filteredCityPlaces
                    : filteredCityPlaces.slice(0, 10)
                  ).map((p, i) => (
                    <button key={p.name} onClick={() => choose(p)}>
                      <span className={`place-icon place-${i}`}>
                        {i < verifiedPlaces.length ? (
                          i + 1
                        ) : (
                          <Icon name="pin" size={16} />
                        )}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.address} · {p.category}
                        </small>
                      </div>
                      <Icon name="arrow" size={17} />
                    </button>
                  ))}
                </div>

                {filteredCityPlaces.length > 10 && (
                  <button
                    className="show-more-places"
                    onClick={() => setShowAllPlaces((value) => !value)}
                  >
                    {showAllPlaces
                      ? "Mostrar menos locais"
                      : `Ver todos os ${filteredCityPlaces.length} locais`}
                  </button>
                )}

                <div className="simulation-note">
                  <Icon name="shield" size={17} />
                  <p>
                    Rotas reais OSRM com alternativas inteligentes, suporte a
                    paradas e alertas da comunidade.
                  </p>
                </div>
              </>
            )}

            {/* Route & Navigation Screen */}
            {(screen === "route" || screen === "navigation") && destination && (
              <>
                {/* Destination & Waypoints Card */}
                <div className="destination-card">
                  <span className="origin-dot" />
                  <div>
                    <small>SAINDO DE</small>
                    <strong>{originPoint.name}</strong>
                  </div>

                  {/* Waypoint Stops */}
                  {waypoints.map((wp, idx) => (
                    <div
                      key={`waypoint-${idx}`}
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "#f0f4ff",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid #dbe6fe",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "#3b82f6",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <small style={{ fontSize: "8px", color: "#3b82f6" }}>
                          PARADA {idx + 1}
                        </small>
                        <strong
                          style={{
                            display: "block",
                            fontSize: "11px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {wp.name}
                        </strong>
                      </div>
                      {screen === "route" && (
                        <button
                          type="button"
                          style={{
                            background: "none",
                            color: "#ef4444",
                            padding: "4px",
                          }}
                          onClick={() => removeWaypoint(idx)}
                          title="Remover parada"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </div>
                  ))}

                  <span className="destination-connector" />
                  <Icon name="pin" size={21} />
                  <div>
                    <small>CHEGANDO EM</small>
                    <strong>{destination.name}</strong>
                  </div>

                  {/* Add Stop Button (Route Screen Only) */}
                  {screen === "route" && waypoints.length < 2 && (
                    <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                      <button
                        type="button"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          padding: "9px",
                          borderRadius: "10px",
                          background: "white",
                          border: "1px dashed var(--purple)",
                          color: "var(--purple)",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                        onClick={() => setShowAddStopModal(true)}
                      >
                        <Icon name="plus" size={15} /> Adicionar parada
                        intermediária ({waypoints.length}/2)
                      </button>
                    </div>
                  )}
                </div>

                {/* Turn Instruction Card during navigation */}
                {screen === "navigation" && (
                  <div className={`turn-card ${paused ? "paused" : ""}`}>
                    <Icon
                      name={currentStep?.maneuver === "turn" ? "turn" : "arrow"}
                      size={32}
                    />
                    <div>
                      <small>
                        {paused
                          ? "Navegação pausada"
                          : currentStep?.instruction || "Siga a rota destacada"}
                      </small>
                      <strong>{currentStreet}</strong>
                    </div>
                    <span className="live-speed">
                      {simulatedSpeed}
                      <small>km/h</small>
                    </span>
                  </div>
                )}

                {/* Route Alternatives Selection (Up to 3 routes) on Route Screen */}
                {screen === "route" && (
                  <div
                    className="route-selection-section"
                    style={{ margin: "20px 0 16px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <strong
                        style={{ fontSize: "11px", color: "var(--night)" }}
                      >
                        Opções de trajeto
                      </strong>
                      <span style={{ fontSize: "9px", color: "var(--muted)" }}>
                        {routeAlternatives.length} rotas disponíveis
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "9px",
                      }}
                    >
                      {routeAlternatives.map((alt, idx) => {
                        const isSelected = selectedRouteIndex === idx
                        const altDurationMin = Math.max(
                          1,
                          Math.ceil(alt.durationSeconds / 60),
                        )
                        const altDistKm = (alt.distanceMeters / 1000)
                          .toFixed(1)
                          .replace(".", ",")
                        return (
                          <button
                            key={alt.id || idx}
                            type="button"
                            className={`route-card ${
                              isSelected ? "selected" : ""
                            }`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 14px",
                              borderRadius: "14px",
                              border: isSelected
                                ? "2px solid var(--purple)"
                                : "1px solid var(--border)",
                              background: isSelected ? "#f6f4ff" : "white",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                            }}
                            onClick={() => selectAlternativeRoute(idx)}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginBottom: "4px",
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: "12px",
                                    color: isSelected
                                      ? "var(--purple)"
                                      : "var(--night)",
                                  }}
                                >
                                  {alt.name}
                                </strong>
                                {alt.isFastest && (
                                  <span
                                    className="fast-badge"
                                    style={{
                                      background: "var(--lime)",
                                      color: "var(--night)",
                                      fontSize: "8px",
                                      fontWeight: 800,
                                      padding: "3px 7px",
                                      borderRadius: "6px",
                                    }}
                                  >
                                    MAIS RÁPIDA
                                  </span>
                                )}
                              </div>
                              <small
                                style={{
                                  fontSize: "9px",
                                  color: "var(--muted)",
                                  display: "block",
                                }}
                              >
                                {alt.summary || alt.destinationStreet}
                              </small>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <strong
                                style={{
                                  fontSize: "14px",
                                  color: "var(--night)",
                                  display: "block",
                                }}
                              >
                                {altDurationMin} min
                              </strong>
                              <small
                                style={{
                                  fontSize: "9px",
                                  color: "var(--muted)",
                                }}
                              >
                                {altDistKm} km
                              </small>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Avoid Tolls & Dirt Roads Toggles on Route Screen */}
                {screen === "route" && (
                  <div
                    className="route-preferences-card"
                    style={{
                      background: "white",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      padding: "12px 14px",
                      margin: "12px 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Icon name="toll" size={17} />
                        Evitar pedágios
                      </span>
                      <input
                        type="checkbox"
                        checked={avoidTolls}
                        onChange={(e) =>
                          handleToggleAvoidTolls(e.target.checked)
                        }
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "var(--purple)",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        borderTop: "1px solid #f1f0f7",
                        paddingTop: "8px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Icon name="road" size={17} />
                        Evitar estradas de terra
                      </span>
                      <input
                        type="checkbox"
                        checked={avoidUnpaved}
                        onChange={(e) =>
                          handleToggleAvoidUnpaved(e.target.checked)
                        }
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "var(--purple)",
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Toll Information Summary Card */}
                <div
                  className="toll-info-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: avoidTolls
                      ? "#f5fdf0"
                      : distance > 5
                        ? "#fff8f0"
                        : "#fbfafd",
                    border: `1px solid ${
                      avoidTolls
                        ? "#c3e8ad"
                        : distance > 5
                          ? "#fed7aa"
                          : "var(--border)"
                    }`,
                    borderRadius: "12px",
                    padding: "10px 14px",
                    margin: "12px 0 16px",
                  }}
                >
                  <Icon name="toll" size={19} />
                  <div>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: avoidTolls
                          ? "#2d6a13"
                          : distance > 5
                            ? "#9a3412"
                            : "var(--night)",
                      }}
                    >
                      {avoidTolls
                        ? "Pedágios evitados · R$ 0,00"
                        : distance > 5
                          ? "1 pedágio estimado · R$ 5,80"
                          : "Sem pedágios nesta rota"}
                    </strong>
                    <small style={{ fontSize: "9px", color: "var(--muted)" }}>
                      {avoidTolls
                        ? "Caminho traçado pelas vias sem cobrança de tarifa"
                        : distance > 5
                          ? "Trecho perimetral estadual com praça tarifada"
                          : "Trajeto urbano livre de pedágio"}
                    </small>
                  </div>
                </div>

                {/* Trip Stats */}
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

                {/* Navigation Progress */}
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
                      Simulação fluida em 2× · atualizações de rota dinâmicas
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <button
                  className="primary"
                  onClick={() => {
                    if (screen === "route") {
                      setElapsed(0)
                      setPaused(false)
                      setZoom(2.5)
                      setTriggeredPotholes(new Set())
                      setHasRecalculated(false)
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
                  Navegação simulada para protótipo. Não use dirigindo.
                </p>
              </>
            )}

            {/* Finish Screen */}
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
                  concluído com sucesso. Aproveite o destino!
                </p>
                <div className="finish-stats">
                  <div>
                    <Icon name="road" />
                    <strong>{distance.toFixed(1).replace(".", ",")} km</strong>
                    <small>Percorridos</small>
                  </div>
                  <div>
                    <Icon name="clock" />
                    <strong>{duration} min</strong>
                    <small>Tempo simulado</small>
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

          {/* Map Section */}
          <section className={`map-section ${mapExpanded ? "expanded" : ""}`}>
            <MapCanvas
              destination={screen === "map" ? null : destination}
              waypoints={waypoints}
              progress={
                screen === "finish" ? 1 : screen === "navigation" ? progress : 0
              }
              interactive={screen === "map"}
              onPick={choose}
              origin={originPoint}
              places={filteredCityPlaces}
              streets={streets}
              followRoute={screen === "navigation"}
              streetRoute={streetRoute}
              routeAlternatives={routeAlternatives}
              selectedRouteIndex={selectedRouteIndex}
              trafficReports={trafficReports}
              zoom={zoom}
            />

            {/* Map Controls */}
            <div className="map-controls" aria-label="Controles do mapa">
              <button
                aria-label="Aproximar mapa"
                disabled={zoom >= 4}
                onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
              >
                +
              </button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Afastar mapa"
                disabled={zoom <= 1}
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              >
                −
              </button>
              <button
                className="map-overview"
                onClick={() => setZoom(1)}
                aria-label="Mostrar cidade inteira"
              >
                <Icon name="locate" size={19} />
              </button>
              <button
                className="map-expand"
                onClick={() => setMapExpanded((v) => !v)}
              >
                {mapExpanded ? "Fechar" : "Ampliar"}
              </button>
            </div>

            {/* Top Status Tag */}
            <div className="map-top-tag">
              <span className="status-dot" />
              {screen === "navigation" ? currentStreet : "Prado Ferreira–PR"}
              <span>
                {screen === "navigation"
                  ? `${simulatedSpeed} KM/H`
                  : mapDataStatus}
              </span>
            </div>

            {/* Interactive hint on map screen */}
            {screen === "map" && (
              <div className="map-instruction">
                <Icon name="pin" size={18} />
                Toque em qualquer ponto · arraste para explorar
              </div>
            )}

            {/* Floating Report Button during Navigation */}
            {screen === "navigation" && (
              <button
                className="floating-report-btn"
                style={{
                  position: "absolute",
                  bottom: "35px",
                  right: "20px",
                  background: "var(--purple)",
                  color: "white",
                  padding: "12px 18px",
                  borderRadius: "25px",
                  boxShadow: "0 8px 25px rgba(91, 75, 255, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  zIndex: 10,
                }}
                onClick={() => setShowReportModal(true)}
              >
                <Icon name="warning" size={18} />
                Reportar
              </button>
            )}

            {/* Pothole Warning Toast */}
            {potholeWarning && (
              <div
                className="pothole-toast"
                style={{
                  position: "absolute",
                  top: "75px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#ff9800",
                  color: "white",
                  padding: "12px 20px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 700,
                  boxShadow: "0 10px 30px rgba(255, 152, 0, 0.4)",
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                {potholeWarning}
              </div>
            )}

            {/* Recalculating Banner */}
            {recalcBanner && (
              <div
                className="recalc-banner"
                style={{
                  position: "absolute",
                  top: "25px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background:
                    recalcBanner === "recalculating"
                      ? "var(--night)"
                      : "#10b981",
                  color: "white",
                  padding: "11px 22px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 700,
                  boxShadow: "0 10px 30px rgba(20, 17, 46, 0.35)",
                  zIndex: 25,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {recalcBanner === "recalculating"
                  ? "🔄 Desvio detectado. Recalculando rota…"
                  : "✓ Rota recalculada em 2.1s"}
              </div>
            )}

            {/* Report Feedback Toast */}
            {reportSuccessToast && (
              <div
                className="report-feedback-toast"
                style={{
                  position: "absolute",
                  bottom: "95px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#10b981",
                  color: "white",
                  padding: "10px 18px",
                  borderRadius: "16px",
                  fontSize: "11px",
                  fontWeight: 700,
                  boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
                  zIndex: 20,
                  whiteSpace: "nowrap",
                }}
              >
                {reportSuccessToast}
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
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap contributors
              </a>
            </div>
          </section>
        </main>
      )}

      {/* MODAL 1: GPS Off / Denied Modal with Step-by-Step Instructions */}
      {showGpsModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 17, 46, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "28px 24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(20, 17, 46, 0.2)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "#fee2e2",
                color: "#ef4444",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Icon name="locate" size={26} />
            </div>

            <h3
              style={{
                fontSize: "20px",
                fontWeight: 750,
                textAlign: "center",
                margin: "0 0 10px",
                color: "var(--night)",
              }}
            >
              Ativar GPS no dispositivo
            </h3>
            <p
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                textAlign: "center",
                lineHeight: "1.6",
                margin: "0 0 20px",
              }}
            >
              Para traçar rotas exatas a partir do seu ponto atual, siga o passo
              a passo abaixo:
            </p>

            <ol
              style={{
                fontSize: "11px",
                color: "var(--night)",
                lineHeight: "1.7",
                paddingLeft: "20px",
                margin: "0 0 24px",
              }}
            >
              <li>
                <strong>Verifique o GPS:</strong> Ative a Localização nas
                configurações rápidas do seu aparelho (Android, iOS ou Windows).
              </li>
              <li>
                <strong>Permissão no navegador:</strong> Toque no ícone de
                cadeado ou ajustes ao lado do endereço do site.
              </li>
              <li>
                <strong>Permita a Localização:</strong> Altere a permissão de
                Localização para <em>"Permitir"</em>.
              </li>
              <li>
                <strong>Tente novamente:</strong> Clique no botão abaixo para
                revalidar o sinal do GPS.
              </li>
            </ol>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <button
                type="button"
                className="primary"
                onClick={() => {
                  requestLocation()
                }}
              >
                Tentar novamente <Icon name="locate" size={18} />
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setShowGpsModal(false)
                  go("map")
                }}
              >
                Usar localização simulada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Waypoint Stop Modal */}
      {showAddStopModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 17, 46, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "26px 22px",
              maxWidth: "400px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 750,
                  margin: 0,
                  color: "var(--night)",
                }}
              >
                Adicionar Parada ({waypoints.length + 1} de 2)
              </h3>
              <button
                type="button"
                style={{
                  background: "none",
                  color: "var(--muted)",
                  padding: "4px",
                }}
                onClick={() => setShowAddStopModal(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar locais de parada…"
              value={stopQuery}
              onChange={(e) => setStopQuery(e.target.value)}
              style={{
                border: "1px solid var(--border)",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "11px",
                marginBottom: "14px",
              }}
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {cityPlaces
                .filter(
                  (p) =>
                    !stopQuery.trim() ||
                    p.name.toLowerCase().includes(stopQuery.toLowerCase()) ||
                    p.category.toLowerCase().includes(stopQuery.toLowerCase()),
                )
                .slice(0, 12)
                .map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#f9f8fc",
                      border: "1px solid var(--border)",
                      textAlign: "left",
                    }}
                    onClick={() => addWaypoint(place)}
                  >
                    <div>
                      <strong
                        style={{ fontSize: "11px", color: "var(--night)" }}
                      >
                        {place.name}
                      </strong>
                      <small
                        style={{
                          display: "block",
                          fontSize: "9px",
                          color: "var(--muted)",
                        }}
                      >
                        {place.address} · {place.category}
                      </small>
                    </div>
                    <Icon name="plus" size={16} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Set Casa / Trabalho Shortcut Modal */}
      {shortcutModalType && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 17, 46, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "26px 22px",
              maxWidth: "400px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 750,
                  margin: 0,
                  color: "var(--night)",
                }}
              >
                Definir {shortcutModalType === "home" ? "Casa" : "Trabalho"}
              </h3>
              <button
                type="button"
                style={{
                  background: "none",
                  color: "var(--muted)",
                  padding: "4px",
                }}
                onClick={() => setShortcutModalType(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                margin: "0 0 12px",
              }}
            >
              Selecione um ponto frequente ou digite o endereço:
            </p>

            <input
              type="text"
              placeholder="Digite o nome do local ou rua…"
              value={shortcutInputName}
              onChange={(e) => setShortcutInputName(e.target.value)}
              style={{
                border: "1px solid var(--border)",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "11px",
                marginBottom: "12px",
              }}
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {cityPlaces
                .filter(
                  (p) =>
                    !shortcutInputName.trim() ||
                    p.name
                      .toLowerCase()
                      .includes(shortcutInputName.toLowerCase()) ||
                    p.address
                      .toLowerCase()
                      .includes(shortcutInputName.toLowerCase()),
                )
                .slice(0, 8)
                .map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#f9f8fc",
                      border: "1px solid var(--border)",
                      textAlign: "left",
                    }}
                    onClick={() => saveShortcut(place)}
                  >
                    <div>
                      <strong
                        style={{ fontSize: "11px", color: "var(--night)" }}
                      >
                        {place.name}
                      </strong>
                      <small
                        style={{
                          display: "block",
                          fontSize: "9px",
                          color: "var(--muted)",
                        }}
                      >
                        {place.address}
                      </small>
                    </div>
                    <Icon name="check" size={16} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Report Traffic / Incident Modal */}
      {showReportModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 17, 46, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "26px 22px",
              maxWidth: "380px",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    color: "var(--purple)",
                  }}
                >
                  COLABORAÇÃO EM TEMPO REAL
                </span>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: 750,
                    margin: "4px 0 0",
                    color: "var(--night)",
                  }}
                >
                  Reportar no caminho
                </h3>
              </div>
              <button
                type="button"
                style={{
                  background: "none",
                  color: "var(--muted)",
                  padding: "4px",
                }}
                onClick={() => setShowReportModal(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                margin: "0 0 18px",
              }}
            >
              Selecione o tipo de evento detectado para alertar outros
              motoristas:
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 12px",
                  borderRadius: "16px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                }}
                onClick={() => createTrafficReport("accident", "Acidente")}
              >
                <span style={{ fontSize: "24px" }}>🚨</span>
                <strong style={{ fontSize: "12px" }}>Acidente</strong>
              </button>

              <button
                type="button"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 12px",
                  borderRadius: "16px",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                }}
                onClick={() => createTrafficReport("construction", "Obras")}
              >
                <span style={{ fontSize: "24px" }}>🚧</span>
                <strong style={{ fontSize: "12px" }}>Obras</strong>
              </button>

              <button
                type="button"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 12px",
                  borderRadius: "16px",
                  background: "#ffedd5",
                  color: "#9a3412",
                  border: "1px solid #fed7aa",
                }}
                onClick={() => createTrafficReport("pothole", "Buraco")}
              >
                <span style={{ fontSize: "24px" }}>⚠️</span>
                <strong style={{ fontSize: "12px" }}>Buraco</strong>
              </button>

              <button
                type="button"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 12px",
                  borderRadius: "16px",
                  background: "#f3e8ff",
                  color: "#6b21a8",
                  border: "1px solid #e9d5ff",
                }}
                onClick={() =>
                  createTrafficReport("closure", "Via interditada")
                }
              >
                <span style={{ fontSize: "24px" }}>⛔</span>
                <strong style={{ fontSize: "12px" }}>Via interditada</strong>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
