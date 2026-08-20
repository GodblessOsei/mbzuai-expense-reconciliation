import { useEffect, useState } from "react";

// Tailwind breakpoints can't reach Recharts: axis width, pie radius and font
// size are NUMERIC PROPS on React components, not CSS the browser resolves.
// So the breakpoint has to be readable from JS, and matchMedia is the same
// engine Tailwind's `sm:` uses — the two stay in step instead of drifting.
//
// `query` is expected to be a constant string. The initial value is read during
// the first render; the listener carries every change after that.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
