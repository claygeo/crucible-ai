import WebSocketImpl from "ws";

export function installNodeWebSocket() {
  const mutableGlobal = globalThis as unknown as {
    WebSocket?: unknown;
  };
  if (!mutableGlobal.WebSocket) {
    mutableGlobal.WebSocket = WebSocketImpl;
  }
}
