/* ---------------------------------------------------------------------------
   clock.js — drives the landing-page live demo:
   a WebNTP-synchronised digital clock (Japan Standard Time) with live
   offset / delay / server-id readouts. Localised via <html lang>.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  // The public WebNTP server that backs this site.
  const HOST = "webntp.shogo82148.com";
  const WS_URL = `wss://${HOST}/websocket`;

  const LANG = (document.documentElement.lang || "ja").startsWith("en") ? "en" : "ja";
  const LOCALE = LANG === "en" ? "en-US" : "ja-JP";
  const T = {
    ja: {
      syncing: "同期中…",
      synced: "WebSocket で同期済み",
      retry: (s) => `再接続まで ${s}秒`,
    },
    en: {
      syncing: "Syncing…",
      synced: "Synced over WebSocket",
      retry: (s) => `Reconnecting in ${s}s`,
    },
  }[LANG];

  const timeEl = document.getElementById("time");
  const msEl = document.getElementById("milliseconds");
  const dateEl = document.getElementById("date");
  const tzEl = document.getElementById("tz-name");
  const statusEl = document.getElementById("sync-status");
  const dotEl = document.getElementById("sync-dot");
  const offsetEl = document.getElementById("stat-offset");
  const delayEl = document.getElementById("stat-delay");
  const serverEl = document.getElementById("stat-server");

  const SYNC_INTERVAL = 10 * 60 * 1000; // 10 min
  const TIMEOUT = 5 * 1000;
  const MAX_RETRY = 60 * 1000;
  let offset = 0;
  let retryDelay = 1000;
  let synced = false;

  // Format in the viewer's own local time zone (no fixed timeZone option).
  const timeFmt = new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const dateFmt = new Intl.DateTimeFormat(LOCALE, {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  // Show the local time zone's friendly name (falls back to the IANA id).
  function localZoneLabel() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const parts = new Intl.DateTimeFormat(LOCALE, { timeZoneName: "long" }).formatToParts(new Date());
      const name = parts.find((p) => p.type === "timeZoneName");
      if (name && name.value) return name.value;
    } catch (e) { /* ignore */ }
    return zone;
  }
  if (tzEl) {
    tzEl.textContent = localZoneLabel();
    tzEl.title = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function render() {
    const now = new Date(Date.now() + offset);
    if (timeEl) {
      timeEl.textContent = timeFmt.format(now);
      timeEl.dateTime = now.toISOString();
    }
    if (msEl) msEl.textContent = ("00" + now.getMilliseconds()).slice(-3);
    if (dateEl) dateEl.textContent = dateFmt.format(now);
    requestAnimationFrame(render);
  }
  render();

  function setStatus(text, kind) {
    if (statusEl) statusEl.textContent = text;
    if (dotEl) dotEl.className = "dot" + (kind ? " " + kind : "");
  }

  function fmtMs(v) {
    const sign = v >= 0 ? "+" : "−";
    return `${sign}${Math.abs(v).toFixed(1)}<small> ms</small>`;
  }

  function getServerTime() {
    return new Promise((resolve, reject) => {
      const client = new WebNTP.Client();
      const t = setTimeout(() => {
        client.cancel();
        reject(new Error("timed out"));
      }, TIMEOUT);
      client.get(WS_URL)
        .then((r) => { clearTimeout(t); resolve(r); })
        .catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  function synchronize() {
    if (!synced) setStatus(T.syncing, "live");
    getServerTime()
      .then((result) => {
        offset = result.offset;
        retryDelay = 1000;
        synced = true;
        setStatus(T.synced, "live");
        if (offsetEl) offsetEl.innerHTML = fmtMs(result.offset);
        if (delayEl) delayEl.innerHTML = fmtMs(result.delay);
        if (serverEl && result.response) serverEl.textContent = result.response.id;
        setTimeout(synchronize, SYNC_INTERVAL);
      })
      .catch(() => {
        const wait = retryDelay * (0.5 + Math.random() * 0.5);
        const retryAt = Date.now() + wait;
        const tick = () => {
          const s = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
          setStatus(T.retry(s), "err");
        };
        tick();
        const iv = setInterval(tick, 250);
        setTimeout(() => { clearInterval(iv); synchronize(); }, wait);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
      });
  }
  synchronize();
})();
