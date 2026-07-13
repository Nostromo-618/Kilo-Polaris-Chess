<script setup>
/** Version badge (opens the changelog) + UI attribution. */
import { useModals } from "../composables/useModals.js";

const { openChangelog } = useModals();
const version = `v${__APP_VERSION__}`;
</script>

<template>
  <div class="side-panel-footer">
    <button
      id="changelog-trigger"
      type="button"
      class="app-version"
      :aria-label="`Open changelog for version ${version}`"
      @click="openChangelog"
    >
      {{ version }}
    </button>
    <p class="side-panel-attribution">
      <a href="https://vanduo.dev/" target="_blank" rel="noopener noreferrer">
        UI powered by Vanduo UI
      </a>
    </p>
  </div>
</template>
