import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { once } from "node:events";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const root = process.cwd();
const configPath = join(root, "config.json");
const downloadsRoot = join(root, "downloads");
const downloadJobs = new Map();
const defaultConfig = {
  backendURL: "https://mpcfill.com",
  categories: [
    {
      name: "OldFrame & Scan",
      description: "Digitalizacoes e leiautes originais.",
      uploaders: [],
      activeUploaders: [],
    },
    {
      name: "Arte Livre",
      description: "Sem filtro de uploader.",
      uploaders: [],
      activeUploaders: [],
    },
  ],
};

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
};

function cleanBackend(value) {
  const url = new URL(value || "https://mpcfill.com");
  return `${url.protocol}//${url.host}`;
}

function cleanUploaders(uploaders) {
  return Array.from(
    new Set(
      (Array.isArray(uploaders) ? uploaders : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

function cleanCategories(config) {
  const rawCategories = Array.isArray(config.categories)
    ? config.categories
    : [
        {
          name: "OldFrame & Scan",
          uploaders: Array.isArray(config.uploaders) ? config.uploaders : [],
        },
        { name: "Arte Livre", uploaders: [] },
      ];

  const categories = rawCategories
    .map((category) => {
      const uploaders = cleanUploaders(category?.uploaders);
      const requestedActive = Array.isArray(category?.activeUploaders)
        ? cleanUploaders(category.activeUploaders)
        : uploaders;
      const activeUploaders = requestedActive.filter((uploader) =>
        uploaders.some(
          (configuredUploader) =>
            configuredUploader.toLowerCase() === uploader.toLowerCase()
        )
      );
      return {
        name: String(category?.name || "").trim(),
        description: String(category?.description || "").trim(),
        uploaders,
        activeUploaders,
      };
    })
    .filter((category) => category.name.length > 0);

  if (!categories.some((category) => category.name === "Arte Livre")) {
    categories.push({
      name: "Arte Livre",
      description: "Sem filtro de uploader.",
      uploaders: [],
      activeUploaders: [],
    });
  }

  return categories;
}

async function readConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      backendURL: parsed.backendURL || defaultConfig.backendURL,
      categories: cleanCategories(parsed),
    };
  } catch {
    await writeConfig(defaultConfig);
    return defaultConfig;
  }
}

async function writeConfig(config) {
  const cleanConfig = {
    backendURL: cleanBackend(config.backendURL || defaultConfig.backendURL),
    categories: cleanCategories(config),
  };
  await writeFile(configPath, `${JSON.stringify(cleanConfig, null, 2)}\n`, "utf8");
  return cleanConfig;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json;charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(payload));
}

function safeFilename(value) {
  return String(value || "card")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function timestampFolderName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function publicJob(job) {
  const now = Date.now();
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    percent: job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0,
    currentFile: job.currentFile,
    currentIndex: job.currentIndex,
    currentPercent: job.currentTotalBytes
      ? Math.round((job.currentBytes / job.currentTotalBytes) * 100)
      : null,
    currentBytes: job.currentBytes,
    currentTotalBytes: job.currentTotalBytes,
    elapsedMs: now - job.startedAt,
    currentElapsedMs: job.currentStartedAt ? now - job.currentStartedAt : 0,
    outputDirectory: job.outputDirectory,
    downloaded: job.downloaded,
    failed: job.failed,
    cancelRequested: job.cancelRequested,
    canCancel:
      job.status === "running" &&
      (now - job.startedAt > 5 * 60 * 1000 ||
        (job.currentStartedAt && now - job.currentStartedAt > 60 * 1000)),
    error: job.error,
  };
}

async function postBackendJSON(backendURL, path, payload) {
  const response = await fetch(new URL(path, backendURL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function writeResponseToFile(response, filePath, job) {
  const totalHeader = response.headers.get("content-length");
  job.currentTotalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : 0;
  job.currentBytes = 0;

  const writer = createWriteStream(filePath);
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    job.currentBytes = buffer.length;
    await writeFile(filePath, buffer);
    return buffer.length;
  }

  try {
    while (true) {
      if (job.cancelRequested) {
        throw new Error("Download cancelado.");
      }
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      job.currentBytes += chunk.length;
      if (!writer.write(chunk)) {
        await once(writer, "drain");
      }
    }
  } finally {
    writer.end();
    await once(writer, "finish").catch(() => undefined);
  }

  return job.currentBytes;
}

async function runDownloadJob(job, identifiers) {
  try {
    const config = await readConfig();
    const backendURL = cleanBackend(config.backendURL);
    const cardsResponse = await postBackendJSON(backendURL, "/2/cards/", {
      cardIdentifiers: identifiers,
    });
    const cardDocuments = cardsResponse.results || {};
    await mkdir(job.outputDirectory, { recursive: true });

    for (const [index, identifier] of identifiers.entries()) {
      if (job.cancelRequested) {
        job.status = "cancelled";
        break;
      }

      const doc = cardDocuments[identifier];
      job.currentIndex = index + 1;
      job.currentFile = doc?.name || identifier;
      job.currentStartedAt = Date.now();
      job.currentBytes = 0;
      job.currentTotalBytes = 0;

      if (!doc?.downloadLink) {
        job.failed.push({ identifier, error: "Imagem nao encontrada no MPCFill." });
        job.completed += 1;
        continue;
      }

      try {
        const extension = doc.extension || "png";
        const fileName = `${safeFilename(doc.name)} - ${identifier}.${extension}`;
        const filePath = join(job.outputDirectory, fileName);
        job.abortController = new AbortController();
        const imageResponse = await fetch(doc.downloadLink, {
          headers: { accept: "image/*,*/*" },
          redirect: "follow",
          signal: job.abortController.signal,
        });
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }
        const bytes = await writeResponseToFile(imageResponse, filePath, job);
        job.downloaded.push({
          identifier,
          name: doc.name,
          fileName,
          bytes,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (job.cancelRequested || message.includes("aborted")) {
          job.status = "cancelled";
          break;
        }
        job.failed.push({ identifier, error: message });
      } finally {
        job.abortController = null;
        job.completed += 1;
      }
    }

    if (job.status !== "cancelled") {
      job.status = job.failed.length ? "completed_with_errors" : "completed";
    }
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
  } finally {
    job.finishedAt = Date.now();
    job.currentStartedAt = null;
  }
}

async function proxy(request, response, requestURL) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,accept",
      "access-control-max-age": "86400",
    });
    response.end();
    return;
  }

  const config = await readConfig();
  const backend = cleanBackend(requestURL.searchParams.get("backend") || config.backendURL);
  const targetPath = requestURL.pathname.replace(/^\/api/, "");
  const target = new URL(targetPath, backend);

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await readBody(request);

  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      "content-type": request.headers["content-type"] || "application/json",
      accept: "application/json",
    },
    body,
  });

  const buffer = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "content-type":
      upstream.headers.get("content-type") || "application/json;charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(buffer);
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(root, safePath);
  const content = await readFile(filePath);
  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
  });
  response.end(content);
}

async function serveConfig(request, response) {
  if (request.method === "GET") {
    response.writeHead(200, {
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    });
    response.end(JSON.stringify(await readConfig()));
    return;
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const saved = await writeConfig(JSON.parse(body.toString("utf8") || "{}"));
    response.writeHead(200, {
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    });
    response.end(JSON.stringify(saved));
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,accept",
      "access-control-max-age": "86400",
    });
    response.end();
    return;
  }

  response.writeHead(405, { "content-type": "application/json;charset=utf-8" });
  response.end(JSON.stringify({ error: "Method not allowed" }));
}

async function serveDownloadImages(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,accept",
      "access-control-max-age": "86400",
    });
    response.end();
    return;
  }

  const requestURL = new URL(request.url || "/", `http://localhost:${port}`);

  if (request.method === "GET") {
    const job = downloadJobs.get(requestURL.searchParams.get("id"));
    if (!job) {
      jsonResponse(response, 404, { error: "Job nao encontrado." });
      return;
    }
    jsonResponse(response, 200, publicJob(job));
    return;
  }

  if (request.method === "POST" && requestURL.searchParams.get("action") === "cancel") {
    const job = downloadJobs.get(requestURL.searchParams.get("id"));
    if (!job) {
      jsonResponse(response, 404, { error: "Job nao encontrado." });
      return;
    }
    if (job.status === "running") {
      job.cancelRequested = true;
      job.abortController?.abort();
    }
    jsonResponse(response, 200, publicJob(job));
    return;
  }

  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = JSON.parse((await readBody(request)).toString("utf8") || "{}");
  const identifiers = Array.from(
    new Set(
      (Array.isArray(body.identifiers) ? body.identifiers : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  if (!identifiers.length) {
    jsonResponse(response, 400, { error: "Nenhuma imagem selecionada." });
    return;
  }

  const folderName = timestampFolderName();
  const outputDirectory = join(downloadsRoot, folderName);
  const job = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: "running",
    total: identifiers.length,
    completed: 0,
    currentFile: "",
    currentIndex: 0,
    currentBytes: 0,
    currentTotalBytes: 0,
    startedAt: Date.now(),
    currentStartedAt: null,
    finishedAt: null,
    outputDirectory,
    downloaded: [],
    failed: [],
    cancelRequested: false,
    abortController: null,
    error: null,
  };
  downloadJobs.set(job.id, job);
  runDownloadJob(job, identifiers);
  jsonResponse(response, 202, publicJob(job));
}

createServer(async (request, response) => {
  try {
    const requestURL = new URL(request.url || "/", `http://localhost:${port}`);
    if (requestURL.pathname === "/config") {
      await serveConfig(request, response);
      return;
    }
    if (requestURL.pathname === "/download-images") {
      await serveDownloadImages(request, response);
      return;
    }
    if (requestURL.pathname.startsWith("/api/")) {
      await proxy(request, response, requestURL);
      return;
    }
    await serveStatic(response, requestURL.pathname);
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json;charset=utf-8" });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}).listen(port, () => {
  console.log(`MPChelis XML Builder: http://localhost:${port}`);
});
