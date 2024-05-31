const trackedWebSockets = {};

// Intercept WebSocket creation
const originalWebSocket = window.WebSocket;
window.WebSocket = function (url, protocols) {
  const ws = new originalWebSocket(url, protocols);
  const wsId = Math.random().toString(36).substring(2);
  trackedWebSockets[wsId] = { ws, isConnected: false };

  // Intercept messages sent by the page
  const originalSend = ws.send;
  ws.send = function (data) {
    // window.notify({ msg: "sendingData", data });
    // window?.runcode({ msg: "sendingData", data });
    originalSend.apply(ws, arguments);
  };

  // Remove WebSocket from tracked list when closed
  ws.addEventListener("close", () => {
    delete trackedWebSockets[wsId];
    window.notify({ wsId, connected: false });
    // window?.runcode({ wsId, connected: false });
  });

  // Track connection state
  ws.addEventListener("open", () => {
    window.notify({ wsId, connected: true, state: "open" });
    // window?.runcode({ wsId, state: "open" });
  });

  ws.addEventListener("message", (msg) => {
    // window?.runcode({ wsId, state: "message", msg: msg.data });
  });

  return ws;
};

// Expose trackedWebSockets to the page for debugging
window.trackedWebSockets = trackedWebSockets;

// 42["orders/open",{"asset":"EURUSD_otc","amount":1,"time":60,"action":"put","isDemo":1,"tournamentId":0,"requestId":1713303856,"optionType":100}]
