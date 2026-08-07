<script setup>
/** Engine-vs-engine match configuration + transport controls. */
import { computed } from "vue";
import { VdButton, VdSelect, VdSwitch } from "@vanduo-oss/vd3";
import SegmentedControl from "./SegmentedControl.vue";
import { useGameStore } from "../../composables/useGameStore.js";
import { useModals } from "../../composables/useModals.js";

const store = useGameStore();
const { match, matchStrengthLabels, matchControls } = store;
const { openMatchInfo } = useModals();

const engineOptions = [
  { value: "builtin", label: "Aurora" },
  { value: "tomitank", label: "Tomitank" },
];
const levelOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));
const perspectiveOptions = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];
const movetimeOptions = [
  { value: "500", label: "0.5s" },
  { value: "1000", label: "1s" },
  { value: "2000", label: "2s" },
  { value: "5000", label: "5s" },
  { value: "10000", label: "10s" },
];

const movetime = computed({
  get: () => String(match.movetime),
  set: (v) => store.setMatchField("movetime", Number(v)),
});

// Each engine has its own "full strength" (uncapped) toggle; show it when a
// side uses that engine.
const showUncapped = computed(
  () => match.whiteEngine === "tomitank" || match.blackEngine === "tomitank",
);
const showAuroraUncapped = computed(
  () => match.whiteEngine === "builtin" || match.blackEngine === "builtin",
);
</script>

<template>
  <div id="match-settings" class="match-settings">
    <div class="match-info-row">
      <button type="button" class="match-info-link" @click="openMatchInfo">
        <i class="ph-duotone ph-info" aria-hidden="true"></i>
        How the engine match works
      </button>
    </div>

    <SegmentedControl
      id="match-white-engine-choice"
      label="White engine"
      data-key="engine"
      :options="engineOptions"
      :model-value="match.whiteEngine"
      @update:model-value="(v) => store.setMatchField('whiteEngine', v)"
    />
    <SegmentedControl
      id="match-white-strength-choice"
      label-id="match-white-strength-label"
      :label="matchStrengthLabels.white"
      data-key="level"
      :options="levelOptions"
      :model-value="match.whiteStrength"
      @update:model-value="(v) => store.setMatchField('whiteStrength', v)"
    />

    <SegmentedControl
      id="match-black-engine-choice"
      label="Black engine"
      data-key="engine"
      :options="engineOptions"
      :model-value="match.blackEngine"
      @update:model-value="(v) => store.setMatchField('blackEngine', v)"
    />
    <SegmentedControl
      id="match-black-strength-choice"
      label-id="match-black-strength-label"
      :label="matchStrengthLabels.black"
      data-key="level"
      :options="levelOptions"
      :model-value="match.blackStrength"
      @update:model-value="(v) => store.setMatchField('blackStrength', v)"
    />

    <div v-if="showUncapped" class="settings-group">
      <VdSwitch
        id="match-uncapped-choice"
        label="Tomitank full strength"
        size="sm"
        :model-value="match.uncapped"
        @update:model-value="(v) => store.setMatchField('uncapped', v)"
      />
      <p v-if="match.uncapped" class="match-hint">
        Depth cap ignored — Tomitank searches to the full move time (its level
        setting no longer limits it).
      </p>
    </div>

    <div v-if="showAuroraUncapped" class="settings-group">
      <VdSwitch
        id="match-aurora-uncapped-choice"
        label="Aurora full strength"
        size="sm"
        :model-value="match.auroraUncapped"
        @update:model-value="(v) => store.setMatchField('auroraUncapped', v)"
      />
      <p v-if="match.auroraUncapped" class="match-hint">
        Depth cap ignored — Aurora searches to the full move time (its level
        setting no longer limits it).
      </p>
    </div>

    <div class="settings-group">
      <label class="settings-label" for="match-movetime-select">Move time</label>
      <VdSelect
        id="match-movetime-select"
        v-model="movetime"
        :options="movetimeOptions"
      />
    </div>

    <SegmentedControl
      id="match-perspective-choice"
      label="Board view"
      data-key="perspective"
      :options="perspectiveOptions"
      :model-value="match.perspective"
      @update:model-value="(v) => store.setMatchField('perspective', v)"
    />

    <div class="match-actions" aria-label="Engine match controls">
      <VdButton
        id="match-start-btn"
        variant="primary"
        size="sm"
        :disabled="matchControls.startDisabled"
        @click="store.startEngineMatch()"
      >Start</VdButton>
      <VdButton
        id="match-pause-btn"
        variant="outline"
        size="sm"
        :disabled="matchControls.pauseStopDisabled"
        @click="store.pauseOrResumeMatch()"
      >{{ matchControls.pauseLabel }}</VdButton>
      <VdButton
        id="match-stop-btn"
        variant="outline"
        size="sm"
        :disabled="matchControls.pauseStopDisabled"
        @click="store.stopMatch()"
      >Stop</VdButton>
    </div>
  </div>
</template>
