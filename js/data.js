/* Siege map: loading and reading the settings file and the spreadsheet.
   Shared by index.html (the map) and check.html (the data checker).
   Nothing here needs changing to update the data: edit data/sieges.csv and config/config.json. */
(function () {
  "use strict";

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  async function fetchText(url, encoding) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status}). Check the file name and folder.`);
    const buf = await res.arrayBuffer();
    if (encoding && encoding !== "auto") return { text: new TextDecoder(encoding).decode(buf), encoding };
    try {
      return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "utf-8" };
    } catch (e) {
      // Excel's plain "CSV" export on Windows is not UTF-8; read it as Windows-1252 instead.
      return { text: new TextDecoder("windows-1252").decode(buf), encoding: "windows-1252" };
    }
  }

  async function loadConfig(url = "config/config.json") {
    const { text } = await fetchText(url, "utf-8");
    try { return JSON.parse(text); }
    catch (e) {
      const m = /position (\d+)/.exec(e.message);
      const line = m ? text.slice(0, +m[1]).split("\n").length : null;
      throw new Error(`The settings file (config/config.json) has a mistake${line ? " near line " + line : ""}: ${e.message}. Look for a missing comma or quote mark.`);
    }
  }

  function parseCSV(text) {
    const out = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: h => h.trim() });
    return out;
  }

  /* Stories: read from data/stories.csv (one row per story) if the settings name it, otherwise from the
     "stories" list in the settings file. Each story is { value, label, group, summary, story, order }. */
  async function loadStories(cfg) {
    const tourDefault = ((cfg.tours || {}).default || "visit").toLowerCase() === "route" ? "route" : "visit";
    const fromSettings = () => (cfg.stories || []).map(s => ({ value: s.value, label: s.label || s.value, group: s.group || "", summary: s.summary || "", story: s.story || "", order: s.sort === "long" ? "long" : "date", tour: s.tour === "route" ? "route" : tourDefault }));
    if (!cfg.data || !cfg.data.stories) return { stories: fromSettings(), problems: [] };
    const { text } = await fetchText(cfg.data.stories, "auto");
    const rows = parseCSV(text).data, problems = [], seen = new Set();
    const orders = { date: "date", route: "route", long: "long", length: "long", longest: "long" };
    const stories = [];
    rows.forEach((r, i) => {
      const value = String(r.Tag || "").trim();
      if (!value) return;
      const note = (field, message) => problems.push({ row: i + 2, id: value, place: r.Title || value, field, message });
      if (seen.has(value)) note("Tag", "This tag appears twice in stories.csv; only the first row is used");
      seen.add(value);
      const o = String(r.Order || "date").trim().toLowerCase();
      if (!orders[o]) note("Order", `"${r.Order}" isn't an order; use date or length`);
      // Tour: "visit" (no lines; places already visited and still to come are faded) or "route" (the route is drawn as the tour goes)
      const t = String(r.Tour || "").trim().toLowerCase();
      if (t && t !== "visit" && t !== "route") note("Tour", `"${r.Tour}" isn't a tour style; use visit or route`);
      const tour = t === "route" || t === "visit" ? t : (o === "route" ? "route" : tourDefault);
      stories.push({ value, label: String(r.Title || value).trim(), group: String(r.Group || "").trim(), summary: String(r.Summary || "").trim(), story: String(r.Story || "").trim(), order: orders[o] === "long" ? "long" : "date", tour, side: String(r.Side || "").trim() });
    });
    return { stories, problems };
  }

  /* Step notes: data/story-steps.csv gives, for each story and siege, a line saying why that siege is part of
     the story. Returns a Map keyed "Tag|ID". */
  async function loadSteps(cfg) {
    const notes = new Map();
    if (!cfg.data || !cfg.data.storySteps) return notes;
    const { text } = await fetchText(cfg.data.storySteps, "auto");
    parseCSV(text).data.forEach(r => {
      const tag = String(r.Tag || "").trim(), id = String(r.ID || "").trim(), note = String(r.Note || "").trim();
      if (tag && id && note) notes.set(tag + "|" + id, note);
    });
    return notes;
  }

  // Dates: "1644/7/2", "1644/7/", "1644//", "1644-07-02", "2/7/1644", "1644". Returns [y, m, d] with nulls, or null if unreadable.
  function parseDate(raw, format) {
    const s = String(raw || "").trim();
    if (!s || /^[/\-\s]*$/.test(s)) return [null, null, null];
    let m = /^(\d{4})(?:[/\-.](\d{0,2}))?(?:[/\-.](\d{0,2}))?$/.exec(s);
    if (m && format !== "day-first") return [+m[1], m[2] ? +m[2] : null, m[3] ? +m[3] : null];
    m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
    if (m && format !== "year-first") return [+m[3], +m[2], +m[1]];
    m = /^(\d{1,2})[/\-.](\d{4})$/.exec(s);
    if (m) return [+m[2], +m[1], null];
    return null;
  }
  const iso = p => p && p[0] ? [p[0], p[1], p[2]].filter(v => v != null).map((v, i) => i ? String(v).padStart(2, "0") : String(v)).join("-") : "";
  function validDate(p) {
    if (!p || !p[0]) return true;
    if (p[1] != null && (p[1] < 1 || p[1] > 12)) return false;
    if (p[2] != null) {
      if (p[1] == null) return false;
      const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
      if (d.getUTCDate() !== p[2]) return false;
    }
    return true;
  }
  const dayNum = p => Date.UTC(p[0], p[1] - 1, p[2]) / 864e5;

  function parseDuration(raw) {
    const s = String(raw || "").trim();
    if (!s) return { days: null, label: "" };
    if (/^multiple/i.test(s)) return { days: null, label: "Multiple sieges" };
    const m = /^([\d,.]+)\s*(days?)?\s*(\(?\s*approx\.?\s*\)?)?/i.exec(s);
    if (!m) return { days: null, label: s, bad: true };
    const v = parseFloat(m[1].replace(/,/g, ""));
    const approx = !!m[3];
    return { days: v, label: `${v} day${v === 1 ? "" : "s"}${approx ? " (approx.)" : ""}`, approx, noUnits: !m[2] };
  }

  /* Turn spreadsheet rows into siege records. Returns { records, skipped, problems }.
     problems: [{ row, id, place, field, message }] for the checker page. */
  function buildRecords(rows, cfg) {
    const C = cfg.columns;
    const sideByValue = {};
    (cfg.sides || []).forEach((s, i) => { sideByValue[s.value.trim().toLowerCase()] = "s" + i; });
    const storyValues = new Set((cfg.stories || []).map(s => s.value));
    const storySource = cfg.data && cfg.data.stories ? "data/stories.csv" : "the settings file";
    const records = [], skipped = [], problems = [];
    const seenIds = new Map();
    const get = (r, key) => (C[key] && r[C[key]] != null ? String(r[C[key]]) : "");
    const fmt = (cfg.dates && cfg.dates.format) || "auto";

    rows.forEach((r, i) => {
      const rowNo = i + 2; // spreadsheet row, counting the header as row 1
      const id = get(r, "id").trim();
      const place = get(r, "place").replace(/\s+/g, " ").trim();
      const note = (field, message) => problems.push({ row: rowNo, id, place, field, message });

      const lat = parseFloat(get(r, "latitude")), lng = parseFloat(get(r, "longitude"));
      const sRaw = get(r, "start"), eRaw = get(r, "end");
      const a = get(r, "attacker").trim(), f = get(r, "defender").trim(), w = get(r, "outcome").trim();

      if (!place && !id) return;
      if (!sRaw.replace(/[/\s]/g, "") && !eRaw.replace(/[/\s]/g, "") && !a && !f && !w) {
        skipped.push({ row: rowNo, id, place, reason: "No dates, sides or outcome, so it isn't shown on the map" });
        return;
      }
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        skipped.push({ row: rowNo, id, place, reason: "Latitude or Longitude is missing or not a number" });
        note("Latitude/Longitude", "Missing or not a number; this siege can't be placed on the map");
        return;
      }
      if (id) {
        if (seenIds.has(id)) note("ID", `Same ID as row ${seenIds.get(id)}`);
        else seenIds.set(id, rowNo);
      } else note("ID", "No ID");

      const sp = parseDate(sRaw, fmt), ep = parseDate(eRaw, fmt);
      if (sp === null) note("Start Date", `Can't read "${sRaw}"`);
      else if (!validDate(sp)) note("Start Date", `"${sRaw}" isn't a real date (month or day out of range)`);
      if (ep === null) note("End Date", `Can't read "${eRaw}"`);
      else if (!validDate(ep)) note("End Date", `"${eRaw}" isn't a real date (month or day out of range)`);
      const s = sp && validDate(sp) ? sp : [null, null, null];
      const e = ep && validDate(ep) ? ep : [null, null, null];
      if (s[0] && e[0]) {
        const ka = [s[0], s[1] || 0, s[2] || 0], kb = [e[0], e[1] || 13, e[2] || 32];
        if (kb[0] < ka[0] || (kb[0] === ka[0] && (kb[1] < ka[1] || (kb[1] === ka[1] && kb[2] < ka[2]))))
          note("End Date", `Ends (${eRaw}) before it starts (${sRaw})`);
      }
      if (!s[0] && !e[0]) note("Start/End Date", "No dates: shown under All years only");

      const dur = parseDuration(get(r, "duration"));
      if (dur.bad) note("Duration", `Can't read "${get(r, "duration").trim()}"`);
      if (dur.noUnits) note("Duration", `"${get(r, "duration").trim()}" has no units; read as days`);
      let days = dur.days, durLabel = dur.label;
      const full = s[0] && s[1] && s[2] && e[0] && e[1] && e[2];
      if (full) {
        const n = dayNum(e) - dayNum(s) + 1;
        if (days == null && !/multiple/i.test(get(r, "duration"))) { days = n; durLabel = `${n} days (from dates)`; }
        else if (days != null && Math.min(Math.abs(days - n), Math.abs(days - n + 1)) > 2)
          note("Duration", `Says ${get(r, "duration").trim()} but the dates give ${n} days`);
      }

      const side = (v, field) => {
        if (!v) return null;
        const k = sideByValue[v.toLowerCase()];
        if (!k) note(field, `"${v}" isn't one of the sides in the settings file`);
        return k || null;
      };
      const story = get(r, "story").trim();
      if (story && !storyValues.has(story) && !(cfg.sides || []).some(sd => sd.value === story))
        note("Themes", `"${story}" isn't a story in ${storySource}, so it has no button`);
      const tags = get(r, "tags").split(/[;\n]/).map(t => t.trim()).filter(Boolean);
      tags.filter(t => !storyValues.has(t)).forEach(t => note("Tags", `"${t}" isn't a story in ${storySource}; check the spelling, or add a row for it`));
      const body = get(r, "body");
      if (/\w\?\w/.test(body + get(r, "headline")))
        note("Text", "Has '?' inside words: the file may have been saved without UTF-8, which turns apostrophes and quote marks into '?'");

      const img1 = get(r, "image"), img2 = get(r, "image2");
      records.push({
        row: rowNo, id: id || "row" + rowNo, p: place, c: get(r, "county").trim(), n: get(r, "country").trim(),
        s: iso(s), e: iso(e), y: s[0] || e[0] || null,
        d: days, dl: durLabel, approx: !!dur.approx,
        a: side(a, "MAP Attacker"), f: side(f, "MAP Defender"), w: side(w, "MAP Outcome"),
        t: story, tags, h: get(r, "headline").trim(), b: body.trim(), u: get(r, "website").trim(),
        images: [[img1, get(r, "caption")], [img2, get(r, "caption2")]].filter(x => x[0] && x[0].trim()).map(x => ({ file: x[0], caption: x[1].trim() })),
        lat, lng
      });
    });
    return { records, skipped, problems };
  }

  function imageURL(folder, file) {
    const f = String(file);
    return (folder || "images/").replace(/\/?$/, "/") + f.split("/").map(encodeURIComponent).join("/");
  }

  function fmtOne(s) {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return [d, m ? MONTHS[m - 1] : null, y].filter(Boolean).join(" ");
  }
  function fmtRange(s, e) {
    if (!s && !e) return "Date unknown";
    if (!s) return "Ended " + fmtOne(e);
    if (!e || s === e) return fmtOne(s);
    const [ys, ms, ds] = s.split("-").map(Number), [ye, me] = e.split("-").map(Number);
    if (ys === ye && ms && me && ds) return `${ds}${ms !== me ? " " + MONTHS[ms - 1] : ""} – ${fmtOne(e)}`;
    if (ys === ye && ms && me) return `${MONTHS[ms - 1]} – ${fmtOne(e)}`;
    return `${fmtOne(s)} – ${fmtOne(e)}`;
  }

  window.SiegeData = { fetchText, loadConfig, loadStories, loadSteps, parseCSV, buildRecords, imageURL, fmtOne, fmtRange, parseDate };
})();
