# Prado Ferreira–PR

Static OpenStreetMap raster tiles at zoom 16, covering the urban area of
Prado Ferreira, Paraná. The municipality's rural territory is not included.

- Tile source: https://tile.openstreetmap.org/{z}/{x}/{y}.png
- Tile columns: 23401–23405; rows: 37078–37082.
- Map data: © OpenStreetMap contributors.
- Attribution and licence: https://www.openstreetmap.org/copyright
- Geographic coordinates and POI names were obtained from Nominatim.

At runtime, the app also requests the complete drivable urban street network
and named amenities, shops, services, leisure facilities, offices, healthcare
locations and buildings from the public OpenStreetMap Overpass API. These
features are projected over the static tiles, making streets selectable as
route destinations and expanding the local places catalog. The four points
below remain bundled as an offline fallback when Overpass is unavailable.

Verified points:

| Point | OSM way |
| --- | --- |
| Prefeitura Municipal, Rua Jaú | 219055508 |
| Igreja São João Batista, Rua Paraná | 109767555 |
| Escola Estadual Julia Wanderley, Rua Bariri | 219055507 |
| Igreja Congregação Cristã, Rua Brasil | 681274132 |

`src/prado-map.json` projects these coordinates into the SVG map using
Web Mercator at zoom 16. Routes are requested from the public OSRM driving
service at https://router.project-osrm.org and follow its OpenStreetMap street
network. The start and destination are snapped to reachable road positions.
Route geometry, distance and duration come from the same response. Requests
require an internet connection; failures never fall back to straight lines.
The journey animation remains simulated and is not suitable for real driving
directions or live traffic estimates.
