"use strict";

const path = require("path");
const express = require("express");

const app = express();
const port = Number.parseInt(process.env.PORT || "3002", 10);
const host = process.env.HOST || "0.0.0.0";
const publicDirectory = path.join(__dirname, "public");
const frameAncestors =
  process.env.FRAME_ANCESTORS ||
  "'self' https://experience.arcgis.com https://*.arcgis.com";

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((request, response, next) => {
  response.removeHeader("X-Frame-Options");
  response.setHeader(
    "Content-Security-Policy",
    `frame-ancestors ${frameAncestors}`
  );
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    application: "Lagetraining Admin"
  });
});

app.use(express.static(publicDirectory, {
  index: "index.html",
  extensions: ["html"]
}));

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.listen(port, host, () => {
  console.log(`Lagetraining Admin läuft auf http://${host}:${port}/`);
});
