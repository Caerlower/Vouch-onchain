/**
 * In-memory live event bus + SSE fan-out.
 * Makes the demo "see behind the scenes" — every gift-card / remit step streams to the UI.
 */
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { LiveEvent, LiveEventType } from "./types.js";

const MAX_BUFFER = 200;
const buffer: LiveEvent[] = [];
const clients = new Set<Response>();

export function publish(
  type: LiveEventType,
  message: string,
  data?: Record<string, unknown>,
): LiveEvent {
  const ev: LiveEvent = {
    id: randomUUID(),
    type,
    ts: new Date().toISOString(),
    message,
    data,
  };
  buffer.push(ev);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  const payload = `id: ${ev.id}\nevent: vouch\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
  return ev;
}

export function recentEvents(limit = 40): LiveEvent[] {
  return buffer.slice(-limit);
}

export function attachSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  clients.add(res);

  const hello = publish("hello", "Live event stream connected", {
    clients: clients.size,
  });
  res.write(`id: ${hello.id}\nevent: vouch\ndata: ${JSON.stringify(hello)}\n\n`);

  // Replay recent history so late joiners see the story
  for (const ev of recentEvents(30)) {
    if (ev.id === hello.id) continue;
    res.write(`id: ${ev.id}\nevent: vouch\ndata: ${JSON.stringify(ev)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 15000);

  res.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}
