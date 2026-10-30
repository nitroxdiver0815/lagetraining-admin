"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{once}=require("node:events");
const app=require("../server");
test("legacy editor and its configuration cannot bypass the central authenticated administration",async()=>{
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");const base="http://127.0.0.1:"+server.address().port;
  try{
    delete process.env.LAGETRAINING_PUBLIC_URL;
    assert.equal((await fetch(base+"/config.js",{redirect:"manual"})).status,503);
    process.env.LAGETRAINING_PUBLIC_URL="https://training.example.org";
    for(const route of ["/","/config.js","/scenario-fahrzeuge.html"]){const r=await fetch(base+route,{redirect:"manual"});assert.equal(r.status,302);assert.equal(r.headers.get("location"),"https://training.example.org/verwaltung.html");}
    process.env.LAGETRAINING_PUBLIC_URL="https://user:password@example.org";
    assert.equal((await fetch(base+"/",{redirect:"manual"})).status,503);
    assert.equal((await fetch(base+"/health")).status,200);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
