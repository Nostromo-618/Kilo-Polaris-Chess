<script setup>
/** Release notes, rendered from the app's structured changelog data. */
import { VdModal, VdBadge } from "@vanduo-oss/vd3";
import { CHANGELOG_ENTRIES } from "../../../js/data/changelogData.js";
import { useModals } from "../../composables/useModals.js";

const { changelogOpen } = useModals();
</script>

<template>
  <VdModal v-model:open="changelogOpen" size="lg" title="Changelog">
    <div id="changelog-modal" class="changelog-scope">
    <p class="changelog-subtitle">Release notes for Aurora Polaris Chess.</p>

    <article
      v-for="entry in CHANGELOG_ENTRIES"
      :key="entry.version"
      class="version-card"
    >
      <header class="version-header">
        <div class="version-meta">
          <VdBadge variant="dark">{{ entry.version }}</VdBadge>
          <span class="version-date">
            <i class="ph-duotone ph-calendar-dots" aria-hidden="true"></i>
            {{ entry.date }}
          </span>
          <VdBadge v-if="entry.latest" variant="primary">Latest</VdBadge>
        </div>
      </header>

      <div class="version-body">
        <div class="changelog-columns">
          <div
            v-for="column in entry.columns || []"
            :key="column.title"
            class="changelog-column"
          >
            <h4 class="changelog-column-title">{{ column.title }}</h4>
            <div
              v-for="group in column.groups || []"
              :key="group.title"
              class="change-group"
            >
              <h5>{{ group.title }}</h5>
              <ul class="change-list">
                <li
                  v-for="(item, i) in group.items || []"
                  :key="i"
                  class="change-item"
                >
                  <i class="ph-duotone" :class="item.icon" aria-hidden="true"></i>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.body }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
    </div>
  </VdModal>
</template>
