import { DEV_FIXTURE } from "@/lib/app-state"

const STATES = [
  { label: "Demo", value: null },
  { label: "Worst case", value: "worst" },
  { label: "Empty", value: "empty" },
  { label: "One", value: "one" },
  { label: "Huge", value: "huge" },
] as const

/**
 * Dev-only switch between the user's own data and the fixtures in
 * data/dev-fixtures.ts. Deliberately plain chrome, not part of the design under
 * test: it reloads with `?data=` so the fixture enters at boot, through the
 * same validation the user's storage does.
 */
export function DevDataToggle() {
  const choose = (value: string | null) => {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("data", value)
    else url.searchParams.delete("data")
    window.location.assign(url)
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(env(safe-area-inset-bottom) + 88px)",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "#d4d4d4",
        font: "500 12px system-ui, sans-serif",
        color: "#222",
        boxShadow: "0 1px 4px rgb(0 0 0 / 0.25)",
      }}
    >
      {STATES.map((s) => {
        const active = (DEV_FIXTURE ?? null) === s.value
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => choose(s.value)}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "4px 10px",
              background: active ? "#fff" : "transparent",
              color: "inherit",
              font: "inherit",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
