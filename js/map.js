/* Siege map: the interactive page.
   Reads config/config.json and data/sieges.csv each time it loads, so changes to either show on the next refresh. */
(async function () {
  "use strict";
  const { loadConfig, loadStories, loadSteps, fetchText, parseCSV, buildRecords, imageURL, fmtOne, fmtRange } = window.SiegeData;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showNotice(msg) {
    const n = $("notice"); n.hidden = false; n.innerHTML = `<b>The map couldn't load.</b><br>${esc(msg)}`;
    $("stats").innerHTML = `<span>${esc(msg)}</span>`;
  }

  /* ---------- load settings and data ---------- */
  let cfg, DATA;
  try {
    cfg = await loadConfig();
    try { cfg.stories = (await loadStories(cfg)).stories; }
    catch (e) { console.warn("Stories file couldn't be read; using the settings file's list.", e); cfg.data.stories = null; cfg.stories = (await loadStories(cfg)).stories; }
    const { text } = await fetchText(cfg.data.sieges, cfg.data.encoding);
    const parsed = parseCSV(text);
    const missing = Object.entries(cfg.columns).filter(([k, col]) => !["image2", "caption2", "website", "story", "tags", "duration", "caption"].includes(k) && !parsed.meta.fields.includes(col));
    if (missing.length) throw new Error(`The spreadsheet has no column called ${missing.map(m => `"${m[1]}"`).join(", ")}. Rename the column, or change "columns" in config/config.json.`);
    DATA = buildRecords(parsed.data, cfg).records;
  } catch (e) { showNotice(e.message); console.error(e); return; }

  const T = cfg.text || {}, M = cfg.map || {}, IMG = cfg.images || {};
  const SIDES = (cfg.sides || []).map((s, i) => ({ key: "s" + i, ...s }));
  const SIDE = Object.fromEntries(SIDES.map(s => [s.key, s]));
  const colour = k => (SIDE[k] && SIDE[k].colour) || "#777777";
  const STORIES = cfg.stories || [];
  let STEPS = new Map();
  try { STEPS = await loadSteps(cfg); } catch (e) { console.warn("Step notes couldn't be read", e); }
  const sideKey = v => (SIDES.find(s => s.value.toLowerCase() === String(v || "").toLowerCase()) || {}).key;
  const STORY = Object.fromEntries(STORIES.map(s => [s.value, s]));
  const inStory = (d, v) => d.t === v || (d.tags || []).includes(v);
  const Y0 = cfg.years.from, Y1 = cfg.years.to;
  const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i);

  // colours from the settings file
  const root = document.documentElement.style, col = cfg.colours || {};
  const setVar = (v, x) => x && root.setProperty(v, x);
  setVar("--paper", col.paper); setVar("--paper-deep", col.paperDeep); setVar("--inlay", col.inlay); setVar("--ink", col.ink); setVar("--sea", col.sea);
  SIDES.forEach((s, i) => setVar("--side" + i, s.colour));
  const TOURS = cfg.tours || {};
  if (TOURS.fadeVisited != null) root.setProperty("--fade-visited", TOURS.fadeVisited);
  if (TOURS.fadeStillToCome != null) root.setProperty("--fade-to-come", TOURS.fadeStillToCome);

  // text from the settings file
  document.title = `${T.title || ""} ${T.titleHighlight || ""}`.trim() || document.title;
  $("eyebrow").textContent = T.eyebrow || "";
  $("title").innerHTML = `${esc(T.title || "")} <em>${esc(T.titleHighlight || "")}</em>`;
  $("intro").textContent = T.intro || "";
  $("footer").textContent = T.footer || "";
  $("search").placeholder = T.searchPlaceholder || "Find a place or county";
  $("compass").style.display = M.showCompass === false ? "none" : "";
  const cart = $("cartouche");
  if (M.showTitleBox === false) cart.style.display = "none";
  else { cart.querySelector(".t").textContent = (M.titleBox || {}).title || ""; cart.querySelector(".s").textContent = (M.titleBox || {}).subtitle || ""; }
  /* ---------- helpers ---------- */
  const sortKey = d => d.s || d.e || "9999";
  const scale = M.markerScale || 1;
  const radius = d => (d.d == null ? 5 : 3.5 + Math.sqrt(Math.max(d.d, 0.5)) * 0.55) * scale;

  /* Siege symbol: a solid circle coloured by who prevailed, sized by length; several sieges at one place
     split the circle into slices. A dark outline and a parchment ring lift it above the town names. */
  function circleHTML(fills, px, unknown) {
    const n = fills.length;
    let bg = fills[0];
    if (n > 1) {
      const step = 100 / n;
      bg = "conic-gradient(" + fills.map((f, j) => `${f} ${(j * step).toFixed(2)}% ${((j + 1) * step).toFixed(2)}%`).join(", ") + ")";
    }
    return `<span class="dot${unknown ? " unknown" : ""}" style="--c:${fills[0]};width:${px}px;height:${px}px;background:${unknown ? "" : bg}"></span>`;
  }
  const dotPx = r => Math.max(8, Math.round(r * 2));

  // Circles start the same size; the "Size by length" switch scales them by days under siege
  // (for several sieges at one place, by their combined length).
  const UNIFORM_PX = Math.round((M.uniformSize || 12) * scale);
  function renderKey(byLength) {
    const c0 = colour("s0"), c1 = colour("s1");
    const item = (sym, label) => `<div>${sym}<span>${label}</span></div>`;
    $("sizeKey").innerHTML = byLength
      ? item(circleHTML([c0], dotPx(radius({ d: 1 }))), "1 day") +
        item(circleHTML([c0], dotPx(radius({ d: 182 }))), "6 months") +
        item(circleHTML([c0], dotPx(radius({ d: 730 }))), "2 years") +
        item(circleHTML([c0], dotPx(5 * scale), true), "length unknown") +
        item(`<span class="key-multi">${circleHTML([c1, c1, c0], 22)}<b>3</b></span>`, "several, combined")
      : item(circleHTML([c0], UNIFORM_PX), "one siege") +
        item(`<span class="key-multi">${circleHTML([c1, c1, c0], UNIFORM_PX)}<b>3</b></span>`, "several at one place");
  }
  function fmtDays(d) {
    if (d.d == null) return d.dl || "length unknown";
    const n = d.d, ap = d.approx ? "c. " : "";
    if (n < 1) return "under a day";
    if (n < 60) return `${ap}${n} day${n === 1 ? "" : "s"}`;
    if (n < 730) return `${ap}${Math.round(n / 30.4)} months`;
    return `${ap}${(n / 365.25).toFixed(1)} years`;
  }
  // An <img> that tries each listed photo in turn and removes itself if none load.
  function imgTag(d, cls, withCaption) {
    if (!d.images.length) return "";
    const srcs = d.images.map(im => imageURL(IMG.folder, im.file));
    const caps = d.images.map(im => im.caption || "");
    return `<img class="${cls}" src="${esc(srcs[0])}" alt="${esc(d.p)}" loading="lazy" data-srcs="${esc(JSON.stringify(srcs))}" data-caps="${esc(JSON.stringify(caps))}" data-i="0" data-cap="${withCaption ? 1 : 0}" onerror="window.__nextPhoto(this)" onload="window.__photoLoaded(this)">`;
  }
  window.__nextPhoto = img => {
    const srcs = JSON.parse(img.dataset.srcs), i = +img.dataset.i + 1;
    if (i < srcs.length) { img.dataset.i = i; img.src = srcs[i]; return; }
    const fig = img.closest("figure"); (fig || img).remove();
  };
  window.__photoLoaded = img => {
    img.classList.add("ok");
    if (img.dataset.cap !== "1") return;
    const cap = JSON.parse(img.dataset.caps)[+img.dataset.i];
    const fc = img.parentElement.querySelector("figcaption");
    if (fc) { fc.textContent = cap; fc.hidden = !cap; }
  };

  function totalDays(members) { const k = members.filter(m => m.d != null); return k.length ? k.reduce((s, m) => s + m.d, 0) : null; }
  function totalLabel(members) {
    const n = totalDays(members);
    return n == null ? "" : `, ${fmtDays({ d: Math.round(n), approx: members.some(m => m.approx) || members.some(m => m.d == null) })} in all`;
  }
  function switcherHTML(members, i) {
    if (members.length < 2) return "";
    const places = new Set(members.map(m => m.p));
    const chips = members.map((m, j) => `<button type="button" data-i="${j}" aria-pressed="${j === i}"><i style="background:${colour(m.w)}"></i>${places.size > 1 ? esc(m.p.replace(/ Castle$/, "")) + " " : ""}${m.y || "undated"}</button>`).join("");
    return `<div class="here">
      <div class="here-top"><span>${members.length} sieges at this spot${totalLabel(members)} · ${i + 1} of ${members.length}</span>
        <span class="nav"><button type="button" data-step="-1" aria-label="Previous siege here" ${i === 0 ? "disabled" : ""}>‹</button><button type="button" data-step="1" aria-label="Next siege here" ${i === members.length - 1 ? "disabled" : ""}>›</button></span></div>
      <div class="here-chips" role="group" aria-label="Sieges at this spot">${chips}</div>
    </div>`;
  }

  function popupHTML(d, members, i) {
    const mine = STORIES.filter(s => inStory(d, s.value));
    const stories = mine.length ? `<div class="in-stories"><span class="lab">In the stories</span>${mine.map(s => `<button type="button" data-story="${esc(s.value)}" aria-pressed="${state.story === s.value}">${esc(s.label)}</button>`).join("")}</div>` : "";
    const out = d.w ? `<span class="pill" style="color:${colour(d.w)}"><i></i>${esc(SIDE[d.w].label)} prevailed</span>` : "";
    const sides = d.a && d.f ? `<span class="sides">${esc(SIDE[d.a].plural || SIDE[d.a].label)} besieged ${esc(SIDE[d.f].plural || SIDE[d.f].label)}</span>` : "";
    const body = (d.b || "").split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("");
    const dur = d.dl ? ` · ${esc(d.dl)}` : "";
    const site = d.u ? `<a class="visit" href="${esc(/^https?:/i.test(d.u) ? d.u : "https://" + d.u)}" target="_blank" rel="noopener">Visit the site ↗</a>` : "";
    const fig = IMG.showInPopup !== false && d.images.length ? `<figure>${imgTag(d, "photo", true)}<figcaption hidden></figcaption></figure>` : "";
    const where = [d.c, d.n].filter(Boolean).join(", ");
    return `<div class="pop">
      ${fig}
      <h3>${esc(d.p)}</h3>
      <div class="head-line"><span class="where">${esc(where)}</span><span class="when">${esc(fmtRange(d.s, d.e))}${dur}</span></div>
      ${switcherHTML(members, i)}
      ${sides}
      <div class="tags">${out}</div>
      <div class="read">
        ${d.h ? `<p class="headline">${esc(d.h)}</p>` : ""}
        ${body ? `<div class="body" tabindex="0" aria-label="Full account">${body}</div>` : ""}
      </div>
      ${site}
      ${stories}
    </div>`;
  }

  /* ---------- map ---------- */
  const sv = M.startView;
  const map = L.map("map", { zoomSnap: 0.25, minZoom: M.minZoom || 5, maxZoom: M.maxZoom || 12, attributionControl: false });
  map.fitBounds([[sv.south, sv.west], [sv.north, sv.east]], { padding: [10, 10] });
  L.control.scale({ imperial: true, metric: false, position: "bottomright", maxWidth: 140 }).addTo(map);

  const optionalJSON = async url => { if (!url) return null; try { return JSON.parse((await fetchText(url, "utf-8")).text); } catch (e) { console.warn(e); return null; } };
  const [coast, rivers] = await Promise.all([optionalJSON(cfg.data.coastline), M.showRivers === false ? null : optionalJSON(cfg.data.rivers)]);
  if (coast) {
    L.geoJSON(coast, { interactive: false, style: { color: "#b9b896", weight: 7, opacity: .7, fill: false } }).addTo(map);
    L.geoJSON(coast, { interactive: false, style: { color: col.ink || "#2a2017", weight: 1.1, fillColor: col.land || "#efe5ca", fillOpacity: 1 } }).addTo(map);
  }
  if (rivers) L.geoJSON(rivers, { interactive: false, style: { color: col.rivers || "#7c8b88", weight: 1.4, opacity: .8 } }).addTo(map);

  (M.labels || []).forEach(l => L.marker([l.lat, l.lng], { interactive: false, keyboard: false,
    icon: L.divIcon({ className: "", html: `<div class="lbl ${l.style === "sea" ? "sea" : "realm"}">${esc(l.text)}</div>`, iconSize: [0, 0] }) }).addTo(map));

  // Towns and cities of the period. Tier: capital, major, minor (shown from smallTownsFromZoom), town (shown from townsFromZoom).
  const PLACES = [];
  if (M.showCities !== false && cfg.data.cities) {
    try {
      const { text } = await fetchText(cfg.data.cities, "auto");
      map.createPane("cities"); map.getPane("cities").style.zIndex = 590; map.getPane("cities").style.pointerEvents = "none"; // under the siege symbols
      parseCSV(text).data.forEach(c => {
        const lat = parseFloat(c.Latitude), lng = parseFloat(c.Longitude);
        if (!c.Name || !isFinite(lat) || !isFinite(lng)) return;
        const t = (c.Tier || "").trim().toLowerCase();
        const tier = ["capital", "major", "minor", "town"].includes(t) ? t : "town";
        const marker = L.marker([lat, lng], { pane: "cities", interactive: false, keyboard: false,
          icon: L.divIcon({ className: "", html: `<div class="city ${tier}" data-place="${PLACES.length}"${c.Note ? ` title="${esc(c.Note)}"` : ""}>${esc(c.Name)}</div>`, iconSize: [0, 0] }) }).addTo(map);
        PLACES.push({ name: c.Name.trim(), lat, lng, tier, marker });
      });
    } catch (e) { console.warn(e); }
  }
  // Labels appear in stages as you zoom in: small towns, then 17th-century towns, then the names of the sieges.
  const zoomClasses = () => {
    const z = map.getZoom(), el = map.getContainer();
    el.classList.toggle("far", z < (M.smallTownsFromZoom ?? 6.75));
    el.classList.toggle("no-towns", z < (M.townsFromZoom ?? 7.5));
    el.classList.toggle("no-siege-names", z < (M.siegeNamesFromZoom ?? 8));
    scheduleDeclutter();
  };
  // Siege names: each tries below, above, right and left of its circle, avoiding other names and circles.
  // Longer sieges choose first. A name that fits nowhere waits for a closer zoom; from allSiegeNamesFromZoom every name shows.
  let declutterQueued = false;
  function scheduleDeclutter() {
    if (declutterQueued) return;
    declutterQueued = true;
    requestAnimationFrame(() => { declutterQueued = false; declutter(); });
  }
  const POSITIONS = ["pos-bottom", "pos-top", "pos-right", "pos-left"];
  function declutter() {
    const box = map.getContainer();
    if (box.classList.contains("no-siege-names")) return;
    const showAll = map.getZoom() >= (M.allSiegeNamesFromZoom ?? 9);
    const view = box.getBoundingClientRect();
    const items = [];
    const dots = [];
    box.querySelectorAll(".city.gives-way").forEach(el => el.classList.remove("gives-way"));
    box.querySelectorAll(".sg-name").forEach(el => {
      el.classList.remove(...POSITIONS); el.classList.add("pos-bottom");
      const dot = el.parentElement.getBoundingClientRect();
      if (dot.right < view.left || dot.left > view.right || dot.bottom < view.top || dot.top > view.bottom) { el.style.visibility = ""; return; }
      dots.push(dot);
      if (el.dataset.dup) el.dataset.dup.split(",").forEach(i => box.querySelector(`.city[data-place="${i}"]`)?.classList.add("gives-way"));
      const r = el.getBoundingClientRect();
      items.push({ el, dot, w: r.width, h: r.height, pri: +el.dataset.pri || 0 });
    });
    items.sort((a, b) => b.pri - a.pri);
    const placed = [];
    const hits = (a, b) => a.left < b.right + 2 && a.right + 2 > b.left && a.top < b.bottom + 1 && a.bottom + 1 > b.top;
    const free = r => !placed.some(p => hits(r, p)) && !dots.some(d => hits(r, d));
    items.forEach(x => {
      const { dot: d, w, h } = x, cx = (d.left + d.right) / 2, cy = (d.top + d.bottom) / 2;
      const cand = {
        "pos-bottom": { left: cx - w / 2, right: cx + w / 2, top: d.bottom + 2, bottom: d.bottom + 2 + h },
        "pos-top": { left: cx - w / 2, right: cx + w / 2, top: d.top - 2 - h, bottom: d.top - 2 },
        "pos-right": { left: d.right + 4, right: d.right + 4 + w, top: cy - h / 2, bottom: cy + h / 2 },
        "pos-left": { left: d.left - 4 - w, right: d.left - 4, top: cy - h / 2, bottom: cy + h / 2 }
      };
      const pos = POSITIONS.find(p => free(cand[p]));
      if (pos || showAll) {
        // when every name must show, take the position that overlaps least
        const overlap = r => [...placed, ...dots].reduce((s, o) => s + Math.max(0, Math.min(r.right, o.right) - Math.max(r.left, o.left)) * Math.max(0, Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top)), 0);
        const use = pos || POSITIONS.reduce((best, p) => overlap(cand[p]) < overlap(cand[best]) ? p : best, "pos-bottom");
        x.el.classList.remove("pos-bottom"); x.el.classList.add(use);
        x.el.style.visibility = "";
        placed.push(cand[use]);
      } else x.el.style.visibility = "hidden";
    });
  }
  map.on("zoomend", zoomClasses); map.on("moveend", scheduleDeclutter); zoomClasses();

  // "Cities" and "Towns" switches on the map. Cities are the capital, major and minor tiers; towns are the market towns.
  if (PLACES.length) {
    const PlaceSwitch = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const div = L.DomUtil.create("div", "leaflet-bar town-switch");
        const box = (id, label, on) => `<label><input type="checkbox" id="${id}"${on ? " checked" : ""}> ${label}</label>`;
        div.innerHTML = box("citiesToggle", "Cities", M.showCitiesAtStart !== false) + box("townsToggle", "Towns", M.showTownsAtStart !== false);
        L.DomEvent.disableClickPropagation(div);
        const [cities, towns] = div.querySelectorAll("input");
        const apply = () => {
          map.getContainer().classList.toggle("cities-off", !cities.checked);
          map.getContainer().classList.toggle("towns-off", !towns.checked);
        };
        cities.addEventListener("change", () => { apply(); scheduleDeclutter(); }); towns.addEventListener("change", () => { apply(); scheduleDeclutter(); }); setTimeout(apply);
        return div;
      }
    });
    map.addControl(new PlaceSwitch());
  }
  map.on("popupopen", () => document.querySelector(".plate").classList.add("popup-open"));
  map.on("popupclose", () => { document.querySelector(".plate").classList.remove("popup-open"); $("tour").classList.remove("compact"); });

  /* Sieges close together share one marker: a pie of their outcomes with a count; the pop-up steps between them. */
  const layer = L.layerGroup().addTo(map);
  const km = (a, b) => Math.hypot((a.lat - b.lat) * 111.2, (a.lng - b.lng) * 111.2 * Math.cos(a.lat * Math.PI / 180));
  const within = M.groupSiegesWithinKm ?? 0.6;
  const GROUPS = [], groupOf = new Map();
  [...DATA].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).forEach(d => {
    let g = within > 0 ? GROUPS.find(g => km(g.all[0], d) < within) : null;
    if (!g) { g = { lat: d.lat, lng: d.lng, all: [] }; GROUPS.push(g); }
    g.all.push(d); groupOf.set(d, g);
  });

  function iconFor(members) {
    const multi = members.length > 1, total = totalDays(members);
    let size, unknown = false;
    if (state.sizeByLength) {
      unknown = total == null && !multi;
      size = dotPx(total == null ? 5 * scale : radius({ d: total }));
    } else size = UNIFORM_PX;
    const sym = circleHTML(members.map(m => colour(m.w)), size, unknown);
    const { text, dup } = siegeName(members);
    return { r: size / 2, icon: L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
      html: `<div class="sg siege${multi ? " multi" : ""}" style="width:${size}px;height:${size}px">${sym}${multi ? `<span class="badge">${members.length}</span>` : ""}<span class="sg-name" data-pri="${total ?? 0}"${dup ? ` data-dup="${dup}"` : ""}>${esc(text)}</span></div>` }) };
  }

  // The name shown by a siege once zoomed in. A city or town of the same name within 8 km gives way to it,
  // so the name appears once, in the siege's style.
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, "");
  function siegeName(members) {
    const names = [...new Set(members.map(m => m.p))];
    const dup = names.map(n => PLACES.findIndex(t => norm(t.name) === norm(n) && km(t, members[0]) < 8)).filter(i => i >= 0);
    return { text: names.join(" & "), dup: dup.join(",") };
  }

  GROUPS.forEach(g => {
    g.marker = L.marker([g.lat, g.lng], { keyboard: true, riseOnHover: true });
    g.popup = L.popup({ maxWidth: 360, autoPanPaddingTopLeft: [24, 96], autoPanPaddingBottomRight: [24, 24] });
    g.marker.bindPopup(g.popup);
    g.marker.on("popupopen", () => { if (g.pick == null) showInPopup(g, 0); });
    g.marker.on("popupclose", () => { g.pick = null; });
  });

  function showInPopup(g, i, focus) {
    const members = g.vis;
    i = Math.max(0, Math.min(i, members.length - 1));
    g.pick = i;
    const el = document.createElement("div");
    el.innerHTML = popupHTML(members[i], members, i);
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    // no taller than the map, so the whole pop-up scrolls as one
    const phone = matchMedia("(max-width: 820px)").matches;
    g.popup.options.maxHeight = Math.max(220, map.getSize().y - (phone ? 60 : tour && tourOverlaps() ? tourEl.offsetHeight + 130 : 160));
    if (phone) { g.popup.options.autoPanPaddingTopLeft = [8, 12]; g.popup.options.autoPanPaddingBottomRight = [8, 12]; }
    el.addEventListener("click", e => {
      e.stopPropagation();
      const fig = e.target.closest("figure");
      if (fig && e.target.tagName === "IMG") { fig.classList.toggle("big"); g.popup.update(); return; }
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.story) { selectStory(b.dataset.story === state.story ? null : b.dataset.story, false); return; }
      if (b.dataset.i != null) showInPopup(g, +b.dataset.i, true);
      else if (b.dataset.step) showInPopup(g, g.pick + +b.dataset.step, true);
    });
    el.querySelectorAll("img").forEach(img => img.addEventListener("load", () => g.popup.update(), { once: true }));
    g.popup.setContent(el);
    if (focus) { const btn = el.querySelector(`.here-chips button[data-i="${i}"]`); btn && btn.focus({ preventScroll: true }); }
  }

  function updateMarkers(ids) {
    GROUPS.forEach(g => {
      g.vis = g.all.filter(d => ids.has(d));
      if (!g.vis.length) { layer.removeLayer(g.marker); return; }
      const sig = (state.sizeByLength ? "L|" : "U|") + g.vis.map(d => d.id).join("|");
      if (sig !== g.sig) {
        g.sig = sig;
        const { r, icon } = iconFor(g.vis);
        g.marker.setIcon(icon);
        const names = [...new Set(g.vis.map(d => d.p))].join(" & ");
        const title = g.vis.length > 1 ? `${names}: ${g.vis.length} sieges` : `${names}, ${g.vis[0].y || "undated"}`;
        const pic = IMG.showInHover === true ? g.vis.find(d => d.images.length) : null;   // off unless switched on in settings
        g.marker.unbindTooltip().bindTooltip(esc(title) + (pic ? imgTag(pic, "tip-img", false) : ""), { className: "tip", direction: "top", offset: [0, -r] });
        g.z = -Math.round(r * 20); g.marker.setZIndexOffset(g.z);
        if (g.marker.isPopupOpen()) showInPopup(g, Math.min(g.pick || 0, g.vis.length - 1));
        g.label = g.vis.length > 1 ? `${g.vis.length} sieges at ${[...new Set(g.vis.map(d => d.p))].join(" and ")}` : `Siege of ${g.vis[0].p}`;
      }
      layer.addLayer(g.marker);
      const el = g.marker.getElement();
      if (el) { el.setAttribute("aria-label", g.label); el.setAttribute("role", "button"); }
    });
  }

  /* ---------- controls ---------- */
  const state = { year: null, sides: new Set(SIDES.map(s => s.key)), sort: (cfg.list || {}).defaultSort || "long", story: null, q: "", showAll: false, sizeByLength: M.sizeByLengthAtStart === true };
  const sizeToggle = $("sizeToggle");
  sizeToggle.checked = state.sizeByLength;
  renderKey(state.sizeByLength);
  sizeToggle.addEventListener("change", () => { state.sizeByLength = sizeToggle.checked; renderKey(state.sizeByLength); render(); });

  /* ---------- stories ----------
     A story is a set of sieges sharing a thread (a tag in the spreadsheet's Tags or Themes column).
     Choosing one filters the map, shows its account in the side panel, and offers a tour that visits
     each siege in turn, saying how far and how long it was from the one before. */
  const storiesEl = $("stories"), groupsEl = $("storyGroups"), card = $("storyCard");
  $("storiesIntro").textContent = T.storiesIntro || "";
  const slug = v => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const storyCount = v => DATA.filter(d => inStory(d, v)).length;
  const GROUPS_ORDER = [...new Set(STORIES.map(s => s.group || ""))];
  let openGroup = GROUPS_ORDER[0];
  function drawGroups() {
    groupsEl.hidden = GROUPS_ORDER.length < 2;
    groupsEl.innerHTML = GROUPS_ORDER.map(g => `<button type="button" data-group="${esc(g)}" aria-pressed="${g === openGroup}">${esc(g || "Other")}</button>`).join("");
    storiesEl.innerHTML = "";
    STORIES.filter(s => (s.group || "") === openGroup).forEach(s => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.story = s.value;
      b.setAttribute("aria-pressed", String(state.story === s.value));
      if (s.summary) b.title = s.summary;
      b.innerHTML = `${esc(s.label)} <span class="ct">${storyCount(s.value)}</span>`;
      b.onclick = () => selectStory(state.story === s.value ? null : s.value, true);
      storiesEl.appendChild(b);
    });
  }
  groupsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; openGroup = b.dataset.group; drawGroups(); });

  // Sieges in story order: by date (undated last), or longest first for "length" stories.
  const byDate = (a, b) => (a.s || a.e ? 0 : 1) - (b.s || b.e ? 0 : 1) || sortKey(a).localeCompare(sortKey(b));
  const storySeq = v => visible().filter(d => inStory(d, v)).sort(STORY[v] && STORY[v].order === "long" ? (a, b) => (b.d ?? -1) - (a.d ?? -1) : byDate);

  function selectStory(v, fit) {
    endTour(); routeDone = null;
    state.story = v; state.showAll = false;
    const st = v && STORY[v];
    if (st) $("storiesBox").open = true;
    if (st && (st.group || "") !== openGroup) openGroup = st.group || "";
    drawGroups();
    if (st) setSort(st.order === "long" ? "long" : "date");
    try { history.replaceState(null, "", v ? "#story-" + slug(v) : location.pathname + location.search); } catch (e) {}
    render(fit);
  }

  function drawCard() {
    const st = state.story && STORY[state.story];
    $("storyNow").textContent = st ? st.label : "";
    card.hidden = !st;
    if (!st) return;
    const all = DATA.filter(d => inStory(d, st.value)), shown = storySeq(st.value);
    const yrs = all.map(d => d.y).filter(Boolean), y0 = Math.min(...yrs), y1 = Math.max(...yrs);
    const span = yrs.length ? (y0 === y1 ? ` · ${y0}` : ` · ${y0}–${y1}`) : "";
    const filtered = shown.length < all.length ? ` <span class="fewer">(${shown.length} with your filters)</span>` : "";
    card.innerHTML = `
      ${st.group ? `<div class="sc-group">${esc(st.group)}</div>` : ""}
      <h3>${esc(st.label)}</h3>
      <div class="sc-meta">${all.length} siege${all.length === 1 ? "" : "s"}${span}${filtered}</div>
      ${st.summary ? `<p class="sc-sum">${esc(st.summary)}</p>` : ""}
      ${st.story ? `<div class="sc-story">${st.story.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("")}</div>` : ""}
      <div class="sc-actions">
        <button type="button" class="chip go" id="tourStart"${shown.length ? "" : " disabled"}>Follow the story <span aria-hidden="true">▸</span></button>
        <button type="button" class="chip" id="storyClear">Show all sieges</button>
      </div>
      <p class="sc-how">${st.tour === "route"
        ? (routeDone === st.value ? "Tour complete: the whole route is shown." : "The grey line is the whole route. Following the story draws it in leg by leg.")
        : `The tour visits the sieges ${st.order === "long" ? "from the longest to the shortest" : "in date order"}; places already visited and those still to come are faded.`}</p>`;
    $("tourStart").onclick = () => startTour();
    $("storyClear").onclick = () => selectStory(null, false);
  }

  /* the route line (for "route" stories) and the leg just travelled on a tour */
  const routeLayer = L.layerGroup().addTo(map);
  /* Two tour styles, set per story in stories.csv (Tour column):
     "visit": no lines; the siege being visited stands out, the ones already visited and still to come are faded.
     "route": before the tour, the whole route in grey as an overview; during it, the route is drawn leg by leg,
              each leg coloured by who prevailed at the siege it leads to; once finished, the whole coloured route stays. */
  let routeDone = null;   // the route story whose tour has been completed
  const dated = d => !!(d.s || d.e);
  const legLine = (a, b, opts) => L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { interactive: false, ...opts }).addTo(routeLayer);
  function drawRoute() {
    routeLayer.clearLayers();
    const st = state.story && STORY[state.story];
    if (st && st.tour === "route") {
      const seq = tour ? tour.list : storySeq(st.value);
      const upto = tour ? tour.i : seq.length - 1;
      const coloured = !!tour || routeDone === st.value;
      const lineColour = colour(sideKey(st.side)) === "#777777" ? (col.ink || "#2a2017") : colour(sideKey(st.side));   // the commander's side
      for (let k = 1; k <= upto; k++) {
        const a = seq[k - 1], b = seq[k];
        if (!dated(a) || !dated(b) || km(a, b) < 1) continue;
        if (!coloured) legLine(a, b, { color: col.ink || "#2a2017", weight: 1.6, opacity: .45, dashArray: "5 6" });
        else if (tour && k === upto) legLine(a, b, { color: lineColour, weight: 4, opacity: .95, dashArray: "9 6", className: "leg-now" });
        else legLine(a, b, { color: lineColour, weight: 2.6, opacity: .75 });
      }
    }
    if (tour) {
      const d = tour.list[tour.i];
      L.circleMarker([d.lat, d.lng], { radius: 17, color: d.a ? colour(d.a) : "#9a1c2c", weight: 3, fill: false, interactive: false, className: "tour-ring" }).addTo(routeLayer);
    }
    fadeMarkers();
  }
  // While touring: the current siege at full strength, visited ones faded, those still to come faded further.
  function fadeMarkers() {
    const pos = tour ? new Map(tour.list.map((d, k) => [d, k])) : null;
    GROUPS.forEach(g => {
      const el = g.marker.getElement();
      if (!el) return;
      let cls = "";
      if (pos && g.vis && g.vis.length) {
        const ks = g.vis.map(d => pos.get(d)).filter(k => k != null);
        cls = ks.includes(tour.i) ? "t-now" : ks.some(k => k < tour.i) ? "t-past" : "t-next";
      }
      el.classList.remove("t-now", "t-past", "t-next");
      if (cls) el.classList.add(cls);
      g.marker.setZIndexOffset(cls === "t-now" ? 5000 : g.z || 0);
    });
  }

  // "From Hougham House: 3 months later, 15 miles to the south-west."
  const ymd = iso => (iso || "").split("-").map(Number);
  function gapText(a, b) {
    const A = ymd(a.s || a.e), B = ymd(b.s || b.e);
    if (!A[0] || !B[0]) return "";
    if (A[1] && A[2] && B[1] && B[2]) {
      const days = Math.round((Date.UTC(B[0], B[1] - 1, B[2]) - Date.UTC(A[0], A[1] - 1, A[2])) / 864e5);
      if (days < 0) return "";
      if (days === 0) return "the same day";
      if (days < 45) return `${days} day${days === 1 ? "" : "s"} later`;
    }
    if (A[1] && B[1]) {
      const m = (B[0] - A[0]) * 12 + (B[1] - A[1]);
      if (m < 0) return "";
      if (m === 0) return "the same month";
      if (m < 18) return `${m} month${m === 1 ? "" : "s"} later`;
      return `${Math.round(m / 12)} years later`;
    }
    const y = B[0] - A[0];
    return y < 0 ? "" : y === 0 ? "the same year" : `${y} year${y === 1 ? "" : "s"} later`;
  }
  const DIRS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  function legText(a, b) {
    const k = km(a, b), miles = Math.round(k * 0.621);
    const dy = b.lat - a.lat, dx = (b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180);
    const dir = DIRS[Math.round(((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) / 45) % 8];
    const where = k < 1.5 ? "at the same place" : `${miles < 1 ? "under a mile" : miles + " mile" + (miles === 1 ? "" : "s")} to the ${dir}`;
    let when = gapText(a, b);
    const aEnd = a.e || a.s, bStart = b.s;
    if (bStart && aEnd && a.s && bStart > a.s && bStart < aEnd && when) when += ", while that siege was still going on";
    return `From ${a.p}: ${[when, where].filter(Boolean).join(", ")}.`;
  }

  /* tour */
  let tour = null;
  const tourEl = $("tour");
  const tourOverlaps = () => getComputedStyle(tourEl).position === "absolute";
  function startTour() {
    const list = storySeq(state.story);
    if (!list.length) return;
    if (routeDone === state.story) routeDone = null;
    tour = { list, i: 0 };
    document.querySelector(".plate").classList.add("touring");
    tourEl.hidden = false;
    map.invalidateSize();
    if (matchMedia("(max-width: 820px)").matches) document.querySelector(".plate").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    goTo(0);
  }
  function endTour(finished) {
    if (!tour) return;
    if (finished === true && STORY[state.story] && STORY[state.story].tour === "route") routeDone = state.story;
    tour = null; tourEl.hidden = true;
    document.querySelector(".plate").classList.remove("touring");
    map.invalidateSize();
    drawRoute(); drawCard();
    if (finished === true) {   // step back to see the whole story
      const vis = storySeq(state.story);
      if (vis.length) map.flyToBounds(L.latLngBounds(vis.map(d => [d.lat, d.lng])).pad(0.15), { maxZoom: 8, duration: reduceMotion ? 0 : 1 });
    }
  }
  function goTo(i) {
    if (!tour) return;
    tour.i = Math.max(0, Math.min(i, tour.list.length - 1));
    const d = tour.list[tour.i], n = tour.list.length, st = STORY[state.story];
    tourEl.querySelector(".tour-title").textContent = st ? st.label : "";
    tourEl.querySelector(".tour-step").textContent = `${tour.i + 1} of ${n}`;
    tourEl.querySelector(".tour-place").textContent = d.p;
    // the pulsing ring on the map is drawn in the attackers' colour; this says so
    const att = d.a ? `<span class="att" style="--c:${colour(d.a)}"><i></i>${esc(SIDE[d.a].plural || SIDE[d.a].label)} attacking</span>` : "";
    tourEl.querySelector(".tour-when").innerHTML = [esc(fmtRange(d.s, d.e)) + (d.dl ? " · " + esc(d.dl) : ""), att, d.w ? `<span class="pill" style="color:${colour(d.w)}"><i></i>${esc(SIDE[d.w].label)} prevailed</span>` : ""].filter(Boolean).join(" ");
    // why this siege belongs to the story (data/story-steps.csv), or the siege's own headline
    tourEl.querySelector(".tour-head").textContent = STEPS.get(state.story + "|" + d.id) || d.h || "";
    tourEl.querySelector(".tour-leg").textContent = tour.i ? legText(tour.list[tour.i - 1], d) : (n > 1 ? `The first of ${n} sieges in this story.` : "The only siege in this story.");
    $("tourPrev").disabled = tour.i === 0;
    $("tourNext").innerHTML = tour.i === n - 1 ? (st && st.tour === "route" ? "Finish: see the whole route" : "Finish") : `Next <span aria-hidden="true">›</span>`;
    drawRoute();
    map.closePopup();
    showLeg(tour.i ? tour.list[tour.i - 1] : null, d);
  }
  // Frame the leg just travelled (previous siege and this one), keeping clear of the tour panel.
  function showLeg(a, b) {
    const below = tourOverlaps() ? tourEl.offsetHeight + 20 : 0;   // on phones the panel sits under the map instead
    const pad = { paddingTopLeft: [Math.min(150, Math.round(map.getSize().x * 0.3)), 40], paddingBottomRight: [50, below + 30], duration: reduceMotion ? 0 : 1 };
    if (a && km(a, b) > 1.5) map.flyToBounds(L.latLngBounds([[a.lat, a.lng], [b.lat, b.lng]]), { ...pad, maxZoom: 9 });
    else {
      const z = Math.max(map.getZoom(), M.zoomWhenSiegeChosen || 8);
      const c = map.unproject(map.project([b.lat, b.lng], z).add([0, Math.round(below / 2)]), z);
      map.flyTo(c, z, { duration: pad.duration });
    }
  }
  function readTourSiege() {
    if (!tour) return;
    const d = tour.list[tour.i], g = groupOf.get(d);
    if (!g.vis.includes(d)) return;
    tourEl.classList.add("compact");   // the panel shrinks while the full account is open
    g.popup.options.autoPanPaddingBottomRight = [24, tourOverlaps() ? tourEl.offsetHeight + 64 : 24];
    g.popup.options.autoPanPaddingTopLeft = [24, 30];
    showInPopup(g, g.vis.indexOf(d)); g.marker.openPopup();
  }
  $("tourRead").onclick = readTourSiege;
  $("tourPrev").onclick = () => goTo(tour.i - 1);
  $("tourNext").onclick = () => tour.i === tour.list.length - 1 ? endTour(true) : goTo(tour.i + 1);
  $("tourClose").onclick = () => endTour();
  document.addEventListener("keydown", e => {
    if (!tour || e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); if (tour.i < tour.list.length - 1) goTo(tour.i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(tour.i - 1); }
    else if (e.key === "Escape") endTour();
  });

  const hist = $("hist");
  hist.style.gridTemplateColumns = $("yearLabels").style.gridTemplateColumns = `repeat(${YEARS.length}, minmax(0, 1fr))`;
  const perYear = y => DATA.filter(d => d.y === y).length;
  const maxPerYear = Math.max(1, ...YEARS.map(perYear));
  YEARS.forEach(y => {
    const n = perYear(y), b = document.createElement("button");
    b.dataset.year = y; b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `${y}: ${n} siege${n === 1 ? "" : "s"} begun`);
    b.innerHTML = `<span class="n">${n || ""}</span><span class="bar" style="height:${n ? Math.max(2, (n / maxPerYear) * 68) : 1}px"></span>`;
    b.onclick = () => { stopPlay(); setYear(state.year === y ? null : y); };
    hist.appendChild(b);
  });
  $("yearLabels").innerHTML = YEARS.map(y => `<span>'${String(y).slice(2)}</span>`).join("");
  const bands = (cfg.years.bands || []).filter(b => b.to >= Y0 && b.from <= Y1);
  $("wars").style.gridTemplateColumns = bands.map(b => `${Math.min(b.to, Y1) - Math.max(b.from, Y0) + 1}fr`).join(" ");
  $("wars").innerHTML = bands.map(b => `<span title="${esc(b.label)}">${esc(b.label)}</span>`).join("");
  const outside = DATA.filter(d => d.y != null && (d.y < Y0 || d.y > Y1)).length;
  const undatedN = DATA.filter(d => d.y == null).length;
  $("undated").textContent = [undatedN ? `${undatedN} sieges have no date and appear under All years only.` : "", outside ? `${outside} fall outside ${Y0}–${Y1}.` : ""].filter(Boolean).join(" ");
  $("allYears").onclick = () => { stopPlay(); setYear(null); };

  function setYear(y) {
    state.year = y; state.showAll = false;
    hist.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.year === y)));
    $("allYears").setAttribute("aria-pressed", String(y == null));
    $("yearNote").textContent = y == null ? "All years" : `Begun in ${y}`;
    render();
  }

  $("sides").innerHTML = SIDES.map(s => `<label class="side"><input type="checkbox" value="${s.key}" checked><span class="sw" style="background:${esc(s.colour)}"></span>${esc(s.label)} <span class="ct">${DATA.filter(d => d.w === s.key).length}</span></label>`).join("");
  $("sides").querySelectorAll("input").forEach(inp => inp.onchange = () => { inp.checked ? state.sides.add(inp.value) : state.sides.delete(inp.value); render(); });

  function setSort(s) { state.sort = s; document.querySelectorAll(".sort button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.sort === s))); }
  setSort(state.sort);
  document.querySelectorAll(".sort button").forEach(b => b.onclick = () => { setSort(b.dataset.sort); render(); });
  $("search").addEventListener("input", e => { state.q = e.target.value.trim().toLowerCase(); state.showAll = false; render(); });
  $("more").onclick = () => { state.showAll = true; render(); };

  let timer = null;
  const playBtn = $("play");
  function stopPlay() {
    if (!timer) return; clearInterval(timer); timer = null;
    playBtn.setAttribute("aria-pressed", "false"); $("playIcon").textContent = "▶"; $("playTxt").textContent = "Play through the wars";
  }
  playBtn.onclick = () => {
    if (timer) return stopPlay();
    const seq = YEARS.filter(perYear); if (!seq.length) return;
    let i = 0; setYear(seq[0]);
    playBtn.setAttribute("aria-pressed", "true"); $("playIcon").textContent = "❚❚"; $("playTxt").textContent = "Pause";
    timer = setInterval(() => { i++; if (i >= seq.length) { stopPlay(); setYear(null); return; } setYear(seq[i]); }, (cfg.years.playSecondsPerYear || 1.6) * 1000);
  };

  const visible = () => DATA.filter(d => (!d.w || state.sides.has(d.w))
    && (state.year == null || d.y === state.year)
    && (!state.story || inStory(d, state.story))
    && (!state.q || d.p.toLowerCase().includes(state.q) || d.c.toLowerCase().includes(state.q)));

  function render(fit) {
    const vis = visible();
    updateMarkers(new Set(vis));
    scheduleDeclutter();
    // towns step back further while a story or year is chosen, so the chosen sieges stand alone
    map.getContainer().classList.toggle("towns-faded", M.fadeTownsWhenFiltered !== false && (state.story != null || state.year != null));
    drawCard(); drawRoute();
    const filtered = state.story != null || state.year != null || !!state.q || state.sides.size < SIDES.length;
    $("resetAll").classList.toggle("active", filtered);
    if (fit && vis.length) map.flyToBounds(L.latLngBounds(vis.map(d => [d.lat, d.lng])).pad(0.15), { maxZoom: 8, duration: reduceMotion ? 0 : 0.8 });

    const longest = vis.filter(d => d.d != null).reduce((a, d) => (!a || d.d > a.d ? d : a), null);
    $("stats").innerHTML = vis.length
      ? `<span><b>${vis.length}</b> siege${vis.length === 1 ? "" : "s"}${state.story && STORY[state.story] ? ` in <i>${esc(STORY[state.story].label)}</i>` : ""}</span>${longest ? `<span>longest: <b>${esc(longest.p)}</b>, ${esc(fmtDays(longest))}</span>` : ""}`
      : `<span>No sieges match these filters.</span>`;

    const rows = [...vis];
    if (state.sort === "long") rows.sort((a, b) => (b.d ?? -1) - (a.d ?? -1));
    else if (state.sort === "date") rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    else rows.sort((a, b) => a.p.localeCompare(b.p));
    const LIMIT = (cfg.list || {}).showFirst || 40;
    const shown = state.showAll ? rows : rows.slice(0, LIMIT);
    $("more").hidden = rows.length <= LIMIT || state.showAll;
    $("more").textContent = `Show all ${rows.length}`;

    const list = $("list");
    list.innerHTML = shown.length ? "" : `<li class="empty">Nothing to show. Try another year, story or side.</li>`;
    shown.forEach(d => {
      const val = state.sort === "date" ? (fmtOne(d.s) || fmtOne(d.e) || "undated") : (d.d == null ? "—" : fmtDays(d));
      const li = document.createElement("li");
      li.innerHTML = `<button><span class="nm">${esc(d.p)}</span><span class="val">${esc(val)}</span>
        <span class="meta"><span class="dot" style="background:${colour(d.w)}"></span><span class="txt">${esc(d.c)} · ${d.y || "undated"}${d.w ? " · " + esc(SIDE[d.w].label) : ""}</span></span></button>`;
      li.firstElementChild.onclick = () => focusSiege(d);
      list.appendChild(li);
    });
  }

  function focusSiege(d) {
    const g = groupOf.get(d);
    if (!g.vis.includes(d)) return;
    const z = Math.max(map.getZoom(), M.zoomWhenSiegeChosen || 8);
    map.closePopup();
    g.popup.options.autoPanPaddingBottomRight = [24, tour && tourOverlaps() ? tourEl.offsetHeight + 44 : 24];
    g.popup.options.autoPanPaddingTopLeft = [24, 96];
    map.flyTo([g.lat, g.lng], z, { duration: reduceMotion ? 0 : 0.9 });
    map.once("moveend", () => { showInPopup(g, g.vis.indexOf(d)); g.marker.openPopup(); });
    if (matchMedia("(max-width: 820px)").matches) document.querySelector(".plate").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  // open a story named in the link (#story-newarks-ring), otherwise the first group
  const fromHash = STORIES.find(s => location.hash === "#story-" + slug(s.value));
  if (fromHash) { $("storiesBox").open = true; state.story = fromHash.value; openGroup = fromHash.group || ""; setSort(fromHash.order === "long" ? "long" : "date"); }
  drawGroups();

  // "Show all sieges": clears every filter and the tour, and returns to the whole map
  $("resetAll").onclick = () => {
    endTour(); stopPlay(); map.closePopup();
    state.story = null; state.year = null; state.q = ""; state.showAll = false;
    state.sides = new Set(SIDES.map(s => s.key));
    $("sides").querySelectorAll("input").forEach(i => { i.checked = true; });
    $("search").value = "";
    hist.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", "false"));
    $("allYears").setAttribute("aria-pressed", "true"); $("yearNote").textContent = "All years";
    setSort((cfg.list || {}).defaultSort || "long");
    drawGroups();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    render();
    map.flyToBounds([[sv.south, sv.west], [sv.north, sv.east]], { padding: [10, 10], duration: reduceMotion ? 0 : 0.8 });
  };
  render(!!fromHash);
  // following a story link while the page is already open
  addEventListener("hashchange", () => {
    const st = STORIES.find(s => location.hash === "#story-" + slug(s.value));
    if (st && st.value !== state.story) selectStory(st.value, true);
  });
})();
