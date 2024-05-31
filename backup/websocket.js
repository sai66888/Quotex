const WebSocket = require('ws');
const crypto = require('crypto');

const key = crypto.randomBytes(16).toString('base64');
const url = 'wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket';

// WebSocket client options
const options = {
  headers: {
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
    'Sec-WebSocket-Key': key,
    'Sec-WebSocket-Version': '13',
    'Origin': 'https://qxbroker.com',
    'Host': 'ws2.qxbroker.com'
  }
};

console.log(options);

// Create a WebSocket instance
const ws = new WebSocket(url, options);

// Event listener for connection success
ws.on('open', () => {
  console.log('Connected to WebSocket server');
});

// Event listener for receiving messages from the server
ws.on('message', (data) => {
  console.log('Received message:', data);
});

// Event listener for connection close
ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});

// Event listener for connection error
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
