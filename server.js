"use strict";

const express = require("express");

const app = express();
const port = Number.parseInt(process.env.PORT || "3002", 10);
const host = process.env.HOST || "127.0.0.1";
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

// The former standalone editor bypassed central membership checks. All business
// pages now enter the central authenticated administration.
app.use((_request, response) => {
  const target=process.env.LAGETRAINING_PUBLIC_URL;
  if(!target) return response.status(503).send("Adresse der Lagetraining-Zentrale fehlt.");
  let origin;
  try { origin=new URL(target); } catch { return response.status(503).end(); }
  if(origin.protocol!=="https:" || origin.username || origin.password || origin.pathname!=="/" || origin.search || origin.hash)
    return response.status(503).end();
  response.setHeader("Cache-Control","no-store");
  response.redirect(302,origin.origin+"/verwaltung.html");
});

if (require.main === module) app.listen(port, host, () => {
  console.log(`Lagetraining Admin läuft auf http://${host}:${port}/`);
});

module.exports=app;
