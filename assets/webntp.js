/* ---------------------------------------------------------------------------
   webntp.js — a tiny WebNTP client for the browser.

   Ported from the reference implementation:
   https://github.com/shogo82148/go-webntp/tree/main/_example

   Exposes `window.WebNTP` with:
     - SUBPROTOCOL         the WebSocket subprotocol string
     - Client              WebSocket-based synchronisation client
     - getJSON(url, it?)   one-shot fetch of the JSON-over-HTTP endpoint
     - getHeaderTime(url)  read the Time over HTTPS (X-Httpstime) header
--------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  const SUBPROTOCOL = "webntp.shogo82148.com";

  /**
   * WebSocket-based WebNTP client.
   * `get(url)` resolves with { delay, offset, response } where
   *   delay  = round-trip delay [ms]
   *   offset = (server time) - (client time) [ms]
   */
  class Client {
    constructor() {
      this.connection = undefined;
    }

    get(url) {
      const conn = new WebSocket(url, [SUBPROTOCOL]);
      this.connection = conn;
      const done = () => {
        if (this.connection === conn) this.connection = undefined;
      };

      return new Promise((resolve, reject) => {
        conn.addEventListener("open", () => {
          const it = Date.now() / 1000; // seconds, matching the server format
          conn.send(it.toString());
        });
        conn.addEventListener("message", (ev) => {
          let response;
          try {
            response = JSON.parse(ev.data);
          } catch (e) {
            reject(new Error("invalid response"));
            conn.close();
            return;
          }
          const end = Date.now();
          const start = response.it * 1000; // ms
          const delay = end - start; // round-trip delay
          const offset = response.st * 1000 - end + delay / 2;
          resolve({ delay, offset, response });
          conn.close();
        });
        conn.addEventListener("error", () => {
          reject(new Error("connection error"));
        });
        conn.addEventListener("close", () => {
          reject(new Error("connection closed"));
        });
      }).finally(done);
    }

    cancel() {
      if (this.connection !== undefined) {
        this.connection.close();
        this.connection = undefined;
      }
    }
  }

  /**
   * Fetch the JSON-over-HTTP endpoint once and compute delay/offset.
   * `url` should point at the `/json` endpoint (without a query string).
   */
  async function getJSON(url) {
    const it = Date.now() / 1000;
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(url + sep + it.toString(), { cache: "no-store" });
    const end = Date.now();
    if (!res.ok) throw new Error("HTTP " + res.status);
    const response = await res.json();
    const start = response.it * 1000;
    const delay = end - start;
    const offset = response.st * 1000 - end + delay / 2;
    return { delay, offset, response };
  }

  /**
   * Read the Time over HTTPS header (X-Httpstime) via a HEAD request.
   * Resolves with { delay, offset, serverTime, raw }.
   */
  async function getHeaderTime(url) {
    const start = Date.now();
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const end = Date.now();
    if (!res.ok && res.status !== 204) throw new Error("HTTP " + res.status);
    const raw = res.headers.get("X-Httpstime");
    if (!raw) throw new Error("X-Httpstime header not exposed");
    const serverTime = parseFloat(raw) * 1000;
    const delay = end - start;
    const offset = serverTime - end + delay / 2;
    return { delay, offset, serverTime, raw };
  }

  global.WebNTP = { SUBPROTOCOL, Client, getJSON, getHeaderTime };
})(window);
