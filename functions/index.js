const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const ERP_BASE_URL = process.env.ERP_BASE_URL || "http://10.0.0.19:8000";
const ALLOWED_PREFIXES = ["/fichajes/"];

const setCors = (req, res) => {
  const origin = req.get("origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

exports.erpProxy = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
    memory: "256MiB"
  },
  async (req, res) => {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const incomingPath = req.path || "/";
    const path = incomingPath.startsWith("/api/erp/")
      ? incomingPath.slice("/api/erp".length)
      : incomingPath;
    const isAllowed = ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (!isAllowed) {
      res.status(403).json({ error: "Path not allowed by ERP proxy" });
      return;
    }

    try {
      const targetUrl = new URL(path, ERP_BASE_URL.endsWith("/") ? ERP_BASE_URL : `${ERP_BASE_URL}/`);
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(req.query || {})) {
        if (Array.isArray(value)) {
          value.forEach((entry) => searchParams.append(key, String(entry)));
        } else if (value != null) {
          searchParams.set(key, String(value));
        }
      }

      const queryString = searchParams.toString();
      if (queryString) {
        targetUrl.search = queryString;
      }

      const forwardHeaders = {
        Accept: req.get("accept") || "application/json"
      };

      const contentType = req.get("content-type");
      if (contentType) {
        forwardHeaders["Content-Type"] = contentType;
      }

      const init = {
        method: req.method,
        headers: forwardHeaders,
        redirect: "follow"
      };

      if (!["GET", "HEAD"].includes(req.method)) {
        init.body = req.rawBody;
      }

      const upstream = await fetch(targetUrl.toString(), init);
      const buffer = Buffer.from(await upstream.arrayBuffer());

      res.status(upstream.status);
      const upstreamType = upstream.headers.get("content-type");
      if (upstreamType) {
        res.set("Content-Type", upstreamType);
      }
      res.send(buffer);
    } catch (error) {
      logger.error("ERP proxy failed", { error: String(error) });
      res.status(502).json({ error: "ERP proxy request failed", details: String(error) });
    }
  }
);
