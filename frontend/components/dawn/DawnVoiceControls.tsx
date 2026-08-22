"use client";

type DawnVoiceControlsProps = {
  avatarEnabled: boolean;
  voiceEnabled: boolean;
  voiceProfile: string;
  listening: boolean;
  speechSupported: boolean;
  voiceSupported: boolean;
  onToggleAvatar: () => void;
  onToggleVoice: () => void;
  onToggleListening: () => void;
  onVoiceProfileChange: (value: string) => void;
};

function pillClass(active: boolean) {
  return active
    ? "border-[rgba(70,209,189,0.26)] bg-[rgba(70,209,189,0.1)]"
    : "";
}

export default function DawnVoiceControls({
  avatarEnabled,
  voiceEnabled,
  voiceProfile,
  listening,
  speechSupported,
  voiceSupported,
  onToggleAvatar,
  onToggleVoice,
  onToggleListening,
  onVoiceProfileChange,
}: DawnVoiceControlsProps) {
  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface-strong)" }}>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Assistant settings</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleVoice}
            disabled={!voiceSupported}
            className={`rounded-full border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${pillClass(voiceEnabled)}`}
            style={{ color: "var(--text-main)", borderColor: "var(--border)", background: "var(--bg-soft)" }}
          >
            {voiceEnabled ? "Voice on" : "Voice off"}
          </button>
          <button
            type="button"
            onClick={onToggleAvatar}
            className={`rounded-full border px-3 py-2 text-sm transition ${pillClass(avatarEnabled)}`}
            style={{ color: "var(--text-main)", borderColor: "var(--border)", background: "var(--bg-soft)" }}
          >
            {avatarEnabled ? "Avatar on" : "Avatar off"}
          </button>
          <span className={`rounded-full border px-3 py-2 text-sm ${pillClass(listening && speechSupported)}`} style={{ color: "var(--text-main)", borderColor: "var(--border)", background: "var(--bg-soft)" }}>
            {speechSupported ? (listening ? "Mic active" : "Mic ready") : "Mic unavailable"}
          </span>
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Voice profile</span>
        <select
          value={voiceProfile}
          onChange={(event) => onVoiceProfileChange(event.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ border: "1px solid var(--border)", background: "var(--bg-soft)", color: "var(--text-main)" }}
        >
          <option value="indian_en_female">Indian English female</option>
          <option value="british_en_female">British English female</option>
          <option value="us_en_female">US English female</option>
        </select>
      </label>
    </div>
  );
}
