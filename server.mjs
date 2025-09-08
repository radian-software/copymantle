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

app.get("/sorttable.js", (_req, res) => {
  res.sendFile(`${thisDir}/static/sorttable.js`);
});

const vectorSum = (vec) => {
  let sum = 0;
  for (const x of vec) {
    sum += x;
  }
  return sum;
};

const vectorMagnitude = (vec) => {
  return Math.sqrt(vectorSum(vec.map((x) => x * x)));
};

const dotProduct = (vec1, vec2) => {
  let sum = 0;
  for (let idx = 0; idx < Math.min(vec1.length, vec2.length); idx++) {
    sum += vec1[idx] * vec2[idx];
  }
  return sum;
};

const cosineSimilarity = (vec1, vec2) => {
  return (
    dotProduct(vec1, vec2) / (vectorMagnitude(vec1) * vectorMagnitude(vec2))
  );
};

const getSemantleAPI = async (answerWord, guessWord) => {
  const resp = await fetch(
    `https://legacy.semantle.com/model2/${answerWord}/${guessWord}`,
  );
  if (!resp.ok) {
    throw new Error(`Bad status ${resp.status}`);
  }
  const respText = await resp.text();
  if (respText.length === 0) {
    return null;
  }
  return JSON.parse(respText);
};

const checkSimilarity = async (answerWord, answerVector, guessWord) => {
  const data = await getSemantleAPI(answerWord, guessWord);
  return (
    data && {
      guess: guessWord,
      similarity: cosineSimilarity(data.vec, answerVector) * 100,
      percentile: data.percentile,
    }
  );
};

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
    const answer = "revelation";
    const game = games[req.query.team] || {
      conns: [],
      answer: answer,
      answerVector: (await getSemantleAPI(answer, answer)).vec,
      guesses: [],
    };
    games[req.query.team] = game;
    for (const guess of game.guesses) {
      ws.send(JSON.stringify({ msg: "guess", guess: guess }));
    }
    ws.send(JSON.stringify({ msg: "setup" }));
    ws.on("close", () => {
      game.conns = game.conns.filter((conn) => conn !== ws);
    });
    ws.on("message", async (msg) => {
      try {
        if (msg.length > 4096) {
          return;
        }
        msg = JSON.parse(msg);
        switch (msg.msg) {
          case "guess":
            const guessResult = await checkSimilarity(
              game.answer,
              game.answerVector,
              msg.guess.toLowerCase(),
            );
            if (!guessResult) {
              ws.send(JSON.stringify({ msg: "badword", guess: msg.guess }));
              break;
            }
            game.guesses.push(guessResult);
            const toSend = JSON.stringify({ msg: "guess", guess: guessResult });
            for (const conn of game.conns) {
              conn.send(toSend);
            }
            break;
          default:
            ws.send(JSON.stringify({ msg: "error", error: "bad msg type" }));
            break;
        }
      } catch (err) {
        ws.send(JSON.stringify({ msg: "error", error: "internal error" }));
        console.error(err);
      }
    });
    game.conns.push(ws);
  } catch (err) {
    console.error(err);
  }
});

app.listen(parseInt(process.env.PORT) || 3000, process.env.HOST || "0.0.0.0");
