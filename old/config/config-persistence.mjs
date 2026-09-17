import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const defaultConfigDir = join(process.cwd(), "config");
const defaultConfigPath = join(defaultConfigDir, "config.json");
const defaultBackupDir = join(defaultConfigDir, "backup");

export class ConfigPersistenceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ConfigPersistenceError";
    this.cause = cause;
  }
}

export function saveConfig(config, options = {}) {
  const configPath = options.configPath ?? defaultConfigPath;
  const backupDir = options.backupDir ?? defaultBackupDir;

  mkdirSync(dirname(configPath), { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  if (existsSync(configPath)) {
    const backupPath = createUniqueBackupPath(backupDir);
    copyFileSync(configPath, backupPath);
  }

  writeJsonFile(configPath, config);

  return config;
}

export function loadConfig(defaultConfig = {}, options = {}) {
  const configPath = options.configPath ?? defaultConfigPath;
  const backupDir = options.backupDir ?? defaultBackupDir;

  if (!existsSync(configPath)) {
    return {
      config: structuredClone(defaultConfig),
      source: "default",
      recovered: false,
    };
  }

  try {
    return {
      config: readJsonFile(configPath),
      source: "config",
      recovered: false,
    };
  } catch (error) {
    return restoreLatestBackup(configPath, backupDir, error);
  }
}

function restoreLatestBackup(configPath, backupDir, originalError) {
  const latestBackupPath = getLatestBackupPath(backupDir);

  if (!latestBackupPath) {
    throw new ConfigPersistenceError(
      "config.json is corrupted and no backup is available.",
      originalError,
    );
  }

  try {
    const restoredConfig = readJsonFile(latestBackupPath);

    mkdirSync(dirname(configPath), { recursive: true });
    copyFileSync(latestBackupPath, configPath);

    return {
      config: restoredConfig,
      source: "backup",
      recovered: true,
      backupPath: latestBackupPath,
    };
  } catch (backupError) {
    throw new ConfigPersistenceError(
      `config.json is corrupted and latest backup cannot be loaded: ${basename(latestBackupPath)}`,
      backupError,
    );
  }
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  const json = `${JSON.stringify(value, null, 2)}\n`;

  writeFileSync(tempPath, json, "utf8");
  renameSync(tempPath, filePath);
}

function getLatestBackupPath(backupDir) {
  if (!existsSync(backupDir)) {
    return null;
  }

  const backups = readdirSync(backupDir)
    .filter(fileName => /^config_\d{8}_\d{6}\.json$/.test(fileName))
    .sort();

  if (backups.length === 0) {
    return null;
  }

  return join(backupDir, backups.at(-1));
}

function createUniqueBackupPath(backupDir) {
  let now = new Date();
  let backupPath = join(backupDir, createBackupFileName(now));

  while (existsSync(backupPath)) {
    now = new Date(now.getTime() + 1000);
    backupPath = join(backupDir, createBackupFileName(now));
  }

  return backupPath;
}

function createBackupFileName(now) {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `config_${year}${month}${day}_${hours}${minutes}${seconds}.json`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
