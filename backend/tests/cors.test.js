// Which browser origins may call this API.
//
// In the deployed setup this barely matters: the Render static site rewrites
// /api to this service, so the browser is on ONE origin and CORS never fires.
// It matters for everything else -- a frontend run locally against the deployed
// API, a Render pull-request preview, or anyone else's site trying its luck.
//
// app.js reads these settings once at import, so they are set before the require.
process.env.CORS_ORIGINS = "https://mbzuai-reconciliation-web.onrender.com";
process.env.CORS_ALLOW_RENDER_PREVIEWS = "true";
process.env.JWT_SECRET = "test-only-secret-not-used-anywhere-real";

const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../src/app");

let server;
let baseUrl;

const originHeaderFor = async (origin) => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
  return response.headers.get("access-control-allow-origin");
};

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server?.close());

test("the configured frontend origin is allowed", async () => {
  assert.equal(
    await originHeaderFor("https://mbzuai-reconciliation-web.onrender.com"),
    "https://mbzuai-reconciliation-web.onrender.com"
  );
});

test("a Render preview deploy is allowed when previews are opted in", async () => {
  // Every pull request gets its own hostname, so previews cannot be listed by
  // hand -- they are matched by pattern instead.
  assert.equal(
    await originHeaderFor("https://mbzuai-reconciliation-web-pr-42.onrender.com"),
    "https://mbzuai-reconciliation-web-pr-42.onrender.com"
  );
});

test("an unrelated origin is refused", async () => {
  // Refused by WITHHOLDING the header, not by throwing: an error here would
  // become a 500 HTML page, reporting a policy decision as a server fault.
  assert.equal(await originHeaderFor("https://not-our-frontend.example.com"), null);
});

test("a lookalike hostname is refused", async () => {
  // The pattern must anchor at both ends. Without the trailing $, a domain like
  // onrender.com.attacker.example would match.
  assert.equal(await originHeaderFor("https://evil.onrender.com.attacker.example"), null);
  assert.equal(await originHeaderFor("https://onrender.com.attacker.example"), null);
});

test("a request with no Origin header is allowed through", async () => {
  // curl, health checks and server-to-server calls send no Origin. They are not
  // browser requests, so CORS has no say over them -- and Render's own health
  // check is one of these.
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});
