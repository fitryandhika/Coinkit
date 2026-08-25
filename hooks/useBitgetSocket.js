"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "wss://ws.bitget.com/v2/ws/public";
const PING_INTERVAL_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

const WS_INST_TYPE = { spot: "SPOT", futures: "USDT-FUTURES" };

export function useBitgetSocket(mode, symbols) {
  const [status, setStatus] = useState("connecting");
  const [tickers, setTickers] = useState({});
  const [lastMessageAt, setLastMessageAt] = useState(null);

  const wsRef = useRef(null);
  const pingTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const attemptsRef = useRef(0);
  const closedByUserRef = useRef(false);

  const cleanupTimers = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !symbols || symbols.length === 0) return;

    closedByUserRef.current = false;
    setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");

    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      setStatus("failed");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      setStatus("open");

      const args = symbols.map((symbol) => ({
        instType: WS_INST_TYPE[mode],
        channel: "ticker",
        instId: symbol,
      }));
      ws.send(JSON.stringify({ op: "subscribe", args }));

      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      if (msg.event === "error") return;
      if (msg.action && Array.isArray(msg.data)) {
        setLastMessageAt(Date.now());
        setTickers((prev) => {
          const next = { ...prev };
          msg.data.forEach((raw) => {
            const symbol = raw.symbol || raw.instId;
            if (symbol) next[symbol] = raw;
          });
          return next;
        });
      }
    };

    ws.onclose = () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (closedByUserRef.current) return;

      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY_MS * 2 ** attemptsRef.current;
        attemptsRef.current += 1;
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(connect, delay);
      } else {
        setStatus("failed");
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch (err) {
        // noop
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, symbols]);

  useEffect(() => {
    attemptsRef.current = 0;
    connect();
    return () => {
      closedByUserRef.current = true;
      cleanupTimers();
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try {
          wsRef.current.close();
        } catch (err) {
          // noop
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, JSON.stringify(symbols)]);

  return { status, tickers, lastMessageAt };
}
