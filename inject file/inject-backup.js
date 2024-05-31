// console.log("Hello I am from extension javascript");
// let realWebSocket = window.WebSocket;

// var webSockets = [];

// // webSockets[1].send('42["orders/open",{"asset":"USDPKR_otc","amount":1,"time":60,"action":"put","isDemo":1,"tournamentId":0,"requestId":1713284609,"optionType":100}]')

// // webSockets[1].send('42["authorization",{"session":"uKDkStcD6dxG31tg5Fkm1adTqA9470kidFnnQOwF","isDemo":1,"tournamentId":0}]')

// var testedSockets = [];

// window.WebSocket = function (url, protocol = undefined) {
//   console.log("websocket paramiter", url, protocol);

//   let ws = new realWebSocket(url, protocol);
//   webSockets.push(ws);

//   // let testEstablish = new realWebSocket(url, protocol);
//   // testedSockets.push(testEstablish);

//   // testEstablish.onopen = () => {
//   //   console.log("Connected to WebSocket server");
//   //   // testEstablish.close();

//   //   // Send a message after connection is established
//   //   // sendMessage('42["authorization",{"session":"VLfPMz76kEEVC9UgM8d3fWeqfQtjahG5DWnULqno","isDemo":1,"tournamentId":0}]');
//   //   // sendMessage('42["orders/open",{"asset":"USDPKR_otc","amount":1,"time":60,"action":"put","isDemo":1,"tournamentId":0,"requestId":1713210068,"optionType":100}]');
//   // };

//   // // Event listener for receiving messages from the server
//   // let num = 0;
//   // testEstablish.onmessage = (event) => {
//   //   num++;
//   //   console.log("Received message:", event.data);

//   //   if (num == 2) {
//   //     sendMessage(
//   //       '42["authorization",{"session":"VLfPMz76kEEVC9UgM8d3fWeqfQtjahG5DWnULqno","isDemo":1,"tournamentId":0}]'
//   //     );
//   //   }
//   // };

//   // // Event listener for connection close
//   // testEstablish.onclose = () => {
//   //   console.log("Disconnected from WebSocket server");
//   // };

//   // // Event listener for connection error
//   // testEstablish.onerror = (error) => {
//   //   console.error("WebSocket error:", error);
//   //   // Close the WebSocket connection if error occurs
//   //   // ws.close();
//   // };

//   return ws;
// };
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
    console.log(`Sending message on WebSocket ${wsId}:`, data);
    originalSend.apply(ws, arguments);
  };

  // Remove WebSocket from tracked list when closed
  ws.addEventListener("close", () => {
    delete trackedWebSockets[wsId];
    window.handleTrackedWebSocketStateChange(wsId, false);
  });

  // Track connection state
  ws.addEventListener("open", () => {
    trackedWebSockets[wsId].isConnected = true;
    window.handleTrackedWebSocketStateChange(wsId, true);
  });

  return ws;
};

// Expose trackedWebSockets to the page for debugging
window.trackedWebSockets = trackedWebSockets;

// 42["orders/open",{"asset":"EURUSD_otc","amount":1,"time":60,"action":"put","isDemo":1,"tournamentId":0,"requestId":1713303856,"optionType":100}]

