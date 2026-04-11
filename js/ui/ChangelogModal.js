import { CHANGELOG_ENTRIES } from "../data/changelogData.js";

export class ChangelogModal {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.modalEl = null;
    this._init();
  }

  _init() {
    if (!this.container) return;
    this.modalEl = document.createElement("div");
    this.modalEl.className = "vd-modal";
    this.modalEl.id = "changelog-modal";
    this.modalEl.setAttribute("role", "dialog");
    this.modalEl.setAttribute("aria-labelledby", "changelog-modal-title");
    this.modalEl.setAttribute("aria-modal", "true");

    const entriesMarkup = CHANGELOG_ENTRIES.map((entry) => {
      const columnsMarkup = (entry.columns || [])
        .map((column) => {
          const groupsMarkup = (column.groups || [])
            .map((group) => {
              const itemsMarkup = (group.items || [])
                .map(
                  (item) => `
                    <li class="change-item">
                      <i class="ph-duotone ${item.icon}" aria-hidden="true"></i>
                      <div>
                        <strong>${item.title}</strong>
                        <p>${item.body}</p>
                      </div>
                    </li>
                  `
                )
                .join("");
              return `
                <div class="change-group">
                  <h5>${group.title}</h5>
                  <ul class="change-list">
                    ${itemsMarkup}
                  </ul>
                </div>
              `;
            })
            .join("");

          return `
            <div class="vd-col-12 vd-col-md-6">
              <h4 class="changelog-column-title">${column.title}</h4>
              ${groupsMarkup}
            </div>
          `;
        })
        .join("");

      return `
        <article class="version-card">
          <header class="version-header">
            <div class="version-meta">
              <span class="vd-badge vd-badge-dark">${entry.version}</span>
              <span class="version-date">
                <i class="ph-duotone ph-calendar-dots" aria-hidden="true"></i>
                ${entry.date}
              </span>
              ${entry.latest ? '<span class="vd-badge vd-badge-primary">Latest</span>' : ""}
            </div>
          </header>
          <div class="version-body">
            <div class="vd-row vd-gap-13">
              ${columnsMarkup}
            </div>
          </div>
        </article>
      `;
    }).join("");

    this.modalEl.innerHTML = `
      <div class="vd-modal-dialog changelog-modal-dialog">
        <div class="vd-modal-content changelog-modal-content">
          <div class="vd-modal-header changelog-modal-header">
            <h3 id="changelog-modal-title" class="vd-modal-title">Changelog</h3>
            <button type="button" class="vd-modal-close" id="changelog-close-btn" aria-label="Close changelog">
              <i class="ph-duotone ph-x" aria-hidden="true"></i>
            </button>
          </div>
          <div class="vd-modal-body changelog-modal-body">
            <p class="changelog-subtitle">Release notes for Aurora Polaris Chess.</p>
            ${entriesMarkup}
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.modalEl);
    const closeBtn = this.modalEl.querySelector("#changelog-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }
  }

  show() {
    if (!this.modalEl) return;
    if (window.VanduoModals) {
      if (!window.VanduoModals.modals.has(this.modalEl)) {
        window.VanduoModals.initModal(this.modalEl);
      }
      window.VanduoModals.open(this.modalEl);
    } else {
      this.modalEl.classList.add("is-open");
      this.modalEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("body-modal-open");
    }
  }

  hide() {
    if (!this.modalEl) return;
    if (window.VanduoModals && window.VanduoModals.modals.has(this.modalEl)) {
      window.VanduoModals.close(this.modalEl);
    } else {
      this.modalEl.classList.remove("is-open");
      this.modalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("body-modal-open");
    }
  }
}
