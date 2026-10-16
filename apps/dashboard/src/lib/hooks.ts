import { useEffect, useState } from "react";
import type { Dataset } from "../types";

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: Dataset };

/** Loads the scraper output. Cache-busted by day so the morning refresh shows up. */
export function useDataset(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    const bust = new Date().toISOString().slice(0, 13);
    fetch(`./data/competitions.json?v=${bust}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Dataset>;
      })
      .then((data) => setState({ status: "ready", data }))
      .catch((e: unknown) => setState({ status: "error", error: String(e) }));
  }, []);
  return state;
}

/** Ticking clock so countdowns stay live without reloading. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

