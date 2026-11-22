import { chosenVoice } from "@/features/voice";
import { invoke } from "@tauri-apps/api/core";
import { hasTauriInternals } from "@/shared/platform/tauri";
import { useTutorStore } from "./tutorStore";
import type { Guide } from "./tutorTypes";

export async function makeOverviewAudio(guideId: string): Promise<void> {
  const store = useTutorStore.getState();
  const guide = store.guides[guideId];
  if (!guide?.script?.length) return;
  const save = (audio: Guide["audio"]) => {
    const current = useTutorStore.getState().guides[guideId];
    if (current) store.saveGuide({ ...current, audio, updatedAt: new Date().toISOString() });
  };
  if (!hasTauriInternals())
    return save({ state: "failed", error: "Audio is made in the Misty app." });
  save({ state: "making" });
  try {
    const seconds = await invoke<number>("tutor_overview_make", {
      voice: chosenVoice(),
      id: guideId,
      lines: guide.script,
    });
    save({ state: "ready", seconds });
  } catch (error) {
    save({ state: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}

export async function overviewAudioUrl(guideId: string): Promise<string> {
  const bytes = await invoke<ArrayBuffer>("tutor_overview_audio", { id: guideId });
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

export function deleteOverviewAudio(guideId: string): Promise<void> {
  if (!hasTauriInternals()) return Promise.resolve();
  return invoke<void>("tutor_overview_delete", { id: guideId }).catch(() => undefined);
}

const sceneAudioId = (guideId: string, index: number) => `${guideId}-s${index}`;

export async function makeVideoAudio(guideId: string): Promise<void> {
  const store = useTutorStore.getState();
  const video = store.guides[guideId];
  if (!video?.scenes?.length) return;
  const save = (change: Partial<Guide>) => {
    const current = useTutorStore.getState().guides[guideId];
    if (current) store.saveGuide({ ...current, ...change, updatedAt: new Date().toISOString() });
  };
  if (!hasTauriInternals())
    return save({ audio: { state: "failed", error: "Audio is made in the Misty app." } });
  save({ audio: { state: "making" } });
  const scenes = [...video.scenes];
  try {
    for (const [index, scene] of scenes.entries()) {
      const seconds = await invoke<number>("tutor_overview_make", {
        voice: chosenVoice(),
        id: sceneAudioId(guideId, index),
        lines: [{ speaker: 0, text: scene.narration }],
      });
      scenes[index] = { ...scene, seconds };
      save({ scenes: [...scenes], audio: { state: "making" } });
    }
    save({
      scenes,
      audio: {
        state: "ready",
        seconds: scenes.reduce((sum, scene) => sum + (scene.seconds ?? 0), 0),
      },
    });
  } catch (error) {
    save({
      audio: { state: "failed", error: error instanceof Error ? error.message : String(error) },
    });
  }
}

export function sceneAudioBytes(guideId: string, index: number): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>("tutor_overview_audio", { id: sceneAudioId(guideId, index) });
}

export async function deleteVideoAudio(guide: Guide): Promise<void> {
  if (!hasTauriInternals()) return;
  await Promise.all(
    (guide.scenes ?? []).map((_, index) =>
      invoke<void>("tutor_overview_delete", { id: sceneAudioId(guide.id, index) }).catch(
        () => undefined,
      ),
    ),
  );
}
