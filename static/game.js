// PREAMBLE

"use strict";

// LOOKUP HTML ELEMENTS

let elts = {
  guessTable: {
    headers: document.getElementById("guesses-table-header").children,
    body: document.getElementById("guesses-table-body"),
    fields: [],
    fieldIndexes: {},
  },
  guessInput: document.getElementById("guess-input"),
  messageArea: document.getElementById("message-area"),
};

for (let idx = 0; idx < elts.guessTable.headers.length; idx++) {
  const field = elts.guessTable.headers[idx].getAttribute("data-field");
  elts.guessTable.fields.push(field);
  elts.guessTable.fieldIndexes[field] = idx;
}

// SETUP THE WEBSOCKET

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

// UTILITY FUNCTIONS

const formatPercentile = (sim, pct) => {
  if (pct) {
    return `${pct}/1000`;
  }
  if (sim > 20) {
    return "(tepid)";
  }
  return "(cold)";
};

const reverseSortDirection = (direction) => {
  switch (direction) {
    case "ascending":
      return "descending";
    case "descending":
      return "ascending";
    default:
      throw new Error(`Unexpected direction ${direction}`);
  }
};

const getRowField = (row, field) => {
  const idx = elts.guessTable.fieldIndexes[field];
  return row.children[idx].getAttribute("data-sortkey");
};

// GLOBAL VARIABLES

let numGuesses = 0;
let setupDone = false;

let alreadyGuessed = new Set();

// USER INTERFACE MANIPULATION

const showMessage = (text) => {
  elts.messageArea.innerText = text;
};

const getCurrentSort = () => {
  for (let idx = 0; idx < elts.guessTable.fields.length; idx++) {
    const direction = elts.guessTable.headers[idx].getAttribute("data-sort");
    if (!direction) continue;
    const field = elts.guessTable.fields[idx];
    return { field, direction };
  }

  throw new Error("No current sort");
};

const resortTable = () => {
  const sort = getCurrentSort();
  const fieldIndex = elts.guessTable.fieldIndexes[sort.field];
  const rows = [...elts.guessTable.body.children];
  rows.sort((r1, r2) => {
    let n1 = getRowField(r1, "number");
    let n2 = getRowField(r2, "number");
    if (parseInt(n1) === numGuesses) return -1;
    if (parseInt(n2) === numGuesses) return +1;
    let k1 = r1.children[fieldIndex].getAttribute("data-sortkey");
    let k2 = r2.children[fieldIndex].getAttribute("data-sortkey");
    k1 = parseFloat(k1) || k1;
    k2 = parseFloat(k2) || k2;
    const directionFactor = sort.direction === "ascending" ? +1 : -1;
    if (k1 < k2) return -1 * directionFactor;
    if (k1 > k2) return +1 * directionFactor;
    return 0;
  });
  rows.forEach((row) => elts.guessTable.body.appendChild(row));
};

// HTML CALLBACKS

const changeGuessesTableSorting = function () {
  const newField = this.getAttribute("data-field");
  let newDirection = this.getAttribute("data-sort");
  if (newDirection) {
    newDirection = reverseSortDirection(newDirection);
  } else {
    newDirection = this.getAttribute("data-sort-default");
  }
  for (let idx = 0; idx < elts.guessTable.fields.length; idx++) {
    if (elts.guessTable.fields[idx] === newField) {
      elts.guessTable.headers[idx].setAttribute("data-sort", newDirection);
    } else {
      elts.guessTable.headers[idx].removeAttribute("data-sort");
    }
  }
  resortTable();
};

const submitGuess = () => {
  if (connectionLost) {
    return;
  }
  if (!elts.guessInput.value) {
    return;
  }
  if (alreadyGuessed.has(elts.guessInput.value)) {
    showMessage(`Already guessed: ${elts.guessInput.value}`);
    elts.guessInput.value = "";
    return;
  }
  ws.send(JSON.stringify({ msg: "guess", guess: elts.guessInput.value }));
  elts.guessInput.value = "";
};

// HANDLE SERVER MESSAGES

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
        { text: numGuesses },
        { text: guess.guess },
        { text: guess.similarity.toFixed(2), key: guess.similarity },
        { text: formatPercentile(guess.similarity, guess.percentile) },
      ]) {
        const cell = document.createElement("td");
        cell.appendChild(document.createTextNode(elt.text));
        cell.setAttribute("data-sortkey", elt.key || elt.text);
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
