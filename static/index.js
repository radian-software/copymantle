"use strict";

let proto = "ws";
if (location.protocol === "https:") {
  proto = "wss";
}

let connectionLost = false;

const ws = new WebSocket(
  `${proto}://${location.host}/api/v0/websocket` + location.search,
);
ws.onclose = () => {
  connectionLost = true;
  showMessage("Connection lost, please reload page");
};
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

let haveFinishedSetup = false;

let alreadyGuessed = new Set();

const submitGuess = () => {
  if (connectionLost) {
    return;
  }
  const input = document.getElementById("guess");
  if (alreadyGuessed.has(input.value)) {
    showMessage(`Already guessed: ${input.value}`);
    return;
  }
  ws.send(JSON.stringify({ msg: "guess", guess: input.value }));
  input.value = "";
};

const showMessage = (text) => {
  document.getElementById("message").innerText = text;
};

let numGuesses = 0;
let setupDone = false;

const resortTable = () => {
  for (const className of ["sorttable_sorted", "sorttable_sorted_reverse"]) {
    document.querySelectorAll(`.${className}`).forEach((elt) => {
      elt.classList.remove(className);
    });
  }
  sorttable.innerSortFunction.apply(document.getElementById("similarity"), []);
  sorttable.innerSortFunction.apply(document.getElementById("similarity"), []);
};

ws.onmessage = (msg) => {
  msg = JSON.parse(msg.data);
  switch (msg.msg) {
    case "guess":
      const guess = msg.guess;
      if (alreadyGuessed.has(guess)) {
        break;
      }
      alreadyGuessed.add(guess.guess);
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
      if (setupDone) {
        resortTable();
      }
      break;
    case "badword":
      showMessage(`Unknown word: ${msg.guess}`);
      break;
    case "error":
      console.error(msg.error);
      alert(`unexpected error: ${msg.error}`);
      break;
    case "setup":
      resortTable();
      setupDone = true;
      break;
    default:
      console.error("bad msg type");
      break;
  }
};
