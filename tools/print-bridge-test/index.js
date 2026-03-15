const { io } = require('socket.io-client');

const WS_URL = process.env.WS_URL || 'http://127.0.0.1:3301';
const BRIDGE_ID = process.env.BRIDGE_ID || 'bridge-test-staging-001';

console.log('[print-bridge-test] Starting...');
console.log('[print-bridge-test] WS_URL:', WS_URL);
console.log('[print-bridge-test] BRIDGE_ID:', BRIDGE_ID);

const socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('[socket] connected:', socket.id);
  socket.emit('print:hello', { bridgeId: BRIDGE_ID });
});

socket.on('connect_error', (error) => {
  console.error('[socket] connect_error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('[socket] disconnected:', reason);
});

socket.on('print:connected', (data) => {
  console.log('[event] print:connected', data);
});

socket.on('print:hello:ack', (payload) => {
  console.log('[event] print:hello:ack', payload);
});

socket.on('print:heartbeat:ack', (payload) => {
  console.log('[event] print:heartbeat:ack', payload);
});

socket.on('print:list-bridges:ack', (payload) => {
  console.log(
    '[event] print:list-bridges:ack',
    JSON.stringify(payload, null, 2),
  );
});

setInterval(() => {
  if (!socket.connected) {
    console.log('[heartbeat] skipped, socket not connected');
    return;
  }

  console.log('[heartbeat] sending...');
  socket.emit('print:heartbeat', { bridgeId: BRIDGE_ID });
}, 10000);

setInterval(() => {
  if (!socket.connected) {
    return;
  }

  console.log('[list] requesting bridges...');
  socket.emit('print:list-bridges');
}, 15000);
