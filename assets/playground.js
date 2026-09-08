/* ---------------------------------------------------------------------------
   playground.js — the interactive live demo on the API reference page.
   Runs each of the three WebNTP protocols against the public server and
   shows the raw response plus the computed offset / delay. Also wires up
   the "copy" buttons on the code samples.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  const HOST = "webntp.shogo82148.com";
  const WS_URL = `wss://${HOST}/websocket`;
  const JSON_URL = `https://${HOST}/json`;
  const TIME_URL = `https://${HOST}/.well-known/time`;

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
    if (pgEndpoint) pgEndpoint.innerHTML = MODES[m].endpoint;
    if (pgDesc) pgDesc.innerHTML = MODES[m].desc;
    if (pgOut) pgOut.textContent = "「実行」を押すと結果がここに表示されます。";
  }

  if (pgTabs.length) {
    pgTabs.forEach((t) => t.addEventListener("click", () => selectMode(t.dataset.mode)));
    selectMode("json");
  }

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
      const code = btn.closest(".code").querySelector("code");
      navigator.clipboard.writeText(code ? code.innerText : "").then(() => {
        const old = btn.textContent;
        btn.textContent = "copied!";
        setTimeout(() => { btn.textContent = old; }, 1200);
      });
    });
  });
})();
