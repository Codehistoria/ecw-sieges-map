# Sieges of the Civil Wars

An interactive map of the 287 sieges of the British and Irish Civil Wars (1640–1654), compiled for the National Civil War Centre, Newark. It is a single web page built with [Leaflet](https://leafletjs.com). It needs no ArcGIS licence and no server software, and it can be hosted free on GitHub Pages.

The map reads the spreadsheet and the settings file **every time it loads**, so to change what it shows you edit those files. You don't need to change any code.

## What's in the folder

```
index.html              the map page
check.html              data checker: lists problems in the spreadsheet and missing photos
todo.html               to-do list: what still needs fixing, most important first, with guides
config/
  config.json           settings: titles, colours, sides, stories, years, map view, labels
  README.md             what every setting does
data/
  sieges.csv            THE SPREADSHEET: one row per siege
  stories.csv           the stories: title, group, summary, the account that links the sieges, tour order and style
  story-steps.csv       for each story and siege, the line the tour shows about why it's in the story
  known-issues.csv      problems found by reading the data against the history (shown on the checker)
  cities.csv            towns and cities of the 1640s shown on the map
  basemap/
    coastline.geojson   coastline of Britain and Ireland (Natural Earth)
    rivers.geojson      main rivers (Natural Earth, plus the Yorkshire Ouse), trimmed to the coastline
images/                 photos, named exactly as in the spreadsheet's Image columns
css/map.css             the look of the page
js/map.js               how the map works
js/data.js              reads the spreadsheet and settings
js/vendor/              Leaflet and PapaParse (third-party libraries; leave alone)
```

## Updating the sieges

1. Open `data/sieges.csv` in Excel.
2. Edit, add or delete rows. Keep the column headings as they are.
3. Save with **File › Save As › "CSV UTF-8 (Comma delimited)"**. Plain "CSV" turns apostrophes and quote marks into `?`.
4. On GitHub, open the `data` folder, choose **Add file › Upload files**, and drop in `sieges.csv` to replace the old one. Click **Commit changes**.
5. Wait a minute, then refresh the map. Open `check.html` to see if anything needs fixing.

`data/known-issues.csv` lists problems found by reading the data against the history (outcomes that contradict the write-up, dates in the wrong year, markers far from their town). The checker shows them; change a row's Status to `Resolved` once it's dealt with.

### The columns

| Column | What goes in it |
|---|---|
| ID | A unique number for each siege. Use 13.1, 13.2… for several sieges at one place. |
| Place, County, Country | Shown at the top of the pop-up. |
| Start Date, End Date | Year first, as `1644/7/2`. Leave out what isn't known: `1644/7/` or `1644//`. Day-first `2/7/1644` also works. |
| Duration | `76 days`, `30 days (approx)`, or `Multiple Sieges`. If it's empty and both dates are complete, the map works the length out. |
| MAP Attacker, MAP Defender, MAP Outcome | One of the sides listed in the settings: `Parliamentarians`, `Royalists` or `Scots`. |
| Themes | One of the featured stories (`Longest`, `Bloodiest`, `Women`, `Must Read`, `Royalist Best`, `Parliamentarian Best`) or a side. |
| Tags | The other stories this siege belongs to, separated by semicolons, e.g. `Stormed; Newark's ring; Oliver Cromwell`. Each tag must match a Tag in `data/stories.csv`. |
| Headline, Body Text | The pop-up's text. Line breaks in Body Text become paragraphs. |
| Website | A link to the site, if there is one. |
| Image 1, Caption Image 1 | The photo's file name and its caption with the credit. |
| Image 2, Caption Image 2 | Optional second choice, shown if Image 1's file isn't in the images folder. |
| Latitude, Longitude | Decimal degrees, e.g. `53.0762`, `-0.8082`. |

A row with no dates, no sides and no outcome (like the "London" introduction row) is left off the map.

## The to-do list

`todo.html` lists everything that still needs doing to the data, most important first: things shown wrongly on the map, photo credits, missing photo files, other review points, the checker's automatic findings, and a read-through of each story. It is rebuilt from the data each time it opens, so fixed items drop off by themselves. Ticks are kept in your browser only; the lasting record is the data (and setting a reviewed issue's Status to `Resolved` in `data/known-issues.csv`). It also has step-by-step guides, a caption builder for photo credits, and downloadable lists of the credits and photos still needed.

Any siege can be linked to directly with `index.html?siege=` and its ID, e.g. `index.html?siege=139.2`.

## Stories

A story picks out sieges that share a thread: how they ended (stormed, starved out, relieved…), a campaign or place (Newark's outposts, after Naseby, ports and the sea…), a commander's trail, or a theme (churches, family homes, turncoats, townspeople). On the map, choosing a story filters the sieges, shows an account of what connects them, and offers **Follow the story**, a tour that visits each siege in turn and says how far, in which direction and how long after the previous one it was.

Each story's tour takes one of two styles, set in the Tour column:

- **visit**: no lines. The siege being visited stands out; places already visited are faded, and places still to come are faded further. Right for stories that simply gather sieges by theme or date.
- **route**: a journey. Before the tour the whole route shows as a grey dashed line, as an overview. During the tour the route is drawn in leg by leg in the colour of the commander's side, so the route ahead stays hidden. After the last siege, **Finish** steps back to show the whole coloured route. Used for the commanders' trails.

How faded the visited and still-to-come places are is set in `config/config.json` under `tours`. A story can be linked to directly: the address ends `#story-` and the tag, e.g. `index.html#story-newark-s-ring`.

Stories live in `data/stories.csv`, one row each:

| Column | What goes in it |
|---|---|
| Tag | The word or phrase used in the spreadsheet's Tags (or Themes) column. Must match exactly. |
| Group | Which tab the story sits under: `Featured`, `How sieges ended`, `Campaigns and places`, `Commanders`, `The war at home`. A new name makes a new tab. |
| Title | The story's name on its button and panel. |
| Summary | One sentence, shown in italics and when hovering the button. |
| Story | The account that connects the sieges. Leave a blank line between paragraphs. |
| Order | The order of the tour: `date` (oldest first) or `length` (longest first). |
| Tour | `visit` or `route` (see above). If empty, the `tours.default` setting is used. |
| Side | For `route` stories: the commander's side (`Royalists`, `Parliamentarians` or `Scots`), which sets the colour of the route. |

Each stop on a tour shows a line saying why that siege is part of the story. These live in `data/story-steps.csv`: one row per story and siege, with the columns Tag, ID, Place (just for reference) and Note. Edit a Note to change what the tour says; if a stop has no row, the tour shows the siege's Headline instead. When you tag a siege into a story, add a row here too. The checker lists notes that point at the wrong story or siege, and counts stops with no note.

To add a siege to a story, add the story's Tag to that row's Tags column. To make a new story, add a row to `stories.csv` and tag the sieges. The checker lists stories with no sieges and tags that match no story (usually a spelling slip).

The tags were assigned by reading each write-up, so they are a judgement worth checking; `data/known-issues.csv` notes this.

## Adding photos

1. Put the photos in the `images` folder (on GitHub: open `images`, then **Add file › Upload files**; you can drag in many at once).
2. Each photo's file name must match the spreadsheet's **Image 1** column exactly, including capitals, spaces and the ending: `Basing House.jpg` is not `basing house.JPG`.
3. Several sieges can share a photo: just put the same file name in each row.
4. Keep photos under about 1 MB. Around 1200 pixels wide is plenty.
5. Put the photographer and licence in **Caption Image 1**. Creative Commons photos must be credited.
6. Open `check.html`. It lists photos the spreadsheet names but the folder doesn't have, names that nearly match (`.JPG` vs `.jpg`, capitals, a stray space), and photos in the folder that no row uses, with a guess at which siege each is for.

The photo appears at the top of the pop-up and in the small label when you hover over a siege.

## Changing the look and wording

Everything you might want to change sits in `config/config.json`: the titles and intro text, the colours of each side, the story buttons, the year range and war periods, where the map starts, whether to show towns, rivers, the compass and the title box, and the sea and country labels. `config/README.md` explains each setting.

To edit it on GitHub, open the file and click the pencil icon. Keep the quote marks and commas. If the page then says the settings file has a mistake, it tells you roughly which line to look at.

If you (or anyone) change `css/map.css` or the files in `js/`, also change the `?v=` number after their names in `index.html` (and `js/data.js` in `check.html`), e.g. `?v=20261107-2` to `?v=20261201-1`. Browsers keep old copies of these files for a while; a new number makes them fetch the new one. The spreadsheet, stories and settings files don't need this: they are always read fresh.

The towns and cities on the map come from `data/cities.csv` (Name, Latitude, Longitude, Tier, Note). Tier is `capital`, `major`, `minor` or `town`. Minor cities appear after one zoom step; `town` (market towns, boroughs and cathedral cities that existed before 1650) appears closer in. Only add places that existed at the time, under the name used then (e.g. Londonderry). The Note shows when you hover over the name.

## Putting it online with GitHub Pages

1. In the repository on GitHub, go to **Settings › Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute or two the map is live at `https://<your-account>.github.io/<repository-name>/`, and the checker at the same address followed by `check.html`.

Free GitHub Pages hosting needs a public repository. To show the map on the Centre's website, link to that address, or embed it:

```html
<iframe src="https://<your-account>.github.io/<repository-name>/" width="100%" height="800" style="border:0" title="Sieges of the Civil Wars"></iframe>
```

## Copying the project to Stephen's account

Either transfer the repository (**Settings › General › Transfer ownership**), or have Stephen open it on GitHub and click **Fork** (or **Use this template** if it's marked as a template). He then turns on GitHub Pages in his copy as above.

## Trying it on your own computer

Browsers won't let a page read files straight from your disk, so double-clicking `index.html` shows "The map couldn't load". Instead, in a terminal in this folder run:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Credits

- Siege data and text: National Civil War Centre, Newark.
- Coastline: [Natural Earth](https://www.naturalearthdata.com) (public domain), via world-atlas.
- Map library: [Leaflet](https://leafletjs.com) (BSD 2-Clause). CSV reader: [PapaParse](https://www.papaparse.com) (MIT).
- Fonts: IM Fell (Igino Marini) and Alegreya, from Google Fonts (SIL Open Font License).
