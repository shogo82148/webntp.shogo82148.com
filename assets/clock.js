/* ---------------------------------------------------------------------------
   clock.js — drives the landing-page live demo:
     1. a WebNTP-synchronised digital clock (Japan Standard Time)
     2. live offset / delay / server-id readouts
     3. an interactive playground for the three WebNTP protocols
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  // The public WebNTP server that backs this site.
  const HOST = "webntp.shogo82148.com";
  const WS_URL = `wss://${HOST}/websocket`;
  const JSON_URL = `https://${HOST}/json`;
  const TIME_URL = `https://${HOST}/.well-known/time`;

  /* ---- digital clock ------------------------------------------------------ */
  const timeEl = document.getElementById("time");
  const msEl = document.getElementById("milliseconds");
  const dateEl = document.getElementById("date");
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

  const timeFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const dateFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

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
    if (!synced) setStatus("同期中…", "live");
    getServerTime()
      .then((result) => {
        offset = result.offset;
        retryDelay = 1000;
        synced = true;
        setStatus("WebSocket で同期済み", "live");
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
          setStatus(`再接続まで ${s}秒`, "err");
        };
        tick();
        const iv = setInterval(tick, 250);
        setTimeout(() => { clearInterval(iv); synchronize(); }, wait);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
      });
  }
  synchronize();

  function fmtMs(v) {
    const sign = v >= 0 ? "+" : "−";
    return `${sign}${Math.abs(v).toFixed(1)}<small> ms</small>`;
  }

  /* ---- playground --------------------------------------------------------- */
  const pgTabs = document.querySelectorAll(".pg-tab");
  const pgEndpoint = document.getElementById("pg-endpoint");
  const pgDesc = document.getElementById("pg-desc");
  const pgOut = document.getElementById("pg-out");
  const pgRun = document.getElementById("pg-run");
  let mode = "json";

  const MODES = {
    json: {
      endpoint: `GET <b>${JSON_URL}</b>?&lt;timestamp&gt;`,
      desc: "JSON over HTTP。リクエスト送信時刻をクエリに付けると、サーバー時刻とあわせて往復遅延・オフセットを計算できます。",
    },
    ws: {
      endpoint: `WS <b>${WS_URL}</b>`,
      desc: `WebSocket（サブプロトコル <code class="inline">${WebNTP.SUBPROTOCOL}</code>）。接続を張ったままタイムスタンプを送受信します。低遅延で最も高精度です。`,
    },
    header: {
      endpoint: `HEAD <b>${TIME_URL}</b>`,
      desc: "Time over HTTPS。レスポンスの X-Httpstime ヘッダーにサーバー時刻が入ります。ボディを持たない軽量な方式です。",
    },
  };

  function selectMode(m) {
    mode = m;
    pgTabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === m));
    pgEndpoint.innerHTML = MODES[m].endpoint;
    pgDesc.innerHTML = MODES[m].desc;
    pgOut.textContent = "「実行」を押すと結果がここに表示されます。";
  }
  pgTabs.forEach((t) => t.addEventListener("click", () => selectMode(t.dataset.mode)));
  selectMode("json");

  async function runDemo() {
    pgRun.disabled = true;
    pgOut.textContent = "リクエスト中…";
    try {
      let result;
      if (mode === "json") {
        result = await WebNTP.getJSON(JSON_URL);
        pgOut.textContent =
          JSON.stringify(result.response, null, 2) +
          `\n\n// offset ${result.offset.toFixed(1)} ms / delay ${result.delay.toFixed(1)} ms`;
      } else if (mode === "ws") {
        const client = new WebNTP.Client();
        result = await client.get(WS_URL);
        pgOut.textContent =
          JSON.stringify(result.response, null, 2) +
          `\n\n// offset ${result.offset.toFixed(1)} ms / delay ${result.delay.toFixed(1)} ms`;
      } else {
        result = await WebNTP.getHeaderTime(TIME_URL);
        pgOut.textContent =
          `X-Httpstime: ${result.raw}\n\n// offset ${result.offset.toFixed(1)} ms / delay ${result.delay.toFixed(1)} ms`;
      }
    } catch (e) {
      pgOut.textContent = "エラー: " + (e && e.message ? e.message : e);
    } finally {
      pgRun.disabled = false;
    }
  }
  if (pgRun) pgRun.addEventListener("click", runDemo);

  /* ---- copy buttons ------------------------------------------------------- */
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pre = btn.closest(".code").querySelector("code");
      const text = pre ? pre.innerText : "";
      navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = "copied!";
        setTimeout(() => { btn.textContent = old; }, 1200);
      });
    });
  });
})();
