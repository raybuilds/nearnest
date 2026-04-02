"use client";

type DawnVoiceControlsProps = {
  avatarEnabled: boolean;
  voiceEnabled: boolean;
  listening: boolean;
  speechSupported: boolean;
  voiceSupported: boolean;
  onToggleAvatar: () => void;
  onToggleVoice: () => void;
  onToggleListening: () => void;
};

function pillClass(active: boolean) {
  return active
    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
    : "border-white/10 bg-white/5 text-slate-300";
}

export default function DawnVoiceControls({
  avatarEnabled,
  voiceEnabled,
  listening,
  speechSupported,
  voiceSupported,
  onToggleAvatar,
  onToggleVoice,
  onToggleListening,
}: DawnVoiceControlsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleListening}
        disabled={!speechSupported}
        className={`rounded-full border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${pillClass(listening)}`}
      >
        {listening ? "Stop listening" : "Mic"}
      </button>
      <button
        type="button"
        onClick={onToggleVoice}
        disabled={!voiceSupported}
        className={`rounded-full border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${pillClass(voiceEnabled)}`}
      >
        {voiceEnabled ? "Voice on" : "Voice off"}
      </button>
      <button
        type="button"
        onClick={onToggleAvatar}
        className={`rounded-full border px-3 py-2 text-sm transition ${pillClass(avatarEnabled)}`}
      >
        {avatarEnabled ? "Avatar on" : "Avatar off"}
      </button>
    </div>
  );
}
