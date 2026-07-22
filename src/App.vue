<script setup>
/** App shell: header, board + control panel, dialogs, theme customizer. */
import { onMounted } from "vue";
import { VdThemeCustomizer, useThemePreference } from "@vanduo-oss/vd3";
import AppHeader from "./components/AppHeader.vue";
import BoardPanel from "./components/BoardPanel.vue";
import GamePanel from "./components/GamePanel.vue";
import GameEndModal from "./components/modals/GameEndModal.vue";
import DisclaimerModal from "./components/modals/DisclaimerModal.vue";
import ChangelogModal from "./components/modals/ChangelogModal.vue";
import MatchInfoModal from "./components/modals/MatchInfoModal.vue";
import { useGameStore } from "./composables/useGameStore.js";
import { useModals } from "./composables/useModals.js";

// Apply the persisted theme on mount (sets data-primary / data-theme on <html>).
useThemePreference();

const store = useGameStore();
const modals = useModals();

onMounted(async () => {
  await store.restore();
  // First visit: gate on the disclaimer.
  if (!store.getDisclaimerAccepted()) modals.openDisclaimer();
});
</script>

<template>
  <div id="app-root">
    <AppHeader />

    <main class="app-main">
      <div class="app-layout">
        <BoardPanel />
        <aside class="app-aside" aria-label="Game controls and status">
          <GamePanel />
        </aside>
      </div>
    </main>

    <GameEndModal />
    <DisclaimerModal />
    <ChangelogModal />
    <MatchInfoModal />
    <!-- Aurora Polaris sticks to the Open Color palette, so the palette
         selector (Open Color / Fibonacci) is hidden. -->
    <VdThemeCustomizer :show-palette="false" />
  </div>
</template>
