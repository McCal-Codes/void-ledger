const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const REQUEST_TIMEOUT_MS = 30000;

const pageChecks = [
  { path: "/", label: "Dashboard", text: "Dashboard" },
  { path: "/wishlist", label: "Wishlist", text: "Baro Wishlist" },
  { path: "/inventory", label: "Inventory", text: "Prime Part Inventory" },
  { path: "/relics", label: "Relics", text: "Relic Inventory" },
  { path: "/fissures", label: "Fissures", text: "Active Fissures" },
  { path: "/world-state", label: "World State", text: "Live World State" },
  { path: "/settings", label: "Settings", text: "Settings" },
];

const apiChecks = [
  {
    path: "/api/health",
    label: "Health",
    validate: (body) => Boolean(body?.overall && body?.checks),
    summarize: (body) => {
      const sourceStatuses = Object.values(body.checks)
        .map((check) => `${check.label}:${check.status}`)
        .join(", ");
      return `overall=${body.overall} ${sourceStatuses}`;
    },
  },
  {
    path: "/api/world-state",
    label: "World State API",
    validate: (body) => body?.ok === true && Array.isArray(body?.fissures),
    summarize: (body) => `fissures=${body.fissures.length}`,
  },
  {
    path: "/api/fissures",
    label: "Fissures API",
    validate: (body) => Array.isArray(body),
    summarize: (body) => `items=${body.length}`,
  },
  {
    path: "/api/baro",
    label: "Baro API",
    validate: (body) => typeof body?.character === "string" && Array.isArray(body?.inventory),
    summarize: (body) => `character=${body.character} inventory=${body.inventory.length}`,
  },
  {
    path: "/api/prime-parts?market=1",
    label: "Prime Parts API",
    validate: (body) => Array.isArray(body?.parts) && Boolean(body?.accountStatus),
    summarize: (body) => `parts=${body.parts.length} marketFetched=${body.marketStatus?.fetched ?? 0}`,
  },
  {
    path: "/api/overwolf/inventory?limit=0",
    label: "Account Snapshot API",
    validate: (body) => typeof body?.hasSnapshot === "boolean",
    summarize: (body) => `hasSnapshot=${body.hasSnapshot} simulated=${body.isSimulated}`,
  },
];

function readBaseUrl() {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--base-url");
  if (flagIndex >= 0 && args[flagIndex + 1]) return args[flagIndex + 1];
  return args[0] && !args[0].startsWith("--") ? args[0] : DEFAULT_BASE_URL;
}

function joinUrl(baseUrl, path) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json, text/html;q=0.9, */*;q=0.8" },
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJson(text) {
  if (!text.trim()) throw new Error("empty response body");
  return JSON.parse(text);
}

async function checkPage(baseUrl, check) {
  const url = joinUrl(baseUrl, check.path);
  const { response, text } = await fetchText(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!text.includes(check.text)) {
    throw new Error(`missing expected text "${check.text}"`);
  }

  return `${check.label}: ok`;
}

async function checkApi(baseUrl, check) {
  const url = joinUrl(baseUrl, check.path);
  const { response, text } = await fetchText(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  let body;
  try {
    body = parseJson(text);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "invalid JSON response");
  }

  if (!check.validate(body)) {
    throw new Error(`unexpected response shape: ${text.slice(0, 240)}`);
  }

  return `${check.label}: ${check.summarize(body)}`;
}

async function run() {
  const baseUrl = readBaseUrl();
  const failures = [];

  console.log(`Smoke base URL: ${baseUrl}`);

  for (const check of pageChecks) {
    try {
      console.log(`PAGE ${await checkPage(baseUrl, check)}`);
    } catch (error) {
      failures.push(`${check.label}: ${error instanceof Error ? error.message : error}`);
      console.error(`PAGE ${check.label}: failed`);
    }
  }

  for (const check of apiChecks) {
    try {
      console.log(`API ${await checkApi(baseUrl, check)}`);
    } catch (error) {
      failures.push(`${check.label}: ${error instanceof Error ? error.message : error}`);
      console.error(`API ${check.label}: failed`);
    }
  }

  if (failures.length > 0) {
    console.error("\nSmoke failures:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("Smoke checks passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
