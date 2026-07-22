import { ref } from "vue";

/**
 * Tiny shared UI-state singleton for the app's dialogs. The game-end dialog is
 * driven by the game store (`gameEndResult`); the disclaimer and changelog are
 * opened from the header / footer and gated on first visit here.
 */
const disclaimerOpen = ref(false);
const changelogOpen = ref(false);
const matchInfoOpen = ref(false);

export function useModals() {
  return {
    disclaimerOpen,
    changelogOpen,
    matchInfoOpen,
    openDisclaimer: () => (disclaimerOpen.value = true),
    closeDisclaimer: () => (disclaimerOpen.value = false),
    openChangelog: () => (changelogOpen.value = true),
    closeChangelog: () => (changelogOpen.value = false),
    openMatchInfo: () => (matchInfoOpen.value = true),
    closeMatchInfo: () => (matchInfoOpen.value = false),
  };
}
