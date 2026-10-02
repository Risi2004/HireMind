/**
 * HireMind Real-Time Live Events Service (Server-Sent Events)
 * Manages live stream subscriptions and pushes instant notifications to candidate dashboards.
 */

// Map of userId string -> Set of active Express HTTP Response objects
const activeClients = new Map();

/**
 * Register a client's SSE connection for real-time updates.
 *
 * @param {string} userId - User ID string
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function subscribe(userId, req, res) {
  if (!userId) {
    res.status(400).end();
    return;
  }

  const idStr = String(userId);

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Register in user set
  if (!activeClients.has(idStr)) {
    activeClients.set(idStr, new Set());
  }
  const userSet = activeClients.get(idStr);
  userSet.add(res);

  // Send initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: idStr, timestamp: Date.now() })}\n\n`);

  // Keep connection alive with periodic comment every 20 seconds
  const keepaliveTimer = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (_) {
      clearInterval(keepaliveTimer);
    }
  }, 20000);

  // Clean up when connection closes
  req.on('close', () => {
    clearInterval(keepaliveTimer);
    userSet.delete(res);
    if (userSet.size === 0) {
      activeClients.delete(idStr);
    }
  });
}

/**
 * Push an event to all active SSE streams connected for a specific user.
 *
 * @param {string} userId - User ID string
 * @param {string} eventName - Name of the event (e.g. 'demo_access_changed')
 * @param {Object} payload - Data payload
 */
function notifyUser(userId, eventName, payload) {
  if (!userId) return;
  const idStr = String(userId);
  const userSet = activeClients.get(idStr);

  if (userSet && userSet.size > 0) {
    const rawData = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    userSet.forEach((clientRes) => {
      try {
        clientRes.write(rawData);
      } catch (err) {
        console.warn(`[RealTime SSE] Failed to write event to client ${idStr}:`, err.message);
      }
    });
    console.log(`[RealTime SSE] Dispatched '${eventName}' to ${userSet.size} active connection(s) for user ${idStr}`);
  }
}

/**
 * Broadcast an event to all connected clients.
 *
 * @param {string} eventName
 * @param {Object} payload
 */
function broadcast(eventName, payload) {
  const rawData = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  activeClients.forEach((set) => {
    set.forEach((clientRes) => {
      try {
        clientRes.write(rawData);
      } catch (_) {}
    });
  });
}

module.exports = {
  subscribe,
  notifyUser,
  broadcast,
};
