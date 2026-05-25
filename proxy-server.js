/**
 * proxy-server.js
 * ─────────────────────────────────────────────────────────────────
 * Local CORS proxy for the LIBERTY Dental / Entra Native Auth demo.
 *
 * WHY THIS EXISTS
 *   The Microsoft Entra Native Auth API does not send CORS headers,
 *   so browsers block direct fetch() calls.  This tiny Node server
 *   sits in between:
 *
 *     Browser  →  http://localhost:3001/proxy/<path>
 *                 ──────────────────────────────────────────────►
 *                 https://<tenant>.ciamlogin.com/<tenantId>/<path>
 *
 * HOW TO START
 *   node proxy-server.js
 *
 * CONFIGURE
 *   Edit the three constants below to match window.NA_CONFIG in
 *   index.html  (they must stay in sync).
 * ─────────────────────────────────────────────────────────────────
 */

"use strict";

const http  = require("http");
const https = require("https");
const url   = require("url");

// ── Match these to window.NA_CONFIG in index.html ────────────────
const TENANT_SUB = "birlasoftdentalentra";
const TENANT_ID  = "36090fda-8a83-4040-8c58-7cf784511505";

// The path prefix the browser will call  →  http://localhost:PORT/LOCAL_PREFIX/...
const LOCAL_PREFIX = "/proxy";
const PORT         = 3002;

// The upstream base URL the proxy forwards to
const UPSTREAM_BASE = `https://${TENANT_SUB}.ciamlogin.com/${TENANT_ID}`;
const UPSTREAM_HOST = `${TENANT_SUB}.ciamlogin.com`;
// ─────────────────────────────────────────────────────────────────

http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // ── Handle CORS pre-flight ────────────────────────────────────
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // ── Only proxy requests that start with LOCAL_PREFIX ─────────
  if (!parsed.pathname.startsWith(LOCAL_PREFIX)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found — only paths starting with " + LOCAL_PREFIX + " are proxied.");
    return;
  }

  // Strip the LOCAL_PREFIX to get the real API path
  const apiPath   = parsed.pathname.slice(LOCAL_PREFIX.length) || "/";
  const targetUrl = UPSTREAM_BASE + apiPath + (parsed.search || "");

  console.log(`[proxy]  ${req.method}  ${req.url}`);
  console.log(`         → ${targetUrl}`);

  // ── Forward the request upstream ─────────────────────────────
  const proxyReq = https.request(
    targetUrl,
    {
      method : req.method,
      headers: {
        ...req.headers,
        host  : UPSTREAM_HOST,   // replace browser's localhost host header
        origin: UPSTREAM_BASE,   // some tenants check Origin
      },
    },
    (proxyRes) => {
      // Re-attach CORS headers so the browser accepts the response
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        ...corsHeaders(),
      });
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (err) => {
    console.error("[proxy] upstream error:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain", ...corsHeaders() });
    res.end("Proxy error: " + err.message);
  });

  req.pipe(proxyReq);

}).listen(PORT, () => {
  console.log("─────────────────────────────────────────────────");
  console.log(`  CORS proxy running  →  http://localhost:${PORT}`);
  console.log(`  Forwarding: ${LOCAL_PREFIX}/*  →  ${UPSTREAM_BASE}/*`);
  console.log("─────────────────────────────────────────────────");
  console.log("  Open index.html in your browser, or serve it with:");
  console.log("    npx serve .   (or any static server on port 3000)");
  console.log("─────────────────────────────────────────────────");
});

// ── Helper ────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, client-info, x-client-current-telemetry, x-client-last-telemetry",
  };
}
