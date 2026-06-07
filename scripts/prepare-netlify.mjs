import fs from "fs";

const api = (process.env.API_PROXY_URL || "").replace(/\/$/, "");
const lines = [];

if (api) {
  lines.push(`/api/*  ${api}/api/:splat  200`);
  console.log("Netlify proxy →", api);
} else {
  console.warn(
    "API_PROXY_URL не задан. Задайте в Netlify после деплоя API на Render, например:",
    "https://ax-files-kb-api.onrender.com"
  );
}

fs.writeFileSync("_redirects", lines.join("\n") + (lines.length ? "\n" : ""));

fs.writeFileSync(
  "assets/config.js",
  `// Generated at Netlify build\nwindow.__API_BASE__ = ${JSON.stringify(api)};\n`
);
console.log("assets/config.js →", api || "(same origin)");
