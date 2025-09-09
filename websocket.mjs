import http from "node:http";

import { WebSocketServer } from "ws";

// Based on express-websocket and tinyws, to keep some of the
// modern interface of tinyws (async/await syntax) while avoiding
// the client connection timeout issue in tinyws.
// (See https://github.com/tinyhttp/tinyws/issues/12).
//
// Usage:
//
// Where `app` is either a Polka or Express instance
// and `httpsServer` is a `node:https` instance.
//
// Polka: httpsServer.on('upgrade', handleUpgrade(app.handler))
// Express: httpsServer.on('upgrade', handleUpgrade(app))
//
// Taken from https://codeberg.org/kitten/app/commit/60359d033ed5fd92f4cfaf9c290c3f6aa2dfc960
export const handleUpgrade = function (app, wss) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
  }

  /**
    Node http(s) upgrade event handler
    (https://nodejs.org/api/http.html#event-upgrade)

    @param {http.IncomingMessage} request
    @param {import('node:stream').Duplex} socket
    @param {Buffer} head
  */
  return function (request, socket, head) {
    var response = new http.ServerResponse(request);
    // @ts-ignore Issue with type definitions
    // (https://github.com/websockets/ws/issues/1926#issuecomment-893261171)
    response.assignSocket(socket);

    // Avoid hanging onto upgradeHead as this will keep the entire
    // slab buffer used by node alive.
    var copyOfHead = Buffer.alloc(head.length);
    head.copy(copyOfHead);

    response.on("finish", function () {
      if (response.socket !== null) {
        response.socket.destroy();
      }
    });

    /**
      Mix in WebSocket to request object.

      @typedef {{ ws: function }} WebSocketMixin
      @typedef { http.IncomingMessage & WebSocketMixin } IncomingMessageWithWebSocket
    */
    /** @type IncomingMessageWithWebSocket */ (request).ws = () =>
      new Promise((resolve) => {
        wss.handleUpgrade(request, request.socket, copyOfHead, (ws) => {
          wss.emit("connection", ws, request);
          resolve(ws);
        });
      });

    return app(request, response);
  };
};
