"use strict";

let proto = "ws";
if (location.protocol === "https:") {
  proto = "wss";
}

const ws = new WebSocket(
  `${proto}://${location.host}/api/v0/websocket?team=siena`,
);
ws.onclose = console.error;
ws.onerror = console.error;
ws.onmessage = console.log;

const formatPercentile = (sim, pct) => {
  if (pct) {
    return `${pct}/1000`;
  }
  if (sim > 20) {
    return "(tepid)";
  }
  return "(cold)";
};

const submitGuess = () => {
  const input = document.getElementById("guess");
  ws.send(JSON.stringify({ msg: "guess", guess: input.value }));
  input.value = "";
};

const showMessage = (text) => {
  document.getElementById("message").innerText = text;
};

let numGuesses = 0;

ws.onmessage = (msg) => {
  msg = JSON.parse(msg.data);
  switch (msg.msg) {
    case "guess":
      const guess = msg.guess;
      numGuesses += 1;
      const row = document.createElement("tr");
      for (const elt of [
        numGuesses,
        guess.guess,
        guess.similarity.toFixed(2),
        formatPercentile(guess.similarity, guess.percentile),
      ]) {
        const cell = document.createElement("td");
        cell.appendChild(document.createTextNode(elt));
        row.appendChild(cell);
      }
      document.querySelector("tbody").appendChild(row);
      showMessage("");
      break;
    case "badword":
      showMessage(`Unknown word: ${msg.guess}`);
      break;
    case "error":
      console.error(msg.error);
      alert(`unexpected error: ${msg.error}`);
      break;
    default:
      console.error("bad msg type");
      break;
  }
};
