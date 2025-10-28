import fs from "fs";
import path from "path";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return String(obj);
  }
}

function createFileIfNotExists(fileName: string) {
  const fullPath = path.resolve(fileName);
  if (!fs.existsSync(fullPath)) {
    console.info(`Creating file: ${fullPath}`);
    fs.writeFileSync(fullPath, "[]");
  }
}

function appendToFile(data: string, fileName: string) {
  const fullPath = path.resolve(fileName);
  createFileIfNotExists(fileName);
  const content = safeParseJson(fs.readFileSync(fullPath, "utf8"), []);
  const updatedContent = Array.isArray(content) ? [...content, data] : [data];
  fs.writeFileSync(fullPath, safeStringify(updatedContent));
}

function safeParseJson<T>(value: any, defaultValue: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return Array.isArray(value) ? (value as T) : defaultValue;
}

function extractJsonFromString(inputString: string): any | null {
  let start = inputString.indexOf("{");
  if (start === -1) return null;

  let braceCount = 0;
  for (let i = start; i < inputString.length; i++) {
    if (inputString[i] === "{") braceCount++;
    else if (inputString[i] === "}") braceCount--;

    if (braceCount === 0 && start !== -1) {
      const jsonString = inputString.slice(start, i + 1);
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
      }
    }
  }

  return null;
}

function saveToFile(data: string, filePath: string) {
  console.info(`Saving to file: ${filePath}`);
  return Bun.write(filePath, data);
}

async function getFile(filePath: string): Promise<string | null> {
  try {
    return Bun.file(filePath).text();
  } catch (error) {
    console.error("Error getting file:", error);
    return null;
  }
}

function generateNonce(length: number = 10): number {
  return Math.floor(Math.random() * 10 ** length);
}

export {
  getFile,
  sleep,
  generateNonce,
  safeStringify,
  saveToFile,
  extractJsonFromString,
  safeParseJson,
  appendToFile,
  createFileIfNotExists,
};
