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

  // Browser mobile sering menghentikan/menahan koneksi & timer saat tab di-background
  // (layar terkunci, pindah app). Begitu tab aktif lagi, coba nyambung ulang dari nol —
  // baik saat status sudah "failed" (jatah reconnect habis) maupun "reconnecting" yang
  // macet karena timer di-throttle browser selama background.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (status !== "failed" && status !== "reconnecting") return;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Tutup socket lama (kalau masih ada sisa percobaan tertunda) sebelum mulai
      // yang baru, supaya tidak ada dua koneksi nyambung bersamaan.
      if (wsRef.current) {
        closedByUserRef.current = true;
        try {
          wsRef.current.close();
        } catch (err) {
          // noop
        }
      }

      attemptsRef.current = 0;
      connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, connect]);

  return { status, tickers, lastMessageAt };
}
