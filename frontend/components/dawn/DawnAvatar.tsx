"use client";

type DawnAvatarState = "idle" | "thinking" | "speaking" | "alert" | "listening";

type DawnAvatarProps = {
  state: DawnAvatarState;
  enabled?: boolean;
};

const STATE_LABELS: Record<DawnAvatarState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  speaking: "Speaking",
  alert: "Alert",
  listening: "Listening",
};

export default function DawnAvatar({ state, enabled = true }: DawnAvatarProps) {
  if (!enabled) return null;

  return (
    <div className="dawn-avatar-shell">
      <div className={`dawn-avatar dawn-avatar-${state}`} aria-hidden="true">
        <div className="dawn-avatar-halo" />
        <div className="dawn-avatar-core">
          <div className="dawn-avatar-face">
            <span className="dawn-avatar-eye dawn-avatar-eye-left" />
            <span className="dawn-avatar-eye dawn-avatar-eye-right" />
            <span className="dawn-avatar-mouth" />
          </div>
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Presence</p>
        <p className="mt-2 text-sm text-slate-200">{STATE_LABELS[state]}</p>
      </div>
    </div>
  );
}
