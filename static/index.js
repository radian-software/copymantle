"use strict";

const ws = new WebSocket(`http://127.0.0.1:3000/api/v0/websocket?team=siena`);
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
  const guess = document.getElementById("guess").value;
  ws.send(JSON.stringify({ msg: "guess", guess: guess }));
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
