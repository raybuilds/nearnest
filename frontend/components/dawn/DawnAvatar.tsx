"use client";

type DawnAvatarState = "idle" | "thinking" | "speaking" | "alert" | "listening";

type DawnAvatarProps = {
  state: DawnAvatarState;
  enabled?: boolean;
  compact?: boolean;
};

const STATE_LABELS: Record<DawnAvatarState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  speaking: "Speaking",
  alert: "Alert",
  listening: "Listening",
};

export default function DawnAvatar({ state, enabled = true, compact = false }: DawnAvatarProps) {
  if (!enabled) return null;

  return (
    <div className={`dawn-avatar-shell ${compact ? "dawn-avatar-shell-compact dawn-avatar-shell-inline" : ""}`}>
      <div className={`dawn-avatar dawn-avatar-${state} ${compact ? "dawn-avatar-compact" : ""}`} aria-hidden="true">
        <div className="dawn-avatar-halo" />
        <div className={`dawn-avatar-core ${compact ? "dawn-avatar-core-compact" : ""}`}>
          <div className="dawn-avatar-face">
            <span className="dawn-avatar-eye dawn-avatar-eye-left" />
            <span className="dawn-avatar-eye dawn-avatar-eye-right" />
            <span className="dawn-avatar-mouth" />
          </div>
        </div>
      </div>
      {!compact ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Presence</p>
          <p className="mt-2 text-sm text-slate-200">{STATE_LABELS[state]}</p>
        </div>
      ) : null}
    </div>
  );
}
