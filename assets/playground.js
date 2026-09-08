/* ---------------------------------------------------------------------------
   playground.js — the interactive live demo on the API reference page.
   Runs each of the three WebNTP protocols against the public server and
   shows the raw response plus the computed offset / delay. Also wires up
   the "copy" buttons on the code samples. Localised via <html lang>.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  const HOST = "webntp.shogo82148.com";
  const WS_URL = `wss://${HOST}/websocket`;
  const JSON_URL = `https://${HOST}/json`;
  const TIME_URL = `https://${HOST}/.well-known/time`;

  const LANG = (document.documentElement.lang || "ja").startsWith("en") ? "en" : "ja";

  const STR = {
    ja: {
      hint: "「実行」を押すと結果がここに表示されます。",
      loading: "リクエスト中…",
      error: "エラー: ",
      modes: {
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
      },
    },
    en: {
      hint: "Press “Run” and the result appears here.",
      loading: "Requesting…",
      error: "Error: ",
      modes: {
        json: {
          endpoint: `GET <b>${JSON_URL}</b>?&lt;timestamp&gt;`,
          desc: "JSON over HTTP. Pass your request timestamp as the query string and the server echoes it back, so you can compute the round-trip delay and offset.",
        },
        ws: {
          endpoint: `WS <b>${WS_URL}</b>`,
          desc: `WebSocket (subprotocol <code class="inline">${WebNTP.SUBPROTOCOL}</code>). Exchanges timestamps over a kept-alive connection — the lowest latency and highest accuracy.`,
        },
        header: {
          endpoint: `HEAD <b>${TIME_URL}</b>`,
          desc: "Time over HTTPS. The server time is returned in the X-Httpstime response header. The lightest-weight method, with no response body.",
        },
      },
    },
  }[LANG];

  const pgTabs = document.querySelectorAll(".pg-tab");
  const pgEndpoint = document.getElementById("pg-endpoint");
  const pgDesc = document.getElementById("pg-desc");
  const pgOut = document.getElementById("pg-out");
  const pgRun = document.getElementById("pg-run");
  let mode = "json";

  function selectMode(m) {
    mode = m;
    pgTabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === m));
    if (pgEndpoint) pgEndpoint.innerHTML = STR.modes[m].endpoint;
    if (pgDesc) pgDesc.innerHTML = STR.modes[m].desc;
    if (pgOut) pgOut.textContent = STR.hint;
  }

  if (pgTabs.length) {
    pgTabs.forEach((t) => t.addEventListener("click", () => selectMode(t.dataset.mode)));
    selectMode("json");
  }

  function withStats(result) {
    return `\n\n// offset ${result.offset.toFixed(1)} ms / delay ${result.delay.toFixed(1)} ms`;
  }

  async function runDemo() {
    pgRun.disabled = true;
    pgOut.textContent = STR.loading;
    try {
      let result;
      if (mode === "json") {
        result = await WebNTP.getJSON(JSON_URL);
        pgOut.textContent = JSON.stringify(result.response, null, 2) + withStats(result);
      } else if (mode === "ws") {
        const client = new WebNTP.Client();
        result = await client.get(WS_URL);
        pgOut.textContent = JSON.stringify(result.response, null, 2) + withStats(result);
      } else {
        result = await WebNTP.getHeaderTime(TIME_URL);
        pgOut.textContent = `X-Httpstime: ${result.raw}` + withStats(result);
      }
    } catch (e) {
      pgOut.textContent = STR.error + (e && e.message ? e.message : e);
    } finally {
      pgRun.disabled = false;
    }
  }
  if (pgRun) pgRun.addEventListener("click", runDemo);

  /* ---- copy buttons ------------------------------------------------------- */
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.closest(".code").querySelector("code");
      navigator.clipboard.writeText(code ? code.innerText : "").then(() => {
        const old = btn.textContent;
        btn.textContent = "copied!";
        setTimeout(() => { btn.textContent = old; }, 1200);
      });
    });
  });
})();
