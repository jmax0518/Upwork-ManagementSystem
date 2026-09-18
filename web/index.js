const fs = require("node:fs");
const path = require("node:path");
const ngrok = require("@ngrok/ngrok");

const envLocal = path.join(__dirname, ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function forwardToApp() {
  if (!process.env.NGROK_AUTHTOKEN) {
    console.error(
      "Missing NGROK_AUTHTOKEN. Set it in .env.local or: $env:NGROK_AUTHTOKEN=\"...\""
    );
    process.exit(1);
  }

  const port = process.env.NGROK_ADDR || "3847";
  const domain =
    process.env.NGROK_DOMAIN || "yanking-bullish-negligent.ngrok-free.dev";

  const forwarder = await ngrok.forward({
    addr: `localhost:${port}`,
    authtoken_from_env: true,
    domain,
  });

  const url = forwarder.url();
  console.log(`Available at: ${url}`);
  console.log(`Health:       ${url}/api/health`);
  console.log(`Extension → Server base URL: ${url.replace(/\/$/, "")}`);
  console.log(`Extension → API path: /api/jobs`);
  console.log("Keep this running. Use `npm run dev` in another terminal.");
  console.log("Press Ctrl+C to stop the tunnel.");

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  setInterval(() => {}, 60_000);
}

forwardToApp().catch((err) => {
  console.error(err);
  process.exit(1);
});
