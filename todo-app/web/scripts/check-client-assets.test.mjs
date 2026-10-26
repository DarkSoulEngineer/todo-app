import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { checkClientAssets } from "./check-client-assets.mjs";

async function withServer(assetStatus, assetType, run) {
  const server = createServer((request, response) => {
    if (request.url.startsWith("/_next/")) {
      response.writeHead(assetStatus, { "content-type": assetType });
      response.end(assetStatus === 200 ? "/* client */" : "Internal Server Error");
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end('<html><script src="/_next/static/chunks/app.js" async></script></html>');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("accepts loadable client chunks and checks shared assets once", async () => {
  await withServer(200, "application/javascript", async (url) => {
    assert.equal(await checkClientAssets(url), 1);
  });
});

test("rejects a 200 shell whose hydration chunk returns 500", async () => {
  await withServer(500, "text/plain", async (url) => {
    await assert.rejects(checkClientAssets(url), /HTTP 500.*restart the server/);
  });
});

test("rejects HTML fallback responses masquerading as successful chunks", async () => {
  await withServer(200, "text/html", async (url) => {
    await assert.rejects(checkClientAssets(url), /Client hydration cannot finish/);
  });
});
