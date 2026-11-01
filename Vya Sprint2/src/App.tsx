import { useEffect, useMemo, useRef, useState } from "react"
import pradoMap from "./prado-map.json"
import "./transport.css"
import "./sprint2.css"
import "./mobile.css"
import {
  calculateRouteAlternatives,
  calculateStreetRoute,
  pickBestRoute,
  routeNotes,
  getTransport,
  loadPradoMapData,
  pointAlongRoute,
  projectOnRoute,
  searchPradoPlaces,
  TRANSPORT_MODES,
  type MapPlace,
  type MapPoint,
  type SearchPlace,
  type StreetFeature,
  type StreetRoute,
  type TollBooth,
  type TransportMode,
} from "./routing"

type Screen =
  | "launcher"   // tela inicial do celular (antes de abrir o Vya)
  | "welcome"
  | "login"
  | "signup"
  | "location"
  // --- app (mobile) ---
  | "map"        // início: mapa em tela cheia + "Para onde vamos?"
  | "search"     // tela "Para onde?" (busca de destino)
  | "route"      // prévia da rota + tipos de locomoção
  | "stops"      // editar paradas
  | "saved"      // locais salvos (Casa, Trabalho, Favoritos)
  | "setPlace"   // definir Casa ou Trabalho
  | "mapPick"    // escolher um ponto no mapa
  | "prefs"      // opções de rota
  | "navigation"
  | "finish"
type Point = {
  x: number
  y: number
  name: string
  // linha de apoio (ex.: o endereço de "Casa" / "Trabalho")
  detail?: string
}
type RouteOptionsState = {
  mode: TransportMode
  stops: Point[]
  avoidTolls: boolean
  avoidUnpaved: boolean
  avoidPotholes: boolean
  avoidTraffic: boolean
}
// Tipos de rota que o usuário pode combinar
type RouteTypeKey = "avoidTraffic" | "avoidTolls" | "avoidPotholes" | "avoidUnpaved"
const ROUTE_TYPES: { key: RouteTypeKey; label: string; icon: string; hint: string }[] = [
  { key: "avoidTraffic", label: "Menos trânsito", icon: "traffic", hint: "Foge dos trechos congestionados" },
  { key: "avoidTolls", label: "Sem pedágio", icon: "toll", hint: "Procura um caminho sem cobrança" },
  { key: "avoidPotholes", label: "Sem buracos", icon: "pothole", hint: "Desvia das ruas com buracos" },
  { key: "avoidUnpaved", label: "Sem terra", icon: "dirt", hint: "Prefere vias pavimentadas" },
]
type HazardKind = "accident" | "works" | "pothole" | "traffic"
type Hazard = {
  id: string
  kind: HazardKind
  point: MapPoint
}
type Favorite = Point
type StoredProfile = {
  name: string
  provider: "email" | "google"
  shortcuts: Shortcuts
  favorites: Favorite[]
  recents?: Point[]
}
type User = { name: string; email: string; provider: "email" | "google" }
type ShortcutKey = "home" | "work"
type Shortcuts = Partial<Record<ShortcutKey, Point>>
type Recalc =
  | { status: "running" }
  | { status: "done"; seconds: number }
  | { status: "error" }
// Para que serve o ponto escolhido na tela "Escolher no mapa"
type PickTarget =
  | { kind: "destination" }
  | { kind: "shortcut"; key: ShortcutKey }
  | { kind: "stop" }
type Suggestion = {
  id: string
  point: Point
  title: string
  subtitle: string
  icon: string
  disabled?: boolean
}
type MapMode = "explore" | "fit" | "follow"

const defaultOrigin: Point = { x: 500, y: 420, name: "Centro de Prado Ferreira" }
const verifiedPlaces: MapPlace[] = pradoMap.places.map((place, index) => ({
  ...place,
  id: `verified-${index}`,
  category: place.address.split(" · ")[1] || "Ponto de referência",
}))
// Área coberta pelas imagens do mapa e limites de zoom
const TILE_BOUNDS = {
  minX: Math.min(...pradoMap.tiles.map((tile) => tile.x)),
  maxX: Math.max(...pradoMap.tiles.map((tile) => tile.x)) + 256,
  minY: Math.min(...pradoMap.tiles.map((tile) => tile.y)),
  maxY: Math.max(...pradoMap.tiles.map((tile) => tile.y)) + 256,
}
const MIN_ZOOM = 0.7
const MAX_ZOOM = 4
const verifiedIndex = new Map(verifiedPlaces.map((place, index) => [place.id, index]))

// Ruas de Prado Ferreira (nomes e posições tirados do próprio mapa do projeto).
// Garantem que a busca por rua funcione mesmo se o serviço online de ruas falhar.
type StreetEntry = { id: string; name: string; x: number; y: number; aliases?: string[] }
const STREET_INDEX: StreetEntry[] = [
  ["Rua Sergipe", 483, 228], ["Rua Bariri", 464, 253], ["Rua Amazonas", 479, 285],
  ["Rua Minas Gerais", 503, 323], ["Rua Bocaina", 584, 313], ["Rua Paraná", 524, 361],
  ["Rua Jaú", 494, 380], ["Rua Brasil", 549, 396], ["Rua São Paulo", 612, 405],
  ["Rua Itapuí", 495, 470], ["Rua Vereador Pedro Silva", 416, 443], ["Avenida Porecatu", 331, 326],
  ["Rua Bahia", 581, 486], ["Rua Iguatemi", 524, 147], ["Rua Deoclésio Militão Duarte", 258, 410],
  ["Rua Joaquim Luiz Guimarães", 238, -6], ["Rua Lourenço Vaz", 222, 577], ["Rua Olívio Biazotti", 285, 675],
  ["Rua Vereador Celso Pereira", 257, 757], ["Rua A", 332, 537], ["Rua Eugênio Colombo", 320, 614],
  ["Avenida Rolândia", 447, 600], ["Rua Pascoal Bombessi", 502, 609], ["Rua Joaquim Pedro Zanotto", 322, 790],
  ["Rua Manoel José Ribeiro", 263, 870], ["Rodovia PR-536", 850, 200],
].map(([name, x, y], index) => ({ id: `rua-${index}`, name: name as string, x: x as number, y: y as number }))
STREET_INDEX.push({ id: "rua-lunardelli", name: "Rodovia João Lunardelli", x: 373, y: 480, aliases: ["PR-170"] })
// Outros pontos conhecidos da cidade
const EXTRA_PLACES: MapPlace[] = [
  { id: "extra-estadio", name: "Estádio Municipal José Aparecido de Moraes", x: 683, y: 275, address: "Estádio · esporte e lazer", category: "esporte e lazer" },
  { id: "extra-jardim", name: "Jardim das Flores", x: 354, y: 150, address: "Bairro", category: "bairro" },
  { id: "extra-granja", name: "Granja do Japonês", x: 438, y: 87, address: "Ponto de referência", category: "ponto de referência" },
]
const BASE_PLACES: MapPlace[] = [...verifiedPlaces, ...EXTRA_PLACES]

// Busca tolerante: ignora acentos, maiúsculas e o tipo da via ("Rua", "Av.")
const STREET_TYPES = /^(rua|r\.|avenida|av\.?|rodovia|rod\.?|travessa|tv\.?|alameda|estrada)\s+/
function streetScore(name: string, query: string, aliases: string[] = []) {
  const q = normalize(query.trim()).replace(STREET_TYPES, "")
  if (!q) return -1
  const full = normalize(name)
  const bare = full.replace(STREET_TYPES, "")
  const words = bare.split(/\s+/)
  if (bare.startsWith(q)) return 3
  if (words.some((word) => word.startsWith(q))) return 2
  if (full.includes(q) || aliases.some((alias) => normalize(alias).includes(q))) return 1
  return -1
}
// Locais pré-salvos para quem entra com uma conta (para a apresentação)
const DEMO_SHORTCUTS: Shortcuts = {
  home: { x: 503, y: 323, name: "Rua Minas Gerais" },
  work: { x: 554, y: 438, name: "Prefeitura Municipal" },
}
const DEMO_FAVORITES: Favorite[] = [
  { x: 534, y: 379, name: "Igreja São João Batista" },
  { x: 683, y: 275, name: "Estádio Municipal José Aparecido de Moraes" },
]

const MAX_RECENTS = 5
// Ritmo da simulação (escolhido no menu da viagem)
const SIM_SPEEDS = [1, 2, 4]
// Na apresentação a viagem anda 6× mais rápido que na vida real,
// mas cada transporte mantém a sua velocidade (carro > moto > bike > a pé)
const PRESENTATION_BOOST = 6

// Velocidade simulada (km/h) em cada ponto da viagem: varia um pouco
// ao longo do caminho e reduz perto da chegada
function speedAt(progress: number, cruiseKmh: number) {
  return Math.max(2, Math.round(
    (progress > .94 ? cruiseKmh * .5 : cruiseKmh) +
      cruiseKmh * .35 * Math.sin(progress * Math.PI * 5) ** 2,
  ))
}
// Perfis das contas ficam no navegador, um por e-mail
const PROFILES_KEY = "vya.profiles"
// Ruas e locais baixados do OpenStreetMap ficam guardados para a próxima vez
const MAP_CACHE_KEY = "vya.mapdata.v1"
const GUEST_EMAIL = "visitante@vya.com"
const GOOGLE_EMAIL = "vya@gmail.com"
const SHORTCUT_LABEL: Record<ShortcutKey, string> = {
  home: "Casa",
  work: "Trabalho",
}
const SHORTCUT_ICON: Record<ShortcutKey, string> = {
  home: "home",
  work: "work",
}
const HAZARD_META: Record<
  HazardKind,
  { label: string; color: string; icon: string; alert: string }
> = {
  accident: { label: "Acidente", color: "#e5484d", icon: "alert", alert: "Acidente à frente" },
  works: { label: "Obras", color: "#f59e0b", icon: "cone", alert: "Obras na via" },
  pothole: { label: "Buraco", color: "#8a5a2b", icon: "pothole", alert: "Buraco à frente" },
  traffic: { label: "Trânsito", color: "#f2711c", icon: "traffic", alert: "Trânsito intenso à frente" },
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Dois pontos são o "mesmo lugar" quando estão praticamente na mesma posição
// (compara pela localização, não pelo nome — nomes podem se repetir)
function samePlace(a: MapPoint | null | undefined, b: MapPoint | null | undefined) {
  if (!a || !b) return false
  return Math.hypot(a.x - b.x, a.y - b.y) < 6
}

function formatKm(km: number) {
  return km.toFixed(1).replace(".", ",")
}

// Guarda dados simples no navegador (se o navegador bloquear, ignora o erro)
function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}
function saveStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sem armazenamento disponível: o protótipo continua funcionando
  }
}

// "maria.silva@email.com" -> "Maria Silva"; sem e-mail -> "Visitante"
function nameFromEmail(email: string) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim()
  if (!local) return "Visitante"
  return local
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

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
    eyeoff: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <path d="m4 4 16 16" />
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
    // --- Sprint 2 ---
    home: <path d="m3 11 9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />,
    work: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
      </>
    ),
    edit: <path d="M4 20h4L19 9l-4-4L4 16ZM13 7l4 4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    alert: (
      <>
        <path d="M12 3 2 20h20Z" />
        <path d="M12 10v4M12 17.5v.01" />
      </>
    ),
    cone: <path d="M10 3h4l5 17H5ZM8 12h8M7 16h10" />,
    pothole: (
      <>
        <ellipse cx="12" cy="15" rx="8" ry="4" />
        <path d="M4 8l3 2M20 8l-3 2M12 4v3" />
      </>
    ),
    toll: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5c-.5-.9-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3.2 6 1.5 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.5-.6-3-1.5M12 6v2M12 16v2" />
      </>
    ),
    dirt: <path d="m2 19 6-10 4 6 3-4 7 8Z" />,
    refresh: <path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4" />,
    bell: <path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4ZM10 21h4" />,
    star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9Z" />,
    starfill: <path fill="currentColor" d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9Z" />,
    traffic: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="3" />
        <circle cx="12" cy="7" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="17" r="1.6" />
      </>
    ),
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
    route: (
      <>
        <circle cx="6" cy="19" r="2.2" />
        <circle cx="18" cy="5" r="2.2" />
        <path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
      </>
    ),
    // --- ícones dos apps da tela do celular ---
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="2" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </>
    ),
    note: <path d="M5 3h10l4 4v14H5ZM15 3v4h4M8 12h8M8 16h5" />,
    music: (
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="17.5" cy="16" r="2.5" />
      </>
    ),
    calc: (
      <>
        <rect x="5" y="2.5" width="14" height="19" rx="3" />
        <path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" strokeWidth="2.6" />
      </>
    ),
    bag: <path d="M5 8h14l-1 13H6ZM9 8V6a3 3 0 0 1 6 0v2" />,
    folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
    phone: <path d="M5 3h3.5l2 5-2.5 1.5a11 11 0 0 0 6.5 6.5L16 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
    message: <path d="M4 5h16v11H9l-5 4Z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
    camera: (
      <>
        <path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    store: (
      <>
        <path d="M4 9 6 4h12l2 5M4 9v11h16V9M4 9h16" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
    // --- telas mobile ---
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    up: <path d="m6 15 6-6 6 6" />,
    dots: (
      <>
        <circle cx="5" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="19" cy="12" r="1.4" fill="currentColor" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2.2" />
        <circle cx="10" cy="17" r="2.2" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    map: (
      <>
        <path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5Z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4.5L6 21Z" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    nav: <path d="M12 2 20 21l-8-4.5L4 21Z" />,
    speed: (
      <>
        <path d="M4 18a8 8 0 1 1 16 0" />
        <path d="m12 18 4-6" />
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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

function Toggle({
  checked,
  onChange,
  icon,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  icon: string
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-row ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-icon"><Icon name={icon} size={18} /></span>
      <span className="toggle-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className="toggle-switch" aria-hidden="true"><i /></span>
    </button>
  )
}

function ReportSheet({
  onClose,
  onReport,
}: {
  onClose: () => void
  onReport: (kind: HazardKind) => void
}) {
  const kinds: HazardKind[] = ["accident", "works", "pothole"]
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Reportar na via"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <h3>O que você viu na via?</h3>
        <p>O alerta aparece no mapa para quem passar por aqui depois.</p>
        <div className="report-grid">
          {kinds.map((kind) => (
            <button key={kind} type="button" onClick={() => onReport(kind)}>
              <span style={{ background: HAZARD_META[kind].color }}>
                <Icon name={HAZARD_META[kind].icon} size={22} />
              </span>
              {HAZARD_META[kind].label}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tela inicial do celular (abertura da apresentação). Os outros apps são só
// ilustrativos; tocar no Vya abre o app com animação + tela de abertura.
// ---------------------------------------------------------------------------
type HomeApp = { id: string; label: string; icon: string; bg: string }
const HOME_APPS: HomeApp[] = [
  { id: "photos", label: "Fotos", icon: "image", bg: "linear-gradient(145deg,#ff9a62,#ff5f7e)" },
  { id: "clock", label: "Relógio", icon: "clock", bg: "linear-gradient(145deg,#2b2840,#14112e)" },
  { id: "calendar", label: "Agenda", icon: "calendar", bg: "linear-gradient(145deg,#ffffff,#eceaf3)" },
  { id: "weather", label: "Clima", icon: "sun", bg: "linear-gradient(145deg,#56b8ff,#2f7bf5)" },
  { id: "notes", label: "Notas", icon: "note", bg: "linear-gradient(145deg,#ffd35c,#f6b21b)" },
  { id: "music", label: "Música", icon: "music", bg: "linear-gradient(145deg,#ff6fb5,#c43dff)" },
  { id: "vya", label: "Vya", icon: "vya", bg: "var(--purple)" },
  { id: "calc", label: "Calculadora", icon: "calc", bg: "linear-gradient(145deg,#3d3a52,#22202f)" },
  { id: "mail", label: "E-mail", icon: "mail", bg: "linear-gradient(145deg,#5fd0ff,#2a8cff)" },
  { id: "store", label: "Loja", icon: "bag", bg: "linear-gradient(145deg,#4fd1c5,#1f9e8f)" },
  { id: "files", label: "Arquivos", icon: "folder", bg: "linear-gradient(145deg,#7fb2ff,#4b7bec)" },
  { id: "settings", label: "Ajustes", icon: "gear", bg: "linear-gradient(145deg,#a7a3b8,#77738a)" },
]
const DOCK_APPS: HomeApp[] = [
  { id: "phone", label: "Telefone", icon: "phone", bg: "linear-gradient(145deg,#5ee27a,#22b04a)" },
  { id: "messages", label: "Mensagens", icon: "message", bg: "linear-gradient(145deg,#6ee787,#2fbf55)" },
  { id: "browser", label: "Navegador", icon: "globe", bg: "linear-gradient(145deg,#ffffff,#e9e7f1)" },
  { id: "camera", label: "Câmera", icon: "camera", bg: "linear-gradient(145deg,#cfcbdb,#9894aa)" },
]

function VyaAppIcon() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="m15 22 15 26 15-26" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M44 7c-7 0-11 5-11 11 0 7 11 15 11 15s11-8 11-15c0-6-4-11-11-11Z" fill="var(--lime)" />
      <circle cx="44" cy="17.5" r="3.4" fill="var(--purple)" />
    </svg>
  )
}

// Barra de status do celular (hora atual + sinal, wi-fi e bateria)
function StatusBar({ tone = "light" }: { tone?: "light" | "app" }) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const clock = window.setInterval(() => setTime(new Date()), 10000)
    return () => window.clearInterval(clock)
  }, [])
  const label = time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return (
    <div className={`ph-status tone-${tone}`}>
      <span className="ph-time">{label}</span>
      <span className="ph-status-icons" aria-hidden="true">
        <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
        <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M2.8 6.2a7.4 7.4 0 0 1 10.4 0l-1.4 1.4a5.4 5.4 0 0 0-7.6 0Z M0 3.4a11.4 11.4 0 0 1 16 0l-1.4 1.4a9.4 9.4 0 0 0-13.2 0Z" fill="currentColor" /></svg>
        <svg viewBox="0 0 27 12" width="27" height="12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45" /><rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="currentColor" /><path d="M24.5 4v4c.8-.3 1.5-1 1.5-2s-.7-1.7-1.5-2Z" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  )
}

function PhoneHome({ onOpenStart, onOpened, onOtherApp }: {
  onOpenStart: () => void
  onOpened: () => void
  onOtherApp: (label: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [opening, setOpening] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [showSplash, setShowSplash] = useState(false)
  const [shake, setShake] = useState("")
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(clock)
  }, [])
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" })
  const day = now.getDate()
  const month = now.toLocaleDateString("pt-BR", { month: "long" })

  function openVya(target: HTMLElement) {
    if (opening) return
    const root = rootRef.current?.getBoundingClientRect()
    const box = target.getBoundingClientRect()
    onOpenStart()
    setOpening({
      x: box.left - (root?.left ?? 0),
      y: box.top - (root?.top ?? 0),
      w: box.width,
      h: box.height,
    })
    window.setTimeout(() => setShowSplash(true), 380)
    window.setTimeout(onOpened, 1900)
  }
  function tapOther(app: HomeApp) {
    setShake(app.id)
    window.setTimeout(() => setShake(""), 450)
    onOtherApp(app.label)
  }
  function renderApp(app: HomeApp, inDock = false) {
    const isVya = app.id === "vya"
    return (
      <button
        key={app.id}
        type="button"
        className={`ph-app ${isVya ? "vya" : ""} ${shake === app.id ? "shake" : ""}`}
        aria-label={isVya ? "Abrir o app Vya" : app.label}
        onClick={(e) => (isVya ? openVya(e.currentTarget.querySelector(".ph-icon") as HTMLElement) : tapOther(app))}
      >
        <span className={`ph-icon icon-${app.id}`} style={{ background: app.bg }}>
          {isVya ? <VyaAppIcon /> : <Icon name={app.icon} size={inDock ? 28 : 27} />}
          {isVya && <i className="ph-badge">1</i>}
        </span>
        {!inDock && <span className="ph-label">{app.label}</span>}
      </button>
    )
  }
  return (
    <div className="ph" ref={rootRef}>
      <div className="ph-wallpaper" aria-hidden="true">
        <svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
          <path d="M-40 700C80 690 120 600 170 520S290 420 330 300 380 120 460 90" stroke="#ffffff14" strokeWidth="60" fill="none" />
          <path d="M-40 700C80 690 120 600 170 520S290 420 330 300 380 120 460 90" stroke="#c6f43240" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <StatusBar />
      <div className="ph-widgets">
        <div className="ph-widget date">
          <small>{weekday}</small>
          <strong>{day}</strong>
          <span>de {month}</span>
        </div>
        <button type="button" className="ph-widget vya-widget" onClick={(e) => openVya(e.currentTarget)}>
          <span className="ph-widget-logo"><VyaAppIcon /></span>
          <strong>Para onde vamos?</strong>
          <small>Toque e siga a Vya.</small>
        </button>
      </div>
      <div className="ph-grid">{HOME_APPS.map((app) => renderApp(app))}</div>
      <div className="ph-dots" aria-hidden="true"><i className="on" /><i /></div>
      <div className="ph-dock">{DOCK_APPS.map((app) => renderApp(app, true))}</div>
      <div className="ph-home-bar" aria-hidden="true" />

      {opening && (
        <div
          className="ph-opening"
          style={{
            "--x": `${opening.x}px`,
            "--y": `${opening.y}px`,
            "--w": `${opening.w}px`,
            "--h": `${opening.h}px`,
          } as React.CSSProperties}
        >
          {showSplash && (
            <div className="ph-splash">
              <Logo light />
              <div className="ph-loader"><i /><i /><i /></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Cabeçalho das telas cheias (estilo app: voltar + título)
function PageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <header className="vx-page-head">
      <button type="button" className="vx-back" aria-label="Voltar" onClick={onBack}>
        <Icon name="back" size={22} />
      </button>
      <h2>{title}</h2>
      {action ?? <span className="vx-head-spacer" />}
    </header>
  )
}

// Linha de lista padrão (ícone, título, subtítulo, ação opcional à direita)
function ListRow({
  icon,
  title,
  subtitle,
  onClick,
  tone = "default",
  trailing,
  disabled = false,
}: {
  icon: string
  title: string
  subtitle?: string
  onClick?: () => void
  tone?: "default" | "brand" | "lime" | "muted"
  trailing?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="vx-row">
      <button type="button" className="vx-row-main" onClick={onClick} disabled={disabled}>
        <span className={`vx-row-icon tone-${tone}`}><Icon name={icon} size={19} /></span>
        <span className="vx-row-text">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
      </button>
      {trailing}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mapa em tela cheia. Ele mesmo cuida do zoom, do arrastar e do enquadramento:
// - explore: mostra a cidade a partir da sua posição
// - fit: enquadra a rota inteira na área livre (acima do painel inferior)
// - follow: acompanha o veículo durante a navegação
// ---------------------------------------------------------------------------
function MapView({
  destination,
  progress = 0,
  interactive = false,
  onPick,
  origin,
  places,
  streets,
  streetRoute,
  hazards,
  tolls,
  stops,
  pin = null,
  alternatives = [],
  traffic = [],
  savedPins = [],
  mode,
  viewKey,
  padTop = 0,
  padBottom = 0,
  showControls = true,
  controlsBottom = 24,
}: {
  destination: Point | null
  progress?: number
  interactive?: boolean
  onPick?: (point: Point) => void
  origin: Point
  places: MapPlace[]
  streets: StreetFeature[]
  streetRoute: StreetRoute | null
  hazards: Hazard[]
  tolls: TollBooth[]
  stops: MapPoint[]
  pin?: MapPoint | null
  alternatives?: MapPoint[][]
  traffic?: MapPoint[][]
  savedPins?: { id: string; icon: string; label: string; point: Point }[]
  mode: MapMode
  viewKey: string
  padTop?: number
  padBottom?: number
  showControls?: boolean
  controlsBottom?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 390, h: 844 })
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 500, y: 420 })
  const [detached, setDetached] = useState(false)
  const [recenter, setRecenter] = useState(0)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; scale: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const element = svgRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // O recorte visível acompanha o formato da tela (celular em pé)
  const aspect = size.w / size.h
  const dims = (z: number) => aspect < 1000 / 840
    ? { w: (840 / z) * aspect, h: 840 / z }
    : { w: 1000 / z, h: 1000 / z / aspect }
  const { w: width, h: height } = dims(zoom)
  // Deixa uma pequena margem além da borda para os painéis não esconderem nada
  const clampAxis = (value: number, span: number, axis: "x" | "y") => {
    const min = axis === "x" ? TILE_BOUNDS.minX : TILE_BOUNDS.minY
    const max = axis === "x" ? TILE_BOUNDS.maxX : TILE_BOUNDS.maxY
    const low = min - 60 + span / 2
    const high = max + 60 - span / 2
    if (low > high) return (min + max) / 2
    return Math.min(high, Math.max(low, value))
  }
  // Ícones do mapa não crescem demais quando o zoom aumenta
  const k = Math.max(0.45, Math.min(1, 1.6 / zoom))
  const cx = clampAxis(center.x, width, "x")
  const cy = clampAxis(center.y, height, "y")
  // Desloca o centro para o ponto de interesse ficar na área livre do mapa
  const shift = (visibleHeight: number) => visibleHeight * (padBottom - padTop) / 2

  const route = destination ? streetRoute?.points ?? [] : []
  const marker = route.length ? pointAlongRoute(route, progress) : origin
  const markerAhead = route.length
    ? pointAlongRoute(route, Math.min(1, progress + 0.002))
    : marker
  const markerRotation = Math.atan2(
    markerAhead.y - marker.y,
    markerAhead.x - marker.x,
  ) * 180 / Math.PI + 90

  // Enquadramento automático a cada troca de tela/rota (ou ao recentralizar)
  useEffect(() => {
    setDetached(false)
    if (mode === "explore") {
      setZoom(1.5)
      setCenter({ x: origin.x, y: origin.y + shift(dims(1.5).h) })
      return
    }
    if (mode === "follow") {
      setZoom(2.2)
      return
    }
    const points = [...route, ...alternatives.flat(), ...(destination ? [destination] : [])]
    if (points.length < 2) return
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const boxW = Math.max(maxX - minX, 70)
    const boxH = Math.max(maxY - minY, 70)
    const base = dims(1)
    const usable = Math.max(0.2, 1 - padTop - padBottom)
    const nextZoom = Math.max(MIN_ZOOM, Math.min(3,
      Math.min(base.w / (boxW * 1.35), (base.h * usable) / (boxH * 1.35)),
    ))
    setZoom(nextZoom)
    setCenter({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2 + shift(dims(nextZoom).h),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, viewKey, recenter, size.w, size.h])

  // Navegação: a câmera segue o veículo (até a pessoa arrastar o mapa)
  useEffect(() => {
    if (mode !== "follow" || detached || !route.length) return
    setCenter({ x: marker.x, y: marker.y + shift(dims(zoom).h) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, detached, marker.x, marker.y, zoom, route.length])

  // Um único tratamento de toque para o mapa inteiro:
  // 1) tocou num estabelecimento -> escolhe o estabelecimento
  // 2) tocou numa rua -> escolhe o ponto exato da rua onde tocou (com o nome da rua)
  // 3) senão -> o ponto tocado (a rota liga à rua acessível mais próxima)
  // Assim arrastar o mapa por cima de uma rua não seleciona nada por engano.
  function pick(e: React.MouseEvent<SVGSVGElement>) {
    if (moved.current || !interactive || !onPick) return
    const matrix = e.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    )
    if (point.x < TILE_BOUNDS.minX || point.x > TILE_BOUNDS.maxX
      || point.y < TILE_BOUNDS.minY || point.y > TILE_BOUNDS.maxY) return
    const unitsPerPx = 1 / matrix.a
    // Casa / Trabalho no mapa
    const tappedSaved = savedPins.find((saved) =>
      Math.hypot(saved.point.x - point.x, saved.point.y - point.y) <= 16 * k + 8 * unitsPerPx)
    if (tappedSaved) {
      onPick(tappedSaved.point)
      return
    }
    let tappedPlace: MapPlace | null = null
    let placeGap = Infinity
    for (let i = 0; i < places.length; i++) {
      const place = places[i]
      const radius = (i < verifiedPlaces.length ? 13 : 8) * k + 8 * unitsPerPx
      const gap = Math.hypot(place.x - point.x, place.y - point.y)
      if (gap <= radius && gap < placeGap) {
        tappedPlace = place
        placeGap = gap
      }
    }
    if (tappedPlace) {
      onPick(tappedPlace)
      return
    }
    let tappedStreet: { street: StreetFeature; progress: number } | null = null
    let streetGap = 16 * unitsPerPx
    for (const street of streets) {
      if (street.points.length < 2) continue
      const projection = projectOnRoute(street.points, point)
      if (projection.distance < streetGap) {
        tappedStreet = { street, progress: projection.progress }
        streetGap = projection.distance
      }
    }
    if (tappedStreet && tappedStreet.street.name !== "Via sem nome") {
      const onStreet = pointAlongRoute(tappedStreet.street.points, tappedStreet.progress)
      onPick({
        x: Math.round(onStreet.x),
        y: Math.round(onStreet.y),
        name: tappedStreet.street.name,
      })
      return
    }
    const x = Math.round(point.x)
    const y = Math.round(point.y)
    onPick({ x, y, name: `Ponto em Prado Ferreira · ${x}, ${y}` })
  }
  function zoomBy(delta: number) {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)))
  }

  return (
    <>
      <svg
        ref={svgRef}
        className={`map-canvas vx-map ${interactive ? "interactive" : ""}`}
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
          if (Math.hypot(dx, dy) > 6) moved.current = true
          if (!moved.current) return
          if (mode === "follow") setDetached(true)
          setCenter({
            x: clampAxis(start.cx - dx / start.scale, width, "x"),
            y: clampAxis(start.cy - dy / start.scale, height, "y"),
          })
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null; moved.current = true }}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 0.25 : -0.25)}
        onClick={pick}
        role="img"
        aria-label={
          interactive
            ? "Mapa de Prado Ferreira–PR. Toque em qualquer ponto para escolher; arraste para explorar."
            : "Mapa de Prado Ferreira–PR com rota pela rede viária"
        }
      >
        <defs>
          <filter id="mapShadow">
            <feDropShadow dy="3" stdDeviation="4" floodColor="#14112e" floodOpacity=".15" />
          </filter>
        </defs>
        <rect x="-500" y="-500" width="2000" height="1840" fill="#e9eddc" />
        {pradoMap.tiles.map((tile) => (
          <image key={tile.url} x={tile.x} y={tile.y} width="256" height="256" href={tile.url} />
        ))}
        {streets.map((street) => (
          <g
            className="street-feature"
            key={street.id}
            role="button"
            tabIndex={interactive ? 0 : -1}
            aria-label={`Escolher ${street.name}`}
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
              <text className="street-label" x={street.center.x} y={street.center.y} textAnchor="middle" style={{ fontSize: 8 * k, strokeWidth: 3 * k }}>
                {street.name}
              </text>
            )}
          </g>
        ))}
        {places.map((p, i) => (
          <g
            key={p.name}
            transform={`translate(${p.x} ${p.y}) scale(${k})`}
            role="button"
            tabIndex={interactive ? 0 : -1}
            aria-label={`Escolher ${p.name}`}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick?.(p) }
            }}
          >
            <title>{p.name} — {p.address}</title>
            <circle r={i < verifiedPlaces.length ? 13 : 8} fill="var(--purple)" stroke="white" strokeWidth="3" filter="url(#mapShadow)" />
            {i < verifiedPlaces.length && (
              <text y="4" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" fontSize="11" fill="white">{i + 1}</text>
            )}
          </g>
        ))}
        {destination && (
          <>
            {alternatives.map((alt, i) => (
              <g key={`alt-${i}`} className="vx-alt-route">
                <polyline points={alt.map((p) => `${p.x},${p.y}`).join(" ")} stroke="white" strokeWidth={13 * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
                <polyline points={alt.map((p) => `${p.x},${p.y}`).join(" ")} stroke="#a79ce8" strokeWidth={7 * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
              </g>
            ))}
            <polyline points={route.map((p) => `${p.x},${p.y}`).join(" ")} stroke="white" strokeWidth={15 * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            <polyline points={route.map((p) => `${p.x},${p.y}`).join(" ")} stroke="var(--purple)" strokeWidth={8 * k} strokeLinejoin="round" fill="none" />
            {traffic.map((segment, i) => (
              <polyline key={`traffic-${i}`} className="vx-traffic" points={segment.map((p) => `${p.x},${p.y}`).join(" ")} stroke="#f2711c" strokeWidth={8 * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            ))}
            {tolls.map((toll, i) => (
              <g key={`toll-${i}`} transform={`translate(${toll.point.x} ${toll.point.y}) scale(${k})`} filter="url(#mapShadow)">
                <title>{toll.name}</title>
                <rect x="-17" y="-11" width="34" height="22" rx="7" fill="var(--night)" stroke="white" strokeWidth="2.5" />
                <text y="4" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="10" fill="var(--lime)">R$</text>
              </g>
            ))}
            {stops.map((stop, i) => (
              <g key={`stop-${i}`} transform={`translate(${stop.x} ${stop.y}) scale(${k})`} filter="url(#mapShadow)">
                <circle r="13" fill="var(--lime)" stroke="var(--night)" strokeWidth="2.5" />
                <text y="4.5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="12" fill="var(--night)">{i + 1}</text>
              </g>
            ))}
            <g transform={`translate(${destination.x} ${destination.y}) scale(${k})`} filter="url(#mapShadow)">
              <path d="M0-38c-13 0-21 9-21 21C-21-4 0 12 0 12S21-4 21-17c0-12-8-21-21-21Z" fill="var(--lime)" stroke="var(--night)" strokeWidth="2" />
              <circle cy="-18" r="6" fill="var(--night)" />
            </g>
          </>
        )}
        {hazards.map((hazard) => (
          <g key={hazard.id} transform={`translate(${hazard.point.x} ${hazard.point.y}) scale(${k})`} filter="url(#mapShadow)">
            <title>{HAZARD_META[hazard.kind].label}</title>
            <circle r="13" fill={HAZARD_META[hazard.kind].color} stroke="white" strokeWidth="3" />
            {hazard.kind === "accident" && (
              <text y="5" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="15" fill="white">!</text>
            )}
            {hazard.kind === "works" && <path d="M0-6 6 5H-6Z" fill="white" />}
            {hazard.kind === "pothole" && <ellipse rx="6" ry="3.5" fill="white" />}
          </g>
        ))}
        {savedPins.map((saved) => (
          <g key={saved.id} className="vx-saved-pin" transform={`translate(${saved.point.x} ${saved.point.y}) scale(${k})`} filter="url(#mapShadow)">
            <title>{saved.label} — {saved.point.detail ?? saved.point.name}</title>
            <path d="M0 22 -7 13H-11a6 6 0 0 1-6-6V-11a6 6 0 0 1 6-6H11a6 6 0 0 1 6 6V7a6 6 0 0 1-6 6H7Z" transform="translate(0 -22)" fill="var(--night)" stroke="white" strokeWidth="2.5" />
            <g transform="translate(-9 -33)" style={{ color: "var(--lime)" }}>
              <Icon name={saved.icon} size={18} />
            </g>
            <text className="vx-saved-label" y="14" textAnchor="middle">{saved.label}</text>
          </g>
        ))}
        {pin && (
          <g className="vx-drop-pin" transform={`translate(${pin.x} ${pin.y}) scale(${k})`} filter="url(#mapShadow)">
            <ellipse cy="12" rx="9" ry="3.5" fill="#14112e" opacity=".22" />
            <path d="M0-38c-13 0-21 9-21 21C-21-4 0 12 0 12S21-4 21-17c0-12-8-21-21-21Z" fill="var(--purple)" stroke="white" strokeWidth="2.5" />
            <circle cy="-18" r="6.5" fill="var(--lime)" />
          </g>
        )}
        <g className="vehicle-marker" transform={`translate(${marker.x} ${marker.y}) rotate(${markerRotation}) scale(${k})`}>
          <circle r="40" fill="var(--purple)" opacity=".08" />
          <circle r="26" fill="var(--purple)" opacity=".1" />
          <circle r="16" fill="white" filter="url(#mapShadow)" />
          <path d="m0-10 9.5 19L0 4l-9.5 5Z" fill="var(--purple)" />
        </g>
      </svg>
      {showControls && (
        <div className="vx-map-controls" style={{ bottom: controlsBottom }}>
          {detached ? (
            <button type="button" className="vx-recenter" onClick={() => setRecenter((n) => n + 1)}>
              <Icon name="nav" size={17} />
              Recentralizar
            </button>
          ) : (
            <div className="vx-zoom">
              <button type="button" aria-label="Aproximar mapa" disabled={zoom >= MAX_ZOOM} onClick={() => zoomBy(0.5)}>
                <Icon name="plus" size={18} />
              </button>
              <button type="button" aria-label="Afastar mapa" disabled={zoom <= MIN_ZOOM} onClick={() => zoomBy(-0.5)}>
                <Icon name="minus" size={18} />
              </button>
            </div>
          )}
          <button
            type="button"
            className="vx-locate"
            aria-label="Centralizar mapa"
            onClick={() => setRecenter((n) => n + 1)}
          >
            <Icon name="locate" size={20} />
          </button>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Simulação de toque no computador: arrastar com o mouse rola as listas
// (para o lado e para cima/baixo, com embalo no final), como o dedo no celular.
// Depois de arrastar, o clique é ignorado para não abrir nada por engano.
// O mapa continua com o seu próprio arrastar.
// ---------------------------------------------------------------------------
function useTouchEmulation(root: { current: HTMLDivElement | null }) {
  useEffect(() => {
    const element = root.current
    if (!element) return
    type Drag = {
      x: number
      y: number
      target: HTMLElement
      axis: "x" | "y" | null
      scroller: HTMLElement | null
      startScroll: number
      lastPos: number
      lastTime: number
      velocity: number
    }
    let drag: Drag | null = null
    let dragged = false
    let frame = 0

    const findScroller = (node: HTMLElement | null, axis: "x" | "y") => {
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node)
        const overflow = axis === "x" ? style.overflowX : style.overflowY
        const room = axis === "x"
          ? node.scrollWidth - node.clientWidth
          : node.scrollHeight - node.clientHeight
        if (/(auto|scroll)/.test(overflow) && room > 1) return node
        node = node.parentElement
      }
      return null
    }
    const finish = (scroller: HTMLElement) => scroller.classList.remove("touch-dragging")

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return
      const target = event.target as HTMLElement
      element.classList.add("touch-down")
      dragged = false
      if (target.closest("input, textarea, select, .vx-map")) return
      window.cancelAnimationFrame(frame)
      drag = {
        x: event.clientX, y: event.clientY, target,
        axis: null, scroller: null, startScroll: 0,
        lastPos: 0, lastTime: event.timeStamp, velocity: 0,
      }
    }
    const onMove = (event: PointerEvent) => {
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 6) return
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
        drag.scroller = findScroller(drag.target, drag.axis)
        if (!drag.scroller) {
          drag = null
          return
        }
        drag.startScroll = drag.axis === "x" ? drag.scroller.scrollLeft : drag.scroller.scrollTop
        drag.lastPos = drag.axis === "x" ? event.clientX : event.clientY
        drag.scroller.classList.add("touch-dragging")
        dragged = true
      }
      const scroller = drag.scroller
      if (!scroller) return
      event.preventDefault()
      const position = drag.axis === "x" ? event.clientX : event.clientY
      const offset = drag.axis === "x" ? dx : dy
      if (drag.axis === "x") scroller.scrollLeft = drag.startScroll - offset
      else scroller.scrollTop = drag.startScroll - offset
      const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
      drag.velocity = 0.8 * ((drag.lastPos - position) / elapsed) + 0.2 * drag.velocity
      drag.lastPos = position
      drag.lastTime = event.timeStamp
    }
    const onUp = () => {
      element.classList.remove("touch-down")
      const current = drag
      drag = null
      if (!current?.scroller) return
      const { scroller, axis } = current
      let velocity = current.velocity
      // embalo: continua rolando e vai freando
      const glide = () => {
        if (Math.abs(velocity) < 0.03) {
          finish(scroller)
          return
        }
        if (axis === "x") scroller.scrollLeft += velocity * 16
        else scroller.scrollTop += velocity * 16
        velocity *= 0.93
        frame = window.requestAnimationFrame(glide)
      }
      frame = window.requestAnimationFrame(glide)
    }
    const onClick = (event: MouseEvent) => {
      if (!dragged) return
      dragged = false
      event.preventDefault()
      event.stopPropagation()
    }
    // Rodinha do mouse sobre uma lista horizontal rola para o lado
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement
      if (target.closest(".vx-map") || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const horizontal = findScroller(target, "x")
      if (!horizontal) return
      const vertical = findScroller(target, "y")
      if (vertical && horizontal.contains(vertical)) return
      horizontal.scrollLeft += event.deltaY
      event.preventDefault()
    }

    element.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove, { passive: false })
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    element.addEventListener("click", onClick, true)
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      window.cancelAnimationFrame(frame)
      element.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      element.removeEventListener("click", onClick, true)
      element.removeEventListener("wheel", onWheel)
    }
  }, [root])
}

export default function App() {
  // Raiz do "celular" (usada para simular o toque com o mouse)
  const appRef = useRef<HTMLDivElement>(null)
  useTouchEmulation(appRef)
  const [screen, setScreen] = useState<Screen>("launcher")
  const [destination, setDestination] = useState<Point | null>(null)
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [cityPlaces, setCityPlaces] = useState<MapPlace[]>(BASE_PLACES)
  const [streets, setStreets] = useState<StreetFeature[]>([])
  const [showAllPlaces, setShowAllPlaces] = useState(false)
  const [locationStatus, setLocationStatus] = useState("")
  const [locating, setLocating] = useState(false)
  const [originPoint, setOriginPoint] = useState<Point>(defaultOrigin)
  const [originLabel, setOriginLabel] = useState("Centro · Prado Ferreira–PR")
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [streetRoute, setStreetRoute] = useState<StreetRoute | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState("")

  // Opções da rota: locomoção, paradas e preferências
  const [options, setOptions] = useState<RouteOptionsState>({
    mode: "driving",
    stops: [],
    avoidTolls: false,
    avoidUnpaved: false,
    avoidPotholes: false,
    avoidTraffic: false,
  })
  // Caminhos alternativos da rota atual (o escolhido fica em streetRoute)
  const [routeCandidates, setRouteCandidates] = useState<StreetRoute[]>([])
  const [potholeAlerts, setPotholeAlerts] = useState(true)

  // Busca por estabelecimentos
  const [category, setCategory] = useState("Todos")

  // Dados da conta: atalhos Casa / Trabalho, favoritos e destinos recentes
  // (carregados do perfil quando a conta entra, salvos a cada mudança)
  const [shortcuts, setShortcuts] = useState<Shortcuts>({})
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [recents, setRecents] = useState<Point[]>([])

  // Estado das telas auxiliares
  const [menuOpen, setMenuOpen] = useState(false)
  const [navMenuOpen, setNavMenuOpen] = useState(false)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [placeKey, setPlaceKey] = useState<ShortcutKey>("home")
  const [placeQuery, setPlaceQuery] = useState("")
  const [pickTarget, setPickTarget] = useState<PickTarget>({ kind: "destination" })
  const [pickPoint, setPickPoint] = useState<Point | null>(null)
  const [draftStops, setDraftStops] = useState<Point[]>([])
  const [stopAdding, setStopAdding] = useState(false)
  const [stopQuery, setStopQuery] = useState("")
  const [prefsDraft, setPrefsDraft] = useState<Record<RouteTypeKey, boolean>>({
    avoidTolls: false, avoidUnpaved: false, avoidPotholes: false, avoidTraffic: false,
  })

  // Reportes na via e recálculo de rota
  const [reports, setReports] = useState<Hazard[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [recalc, setRecalc] = useState<Recalc | null>(null)
  // Paradas alcançadas na navegação (a viagem pausa em cada uma)
  const [reachedStop, setReachedStop] = useState(-1)
  const [stopArrival, setStopArrival] = useState<number | null>(null)
  const [simSpeed, setSimSpeed] = useState(SIM_SPEEDS[0])
  const [toast, setToast] = useState("")

  // Conta do usuário (login, cadastro e Google — tudo simulado)
  const [user, setUser] = useState<User | null>(null)
  const [authName, setAuthName] = useState("")
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authConfirm, setAuthConfirm] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const routeRequest = useRef<AbortController | null>(null)
  const searchRequest = useRef<AbortController | null>(null)
  const lastPick = useRef<Point | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  // Pilha de telas para o botão "voltar"
  const backStack = useRef<Screen[]>([])
  // Para onde o app volta quando é reaberto pela tela do celular
  const resumeScreen = useRef<Screen>("welcome")

  const transport = getTransport(options.mode)
  const unpavedStreets = useMemo(
    () => streets.filter((street) => street.unpaved),
    [streets],
  )
  const distance = (streetRoute?.distanceMeters ?? 0) / 1000
  const totalSeconds = Math.max(1, streetRoute?.durationSeconds ?? 1)
  const duration = Math.max(1, Math.ceil(totalSeconds / 60))
  const firstName = user?.name.split(" ")[0] ?? ""

  useEffect(() => () => {
    routeRequest.current?.abort()
    searchRequest.current?.abort()
    window.clearTimeout(toastTimer.current)
  }, [])
  // Salva o perfil da conta (atalhos + favoritos + recentes) sempre que algo muda.
  // Sem conta (convidado), nada é guardado.
  useEffect(() => {
    if (!user) return
    const profiles = loadStored<Record<string, StoredProfile>>(PROFILES_KEY, {})
    profiles[user.email] = {
      name: user.name,
      provider: user.provider,
      shortcuts,
      favorites,
      recents,
    }
    saveStored(PROFILES_KEY, profiles)
  }, [user, shortcuts, favorites, recents])
  useEffect(() => {
    const controller = new AbortController()
    // Ruas e locais da última vez que o mapa carregou (abre na hora)
    const cached = loadStored<{ places: MapPlace[]; streets: StreetFeature[] } | null>(MAP_CACHE_KEY, null)
    if (cached?.streets?.length) {
      const knownNames = new Set(BASE_PLACES.map((place) => normalize(place.name)))
      setCityPlaces([...BASE_PLACES, ...cached.places.filter((place) => !knownNames.has(normalize(place.name)))])
      setStreets(cached.streets)
    }
    loadPradoMapData(controller.signal).then((data) => {
      if (data.streets.length) saveStored(MAP_CACHE_KEY, data)
      else if (cached?.streets?.length) return
      const knownNames = new Set(BASE_PLACES.map((place) =>
        normalize(place.name),
      ))
      setCityPlaces([
        ...BASE_PLACES,
        ...data.places.filter((place) => !knownNames.has(normalize(place.name))),
      ])
      setStreets(data.streets)
    }).catch(() => {
      // sem dados extras: o mapa local continua funcionando
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
  // No trânsito intenso o carro anda bem mais devagar (a moto um pouco menos)
  const trafficSlowdown = options.mode === "driving" ? 0.35 : options.mode === "motorcycle" ? 0.6 : 1
  const inTrafficAt = (p: number) =>
    (streetRoute?.trafficRanges ?? []).some(([a, b]) => p >= a && p <= b)
  const speedNow = (p: number) =>
    Math.max(2, Math.round(speedAt(p, cruise) * (inTrafficAt(p) ? trafficSlowdown : 1)))
  const inTraffic = inTrafficAt(progress) && trafficSlowdown < 1
  const simulatedSpeed = paused ? 0 : speedNow(progress)
  const remaining = Math.max(0, Math.ceil((totalSeconds - elapsed) / 60))
  const arrival = new Date(Date.now() + remaining * 60000).toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )
  const isAuth =
    screen === "welcome" || screen === "login" || screen === "signup"
    || screen === "location"
  const routeVisible = screen === "route" || screen === "navigation" || screen === "finish"

  // ---- Estabelecimentos: categorias e filtro ----
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    cityPlaces.forEach((place) =>
      counts.set(place.category, (counts.get(place.category) ?? 0) + 1),
    )
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)
    return ["Todos", ...top]
  }, [cityPlaces])
  const normalizedQuery = normalize(query.trim())
  const filteredPlaces = useMemo(
    () => cityPlaces.filter((place) =>
      (category === "Todos" || place.category === category)
      && (!normalizedQuery
        || normalize(place.name).includes(normalizedQuery)
        || normalize(place.address).includes(normalizedQuery)
        || normalize(place.category).includes(normalizedQuery)),
    ),
    [cityPlaces, category, normalizedQuery],
  )

  // Sugestões de lugares e ruas para os campos de busca
  function placeSubtitle(place: MapPlace) {
    return place.address.includes(place.category)
      ? place.address
      : `${place.address} · ${place.category}`
  }
  function suggest(text: string, limit: number, exclude: string[] = []): Suggestion[] {
    const q = normalize(text.trim())
    const skip = new Set(exclude)
    const placeHits: Suggestion[] = cityPlaces
      .filter((place) => !skip.has(place.name) && (!q
        || normalize(place.name).includes(q)
        || normalize(place.category).includes(q)
        || normalize(place.address).includes(q)))
      .slice(0, limit)
      .map((place) => ({
        id: place.id,
        point: { x: place.x, y: place.y, name: place.name },
        title: place.name,
        subtitle: placeSubtitle(place),
        icon: "store",
      }))
    if (!q) return placeHits
    const streetHits: Suggestion[] = findStreets(text, 5, exclude).map((street) => ({
      id: street.id,
      point: { x: street.x, y: street.y, name: street.name },
      title: street.name,
      subtitle: "Rua · Prado Ferreira–PR",
      icon: "road",
    }))
    return [...streetHits, ...placeHits]
  }
  // Todas as ruas conhecidas: as do serviço online (com o traçado) + o índice local
  const streetDirectory = useMemo(() => {
    const byName = new Map<string, StreetEntry>()
    for (const street of streets) {
      if (street.name === "Via sem nome") continue
      const key = normalize(street.name)
      if (!byName.has(key)) byName.set(key, { id: street.id, name: street.name, x: street.center.x, y: street.center.y })
    }
    for (const entry of STREET_INDEX) {
      const key = normalize(entry.name)
      const known = byName.get(key)
      if (!known) byName.set(key, entry)
      else if (entry.aliases) byName.set(key, { ...known, aliases: entry.aliases })
    }
    return [...byName.values()]
  }, [streets])
  function findStreets(text: string, limit: number, exclude: string[] = []) {
    const skip = new Set(exclude)
    return streetDirectory
      .map((street) => ({ street, score: streetScore(street.name, text, street.aliases) }))
      .filter(({ street, score }) => score > 0 && !skip.has(street.name))
      .sort((a, b) => b.score - a.score || a.street.name.localeCompare(b.street.name, "pt-BR"))
      .slice(0, limit)
      .map(({ street }) => street)
  }
  const streetMatches = useMemo(
    () => (normalizedQuery ? findStreets(query, 8) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streetDirectory, normalizedQuery],
  )

  useEffect(() => {
    if (screen !== "search") return
    const text = query.trim()
    if (text.length < 3) {
      setSearchResults([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPradoPlaces(text, controller.signal)
        .then((results) => {
          const local = new Set(streetDirectory.map((street) => normalize(street.name)))
          setSearchResults(results.filter((result) => !local.has(normalize(result.name))))
        })
        .catch(() => { /* sem internet: fica só a lista local */ })
    }, 450)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, screen, streetDirectory])

  // ---- Avisos na via: buracos (simulados) e reportes dos usuários ----
  const routePoints = streetRoute?.points
  const worldPotholes = streetRoute?.worldPotholes
  const simulatedHazards = useMemo<Hazard[]>(() =>
    (worldPotholes ?? []).map((point, index) => ({
      id: `sim-pothole-${index}`,
      kind: "pothole" as const,
      point,
    })), [worldPotholes])
  const mapHazards = useMemo(() => {
    const all = [
      ...reports,
      ...(destination && routeVisible ? simulatedHazards : []),
    ]
    return potholeAlerts ? all : all.filter((hazard) => hazard.kind !== "pothole")
  }, [reports, simulatedHazards, destination, routeVisible, potholeAlerts])
  const routeHazards = useMemo(() => {
    if (!routePoints || routePoints.length < 2) return []
    return mapHazards.flatMap((hazard) => {
      const projection = projectOnRoute(routePoints, hazard.point)
      return projection.distance <= 25
        ? [{ hazard, progress: projection.progress }]
        : []
    })
  }, [mapHazards, routePoints])
  let upcoming: { hazard: Hazard; meters: number } | null = null
  if (screen === "navigation" && streetRoute) {
    const trafficAhead = streetRoute.trafficRanges.map(([start], index) => ({
      hazard: { id: `traffic-${index}`, kind: "traffic" as const, point: pointAlongRoute(streetRoute.points, start) },
      progress: start,
    }))
    for (const item of [...routeHazards, ...trafficAhead]) {
      const meters = (item.progress - progress) * streetRoute.distanceMeters
      if (meters > 5 && meters <= 250 && (!upcoming || meters < upcoming.meters)) {
        upcoming = { hazard: item.hazard, meters }
      }
    }
  }
  const nextStopIndex = streetRoute
    ? streetRoute.stopProgress.findIndex((value) => value > progress + 0.002)
    : -1

  useEffect(() => {
    if (screen !== "navigation" || paused) return
    const timer = window.setInterval(
      () => setElapsed((t) => {
        // anda a distância que o veículo percorreria nessa velocidade
        const meters = streetRoute?.distanceMeters ?? 0
        if (meters <= 0) return totalSeconds
        const kmh = speedNow(Math.min(1, t / totalSeconds))
        const stepMeters = (kmh / 3.6) * 0.1 * PRESENTATION_BOOST * simSpeed
        return Math.min(totalSeconds, t + (stepMeters / meters) * totalSeconds)
      }),
      100,
    )
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, paused, totalSeconds, simSpeed, streetRoute, cruise, trafficSlowdown])
  useEffect(() => {
    if (screen !== "navigation" || !streetRoute || stopArrival !== null) return
    const index = streetRoute.stopProgress.findIndex(
      (value, i) => i > reachedStop && progress >= value - 0.001,
    )
    if (index >= 0 && index < options.stops.length) {
      setReachedStop(index)
      setStopArrival(index)
      setPaused(true)
    }
  }, [screen, streetRoute, progress, reachedStop, stopArrival, options.stops.length])
  useEffect(() => {
    if (screen === "navigation" && progress >= 1) {
      setNavMenuOpen(false)
      setScreen("finish")
    }
  }, [progress, screen])

  function showToast(message: string) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(""), 3500)
  }
  function go(next: Screen) {
    routeRequest.current?.abort()
    routeRequest.current = null
    setRouteLoading(false)
    setScreen(next)
  }
  // Abre uma tela por cima da atual (o "voltar" retorna para ela)
  function push(next: Screen) {
    backStack.current.push(screen)
    setRouteError("")
    setMenuOpen(false)
    go(next)
  }
  function back(levels = 1) {
    let previous: Screen = "map"
    for (let i = 0; i < levels; i++) previous = backStack.current.pop() ?? "map"
    setRouteError("")
    go(previous)
  }

  // ---------------------------------------------------------------------
  // Conta (PROTÓTIPO): qualquer e-mail e senha entram, o Google só avança.
  // Cada e-mail tem um perfil guardado no navegador (atalhos + favoritos),
  // que é carregado de volta quando a mesma conta entra de novo.
  // ---------------------------------------------------------------------
  function resetAuthForm() {
    setAuthPassword("")
    setAuthConfirm("")
    setShowPassword(false)
  }
  function openAuth(next: "login" | "signup") {
    resetAuthForm()
    go(next)
  }
  function enterAccount(email: string, provider: User["provider"], typedName = "") {
    const key = email.trim().toLowerCase() || GUEST_EMAIL
    const stored = loadStored<Record<string, StoredProfile>>(PROFILES_KEY, {})[key]
    const name = typedName.trim() || stored?.name || nameFromEmail(key)
    // Conta sem nenhum lugar salvo recebe Casa, Trabalho e favoritos de exemplo
    const empty = !stored
      || (!Object.keys(stored.shortcuts ?? {}).length && !(stored.favorites?.length))
    const shortcutsToLoad = empty ? DEMO_SHORTCUTS : stored?.shortcuts ?? {}
    const favoritesToLoad = empty ? DEMO_FAVORITES : stored?.favorites ?? []
    const savedPlaces = Object.keys(shortcutsToLoad).length + favoritesToLoad.length
    setUser({ name, email: key, provider })
    setShortcuts(shortcutsToLoad)
    setFavorites(favoritesToLoad)
    setRecents(stored?.recents ?? [])
    resetAuthForm()
    const first = name.split(" ")[0]
    showToast(
      `${stored ? "Bem-vindo de volta" : "Olá"}, ${first}! ${savedPlaces} ${savedPlaces === 1 ? "lugar salvo carregado" : "lugares salvos carregados"}.`,
    )
    go("location")
  }
  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    enterAccount(authEmail, "email")
  }
  function handleSignup(event: React.FormEvent) {
    event.preventDefault()
    enterAccount(authEmail, "email", authName)
  }
  function handleGoogle() {
    setAuthLoading(true)
    window.setTimeout(() => {
      setAuthLoading(false)
      enterAccount(GOOGLE_EMAIL, "google", "Vya")
    }, 600)
  }
  function handleGuest() {
    setUser(null)
    setShortcuts({})
    setFavorites([])
    setRecents([])
    resetAuthForm()
    go("location")
  }
  // Fecha o app e volta para a tela do celular (ao reabrir, continua no mapa)
  function closeApp() {
    setMenuOpen(false)
    resumeScreen.current = "map"
    backStack.current = []
    go("launcher")
  }
  function logout() {
    resumeScreen.current = "welcome"
    setUser(null)
    setShortcuts({})
    setFavorites([])
    setRecents([])
    setDestination(null)
    setStreetRoute(null)
    setRouteCandidates([])
    setMenuOpen(false)
    setOptions((current) => ({ ...current, stops: [] }))
    backStack.current = []
    go("welcome")
  }

  // PROTÓTIPO: "aceita" a localização na hora, sem pedir o GPS de verdade.
  function requestLocation() {
    setLocating(true)
    setLocationStatus("")
    window.setTimeout(() => {
      setLocating(false)
      setOriginPoint({ ...defaultOrigin, name: "Sua localização atual" })
      setOriginLabel("Localização atual · Prado Ferreira–PR")
      setLocationStatus("Localização encontrada. Abrindo o mapa…")
      window.setTimeout(() => go("map"), 600)
    }, 700)
  }

  // ---------------------------------------------------------------------
  // Rota
  // ---------------------------------------------------------------------
  // Calcula a rota até o destino com as opções escolhidas (locomoção, paradas,
  // evitar pedágios/terra). Devolve true quando deu certo.
  async function choose(point: Point, opts: RouteOptionsState = options): Promise<boolean> {
    routeRequest.current?.abort()
    const controller = new AbortController()
    routeRequest.current = controller
    lastPick.current = point
    setRouteLoading(true)
    setRouteError("")
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const alternatives = await calculateRouteAlternatives(
        originPoint,
        point,
        controller.signal,
        opts,
        unpavedStreets,
      )
      if (routeRequest.current !== controller) return false
      const result = pickBestRoute(alternatives, opts)
      if (result.distanceMeters < 1) throw new Error("Escolha um destino diferente do ponto de partida.")
      setRouteCandidates(alternatives)
      setStreetRoute(result)
      // The destination marker sits on the reachable street, not inside a building.
      const manualMapPoint = point.name.startsWith("Ponto em Prado Ferreira")
      const reached: Point = {
        ...point,
        ...result.points[result.points.length - 1],
        name: manualMapPoint ? result.destinationStreet : point.name,
      }
      setDestination(reached)
      setRecents((current) => [
        reached,
        ...current.filter((item) => !(item.name === reached.name || samePlace(item, reached))),
      ].slice(0, MAX_RECENTS))
      setElapsed(0)
      setPaused(false)
      setRecalc(null)
      backStack.current = []
      go("route")
      return true
    } catch (error) {
      if (routeRequest.current !== controller) return false
      setRouteError(controller.signal.aborted
        ? "O cálculo demorou mais que o esperado. Verifique sua conexão e tente novamente."
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
  // Muda uma opção (modo, paradas, evitar...). Se já existe uma rota,
  // recalcula; se falhar, volta à opção anterior.
  async function applyOptions(patch: Partial<RouteOptionsState>): Promise<boolean> {
    const previous = options
    const next = { ...previous, ...patch }
    setOptions(next)
    if (!lastPick.current || !destination) return true
    const ok = await choose(lastPick.current, next)
    if (!ok) setOptions(previous)
    return ok
  }

  // Tipo de rota: liga/desliga uma preferência e escolhe na hora o melhor
  // caminho entre os já calculados (sem esperar o servidor)
  function toggleRouteType(key: RouteTypeKey) {
    const next = { ...options, [key]: !options[key] }
    setOptions(next)
    if (routeCandidates.length) setStreetRoute(pickBestRoute(routeCandidates, next))
  }
  function fastestOnly() {
    const next = { ...options, avoidTolls: false, avoidUnpaved: false, avoidPotholes: false, avoidTraffic: false }
    setOptions(next)
    if (routeCandidates.length) setStreetRoute(pickBestRoute(routeCandidates, next))
  }
  // O usuário também pode tocar direto num dos caminhos
  function selectRoute(route: StreetRoute) {
    setStreetRoute(route)
  }

  // Toque em um local/rua/mapa na tela inicial: traça a rota até lá
  function handlePick(point: Point) {
    choose(point)
  }

  // Nome amigável para um ponto tocado no mapa (rua mais próxima)
  function friendlyName(point: Point): Point {
    if (!point.name.startsWith("Ponto em Prado Ferreira")) return point
    let best = { name: "", distance: Infinity }
    for (const street of streets) {
      if (street.name === "Via sem nome" || street.points.length < 2) continue
      const { distance: gap } = projectOnRoute(street.points, point)
      if (gap < best.distance) best = { name: street.name, distance: gap }
    }
    if (best.distance <= 80) return { ...point, name: `Próximo à ${best.name}` }
    // sem rua por perto: usa o estabelecimento mais próximo como referência
    let nearPlace = { name: "", distance: Infinity }
    for (const place of cityPlaces) {
      const gap = Math.hypot(place.x - point.x, place.y - point.y)
      if (gap < nearPlace.distance) nearPlace = { name: place.name, distance: gap }
    }
    if (nearPlace.distance <= 140) return { ...point, name: `Perto de ${nearPlace.name}` }
    return { ...point, name: "Ponto no mapa" }
  }

  // Casa / Trabalho
  function saveShortcut(key: ShortcutKey, point: Point) {
    setShortcuts((current) => ({
      ...current,
      [key]: { x: point.x, y: point.y, name: point.name },
    }))
    showToast(`${SHORTCUT_LABEL[key]} definido: ${point.name}`)
  }
  function removeShortcut(key: ShortcutKey) {
    setShortcuts((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    showToast(`${SHORTCUT_LABEL[key]} removido.`)
  }
  function goShortcut(key: ShortcutKey) {
    const saved = shortcuts[key]
    if (saved) choose({ ...saved, name: SHORTCUT_LABEL[key], detail: saved.name })
    else openSetPlace(key)
  }

  // Favoritos: adiciona ou remove um lugar da conta
  function isFavorite(name: string) {
    return favorites.some((favorite) => favorite.name === name)
  }
  function toggleFavorite(place: Point) {
    if (isFavorite(place.name)) {
      setFavorites((current) => current.filter((favorite) => favorite.name !== place.name))
      showToast(`${place.name} removido dos favoritos.`)
      return
    }
    setFavorites((current) => [
      ...current,
      { x: place.x, y: place.y, name: place.name },
    ])
    showToast(
      user
        ? `${place.name} adicionado aos favoritos.`
        : `${place.name} favoritado. Entre numa conta para guardar.`,
    )
  }

  // ---- Abrir telas ----
  function openSearch() {
    setQuery("")
    setSearchResults([])
    setCategory("Todos")
    setShowAllPlaces(false)
    push("search")
  }
  function openSetPlace(key: ShortcutKey) {
    setPlaceKey(key)
    setPlaceQuery("")
    push("setPlace")
  }
  function openMapPick(target: PickTarget) {
    setPickTarget(target)
    setPickPoint(null)
    push("mapPick")
  }
  function openStops() {
    setDraftStops(options.stops)
    setStopAdding(options.stops.length === 0)
    setStopQuery("")
    push("stops")
  }
  function openPrefs() {
    setPrefsDraft({
      avoidTolls: options.avoidTolls,
      avoidUnpaved: options.avoidUnpaved,
      avoidPotholes: options.avoidPotholes,
      avoidTraffic: options.avoidTraffic,
    })
    push("prefs")
  }

  // Volta da prévia da rota para a busca de destino
  function backFromRoute() {
    setDestination(null)
    setStreetRoute(null)
    setRouteCandidates([])
    setRouteError("")
    setSaveSheetOpen(false)
    setOptions((current) => ({ ...current, stops: [] }))
    lastPick.current = null
    backStack.current = ["map"]
    go("search")
  }

  // Paradas (rascunho na tela "Paradas"; a rota só recalcula ao concluir)
  function addDraftStop(place: Point) {
    setDraftStops((current) => [
      ...current,
      { x: place.x, y: place.y, name: place.name, detail: place.detail },
    ])
    setStopAdding(false)
    setStopQuery("")
  }
  // Reorganiza as paradas pelo caminho mais curto (sempre vai para a mais próxima)
  function optimizeStops() {
    const left = [...draftStops]
    const ordered: Point[] = []
    let from: MapPoint = originPoint
    while (left.length) {
      let best = 0
      left.forEach((stop, i) => {
        if (Math.hypot(stop.x - from.x, stop.y - from.y)
          < Math.hypot(left[best].x - from.x, left[best].y - from.y)) best = i
      })
      const [next] = left.splice(best, 1)
      ordered.push(next)
      from = next
    }
    const changed = ordered.some((stop, i) => stop !== draftStops[i])
    setDraftStops(ordered)
    showToast(changed ? "Paradas organizadas pelo caminho mais curto." : "As paradas já estão na melhor ordem.")
  }
  // Trocar o destino mantendo as paradas
  function changeDestination() {
    setOptions((current) => ({ ...current, stops: draftStops }))
    setQuery("")
    setSearchResults([])
    setCategory("Todos")
    setShowAllPlaces(false)
    push("search")
  }
  function removeDraftStop(index: number) {
    setDraftStops((current) => current.filter((_, i) => i !== index))
  }
  function moveDraftStop(index: number, delta: number) {
    setDraftStops((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  async function confirmStops() {
    const same = draftStops.length === options.stops.length
      && draftStops.every((stop, i) =>
        stop.name === options.stops[i].name && samePlace(stop, options.stops[i]))
    if (same) {
      back()
      return
    }
    await applyOptions({ stops: draftStops })
  }
  const stopSuggestions = useMemo(
    () => suggest(stopQuery, 8, draftStops.map((stop) => stop.name))
      .filter((item) => !samePlace(item.point, destination)
        && !draftStops.some((stop) => samePlace(stop, item.point))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityPlaces, streets, stopQuery, destination, draftStops],
  )
  // Seus locais (Casa, Trabalho, favoritos e recentes) também viram parada.
  // A comparação é pela localização: dois lugares com o mesmo nome não se escondem.
  const savedStopOptions = useMemo(() => {
    const q = normalize(stopQuery.trim())
    const items: Suggestion[] = []
    const reasonFor = (point: MapPoint) =>
      samePlace(point, destination)
        ? "É o destino desta rota"
        : draftStops.some((stop) => samePlace(stop, point)) ? "Já está na rota" : ""
    const add = (item: Suggestion, keepWhenTaken = false) => {
      if (items.some((other) => samePlace(other.point, item.point))) return
      if (q && !normalize(`${item.title} ${item.subtitle}`).includes(q)) return
      const reason = reasonFor(item.point)
      if (reason && !keepWhenTaken) return
      items.push(reason ? { ...item, subtitle: `${reason} · ${item.subtitle}`, disabled: true } : item)
    }
    ;(["home", "work"] as ShortcutKey[]).forEach((key) => {
      const saved = shortcuts[key]
      if (!saved) return
      // Casa e Trabalho sempre aparecem (desativados quando já estão na rota)
      add({
        id: `shortcut-${key}`,
        point: { x: saved.x, y: saved.y, name: SHORTCUT_LABEL[key], detail: saved.name },
        title: SHORTCUT_LABEL[key],
        subtitle: saved.name,
        icon: SHORTCUT_ICON[key],
      }, true)
    })
    favorites.forEach((favorite, i) => add({
      id: `fav-${i}`, point: favorite, title: favorite.name, subtitle: "Favorito", icon: "starfill",
    }))
    recents.forEach((recent, i) => add({
      id: `recent-${i}`, point: recent, title: recent.name, subtitle: recent.detail ? `Recente · ${recent.detail}` : "Recente", icon: "clock",
    }))
    return items
  }, [stopQuery, destination, draftStops, shortcuts, favorites, recents])
  const missingShortcuts = (["home", "work"] as ShortcutKey[]).filter((key) => !shortcuts[key])

  // Opções de rota
  function applyPrefs() {
    const changed = ROUTE_TYPES.some(({ key }) => prefsDraft[key] !== options[key])
    if (changed) {
      const next = { ...options, ...prefsDraft }
      setOptions(next)
      if (routeCandidates.length && destination) {
        const best = pickBestRoute(routeCandidates, next)
        setStreetRoute(best)
        showToast("Tipo de rota atualizado.")
      } else {
        showToast("Opções de rota salvas.")
      }
    }
    back()
  }

  // Escolher no mapa
  function confirmMapPick() {
    if (!pickPoint) return
    if (pickTarget.kind === "destination") {
      choose(pickPoint)
    } else if (pickTarget.kind === "shortcut") {
      saveShortcut(pickTarget.key, pickPoint)
      back(2)
    } else {
      addDraftStop(pickPoint)
      back()
    }
  }

  // Reportar acidente, obras ou buraco
  function submitReport(kind: HazardKind) {
    const point = screen === "navigation" && streetRoute
      ? pointAlongRoute(streetRoute.points, progress)
      : originPoint
    setReports((current) => [
      ...current,
      { id: `report-${Date.now()}`, kind, point: { x: point.x, y: point.y } },
    ])
    setReportOpen(false)
    showToast(`${HAZARD_META[kind].label} reportado. Obrigado por ajudar!`)
  }

  // Simula sair da rota e mede o tempo para recalcular (meta: até 3 segundos)
  async function simulateDetour() {
    if (!streetRoute || !destination || recalc?.status === "running") return
    setNavMenuOpen(false)
    const here = pointAlongRoute(streetRoute.points, progress)
    const ahead = pointAlongRoute(streetRoute.points, Math.min(1, progress + 0.01))
    const dx = ahead.x - here.x
    const dy = ahead.y - here.y
    const length = Math.hypot(dx, dy) || 1
    const off: MapPoint = {
      x: Math.min(980, Math.max(20, here.x - (dy / length) * 40)),
      y: Math.min(820, Math.max(20, here.y + (dx / length) * 40)),
    }
    const remainingStops = options.stops.filter(
      (_, i) => (streetRoute.stopProgress[i] ?? 0) > progress,
    )
    const next: RouteOptionsState = { ...options, stops: remainingStops }
    routeRequest.current?.abort()
    const controller = new AbortController()
    routeRequest.current = controller
    setPaused(true)
    setRecalc({ status: "running" })
    const started = performance.now()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const result = await calculateStreetRoute(
        off,
        destination,
        controller.signal,
        next,
        unpavedStreets,
      )
      if (routeRequest.current !== controller) return
      setOptions(next)
      setRouteCandidates([result])
      setStreetRoute(result)
      setElapsed(0)
      setPaused(false)
      setReachedStop(-1)
      setStopArrival(null)
      setRecalc({ status: "done", seconds: (performance.now() - started) / 1000 })
      window.setTimeout(() => setRecalc(null), 7000)
    } catch {
      if (routeRequest.current !== controller) return
      setPaused(false)
      setRecalc({ status: "error" })
      window.setTimeout(() => setRecalc(null), 6000)
    } finally {
      window.clearTimeout(timeout)
      if (routeRequest.current === controller) routeRequest.current = null
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const known = cityPlaces.find((p) =>
      normalize(p.name).includes(normalizedQuery)
      || normalize(p.address).includes(normalizedQuery),
    )
    if (known) {
      setSearchResults([])
      handlePick(known)
      return
    }
    const [knownStreet] = findStreets(query, 1)
    if (knownStreet) {
      setSearchResults([])
      handlePick({ x: knownStreet.x, y: knownStreet.y, name: knownStreet.name })
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
    setRouteCandidates([])
    setRouteError("")
    setQuery("")
    setSearchResults([])
    setElapsed(0)
    setRecalc(null)
    setMenuOpen(false)
    setNavMenuOpen(false)
    setSaveSheetOpen(false)
    setStopArrival(null)
    setOptions((current) => ({ ...current, stops: [] }))
    lastPick.current = null
    backStack.current = []
    go("map")
  }
  function continueFromStop() {
    setStopArrival(null)
    setPaused(false)
  }
  function startNavigation() {
    setElapsed(0)
    setPaused(false)
    setReachedStop(-1)
    setStopArrival(null)
    setNavMenuOpen(false)
    setSaveSheetOpen(false)
    go("navigation")
  }

  const stepIndex = screen === "welcome" ? 0 : screen === "location" ? 2 : 1
  const tolls = streetRoute?.tolls ?? []
  const noTollMode = options.mode === "walking" || options.mode === "cycling"
  const initial = user ? user.name[0].toUpperCase() : "V"
  // Tipos de rota na prévia
  const noTrafficMode = options.mode === "walking" || options.mode === "cycling"
  const noRouteType = !options.avoidTolls && !options.avoidUnpaved && !options.avoidPotholes && !options.avoidTraffic
  const recommendedRoute = routeCandidates.length ? pickBestRoute(routeCandidates, options) : null
  const currentNotes = streetRoute && routeCandidates.length
    ? routeNotes(streetRoute, routeCandidates, options)
    : streetRoute?.notes ?? []
  // Tempo do melhor caminho para cada tipo de rota (sozinho) e se ele é possível
  function typeOutcome(key?: RouteTypeKey) {
    if (!routeCandidates.length) return null
    const minutesOf = (route: StreetRoute) => Math.max(1, Math.ceil(route.durationSeconds / 60))
    if (!key) return { minutes: minutesOf(routeCandidates[0]), ok: true }
    const best = pickBestRoute(routeCandidates, { [key]: true })
    const ok = key === "avoidTolls"
      ? !best.tolls.length
      : key === "avoidPotholes"
        ? !best.potholes.length
        : key === "avoidUnpaved" ? !best.unpavedNames.length : true
    return { minutes: minutesOf(best), ok }
  }
  // Rótulo de cada caminho: no que ele se destaca em relação aos outros
  function routeTag(route: StreetRoute) {
    const others = routeCandidates.filter((other) => other.id !== route.id)
    if (route.id === routeCandidates[0]?.id) return "Mais rápida"
    if (!route.tolls.length && others.some((other) => other.tolls.length)) return "Sem pedágio"
    if (others.every((other) => route.trafficDelaySeconds < other.trafficDelaySeconds - 10)) return "Menos trânsito"
    if (others.every((other) => route.potholes.length < other.potholes.length)) return "Menos buracos"
    if (others.every((other) => route.distanceMeters < other.distanceMeters)) return "Mais curta"
    return "Alternativa"
  }
  // Estimativa de tempo de cada tipo de locomoção para a lista da prévia
  function etaFor(mode: TransportMode) {
    if (mode === options.mode) return { minutes: duration, estimate: false }
    const config = getTransport(mode)
    return {
      minutes: Math.max(1, Math.round((distance / config.cruiseKmh) * 60)),
      estimate: true,
    }
  }

  // Configuração do mapa para cada tela
  const mapConfig: {
    mode: MapMode
    padTop: number
    padBottom: number
    controls: boolean
    controlsBottom: number
  } = screen === "route"
    ? { mode: "fit", padTop: 0.1, padBottom: 0.64, controls: false, controlsBottom: 0 }
    : screen === "navigation"
      ? { mode: "follow", padTop: 0.2, padBottom: 0.14, controls: true, controlsBottom: 118 }
      : screen === "finish"
        ? { mode: "fit", padTop: 0.06, padBottom: 0.52, controls: false, controlsBottom: 0 }
        : screen === "mapPick"
          ? { mode: "explore", padTop: 0.12, padBottom: 0.26, controls: true, controlsBottom: 200 }
          : { mode: "explore", padTop: 0.08, padBottom: 0.42, controls: true, controlsBottom: 0 }
  const fullPage = screen === "search" || screen === "stops" || screen === "saved"
    || screen === "setPlace" || screen === "prefs"
  const homeSuggestions: Point[] = recents.length
    ? recents.slice(0, 3)
    : verifiedPlaces.slice(0, 3).map((place) => ({ x: place.x, y: place.y, name: place.name }))
  const placeSuggestions = suggest(placeQuery, 8)

  return (
    <div ref={appRef} className={`app screen-${screen} ${screen === "launcher" ? "launcher-app" : isAuth ? "auth-app" : "vx-app"}`}>
      {screen !== "launcher" && (
        <div className="phone-status">
          <StatusBar tone={isAuth ? "light" : "app"} />
        </div>
      )}
      {isAuth && (
        <header className="app-header">
          <button className="logo-button" onClick={() => go("welcome")}>
            <Logo compact />
          </button>
          <div className="header-center">
            <span className="status-dot" />
            Seu próximo caminho começa aqui
          </div>
          <span className="prototype-badge">PROTÓTIPO INTERATIVO</span>
        </header>
      )}
      {screen === "launcher" ? (
        <PhoneHome
          onOpenStart={() => setToast("")}
          onOpened={() => go(resumeScreen.current)}
          onOtherApp={() => { /* apps ilustrativos: só balançam */ }}
        />
      ) : isAuth ? (
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
                {screen === "location" ? (
                  <>Sua posição.<br />Seu ponto de <span>partida.</span></>
                ) : screen === "login" ? (
                  <>Que bom te<br />ver <span>de novo.</span></>
                ) : screen === "signup" ? (
                  <>Seu caminho<br />merece uma <span>conta.</span></>
                ) : (
                  <>Seu caminho<br />começa na <span>Vya.</span></>
                )}
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
              {["Boas-vindas", "Conta", "Localização"].map((label, i) => (
                <div
                  className={i === stepIndex ? "active" : ""}
                  key={label}
                >
                  <span>
                    {i < stepIndex ? (
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
              {screen === "login" && (
                <>
                  <span className="form-icon">
                    <Icon name="user" size={28} />
                  </span>
                  <div className="eyebrow">ACESSE SUA CONTA</div>
                  <h2>
                    Entre para
                    <br />seguir caminho.
                  </h2>
                  <p className="demo-account">
                    <strong>Protótipo:</strong> digite qualquer e-mail e senha. Se o e-mail já
                    tiver sido usado, seus lugares salvos são carregados.
                  </p>
                  <form className="auth-form" onSubmit={handleLogin} noValidate>
                    <label>
                      E-mail
                      <div className="input-wrap">
                        <Icon name="mail" size={18} />
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="voce@email.com"
                          value={authEmail}
                          onChange={(e) => { setAuthEmail(e.target.value) }}
                        />
                      </div>
                    </label>
                    <label>
                      Senha
                      <div className="input-wrap">
                        <Icon name="lock" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Sua senha"
                          value={authPassword}
                          onChange={(e) => { setAuthPassword(e.target.value) }}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          <Icon name={showPassword ? "eyeoff" : "eye"} size={18} />
                        </button>
                      </div>
                    </label>
                    <button className="primary" disabled={authLoading}>
                      Entrar
                      <Icon name="arrow" size={19} />
                    </button>
                  </form>
                  <div className="auth-divider"><span>ou</span></div>
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogle}
                    disabled={authLoading}
                  >
                    <GoogleMark />
                    {authLoading ? "Conectando…" : "Continuar com Google"}
                  </button>
                  <div className="auth-switch">
                    Ainda não tem conta?
                    <button type="button" onClick={() => openAuth("signup")}>
                      Criar conta
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <button className="text-button" onClick={handleGuest}>
                    Continuar sem conta
                  </button>
                </>
              )}
              {screen === "signup" && (
                <>
                  <span className="form-icon">
                    <Icon name="user" size={28} />
                  </span>
                  <div className="eyebrow">CRIE SUA CONTA</div>
                  <h2>
                    Vamos criar
                    <br />o seu acesso.
                  </h2>
                  <p className="form-intro">
                    Use seu e-mail e uma senha, ou entre direto com o Google.
                  </p>
                  <form className="auth-form" onSubmit={handleSignup} noValidate>
                    <label>
                      Nome
                      <div className="input-wrap">
                        <Icon name="user" size={18} />
                        <input
                          autoComplete="name"
                          placeholder="Como devemos te chamar?"
                          value={authName}
                          onChange={(e) => { setAuthName(e.target.value) }}
                        />
                      </div>
                    </label>
                    <label>
                      E-mail
                      <div className="input-wrap">
                        <Icon name="mail" size={18} />
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="voce@email.com"
                          value={authEmail}
                          onChange={(e) => { setAuthEmail(e.target.value) }}
                        />
                      </div>
                    </label>
                    <label>
                      Senha
                      <div className="input-wrap">
                        <Icon name="lock" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Mínimo de 6 caracteres"
                          value={authPassword}
                          onChange={(e) => { setAuthPassword(e.target.value) }}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          <Icon name={showPassword ? "eyeoff" : "eye"} size={18} />
                        </button>
                      </div>
                    </label>
                    <label>
                      Confirmar senha
                      <div className="input-wrap">
                        <Icon name="lock" size={18} />
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Repita a senha"
                          value={authConfirm}
                          onChange={(e) => { setAuthConfirm(e.target.value) }}
                        />
                      </div>
                    </label>
                    <button className="primary" disabled={authLoading}>
                      Criar conta
                      <Icon name="arrow" size={19} />
                    </button>
                  </form>
                  <div className="auth-divider"><span>ou</span></div>
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogle}
                    disabled={authLoading}
                  >
                    <GoogleMark />
                    {authLoading ? "Conectando…" : "Continuar com Google"}
                  </button>
                  <div className="auth-switch">
                    Já tem uma conta?
                    <button type="button" onClick={() => openAuth("login")}>
                      Entrar
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                </>
              )}
              {screen === "location" && (
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
              )}
              {screen === "welcome" && (
                <>
                  <span className="form-icon"><Icon name="road" size={28} /></span>
                  <div className="eyebrow">BEM-VINDO AO VYA</div>
                  <h2>Pronto para<br />seguir caminho?</h2>
                  <p className="form-intro">Entre com a sua conta ou crie uma em segundos para explorar a cidade, encontrar lugares e traçar sua próxima rota.</p>
                  <button className="primary" onClick={() => openAuth("login")}>Entrar<Icon name="arrow" size={20} /></button>
                  <button className="secondary" onClick={() => openAuth("signup")}>Criar conta<Icon name="user" size={19} /></button>
                  <button className="text-button guest-entry" onClick={handleGuest}>Entrar sem conta</button>
                  <div className="guest-benefits"><div><Icon name="check" size={16} />Todas as ruas da cidade</div><div><Icon name="check" size={16} />Comércios e serviços próximos</div><div><Icon name="check" size={16} />Rotas reais, passo a passo</div></div>
                  <div className="demo-banner"><Icon name="shield" size={18} /><p><strong>Cartografia real, navegação simulada.</strong>As contas deste protótipo são fictícias e ficam só no seu navegador.</p></div>
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
        <main className="vx">
          {/* ---------- Mapa (fica sempre por baixo) ---------- */}
          <MapView
            destination={routeVisible ? destination : null}
            progress={screen === "finish" ? 1 : screen === "navigation" ? progress : 0}
            interactive={screen === "map" || screen === "mapPick"}
            onPick={screen === "mapPick" ? (point) => setPickPoint(friendlyName(point)) : handlePick}
            origin={originPoint}
            places={cityPlaces}
            streets={streets}
            streetRoute={streetRoute}
            hazards={mapHazards}
            tolls={screen === "route" ? streetRoute?.worldTolls ?? tolls : routeVisible ? tolls : []}
            stops={routeVisible ? streetRoute?.stopPoints ?? [] : []}
            pin={screen === "mapPick" ? pickPoint : null}
            savedPins={(["home", "work"] as ShortcutKey[]).flatMap((key) => {
              const saved = shortcuts[key]
              return saved
                ? [{
                    id: key,
                    icon: SHORTCUT_ICON[key],
                    label: SHORTCUT_LABEL[key],
                    point: { x: saved.x, y: saved.y, name: SHORTCUT_LABEL[key], detail: saved.name },
                  }]
                : []
            })}
            alternatives={screen === "route"
              ? routeCandidates.filter((route) => route.id !== streetRoute?.id).map((route) => route.points)
              : []}
            traffic={noTrafficMode ? [] : screen === "route"
              ? streetRoute?.worldTraffic ?? []
              : routeVisible ? streetRoute?.trafficSegments ?? [] : []}
            mode={mapConfig.mode}
            viewKey={`${screen}-${routeCandidates.map((route) => route.distanceMeters).join("|")}-${screen === "route" ? "" : streetRoute?.distanceMeters ?? 0}`}
            padTop={mapConfig.padTop}
            padBottom={mapConfig.padBottom}
            showControls={mapConfig.controls && !fullPage}
            controlsBottom={mapConfig.controlsBottom}
          />
          <div className="vx-osm">© OpenStreetMap</div>

          {/* ================= INÍCIO ================= */}
          {screen === "map" && (
            <>
              <div className="vx-top">
                <button type="button" className="vx-avatar" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
                  <span>{initial}</span>
                </button>
                <div className="vx-chip">
                  <span className="status-dot" />
                  Prado Ferreira · PR
                </div>
                <button type="button" className="vx-fab vx-fab-report" aria-label="Reportar na via" onClick={() => setReportOpen(true)}>
                  <Icon name="alert" size={21} />
                </button>
              </div>
              <section className="vx-sheet vx-home-sheet">
                <div className="vx-grip" />
                <p className="vx-hello">
                  {user ? `Olá, ${firstName}!` : "Olá!"} <span>Toque no mapa ou busque um destino.</span>
                </p>
                <button type="button" className="vx-where" onClick={openSearch}>
                  <Icon name="search" size={21} />
                  <span>Para onde vamos?</span>
                  <span className="vx-where-mode" aria-label={`Locomoção: ${transport.label}`}>
                    <Icon name={transport.icon} size={17} />
                  </span>
                </button>
                {routeLoading && (
                  <p className="vx-status"><span className="spinner" />Calculando rota pelas ruas…</p>
                )}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
                <div className="vx-chips" role="group" aria-label="Atalhos">
                  {(["home", "work"] as ShortcutKey[]).map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={`vx-shortcut ${shortcuts[key] ? "" : "empty"}`}
                      onClick={() => goShortcut(key)}
                    >
                      <span className="vx-shortcut-icon"><Icon name={SHORTCUT_ICON[key]} size={18} /></span>
                      <span className="vx-shortcut-text">
                        <strong>{SHORTCUT_LABEL[key]}</strong>
                        <small>{shortcuts[key]?.name ?? "Definir"}</small>
                      </span>
                    </button>
                  ))}
                  {favorites.slice(0, 4).map((favorite) => (
                    <button type="button" key={favorite.name} className="vx-shortcut" onClick={() => choose(favorite)}>
                      <span className="vx-shortcut-icon star"><Icon name="starfill" size={16} /></span>
                      <span className="vx-shortcut-text">
                        <strong>{favorite.name}</strong>
                        <small>Favorito</small>
                      </span>
                    </button>
                  ))}
                  <button type="button" className="vx-shortcut more" onClick={() => push("saved")}>
                    <span className="vx-shortcut-icon"><Icon name="bookmark" size={17} /></span>
                    <span className="vx-shortcut-text">
                      <strong>Salvos</strong>
                      <small>Ver todos</small>
                    </span>
                  </button>
                </div>
                <div className="vx-section-title">{recents.length ? "Recentes" : "Sugestões por perto"}</div>
                <div className="vx-list">
                  {homeSuggestions.map((place) => (
                    <ListRow
                      key={place.name}
                      icon={recents.length ? "clock" : "pin"}
                      title={place.name}
                      subtitle="Prado Ferreira–PR"
                      onClick={() => choose(place)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ================= PARA ONDE? (busca) ================= */}
          {screen === "search" && (
            <div className="vx-page">
              <PageHeader title="Para onde?" onBack={() => back()} />
              <form className="vx-fields" onSubmit={search}>
                <div className="vx-fields-rail" aria-hidden="true">
                  <span className="dot origin" />
                  <span className="line" />
                  <span className="dot dest" />
                </div>
                <div className="vx-fields-inputs">
                  <div className="vx-field static">
                    <span>{originPoint.name === "Sua localização atual" ? "Sua localização atual" : "Sua localização"}</span>
                    <small>{originLabel}</small>
                  </div>
                  <div className="vx-field active">
                    <input
                      aria-label="Buscar destino"
                      placeholder="Busque rua, endereço ou local"
                      value={query}
                      autoFocus
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setSearchResults([])
                        setRouteError("")
                        setShowAllPlaces(false)
                      }}
                    />
                    {query && (
                      <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(""); setSearchResults([]) }}>
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
              <div className="vx-page-body">
                {routeLoading && <p className="vx-status"><span className="spinner" />Calculando rota pelas ruas…</p>}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
                {searching && <p className="vx-status"><span className="spinner" />Buscando em Prado Ferreira…</p>}

                {!query.trim() && (
                  <>
                    <div className="vx-list">
                      {(["home", "work"] as ShortcutKey[]).map((key) => (
                        <ListRow
                          key={key}
                          icon={SHORTCUT_ICON[key]}
                          tone="brand"
                          title={SHORTCUT_LABEL[key]}
                          subtitle={shortcuts[key]?.name ?? "Toque para definir o endereço"}
                          onClick={() => goShortcut(key)}
                          trailing={shortcuts[key] && (
                            <button type="button" className="vx-row-action" aria-label={`Alterar ${SHORTCUT_LABEL[key]}`} onClick={() => openSetPlace(key)}>
                              <Icon name="edit" size={16} />
                            </button>
                          )}
                        />
                      ))}
                      <ListRow
                        icon="map"
                        tone="lime"
                        title="Escolher no mapa"
                        subtitle="Marque o destino tocando no mapa"
                        onClick={() => openMapPick({ kind: "destination" })}
                      />
                    </div>
                    {favorites.length > 0 && (
                      <>
                        <div className="vx-section-title">Favoritos</div>
                        <div className="vx-list">
                          {favorites.map((favorite) => (
                            <ListRow
                              key={favorite.name}
                              icon="starfill"
                              tone="lime"
                              title={favorite.name}
                              subtitle="Favorito"
                              onClick={() => choose(favorite)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {recents.length > 0 && (
                      <>
                        <div className="vx-section-title">Recentes</div>
                        <div className="vx-list">
                          {recents.map((recent) => (
                            <ListRow
                              key={recent.name}
                              icon="clock"
                              tone="muted"
                              title={recent.name}
                              subtitle="Prado Ferreira–PR"
                              onClick={() => choose(recent)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {query.trim() && (
                  <>
                    <div className="vx-section-title first">
                      Ruas<span>{streetMatches.length}</span>
                    </div>
                    <div className="vx-list">
                      {streetMatches.map((street) => (
                        <ListRow
                          key={street.id}
                          icon="road"
                          tone="brand"
                          title={street.name}
                          subtitle={street.aliases?.length ? `${street.aliases.join(" · ")} · Prado Ferreira–PR` : "Prado Ferreira–PR"}
                          onClick={() => handlePick({ x: street.x, y: street.y, name: street.name })}
                        />
                      ))}
                      {streetMatches.length === 0 && (
                        <p className="vx-empty">Nenhuma rua com “{query.trim()}”. Confira os locais abaixo ou escolha no mapa.</p>
                      )}
                    </div>
                    {searchResults.length > 0 && (
                      <>
                        <div className="vx-section-title">Endereços</div>
                        <div className="vx-list">
                          {searchResults.map((result, index) => (
                            <ListRow
                              key={`${result.x}-${result.y}-${index}`}
                              icon="pin"
                              title={result.name}
                              subtitle={result.address || "Prado Ferreira–PR"}
                              onClick={() => handlePick(result)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="vx-section-title">
                  {query.trim() ? "Locais encontrados" : "Explorar a cidade"}
                  <span>{filteredPlaces.length}</span>
                </div>
                <div className="vx-cats" role="group" aria-label="Filtrar por categoria">
                  {categories.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`chip ${category === name ? "active" : ""}`}
                      aria-pressed={category === name}
                      onClick={() => { setCategory(name); setShowAllPlaces(false) }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {filteredPlaces.length === 0 ? (
                  <p className="vx-empty">
                    Nenhum local encontrado
                    {category !== "Todos" ? ` em “${category}”` : ""}.
                    {query.trim() ? " Tente outro nome ou escolha o ponto no mapa." : ""}
                  </p>
                ) : (
                  <div className="vx-list">
                    {(showAllPlaces ? filteredPlaces : filteredPlaces.slice(0, 8)).map((place) => {
                      const verified = verifiedIndex.get(place.id)
                      const favorite = isFavorite(place.name)
                      return (
                        <div className="vx-row" key={place.id}>
                          <button type="button" className="vx-row-main" onClick={() => handlePick(place)}>
                            <span className="vx-row-icon tone-brand num">
                              {verified !== undefined ? verified + 1 : <Icon name="store" size={18} />}
                            </span>
                            <span className="vx-row-text">
                              <strong>{place.name}</strong>
                              <small>{placeSubtitle(place)}</small>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`vx-row-action star ${favorite ? "on" : ""}`}
                            aria-pressed={favorite}
                            aria-label={favorite ? `Remover ${place.name} dos favoritos` : `Favoritar ${place.name}`}
                            onClick={() => toggleFavorite(place)}
                          >
                            <Icon name={favorite ? "starfill" : "star"} size={19} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {filteredPlaces.length > 8 && (
                  <button type="button" className="vx-more" onClick={() => setShowAllPlaces((value) => !value)}>
                    {showAllPlaces ? "Mostrar menos" : `Ver todos os ${filteredPlaces.length} locais`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================= PRÉVIA DA ROTA ================= */}
          {screen === "route" && destination && (
            <>
              <div className="vx-top">
                <button type="button" className="vx-fab" aria-label="Voltar" onClick={backFromRoute}>
                  <Icon name="back" size={22} />
                </button>
                <div className="vx-chip trip">
                  <span className="origin-dot-mini" />
                  <span className="vx-chip-text">{originPoint.name === "Sua localização atual" ? "Você" : "Centro"}</span>
                  <Icon name="arrow" size={14} />
                  <span className="vx-chip-text strong">{destination.name}</span>
                </div>
              </div>
              <section className="vx-sheet vx-route-sheet">
                <div className="vx-grip" />
                <div className="vx-dest">
                  <span className="vx-dest-pin"><Icon name="pin" size={20} /></span>
                  <div>
                    <small>Destino</small>
                    <strong>{destination.name}</strong>
                    {destination.detail && <em className="vx-dest-detail">{destination.detail}</em>}
                  </div>
                  <button
                    type="button"
                    className={`vx-round ${isFavorite(destination.name) ? "on" : ""}`}
                    aria-label="Salvar destino"
                    onClick={() => setSaveSheetOpen(true)}
                  >
                    <Icon name={isFavorite(destination.name) ? "starfill" : "bookmark"} size={19} />
                  </button>
                </div>

                <button type="button" className="vx-stops-row" onClick={openStops} disabled={routeLoading}>
                  <span className="vx-stops-icon"><Icon name="plus" size={16} /></span>
                  <span className="vx-stops-text">
                    {options.stops.length
                      ? <><strong>{options.stops.length} {options.stops.length === 1 ? "parada" : "paradas"}</strong><small>{options.stops.map((stop) => stop.name).join(" · ")}</small></>
                      : <strong>Adicionar parada</strong>}
                  </span>
                  <Icon name="chevron" size={18} />
                </button>

                <div className="vx-route-types" role="group" aria-label="Tipo de rota">
                  <button
                    type="button"
                    className={`vx-type ${noRouteType ? "active" : ""}`}
                    aria-pressed={noRouteType}
                    onClick={fastestOnly}
                  >
                    <Icon name="bolt" size={15} />Mais rápida
                    {typeOutcome() && <b>{typeOutcome()?.minutes} min</b>}
                  </button>
                  {ROUTE_TYPES.filter((type) => !(noTollMode && type.key === "avoidTolls")
                    && !(noTrafficMode && type.key === "avoidTraffic")).map((type) => (
                    <button
                      key={type.key}
                      type="button"
                      className={`vx-type ${options[type.key] ? "active" : ""}`}
                      aria-pressed={options[type.key]}
                      onClick={() => toggleRouteType(type.key)}
                    >
                      <Icon name={type.icon} size={15} />{type.label}
                      {(() => {
                        const outcome = typeOutcome(type.key)
                        if (!outcome) return null
                        return outcome.ok
                          ? <b>{outcome.minutes} min</b>
                          : <b className="none">sem opção</b>
                      })()}
                    </button>
                  ))}
                </div>

                <div className={`vx-routes ${routeLoading ? "loading" : ""}`} role="radiogroup" aria-label="Caminhos">
                  {routeCandidates.map((route) => {
                    const active = route.id === streetRoute?.id
                    const recommended = route.id === recommendedRoute?.id
                    return (
                      <button
                        key={route.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`vx-route-card ${active ? "active" : ""}`}
                        disabled={routeLoading}
                        onClick={() => selectRoute(route)}
                      >
                        <span className={`vx-route-tag ${recommended ? "rec" : ""}`}>
                          {recommended ? "Recomendada" : routeTag(route)}
                        </span>
                        <strong>{Math.max(1, Math.ceil(route.durationSeconds / 60))}<small> min</small></strong>
                        <span className="vx-route-km">{formatKm(route.distanceMeters / 1000)} km</span>
                        <span className="vx-route-badges">
                          {!noTrafficMode && (
                            <em className={route.trafficDelaySeconds >= 30 ? "bad" : "good"}>
                              <Icon name="traffic" size={13} />
                              {route.trafficDelaySeconds >= 30
                                ? `Trânsito +${Math.max(1, Math.round(route.trafficDelaySeconds / 60))} min`
                                : "Trânsito livre"}
                            </em>
                          )}
                          {!noTollMode && (
                            <em className={route.tolls.length ? "bad" : "good"}>
                              <Icon name="toll" size={13} />
                              {route.tolls.length ? formatBRL(route.tollTotal) : "Sem pedágio"}
                            </em>
                          )}
                          <em className={route.potholes.length ? "bad" : "good"}>
                            <Icon name="pothole" size={13} />
                            {route.potholes.length
                              ? `${route.potholes.length} ${route.potholes.length === 1 ? "buraco" : "buracos"}`
                              : "Sem buracos"}
                          </em>
                          {route.unpavedNames.length > 0 && (
                            <em className="bad"><Icon name="dirt" size={13} />Trecho de terra</em>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {routeCandidates.length === 1 && (
                  <p className="vx-hint small">Só existe um caminho pelas ruas para este trajeto.</p>
                )}
                {currentNotes.map((note) => (
                  <p className={`vx-note ${note.startsWith("Rota alternativa") ? "ok" : ""}`} key={note}>
                    <Icon name={note.startsWith("Rota alternativa") ? "check" : "alert"} size={15} />
                    {note}
                  </p>
                ))}

                <div className="vx-section-title">Como você vai?</div>
                <div className={`vx-modes-row ${routeLoading ? "loading" : ""}`} role="radiogroup" aria-label="Tipo de locomoção">
                  {TRANSPORT_MODES.map((item) => {
                    const eta = etaFor(item.id)
                    const active = item.id === options.mode
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`vx-mode-chip ${active ? "active" : ""}`}
                        disabled={routeLoading}
                        onClick={() => !active && applyOptions({ mode: item.id })}
                      >
                        <Icon name={item.icon} size={22} />
                        <strong>{item.label}</strong>
                        <small>{eta.estimate ? "≈ " : ""}{eta.minutes} min</small>
                      </button>
                    )
                  })}
                </div>
                {routeLoading && <p className="vx-status"><span className="spinner" />Recalculando rota…</p>}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}

                <div className="vx-route-actions">
                  <button type="button" className="vx-square" aria-label="Opções de rota" onClick={openPrefs} disabled={routeLoading}>
                    <Icon name="sliders" size={21} />
                  </button>
                  <button type="button" className="primary vx-go" onClick={startNavigation} disabled={routeLoading}>
                    Iniciar
                    <Icon name="nav" size={20} />
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ================= PARADAS ================= */}
          {screen === "stops" && destination && (
            <div className="vx-page">
              <PageHeader title="Paradas" onBack={() => back()} />
              <div className="vx-page-body">
                <div className="vx-timeline">
                  <div className="vx-tl-row">
                    <span className="vx-tl-dot origin" />
                    <div className="vx-tl-text"><small>Saindo de</small><strong>{originPoint.name}</strong></div>
                  </div>
                  {draftStops.map((stop, index) => (
                    <div className="vx-tl-row" key={`${stop.name}-${index}`}>
                      <span className="vx-tl-dot stop">{index + 1}</span>
                      <div className="vx-tl-text">
                        <small>Parada {index + 1}</small>
                        <strong>{stop.name}</strong>
                        {stop.detail && <span className="vx-tl-detail">{stop.detail}</span>}
                      </div>
                      <div className="vx-tl-actions">
                        {draftStops.length > 1 && (
                          <>
                            <button type="button" aria-label={`Mover ${stop.name} para cima`} disabled={index === 0} onClick={() => moveDraftStop(index, -1)}>
                              <Icon name="up" size={16} />
                            </button>
                            <button type="button" className="down" aria-label={`Mover ${stop.name} para baixo`} disabled={index === draftStops.length - 1} onClick={() => moveDraftStop(index, 1)}>
                              <Icon name="up" size={16} />
                            </button>
                          </>
                        )}
                        <button type="button" aria-label={`Remover parada ${stop.name}`} onClick={() => removeDraftStop(index)}>
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!stopAdding && (
                    <button type="button" className="vx-tl-add" onClick={() => setStopAdding(true)}>
                      <span className="vx-tl-dot add"><Icon name="plus" size={14} /></span>
                      Adicionar parada
                    </button>
                  )}
                  <div className="vx-tl-row">
                    <span className="vx-tl-dot dest"><Icon name="pin" size={14} /></span>
                    <div className="vx-tl-text">
                      <small>Chegando em</small>
                      <strong>{destination.name}</strong>
                      {destination.detail && <span className="vx-tl-detail">{destination.detail}</span>}
                    </div>
                    <button type="button" className="vx-tl-change" onClick={changeDestination}>Trocar</button>
                  </div>
                </div>
                {draftStops.length >= 2 && (
                  <button type="button" className="vx-optimize" onClick={optimizeStops}>
                    <Icon name="route" size={18} />
                    <span>
                      <strong>Organizar pela menor distância</strong>
                      <small>Coloca as paradas na ordem mais curta a partir de você</small>
                    </span>
                  </button>
                )}
                <p className="vx-hint">
                  Adicione quantas paradas quiser. A rota passa por elas na ordem da lista; use as setas para mudar a ordem.
                </p>

                {stopAdding && (
                  <div className="vx-add-stop">
                    <div className="vx-section-title">Nova parada</div>
                    <div className="vx-search">
                      <Icon name="search" size={19} />
                      <input
                        aria-label="Buscar parada"
                        placeholder="Mercado, farmácia, rua…"
                        value={stopQuery}
                        autoFocus
                        onChange={(e) => setStopQuery(e.target.value)}
                      />
                      {stopQuery && (
                        <button type="button" aria-label="Limpar" onClick={() => setStopQuery("")}><Icon name="close" size={15} /></button>
                      )}
                    </div>
                    <div className="vx-list">
                      <ListRow
                        icon="map"
                        tone="lime"
                        title="Escolher no mapa"
                        subtitle="Toque no mapa para marcar a parada"
                        onClick={() => openMapPick({ kind: "stop" })}
                      />
                    </div>
                    {(savedStopOptions.length > 0 || (!stopQuery.trim() && missingShortcuts.length > 0)) && (
                      <>
                        <div className="vx-section-title">Seus locais</div>
                        <div className="vx-list">
                          {savedStopOptions.map((item) => (
                            <ListRow
                              key={item.id}
                              icon={item.icon}
                              tone={item.icon === "starfill" ? "lime" : item.icon === "clock" ? "muted" : "brand"}
                              title={item.title}
                              subtitle={item.subtitle}
                              disabled={item.disabled}
                              onClick={() => addDraftStop(item.point)}
                            />
                          ))}
                          {!stopQuery.trim() && missingShortcuts.map((key) => (
                            <ListRow
                              key={`missing-${key}`}
                              icon={SHORTCUT_ICON[key]}
                              tone="brand"
                              title={SHORTCUT_LABEL[key]}
                              subtitle="Toque para definir o endereço"
                              onClick={() => openSetPlace(key)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    <div className="vx-section-title">Lugares</div>
                    <div className="vx-list">
                      {stopSuggestions.map((item) => (
                        <ListRow
                          key={item.id}
                          icon={item.icon}
                          title={item.title}
                          subtitle={item.subtitle}
                          onClick={() => addDraftStop(item.point)}
                        />
                      ))}
                      {stopSuggestions.length === 0 && <p className="vx-empty">Nenhum local encontrado.</p>}
                    </div>
                  </div>
                )}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
              </div>
              <footer className="vx-page-foot">
                <button type="button" className="primary" onClick={confirmStops} disabled={routeLoading}>
                  {routeLoading ? "Recalculando rota…" : "Concluir"}
                  {routeLoading ? <span className="spinner light" /> : <Icon name="check" size={20} />}
                </button>
              </footer>
            </div>
          )}

          {/* ================= LOCAIS SALVOS ================= */}
          {screen === "saved" && (
            <div className="vx-page">
              <PageHeader title="Locais salvos" onBack={() => back()} />
              <div className="vx-page-body">
                <div className="vx-list">
                  {(["home", "work"] as ShortcutKey[]).map((key) => (
                    <ListRow
                      key={key}
                      icon={SHORTCUT_ICON[key]}
                      tone="brand"
                      title={SHORTCUT_LABEL[key]}
                      subtitle={shortcuts[key]?.name ?? "Adicionar endereço"}
                      onClick={() => goShortcut(key)}
                      trailing={
                        <button
                          type="button"
                          className="vx-row-action"
                          aria-label={shortcuts[key] ? `Alterar ${SHORTCUT_LABEL[key]}` : `Definir ${SHORTCUT_LABEL[key]}`}
                          onClick={() => openSetPlace(key)}
                        >
                          <Icon name={shortcuts[key] ? "edit" : "plus"} size={17} />
                        </button>
                      }
                    />
                  ))}
                </div>
                <div className="vx-section-title">
                  Favoritos<span>{favorites.length}</span>
                </div>
                {favorites.length === 0 ? (
                  <div className="vx-empty-card">
                    <span><Icon name="star" size={24} /></span>
                    <strong>Nenhum favorito ainda</strong>
                    <p>Na busca, toque na estrela de um local. Na prévia da rota, use o botão salvar.</p>
                  </div>
                ) : (
                  <div className="vx-list">
                    {favorites.map((favorite) => (
                      <ListRow
                        key={favorite.name}
                        icon="starfill"
                        tone="lime"
                        title={favorite.name}
                        subtitle="Toque para traçar a rota"
                        onClick={() => choose(favorite)}
                        trailing={
                          <button
                            type="button"
                            className="vx-row-action"
                            aria-label={`Remover ${favorite.name} dos favoritos`}
                            onClick={() => toggleFavorite(favorite)}
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
                {!user && (
                  <p className="vx-hint">
                    <Icon name="shield" size={15} />
                    Você está como visitante. Entre numa conta para guardar seus locais.
                  </p>
                )}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
              </div>
            </div>
          )}

          {/* ================= DEFINIR CASA / TRABALHO ================= */}
          {screen === "setPlace" && (
            <div className="vx-page">
              <PageHeader title={`Definir ${SHORTCUT_LABEL[placeKey]}`} onBack={() => back()} />
              <div className="vx-page-body">
                <div className="vx-place-hero">
                  <span><Icon name={SHORTCUT_ICON[placeKey]} size={26} /></span>
                  <div>
                    <strong>{shortcuts[placeKey] ? shortcuts[placeKey]?.name : `Onde fica ${placeKey === "home" ? "sua casa" : "seu trabalho"}?`}</strong>
                    <small>{shortcuts[placeKey] ? `${SHORTCUT_LABEL[placeKey]} atual` : "Com o atalho, a rota sai com um toque."}</small>
                  </div>
                  {shortcuts[placeKey] && (
                    <button type="button" className="vx-link-danger" onClick={() => { removeShortcut(placeKey); back() }}>
                      Remover
                    </button>
                  )}
                </div>
                <div className="vx-search">
                  <Icon name="search" size={19} />
                  <input
                    aria-label={`Buscar endereço de ${SHORTCUT_LABEL[placeKey]}`}
                    placeholder="Busque rua, endereço ou local"
                    value={placeQuery}
                    autoFocus
                    onChange={(e) => setPlaceQuery(e.target.value)}
                  />
                  {placeQuery && (
                    <button type="button" aria-label="Limpar" onClick={() => setPlaceQuery("")}><Icon name="close" size={15} /></button>
                  )}
                </div>
                <div className="vx-list">
                  <ListRow
                    icon="locate"
                    tone="brand"
                    title="Usar minha localização atual"
                    subtitle={originLabel}
                    onClick={() => { saveShortcut(placeKey, { ...originPoint, name: originLabel.split(" · ")[0] }); back() }}
                  />
                  <ListRow
                    icon="map"
                    tone="lime"
                    title="Escolher no mapa"
                    subtitle="Toque no mapa para marcar o local"
                    onClick={() => openMapPick({ kind: "shortcut", key: placeKey })}
                  />
                </div>
                <div className="vx-section-title">{placeQuery.trim() ? "Resultados" : "Sugestões"}</div>
                <div className="vx-list">
                  {placeSuggestions.map((item) => (
                    <ListRow
                      key={item.id}
                      icon={item.icon}
                      title={item.title}
                      subtitle={item.subtitle}
                      onClick={() => { saveShortcut(placeKey, item.point); back() }}
                    />
                  ))}
                  {placeSuggestions.length === 0 && (
                    <p className="vx-empty">Nada encontrado. Tente “Escolher no mapa”.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= ESCOLHER NO MAPA ================= */}
          {screen === "mapPick" && (
            <>
              <div className="vx-top">
                <button type="button" className="vx-fab" aria-label="Voltar" onClick={() => back()}>
                  <Icon name="back" size={22} />
                </button>
                <div className="vx-chip">
                  <Icon name="pin" size={15} />
                  Toque no mapa para marcar
                </div>
              </div>
              <section className="vx-sheet vx-pick-sheet">
                <div className="vx-grip" />
                <small className="vx-eyebrow">
                  {pickTarget.kind === "shortcut"
                    ? `Definir ${SHORTCUT_LABEL[pickTarget.key]}`
                    : pickTarget.kind === "stop" ? "Nova parada" : "Destino"}
                </small>
                <div className="vx-pick-place">
                  <span className={pickPoint ? "on" : ""}><Icon name="pin" size={20} /></span>
                  <div>
                    <strong>{pickPoint ? pickPoint.name : "Nenhum ponto marcado"}</strong>
                    <small>{pickPoint ? "Prado Ferreira–PR" : "Toque em uma rua, local ou ponto do mapa"}</small>
                  </div>
                </div>
                {routeLoading && <p className="vx-status"><span className="spinner" />Calculando rota…</p>}
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
                <button type="button" className="primary" disabled={!pickPoint || routeLoading} onClick={confirmMapPick}>
                  {pickTarget.kind === "destination" ? "Traçar rota até aqui" : "Confirmar local"}
                  <Icon name="check" size={20} />
                </button>
              </section>
            </>
          )}

          {/* ================= OPÇÕES DE ROTA ================= */}
          {screen === "prefs" && (
            <div className="vx-page">
              <PageHeader title="Opções de rota" onBack={() => back()} />
              <div className="vx-page-body">
                <div className="vx-section-title first">Tipo de rota padrão</div>
                <p className="vx-hint top">
                  Sem nada ligado, a Vya escolhe a rota mais rápida. Ligue o que quiser evitar; dá para combinar.
                </p>
                <div className="vx-group">
                  {ROUTE_TYPES.map((type) => (
                    <Toggle
                      key={type.key}
                      icon={type.icon}
                      label={type.label}
                      hint={type.hint}
                      checked={prefsDraft[type.key]}
                      onChange={(value) => setPrefsDraft((draft) => ({ ...draft, [type.key]: value }))}
                    />
                  ))}
                </div>
                <div className="vx-section-title">Alertas na navegação</div>
                <div className="vx-group">
                  <Toggle
                    icon="bell"
                    label="Avisos de buracos"
                    hint="Alerta quando houver buraco à frente"
                    checked={potholeAlerts}
                    onChange={setPotholeAlerts}
                  />
                </div>
                <p className="vx-hint">
                  <Icon name="shield" size={15} />
                  Rotas calculadas pelas ruas com OSRM. Pedágios, buracos e trânsito são simulados para a apresentação.
                </p>
                {routeError && <p className="vx-error" role="alert">{routeError}</p>}
              </div>
              <footer className="vx-page-foot">
                <button type="button" className="primary" onClick={applyPrefs} disabled={routeLoading}>
                  Aplicar
                  {routeLoading ? <span className="spinner light" /> : <Icon name="check" size={20} />}
                </button>
              </footer>
            </div>
          )}

          {/* ================= NAVEGAÇÃO ================= */}
          {screen === "navigation" && destination && (
            <>
              <div className="vx-nav-top">
                <div className={`vx-turn ${paused ? "paused" : ""}`}>
                  <span className="vx-turn-icon">
                    <Icon name={paused ? "pause" : currentStep?.maneuver === "turn" ? "turn" : "arrow"} size={34} />
                  </span>
                  <div>
                    <strong>{paused ? (stopArrival !== null ? "Você chegou à parada" : "Navegação pausada") : currentStep?.instruction || "Siga a rota destacada"}</strong>
                    <small>{currentStreet}</small>
                  </div>
                </div>
                {recalc && (
                  <div className={`vx-banner ${recalc.status === "running" ? "" : recalc.status}`} role="status">
                    {recalc.status === "running" ? <span className="spinner" /> : <Icon name={recalc.status === "done" ? "check" : "alert"} size={20} />}
                    <div>
                      <strong>
                        {recalc.status === "running"
                          ? "Você saiu da rota. Recalculando…"
                          : recalc.status === "done"
                            ? `Rota recalculada em ${recalc.seconds.toFixed(1).replace(".", ",")} s`
                            : "Não foi possível recalcular agora."}
                      </strong>
                      <small>
                        {recalc.status === "running"
                          ? "Buscando o melhor caminho a partir de onde você está."
                          : recalc.status === "done"
                            ? recalc.seconds <= 3 ? "Dentro da meta de 3 segundos." : "Acima da meta de 3 segundos (conexão lenta)."
                            : "Continue pela rota anterior e tente de novo."}
                      </small>
                    </div>
                  </div>
                )}
                {upcoming && (
                  <div className={`vx-banner hazard kind-${upcoming.hazard.kind}`} role="alert">
                    <span className="vx-hazard-icon" style={{ background: HAZARD_META[upcoming.hazard.kind].color }}>
                      <Icon name={HAZARD_META[upcoming.hazard.kind].icon} size={18} />
                    </span>
                    <div>
                      <strong>{HAZARD_META[upcoming.hazard.kind].alert} · {Math.max(10, Math.round(upcoming.meters / 10) * 10)} m</strong>
                      <small>{upcoming.hazard.kind === "pothole" ? "Reduza a velocidade" : "Atenção na via"}</small>
                    </div>
                  </div>
                )}
                {nextStopIndex >= 0 && options.stops[nextStopIndex] && (
                  <div className="vx-next-stop">
                    <span>{nextStopIndex + 1}</span>
                    Próxima parada: <strong>{options.stops[nextStopIndex].name}</strong>
                    {streetRoute && (
                      <em>
                        {Math.max(1, Math.ceil(((streetRoute.stopProgress[nextStopIndex] ?? 1) - progress) * totalSeconds / 60))} min
                      </em>
                    )}
                  </div>
                )}
              </div>
              <div className={`vx-speed ${inTraffic && !paused ? "traffic" : ""}`} aria-label={`Velocidade ${simulatedSpeed} km/h`}>
                <strong>{simulatedSpeed}</strong>
                <small>km/h</small>
              </div>
              <button type="button" className="vx-fab vx-fab-report nav" aria-label="Reportar na via" onClick={() => setReportOpen(true)}>
                <Icon name="alert" size={24} />
              </button>
              {stopArrival !== null && options.stops[stopArrival] && (
                <section className="vx-sheet vx-stop-arrival" role="status">
                  <div className="vx-stop-arrival-head">
                    <span className="vx-tl-dot stop">{stopArrival + 1}</span>
                    <div>
                      <small>Parada {stopArrival + 1} de {options.stops.length} alcançada</small>
                      <strong>{options.stops[stopArrival].name}</strong>
                      {options.stops[stopArrival].detail && <em>{options.stops[stopArrival].detail}</em>}
                    </div>
                  </div>
                  <button type="button" className="primary" onClick={continueFromStop}>
                    {stopArrival + 1 < options.stops.length
                      ? `Seguir para a parada ${stopArrival + 2}`
                      : `Seguir para ${destination.name}`}
                    <Icon name="arrow" size={20} />
                  </button>
                </section>
              )}
              <section className="vx-nav-bar">
                <button type="button" className="vx-nav-btn end" aria-label="Encerrar viagem" onClick={newRoute}>
                  <Icon name="close" size={22} />
                </button>
                <button type="button" className="vx-nav-eta" onClick={() => setNavMenuOpen(true)}>
                  <strong>{remaining} min</strong>
                  <span>{formatKm(distance * (1 - progress))} km · chegada {arrival}</span>
                  <i className="vx-progress"><b style={{ width: `${progress * 100}%` }} /></i>
                </button>
                <button type="button" className="vx-nav-btn" aria-label="Mais opções da viagem" onClick={() => setNavMenuOpen(true)}>
                  <Icon name="dots" size={22} />
                </button>
              </section>
            </>
          )}

          {/* ================= CHEGADA ================= */}
          {screen === "finish" && destination && (
            <section className="vx-sheet vx-finish">
              <div className="vx-finish-check"><Icon name="check" size={38} /></div>
              <small className="vx-eyebrow center">Destino alcançado</small>
              <h2>Você chegou!</h2>
              <p>Seu caminho até <strong>{destination.name}</strong> foi concluído. Aproveite o destino!</p>
              <div className="vx-finish-stats">
                <div><Icon name="road" size={20} /><strong>{formatKm(distance)} km</strong><small>Percorridos</small></div>
                <div><Icon name={transport.icon} size={20} /><strong>{duration} min</strong><small>{transport.label}</small></div>
                <div><Icon name="pin" size={20} /><strong>{options.stops.length}</strong><small>{options.stops.length === 1 ? "Parada" : "Paradas"}</small></div>
              </div>
              <button type="button" className="primary" onClick={newRoute}>
                Escolher novo destino
                <Icon name="arrow" />
              </button>
              <button type="button" className="secondary" onClick={() => toggleFavorite(destination)}>
                {isFavorite(destination.name) ? "Nos favoritos" : "Salvar nos favoritos"}
                <Icon name={isFavorite(destination.name) ? "starfill" : "star"} size={18} />
              </button>
            </section>
          )}

          {/* ---------- Menu lateral ---------- */}
          {menuOpen && (
            <div className="vx-drawer-backdrop" onClick={() => setMenuOpen(false)}>
              <aside className="vx-drawer" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
                <div className="vx-drawer-head">
                  <span className="vx-drawer-avatar">{initial}</span>
                  <div>
                    <strong>{user ? user.name : "Visitante"}</strong>
                    <small>{user ? user.email : "Sem conta · nada é salvo"}</small>
                  </div>
                </div>
                <nav className="vx-drawer-nav">
                  <button type="button" onClick={() => push("saved")}><Icon name="bookmark" size={20} />Locais salvos</button>
                  <button type="button" onClick={() => openSetPlace("home")}><Icon name="home" size={20} />Casa<small>{shortcuts.home ? shortcuts.home.name : "Definir"}</small></button>
                  <button type="button" onClick={() => openSetPlace("work")}><Icon name="work" size={20} />Trabalho<small>{shortcuts.work ? shortcuts.work.name : "Definir"}</small></button>
                  <button type="button" onClick={openPrefs}><Icon name="sliders" size={20} />Opções de rota</button>
                  <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true) }}><Icon name="alert" size={20} />Reportar na via</button>
                </nav>
                <div className="vx-drawer-foot">
                  <button type="button" className="vx-close-app" onClick={closeApp}>
                    <Icon name="close" size={19} />
                    Fechar o app
                  </button>
                  <button type="button" className="vx-logout" onClick={logout}>
                    <Icon name="exit" size={19} />
                    {user ? "Sair da conta" : "Voltar ao início"}
                  </button>
                  <div className="vx-drawer-brand">
                    <Logo compact />
                    <small>Protótipo · navegação simulada</small>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* ---------- Salvar destino (folha inferior) ---------- */}
          {saveSheetOpen && destination && (
            <div className="sheet-backdrop" onClick={() => setSaveSheetOpen(false)}>
              <div className="sheet vx-sheet-menu" role="dialog" aria-modal="true" aria-label="Salvar destino" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-grip" />
                <h3>Salvar destino</h3>
                <p>{destination.name}</p>
                <div className="vx-list">
                  <ListRow
                    icon={isFavorite(destination.name) ? "starfill" : "star"}
                    tone="lime"
                    title={isFavorite(destination.name) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    onClick={() => { toggleFavorite(destination); setSaveSheetOpen(false) }}
                  />
                  <ListRow
                    icon="home"
                    tone="brand"
                    title="Salvar como Casa"
                    subtitle={shortcuts.home ? `Substitui: ${shortcuts.home.name}` : undefined}
                    onClick={() => { saveShortcut("home", destination); setSaveSheetOpen(false) }}
                  />
                  <ListRow
                    icon="work"
                    tone="brand"
                    title="Salvar como Trabalho"
                    subtitle={shortcuts.work ? `Substitui: ${shortcuts.work.name}` : undefined}
                    onClick={() => { saveShortcut("work", destination); setSaveSheetOpen(false) }}
                  />
                </div>
                <button className="text-button" onClick={() => setSaveSheetOpen(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* ---------- Menu da viagem (simulação) ---------- */}
          {navMenuOpen && screen === "navigation" && destination && (
            <div className="sheet-backdrop" onClick={() => setNavMenuOpen(false)}>
              <div className="sheet vx-sheet-menu" role="dialog" aria-modal="true" aria-label="Opções da viagem" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-grip" />
                <h3>Sua viagem</h3>
                <p>
                  {transport.label} até <strong>{destination.name}</strong> · {Math.round(progress * 100)}% concluído
                </p>
                <div className="vx-list">
                  <ListRow
                    icon={paused ? "play" : "pause"}
                    tone="brand"
                    title={paused ? "Continuar viagem" : "Pausar simulação"}
                    onClick={() => { setPaused((value) => !value); setNavMenuOpen(false) }}
                  />
                  <ListRow
                    icon="speed"
                    tone="brand"
                    title={`Ritmo da simulação: ${simSpeed}×`}
                    subtitle="Toque para acelerar"
                    onClick={() => setSimSpeed((current) => SIM_SPEEDS[(SIM_SPEEDS.indexOf(current) + 1) % SIM_SPEEDS.length])}
                  />
                  <ListRow
                    icon="refresh"
                    tone="brand"
                    title="Simular desvio"
                    subtitle="Testa o recálculo da rota (meta: 3 s)"
                    disabled={recalc?.status === "running"}
                    onClick={simulateDetour}
                  />
                  <ListRow
                    icon="check"
                    tone="lime"
                    title="Simular chegada agora"
                    onClick={() => { setElapsed(totalSeconds); setNavMenuOpen(false); go("finish") }}
                  />
                  <ListRow
                    icon="close"
                    tone="muted"
                    title="Encerrar viagem"
                    onClick={newRoute}
                  />
                </div>
                <p className="vx-disclaimer">Navegação fictícia. Não use para dirigir.</p>
              </div>
            </div>
          )}
        </main>
      )}
      {reportOpen && (
        <ReportSheet
          onClose={() => setReportOpen(false)}
          onReport={submitReport}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={16} />
          {toast}
        </div>
      )}
    </div>
  )
}