var ws; // Define the WebSocket object globally

function connectWebSocket() {
  const url = "wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket";
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("Connected to WebSocket server");

    // Send a message after connection is established
    // sendMessage('42["authorization",{"session":"VLfPMz76kEEVC9UgM8d3fWeqfQtjahG5DWnULqno","isDemo":1,"tournamentId":0}]');
    // sendMessage('42["orders/open",{"asset":"USDPKR_otc","amount":1,"time":60,"action":"put","isDemo":1,"tournamentId":0,"requestId":1713210068,"optionType":100}]');
  };

  ws.onmessage = (event) => {
    console.log("Received message:", event.data);
  };

  ws.onclose = () => {
    console.log("Disconnected from WebSocket server");
  };

  // Event listener for connection error
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

// let $data = function () {
//   return fn.apply(obj, args.concat(slice.call(arguments)));
// };

// let $close = function () {
//   return fn.apply(obj, args.concat(slice.call(arguments)));
// };

// let $error = function () {
//   return fn.apply(obj, args.concat(slice.call(arguments)));
// };

// let $heartbeats = function (timeout) {
//   clearTimeout(this.pingTimeoutTimer);
//   var self = this;
//   self.pingTimeoutTimer = setTimeout(function () {
//     if ("closed" === self.readyState) return;
//     self.onClose("ping timeout");
//   }, timeout || self.pingInterval + self.pingTimeout);
// };

// let $ping = function () {
//   return fn.apply(obj, args.concat(slice.call(arguments)));
// };

// let $pong = function () {
//   return fn.apply(obj, args.concat(slice.call(arguments)));
// };

// function emit(event) {
//   this._callbacks = this._callbacks || {};

//   var args = new Array(arguments.length - 1),
//     callbacks = this._callbacks["$" + event];

//   for (var i = 1; i < arguments.length; i++) {
//     args[i - 1] = arguments[i];
//   }

//   if (callbacks) {
//     callbacks = callbacks.slice(0);
//     for (var i = 0, len = callbacks.length; i < len; ++i) {
//       callbacks[i].apply(this, args);
//     }
//   }
// }

// Function to send message over WebSocket
function sendMessage(message) {
  ws.send(message);
}

connectWebSocket();
