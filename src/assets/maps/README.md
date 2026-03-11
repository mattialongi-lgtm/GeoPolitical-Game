# World Map TopoJSON

## Source

The file `world_adm1.topo.json` is derived from the [world-atlas](https://github.com/topojson/world-atlas) npm package (v2), which uses **Natural Earth** data (public domain).

- **Resolution:** 50m (1:50,000,000)
- **Level:** ADM0 (countries) — each geometry = one sovereign state
- **Format:** TopoJSON (lightweight, ~740 KB)
- **License:** Public domain (Natural Earth)

## Properties

Each geometry has:
- `name` — country display name (e.g., "Italy")
- `ISO_A2` — ISO 3166-1 alpha-2 code (e.g., "IT")

## How to regenerate

1. Install dependencies:
   ```bash
   npm install world-atlas topojson-client
   ```

2. Run the enrichment script (Node.js):
   ```js
   const fs = require('fs');
   const data = require('world-atlas/countries-50m.json');

   // ISO 3166-1 numeric → alpha-2 mapping
   const numericToAlpha2 = {
     '004': 'AF', '008': 'AL', '010': 'AQ', '012': 'DZ',
     '024': 'AO', '031': 'AZ', '032': 'AR', '036': 'AU',
     '040': 'AT', '044': 'BS', '050': 'BD', '051': 'AM',
     '056': 'BE', '064': 'BT', '068': 'BO', '070': 'BA',
     '072': 'BW', '076': 'BR', '084': 'BZ', '090': 'SB',
     '096': 'BN', '100': 'BG', '104': 'MM', '108': 'BI',
     '112': 'BY', '116': 'KH', '120': 'CM', '124': 'CA',
     '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL',
     '156': 'CN', '158': 'TW', '170': 'CO', '178': 'CG',
     '180': 'CD', '188': 'CR', '191': 'HR', '192': 'CU',
     '196': 'CY', '203': 'CZ', '204': 'BJ', '208': 'DK',
     '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ',
     '231': 'ET', '232': 'ER', '233': 'EE', '238': 'FK',
     '242': 'FJ', '246': 'FI', '250': 'FR', '260': 'TF',
     '262': 'DJ', '266': 'GA', '268': 'GE', '270': 'GM',
     '275': 'PS', '276': 'DE', '288': 'GH', '300': 'GR',
     '304': 'GL', '320': 'GT', '324': 'GN', '328': 'GY',
     '332': 'HT', '340': 'HN', '348': 'HU', '352': 'IS',
     '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ',
     '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI',
     '388': 'JM', '392': 'JP', '398': 'KZ', '400': 'JO',
     '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW',
     '417': 'KG', '418': 'LA', '422': 'LB', '426': 'LS',
     '428': 'LV', '430': 'LR', '434': 'LY', '440': 'LT',
     '442': 'LU', '450': 'MG', '454': 'MW', '458': 'MY',
     '466': 'ML', '478': 'MR', '484': 'MX', '496': 'MN',
     '498': 'MD', '499': 'ME', '504': 'MA', '508': 'MZ',
     '512': 'OM', '516': 'NA', '524': 'NP', '528': 'NL',
     '540': 'NC', '548': 'VU', '554': 'NZ', '558': 'NI',
     '562': 'NE', '566': 'NG', '578': 'NO', '586': 'PK',
     '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE',
     '608': 'PH', '616': 'PL', '620': 'PT', '624': 'GW',
     '626': 'TL', '630': 'PR', '634': 'QA', '642': 'RO',
     '643': 'RU', '646': 'RW', '682': 'SA', '686': 'SN',
     '688': 'RS', '694': 'SL', '700': 'SG', '702': 'SG',
     '703': 'SK', '705': 'SI', '706': 'SO', '710': 'ZA',
     '716': 'ZW', '724': 'ES', '728': 'SS', '729': 'SD',
     '732': 'EH', '740': 'SR', '748': 'SZ', '752': 'SE',
     '756': 'CH', '760': 'SY', '762': 'TJ', '764': 'TH',
     '768': 'TG', '780': 'TT', '784': 'AE', '788': 'TN',
     '792': 'TR', '795': 'TM', '800': 'UG', '804': 'UA',
     '807': 'MK', '818': 'EG', '826': 'GB', '834': 'TZ',
     '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ',
     '862': 'VE', '887': 'YE', '894': 'ZM', '704': 'VN'
   };

   data.objects.countries.geometries.forEach(g => {
     if (!g.properties) g.properties = {};
     g.properties.ISO_A2 = numericToAlpha2[g.id] || '';
   });

   fs.writeFileSync('src/assets/maps/world_adm1.topo.json', JSON.stringify(data));
   ```

3. Uninstall temporary dependency:
   ```bash
   npm uninstall world-atlas
   ```

## Upgrading to ADM1 (provinces/regions)

To upgrade to admin-1 level detail:

1. Download Natural Earth "Admin 1 – States, Provinces" shapefile from
   https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
2. Use [Mapshaper](https://mapshaper.org/) to simplify and convert:
   ```bash
   npx mapshaper ne_10m_admin_1_states_provinces.shp \
     -simplify dp 15% \
     -o format=topojson world_adm1.topo.json
   ```
3. Ensure each geometry has an `iso_a2` or `adm0_a2` property for parent-country matching.
4. Replace `world_adm1.topo.json` with the new file.
