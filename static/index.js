"use strict";

const ws = new WebSocket(`http://127.0.0.1:3000/api/v0/websocket?team=siena`);
ws.onclose = console.error;
ws.onerror = console.error;
ws.onmessage = console.log;
