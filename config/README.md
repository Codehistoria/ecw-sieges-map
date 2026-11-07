# Settings (`config.json`)

`config.json` controls the wording, colours and behaviour of the map. Edit a value, keep the quote marks and commas, save, and refresh the map. If you break the file, the map says so and names the line to check; the commonest slips are a missing comma at the end of a line or a missing closing quote.

Colours are written as hex codes like `"#9a1c2c"`. Any colour picker gives you one.

## `text`: wording on the page

| Setting | What it does |
|---|---|
| `eyebrow` | Small capitals above the title. |
| `title`, `titleHighlight` | The heading. The highlight part is shown in italic crimson. |
| `intro` | The paragraph under the heading. |
| `footer` | The note at the bottom of the side panel (source, date conventions). |
| `searchPlaceholder` | Grey text in the search box. |

## `data`: where the files are

| Setting | What it does |
|---|---|
| `sieges` | The siege spreadsheet. Default `data/sieges.csv`. |
| `cities` | The towns spreadsheet. Set to `""` to show no towns. |
| `coastline`, `rivers` | Map outlines (GeoJSON). |
| `encoding` | `"auto"` reads UTF-8 and falls back to Excel's Windows format. Leave as `"auto"`. |

## `columns`: spreadsheet headings

If a column heading in the spreadsheet changes, change it here instead of in the code. The left side is what the map needs; the right side is the heading in your spreadsheet. `image2` and `caption2` are optional.

## `dates`

`format`: `"auto"` accepts both `1644/7/2` and `2/7/1644`. Use `"year-first"` or `"day-first"` to force one.

## `images`

| Setting | What it does |
|---|---|
| `folder` | Where the photos are. Default `images/`. |
| `showInPopup` | `true` or `false`: photo at the top of the pop-up. |
| `showInHover` | `true` or `false`: small photo in the hover label. |

## `sides`

One entry per side. `value` must match the spreadsheet's MAP Attacker/Defender/Outcome text exactly. `label` is shown on buttons ("Parliament prevailed"), `plural` in sentences ("Parliamentarians besieged Royalists"), `colour` is the marker colour. You can add a side (e.g. Confederates in Ireland) by adding an entry and using its `value` in the spreadsheet.

## `stories`

The story buttons (the old story-map tabs). `value` matches the spreadsheet's Themes column, `label` is the button text, and `sort` is how the list is ordered when the story is picked: `"long"` (longest first), `"date"` or `"az"`. Add, remove or reorder entries freely.

## `years`

| Setting | What it does |
|---|---|
| `from`, `to` | The range of the year chart. |
| `bands` | The periods shown under the chart. Each has a `label` and the years it runs `from` and `to`. |
| `playSecondsPerYear` | Speed of "Play through the wars". |

## `list`

`defaultSort` is `"long"`, `"date"` or `"az"`. `showFirst` is how many sieges the side list shows before "Show all".

## `map`

| Setting | What it does |
|---|---|
| `startView` | The area shown when the page opens: `south`, `west`, `north`, `east` in degrees. |
| `minZoom`, `maxZoom` | How far out and in you can zoom (5 shows all of Britain and Ireland; 12 is street level). |
| `zoomWhenSiegeChosen` | How close the map flies in when you pick a siege from the list. |
| `groupSiegesWithinKm` | Sieges closer than this share one marker with a counter. `0` turns grouping off. |
| `markerScale` | Make all circles bigger (`1.3`) or smaller (`0.8`). |
| `showRivers`, `showCities`, `showCompass`, `showTitleBox` | `true` or `false`. |
| `smallTownsFromZoom` | Zoom level at which "minor" towns appear. |
| `titleBox` | The cartouche in the bottom-left corner: `title` and `subtitle`. |
| `labels` | Sea and country names: `text`, `lat`, `lng`, and `style` (`"sea"` for italic, `"country"` for spaced capitals). |

## `colours`

`paper` (background and pop-ups), `paperDeep` (shading), `inlay` (the lighter panel behind pop-up text), `ink` (text and lines), `sea`, `land`, `rivers`.
