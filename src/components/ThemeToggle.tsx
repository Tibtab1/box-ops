"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // On mount: read preference from localStorage or prefers-color-scheme
  useEffect(() => {
    const stored = (localStorage.getItem("boxops-theme") as Theme | null);
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      apply(stored);
    } else {
      const prefDark =
        window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
      const initial: Theme = prefDark ? "dark" : "light";
      setTheme(initial);
      apply(initial);
    }
    setMounted(true);
  }, []);

  function apply(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem("boxops-theme", next);
    } catch {}
  }

  // Avoid hydration mismatch by rendering a stable placeholder before mount
  if (!mounted) {
    return (
      <button
        aria-label="Thème"
        className="btn-ghost whitespace-nowrap !px-2.5"
        disabled
      >
        …
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer en clair" : "Passer en sombre"}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
      className={clsx("btn-ghost whitespace-nowrap !px-2.5 !text-sm")}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
