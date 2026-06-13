import * as path from "path";
import * as process from "process";
import * as url from "url";

import express from "express";

import { handleUpgrade } from "./websocket.mjs";

const thisDir = path.dirname(url.fileURLToPath(import.meta.url));

const app = express();

app.get("/", (req, res) => {
  if (req.query.team) {
    res.sendFile(`${thisDir}/static/game.html`);
  } else {
    res.sendFile(`${thisDir}/static/start.html`);
  }
});

app.get("/game.js", (_req, res) => {
  res.sendFile(`${thisDir}/static/game.js`);
});

app.get("/style.css", (_req, res) => {
  res.sendFile(`${thisDir}/static/style.css`);
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

let secretWords = null;

const getSecretWord = async () => {
  if (!secretWords) {
    const resp = await fetch(
      "https://legacy.semantle.com/assets/js/secretWords.js",
    );
    if (!resp.ok) {
      throw new Error(`Bad secretWords.js status ${resp.status}`);
    }
    const js = await resp.text();
    secretWords = JSON.parse(
      js.replace(/^secretWords = /, "").replace(/,\n\]/, "]"),
    );
  }
  const today = Math.floor(Date.now() / (86400 * 1000));
  const puzzleNumber = today - 19021;
  return secretWords[puzzleNumber % secretWords.length];
};

// prettier-ignore
// https://github.com/AnshSinghSonkhia/random-emoji-picker/blob/23eac2244861b3fe1478317313272495ef7711d1/src/emojiDatabase.js
const availableEmojis = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵",
  "🦁", "🐯", "🐷", "🐮", "🐨", "🦄", "🐺", "🐢", "🐊", "🐙",
  "🦉", "🦦", "🦘", "🐞", "🦋", "🐍", "🐠", "🐬", "🦜", "🦥",

  "🍕", "🍔", "🍎", "🍉", "🍩", "🌮", "🥗", "🍣", "🍪", "🥞",
  "🍜", "🥑", "🍞", "🥕", "🧁", "🍗", "🥩", "🌭", "🧀", "🍇",
  "🍓", "🥒", "🌰", "🥥", "🍫", "🍹", "🍷",

  "🌲", "🌿", "🌸", "🌊", "🔥", "🏔️", "🌎", "☀️", "🌧️", "🌈",
  "🍂", "🍃", "🌱", "🌻", "🌵", "🌳", "🌼", "🪵", "🌪️", "🌀",
  "🌙", "☄️", "⛰️", "🏜️", "🌍", "🌑", "🪲", "🦠", "🍄",

  "🚗", "✈️", "🚆", "🛳️", "🚀", "🏝️", "🏕️", "🗽", "🗼", "🎡",
  "🚜", "🚂", "🛫", "🚘", "🚌", "🚠", "🛤️", "🚍", "🚉", "🛩️",
  "⛴️", "🚛", "🚙", "🏎️", "🛑", "🚖", "🚎", "🚲", "🛣️", "🛶",

  "💾", "💿", "📀", "📡", "🖥️", "🖨️", "🖱️", "💻", "🔋", "📶",
  "🔌", "🔧", "🔨", "⚙️", "🛠️", "📱", "📷", "🎥", "📺", "🎞️",
  "💡", "🔭", "🎛️", "⏳", "🧬", "🛰️", "🕹️", "🖇️",
];

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
    const answer = await getSecretWord();
    const game = games[req.query.team] || {
      conns: [],
      answer: answer,
      answerVector: (await getSemantleAPI(answer, answer)).vec,
      guesses: [],
      alreadyGuessed: new Set(),
      players: {},
      usedEmojis: new Set(),
    };
    games[req.query.team] = game;
    for (const guessMsg of game.guesses) {
      ws.send(JSON.stringify(guessMsg));
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
            const player = msg.player;
            if (player && !game.players[player]) {
              while (true) {
                const emoji =
                  availableEmojis[
                    Math.floor(Math.random() * availableEmojis.length)
                  ];
                // Stop trying to avoid reusing emojis once we get to to 75% utilization
                // and it will become computationally annoying to do so efficiently.
                if (
                  !game.usedEmojis.has(emoji) ||
                  game.usedEmojis.size >= availableEmojis.length * 0.75
                ) {
                  game.players[player] = emoji;
                  game.usedEmojis.add(emoji);
                  break;
                }
              }
            }
            const guess = msg.guess.toLowerCase();
            if (game.alreadyGuessed.has(guess)) {
              break;
            }
            const guessResult = await checkSimilarity(
              game.answer,
              game.answerVector,
              guess,
            );
            if (!guessResult) {
              ws.send(JSON.stringify({ msg: "badword", guess: msg.guess }));
              break;
            }
            game.alreadyGuessed.add(guessResult.guess);
            const guessMsg = {
              msg: "guess",
              guess: guessResult,
              player: player,
              playerEmoji: game.players[player] || "❓️",
            };
            game.guesses.push(guessMsg);
            for (const conn of game.conns) {
              const toSend = JSON.stringify(guessMsg);
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

const port = parseInt(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const server = app.listen(port, host);
server.on("upgrade", handleUpgrade(app));
console.log(`listening on http://${host}:${port}`);
