import { pathToFileURL } from "node:url";

/** A 200 HTML shell alone does not prove that React can hydrate. */
export async function checkClientAssets(baseUrl) {
  const assets = new Set();
  for (const route of ["/", "/tasks"]) {
    const url = new URL(route, baseUrl);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)];
    if (scripts.length === 0) throw new Error(`${url}: no client scripts found`);
    for (const [, src] of scripts) assets.add(new URL(src.replaceAll("&amp;", "&"), url).href);
  }

  for (const url of assets) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const type = response.headers.get("content-type") ?? "";
    await response.arrayBuffer();
    if (!response.ok || !/(?:java|ecma)script/i.test(type)) {
      throw new Error(
        `${url}: HTTP ${response.status}, ${type || "missing content type"}. ` +
        "Client hydration cannot finish. If .next was rebuilt while next start was running, restart the server.",
      );
    }
  }
  return assets.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseUrl = process.argv[2] ?? "http://localhost:3000";
  try {
    const count = await checkClientAssets(baseUrl);
    console.log(`Passed: ${count} client scripts load for / and /tasks at ${baseUrl}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
