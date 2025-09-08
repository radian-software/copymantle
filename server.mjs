import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import * as url from "url";

import express from "express";
import { tinyws } from "tinyws";

const thisDir = path.dirname(url.fileURLToPath(import.meta.url));

const app = express();
app.use(tinyws());

app.get("/", (_req, res) => {
  res.sendFile(`${thisDir}/static/index.html`);
});

app.get("/index.js", (_req, res) => {
  res.sendFile(`${thisDir}/static/index.js`);
});

app.get("/api/v0/similarity", async (req, res) => {
  const answerWord = req.query.word1;
  const guessWord = req.query.word2;
  if (
    !answerWord ||
    !guessWord ||
    Array.isArray(answerWord) ||
    Array.isArray(guessWord)
  ) {
    res.sendStatus(400);
    return;
  }
  const resp = await fetch(
    `https://legacy.semantle.com/model2/${answerWord}/${guessWord}`,
  );
  if (!resp.ok) {
    res.sendStatus(502);
    return;
  }
  const data = await resp.json();
  res.send(JSON.stringify(data));
  res.sendStatus(200);
});

const games = {};

app.use("/api/v0/websocket", async (req, res) => {
  try {
    if (!req.ws) {
      res.sendStatus(400);
      return;
    }
    const ws = await req.ws();
    const teamID = req.query.team;
    if (!teamID) {
      ws.send("bad request");
      ws.close();
      return;
    }
    const game = games[req.query.team] || {
      conns: [],
    };
    games[req.query.team] = game;
    ws.on("close", () => {
      game.conns = game.conns.filter((conn) => conn !== ws);
    });
    ws.on("message", (msg) => {
      // Put an upper limit on messages, for sanity.
      if (msg.length > 4096) {
        return;
      }
      // Broadcast received message to all other connected clients.
      for (const conn of game.conns) {
        // Don't echo message back to the client that sent it.
        if (conn === ws) {
          continue;
        }
        conn.send(msg);
      }
    });
    game.conns.push(ws);
  } catch (err) {
    console.error(err);
  }
});

app.listen(parseInt(process.env.PORT) || 3000, process.env.HOST || "0.0.0.0");
