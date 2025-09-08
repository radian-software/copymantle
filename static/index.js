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

let numGuesses = 0;

ws.onmessage = (msg) => {
  msg = JSON.parse(msg.data);
  numGuesses += 1;
  const row = document.createElement("tr");
  for (const elt of [
    numGuesses,
    msg.guess,
    msg.similarity.toFixed(2),
    formatPercentile(msg.similarity, msg.percentile),
  ]) {
    const cell = document.createElement("td");
    cell.appendChild(document.createTextNode(elt));
    row.appendChild(cell);
  }
  document.querySelector("tbody").appendChild(row);
};
