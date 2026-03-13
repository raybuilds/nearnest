const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function fail(message, exitCode = 1) {
  if (message) {
    console.error(message);
  }
  process.exit(exitCode);
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.log(
      "teamSetupConfig.json not found. Run export:setup on a configured machine first."
    );
    process.exit(1);
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Failed to read teamSetupConfig.json: ${error.message}`);
  }
}

function writeEnvFile(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `${entries.map(([key, value]) => `${key}=${value ?? ""}`).join("\n")}\n`;
  fs.writeFileSync(filePath, content, "utf8");
}

function commandName(base) {
  return process.platform === "win32" ? `${base}.cmd` : base;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    fail(`Failed to run ${command} ${args.join(" ")}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function captureCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return String(result.stdout || "").trim();
}

function warnIfVersionMismatch(label, actual, expected) {
  if (!expected) return;
  if (actual !== expected) {
    console.warn(`Warning: ${label} version mismatch. Expected ${expected}, found ${actual || "unknown"}.`);
  }
}

function main() {
  const rootDir = __dirname;
  const configPath = path.join(rootDir, "teamSetupConfig.json");
  const config = readConfig(configPath);

  const databaseUrl = config?.database?.connection || "";
  const jwtSecret = config?.backend?.JWT_SECRET || "";
  const port = config?.backend?.PORT || 5000;
  const apiUrl = config?.frontend?.NEXT_PUBLIC_API_URL || "";

  const backendEnvEntries = [
    ["DATABASE_URL", databaseUrl],
    ["JWT_SECRET", jwtSecret],
    ["PORT", port],
  ];
  const frontendEnvEntries = [["NEXT_PUBLIC_API_URL", apiUrl]];

  const backendEnvPath = path.join(rootDir, "backend", ".env");
  const rootEnvPath = path.join(rootDir, ".env");
  const frontendEnvPath = path.join(rootDir, "frontend", ".env.local");

  console.log("Step 2: Creating backend environment file...");
  writeEnvFile(backendEnvPath, backendEnvEntries);
  // Keep the existing backend/prisma commands working, which currently read from the repo root.
  writeEnvFile(rootEnvPath, backendEnvEntries);

  console.log("Step 3: Creating frontend environment file...");
  writeEnvFile(frontendEnvPath, frontendEnvEntries);

  console.log("Step 4: Validating Node environment...");
  const nodeVersion = captureCommand(process.execPath, ["-v"]);
  const npmVersion = captureCommand(commandName("npm"), ["-v"]);
  warnIfVersionMismatch("Node", nodeVersion, config.nodeVersion);
  warnIfVersionMismatch("npm", npmVersion, config.npmVersion);

  const commandEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    PORT: String(port),
    NEXT_PUBLIC_API_URL: apiUrl,
  };

  console.log("Step 5: Installing backend dependencies...");
  runCommand(commandName("npm"), ["install"], { cwd: rootDir, env: commandEnv });

  console.log("Step 6: Installing frontend dependencies...");
  runCommand(commandName("npm"), ["install"], {
    cwd: path.join(rootDir, "frontend"),
    env: commandEnv,
  });

  console.log("Step 7: Setting up Prisma...");
  runCommand(commandName("npx"), ["prisma", "generate"], { cwd: rootDir, env: commandEnv });
  runCommand(commandName("npx"), ["prisma", "migrate", "deploy"], {
    cwd: rootDir,
    env: commandEnv,
  });

  console.log("Step 8: Seeding demo database...");
  runCommand(commandName("npm"), ["run", "demo:reset"], { cwd: rootDir, env: commandEnv });

  console.log("\nBackend:");
  console.log("npm run dev");
  console.log("\nFrontend:");
  console.log("cd frontend");
  console.log("npm run dev");
  console.log("\nWindows one-click startup:");
  console.log("RUN_NEARNEST.bat");
}

main();
