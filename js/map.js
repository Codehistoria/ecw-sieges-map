/* Siege map: the interactive page.
   Reads config/config.json and data/sieges.csv each time it loads, so changes to either show on the next refresh. */
(async function () {
  "use strict";
  const { loadConfig, fetchText, parseCSV, buildRecords, imageURL, fmtOne, fmtRange } = window.SiegeData;
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
    const { text } = await fetchText(cfg.data.sieges, cfg.data.encoding);
    const parsed = parseCSV(text);
    const missing = Object.entries(cfg.columns).filter(([k, col]) => !["image2", "caption2", "website", "story", "duration", "caption"].includes(k) && !parsed.meta.fields.includes(col));
    if (missing.length) throw new Error(`The spreadsheet has no column called ${missing.map(m => `"${m[1]}"`).join(", ")}. Rename the column, or change "columns" in config/config.json.`);
    DATA = buildRecords(parsed.data, cfg).records;
  } catch (e) { showNotice(e.message); console.error(e); return; }

  const T = cfg.text || {}, M = cfg.map || {}, IMG = cfg.images || {};
  const SIDES = (cfg.sides || []).map((s, i) => ({ key: "s" + i, ...s }));
  const SIDE = Object.fromEntries(SIDES.map(s => [s.key, s]));
  const colour = k => (SIDE[k] && SIDE[k].colour) || "#777777";
  const STORIES = cfg.stories || [];
  const STORY_VALUES = STORIES.map(s => s.value);
  const Y0 = cfg.years.from, Y1 = cfg.years.to;
  const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i);

  // colours from the settings file
  const root = document.documentElement.style, col = cfg.colours || {};
  const setVar = (v, x) => x && root.setProperty(v, x);
  setVar("--paper", col.paper); setVar("--paper-deep", col.paperDeep); setVar("--inlay", col.inlay); setVar("--ink", col.ink); setVar("--sea", col.sea);
  SIDES.forEach((s, i) => setVar("--side" + i, s.colour));

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
    const story = STORY_VALUES.includes(d.t) ? `<span class="story">${esc((STORIES.find(s => s.value === d.t) || {}).label || d.t)}</span>` : "";
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
      <div class="where">${esc(where)}</div>
      ${switcherHTML(members, i)}
      <div class="when">${esc(fmtRange(d.s, d.e))}${dur}</div>
      ${sides}
      <div class="tags">${out}${story}</div>
      <div class="read">
        ${d.h ? `<p class="headline">${esc(d.h)}</p>` : ""}
        ${body ? `<div class="body" tabindex="0" aria-label="Full account">${body}</div>` : ""}
      </div>
      ${site}
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
  map.on("popupclose", () => document.querySelector(".plate").classList.remove("popup-open"));

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
    el.addEventListener("click", e => {
      e.stopPropagation();
      const b = e.target.closest("button"); if (!b) return;
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
        g.marker.setZIndexOffset(-Math.round(r * 20));
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

  const storiesEl = $("stories");
  [{ value: null, label: "All sieges" }, ...STORIES].forEach(s => {
    const b = document.createElement("button");
    const n = s.value ? DATA.filter(d => d.t === s.value).length : DATA.length;
    b.className = "chip"; b.setAttribute("aria-pressed", String(s.value === null));
    b.innerHTML = `${esc(s.label)} <span class="ct">${n}</span>`;
    b.onclick = () => {
      state.story = s.value; state.showAll = false;
      storiesEl.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (s.sort) setSort(s.sort);
      render(true);
    };
    storiesEl.appendChild(b);
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
    && (!state.story || d.t === state.story)
    && (!state.q || d.p.toLowerCase().includes(state.q) || d.c.toLowerCase().includes(state.q)));

  function render(fit) {
    const vis = visible();
    updateMarkers(new Set(vis));
    scheduleDeclutter();
    // towns step back further while a story or year is chosen, so the chosen sieges stand alone
    map.getContainer().classList.toggle("towns-faded", M.fadeTownsWhenFiltered !== false && (state.story != null || state.year != null));
    if (fit && vis.length) map.flyToBounds(L.latLngBounds(vis.map(d => [d.lat, d.lng])).pad(0.15), { maxZoom: 8, duration: reduceMotion ? 0 : 0.8 });

    const longest = vis.filter(d => d.d != null).reduce((a, d) => (!a || d.d > a.d ? d : a), null);
    $("stats").innerHTML = vis.length
      ? `<span><b>${vis.length}</b> siege${vis.length === 1 ? "" : "s"}</span>${longest ? `<span>longest: <b>${esc(longest.p)}</b>, ${esc(fmtDays(longest))}</span>` : ""}`
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
    map.flyTo([g.lat, g.lng], Math.max(map.getZoom(), M.zoomWhenSiegeChosen || 8), { duration: reduceMotion ? 0 : 0.9 });
    map.once("moveend", () => { showInPopup(g, g.vis.indexOf(d)); g.marker.openPopup(); });
    if (matchMedia("(max-width: 820px)").matches) document.querySelector(".plate").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  render();
})();
