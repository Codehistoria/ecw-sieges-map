/* View counter for the map.
   Counts one view per visit (a browser tab session), and can show the running total.
   Two services are supported, chosen in config/config.json under "viewCount":
   - "abacus" (default): a free counting service that needs no sign-up. It stores only a number: no cookies,
     nothing about the visitor. https://v2.jasoncameron.dev/abacus
   - "goatcounter": a free, privacy-friendly analytics service (needs a free account and its site code). Besides
     the total it gives a dashboard of views by day, referring sites, countries and screen sizes.
   Nothing is counted on a local copy (localhost) or anywhere the service can't be reached; the map never waits for it. */
window.SiegeViews = (function () {
  "use strict";
  const LOCAL = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(location.hostname) || location.protocol === "file:";
  const SEEN = "siege-map-viewed";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
  const getJSON = url => withTimeout(fetch(url, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error(r.status))), 6000);

  // count = true on the map itself, false on helper pages that only show the total
  async function run(vc, count) {
    if (!vc || vc.service === "none") return null;
    let first = false;
    try { first = count && !sessionStorage.getItem(SEEN); if (first) sessionStorage.setItem(SEEN, "1"); } catch (e) { first = count; }
    const doCount = first && !LOCAL && (!vc.countOn || [].concat(vc.countOn).includes(location.hostname));
    try {
      if (vc.service === "goatcounter") {
        if (!vc.goatcounter) return null;
        const base = `https://${vc.goatcounter}.goatcounter.com`;
        if (doCount) {   // GoatCounter's own script records the visit
          const s = document.createElement("script");
          s.async = true; s.src = "https://gc.zgo.at/count.js"; s.dataset.goatcounter = base + "/count";
          document.head.appendChild(s);
        }
        const j = await getJSON(`${base}/counter/TOTAL.json`);
        return Number(String(j.count).replace(/[^\d]/g, "")) || null;
      }
      const ns = encodeURIComponent(vc.namespace || "siege-map"), key = encodeURIComponent(vc.key || "views");
      const j = await getJSON(`https://abacus.jasoncameron.dev/${doCount ? "hit" : "get"}/${ns}/${key}`);
      return typeof j.value === "number" ? j.value : null;
    } catch (e) { return null; }
  }

  // Writes e.g. "Viewed 1,234 times since November 2026" into an element (left empty if there's no number)
  function show(el, n, vc) {
    if (!el || n == null) return;
    const since = vc.since ? ` since ${vc.since}` : "";
    el.textContent = (vc.label || "Viewed {n} times{since}").replace("{n}", n.toLocaleString("en-GB")).replace("{since}", since);
    el.hidden = false;
  }
  return { run, show };
})();
