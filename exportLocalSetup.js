const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function pickValue(key, ...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return null;
}

function safeExec(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (_) {
    return null;
  }
}

function resolveVersion(commands) {
  for (const command of commands) {
    const value = safeExec(command);
    if (value) return value;
  }
  return null;
}

function npmVersionFromUserAgent() {
  const ua = String(process.env.npm_config_user_agent || "");
  const match = ua.match(/npm\/([0-9]+(?:\.[0-9]+){0,2})/i);
  if (!match) return null;
  return match[1];
}

function toNumberIfPossible(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function main() {
  const rootDir = process.cwd();
  const backendEnvPath = path.join(rootDir, "backend", ".env");
  const rootEnvPath = path.join(rootDir, ".env");
  const frontendEnvPath = path.join(rootDir, "frontend", ".env.local");

  const backendEnv = {
    ...readEnvFile(backendEnvPath),
    ...readEnvFile(rootEnvPath),
  };
  const frontendEnv = readEnvFile(frontendEnvPath);

  const jwtSecret = pickValue("JWT_SECRET", backendEnv, process.env);
  const databaseUrl = pickValue("DATABASE_URL", backendEnv, process.env);
  const port = pickValue("PORT", backendEnv, process.env);
  const nextPublicApiUrl = pickValue("NEXT_PUBLIC_API_URL", frontendEnv, process.env);

  const output = {
    nodeVersion: process.version,
    npmVersion:
      resolveVersion(["npm -v", "npm --version", "npm.cmd -v", "npm.cmd --version"]) ||
      npmVersionFromUserAgent(),
    postgresVersion: resolveVersion(["psql --version", "psql.exe --version"]),
    database: {
      type: "postgresql",
      connection: databaseUrl,
    },
    backend: {
      JWT_SECRET: jwtSecret,
      PORT: toNumberIfPossible(port),
    },
    frontend: {
      NEXT_PUBLIC_API_URL: nextPublicApiUrl,
    },
  };

  const outputPath = path.join(rootDir, "teamSetupConfig.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log("teamSetupConfig.json generated.");
}

main();
