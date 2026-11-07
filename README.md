# Sieges of the Civil Wars

An interactive map of the 287 sieges of the British and Irish Civil Wars (1640–1654), compiled for the National Civil War Centre, Newark. It is a single web page built with [Leaflet](https://leafletjs.com). It needs no ArcGIS licence and no server software, and it can be hosted free on GitHub Pages.

The map reads the spreadsheet and the settings file **every time it loads**, so to change what it shows you edit those files. You don't need to change any code.

## What's in the folder

```
index.html              the map page
check.html              data checker: lists problems in the spreadsheet and missing photos
config/
  config.json           settings: titles, colours, sides, stories, years, map view, labels
  README.md             what every setting does
data/
  sieges.csv            THE SPREADSHEET: one row per siege
  cities.csv            towns and cities of the 1640s shown on the map
  basemap/
    coastline.geojson   coastline of Britain and Ireland (Natural Earth)
    rivers.geojson      Thames, Severn, Trent, Ouse and Humber
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

### The columns

| Column | What goes in it |
|---|---|
| ID | A unique number for each siege. Use 13.1, 13.2… for several sieges at one place. |
| Place, County, Country | Shown at the top of the pop-up. |
| Start Date, End Date | Year first, as `1644/7/2`. Leave out what isn't known: `1644/7/` or `1644//`. Day-first `2/7/1644` also works. |
| Duration | `76 days`, `30 days (approx)`, or `Multiple Sieges`. If it's empty and both dates are complete, the map works the length out. |
| MAP Attacker, MAP Defender, MAP Outcome | One of the sides listed in the settings: `Parliamentarians`, `Royalists` or `Scots`. |
| Themes | One of the story names (`Longest`, `Bloodiest`, `Women`, `Must Read`, `Royalist Best`, `Parliamentarian Best`) or a side. |
| Headline, Body Text | The pop-up's text. Line breaks in Body Text become paragraphs. |
| Website | A link to the site, if there is one. |
| Image 1, Caption Image 1 | The photo's file name and its caption with the credit. |
| Image 2, Caption Image 2 | Optional second choice, shown if Image 1's file isn't in the images folder. |
| Latitude, Longitude | Decimal degrees, e.g. `53.0762`, `-0.8082`. |

A row with no dates, no sides and no outcome (like the "London" introduction row) is left off the map.

## Adding photos

1. Put the photos in the `images` folder (on GitHub: open `images`, then **Add file › Upload files**; you can drag in many at once).
2. Each photo's file name must match the spreadsheet's **Image 1** column exactly, including capitals, spaces and the ending: `Basing House.jpg` is not `basing house.JPG`.
3. Several sieges can share a photo: just put the same file name in each row.
4. Keep photos under about 1 MB. Around 1200 pixels wide is plenty.
5. Put the photographer and licence in **Caption Image 1**. Creative Commons photos must be credited.
6. Open `check.html` to see which named photos are still missing.

The photo appears at the top of the pop-up and in the small label when you hover over a siege.

## Changing the look and wording

Everything you might want to change sits in `config/config.json`: the titles and intro text, the colours of each side, the story buttons, the year range and war periods, where the map starts, whether to show towns, rivers, the compass and the title box, and the sea and country labels. `config/README.md` explains each setting.

To edit it on GitHub, open the file and click the pencil icon. Keep the quote marks and commas. If the page then says the settings file has a mistake, it tells you roughly which line to look at.

The towns and cities on the map come from `data/cities.csv` (Name, Latitude, Longitude, Tier, Note). Tier is `capital`, `major` or `minor`; minor towns appear once you zoom in.

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
