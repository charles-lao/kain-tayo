/** Saved meal IDs in localStorage. */
const MealManager = {
    _storageKey: 'savedMeals',

    /** @returns {Array<string>} */
    getSavedMealIds: function() {
        try {
            const saved = localStorage.getItem(this._storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error reading saved meals from localStorage:', e);
            return [];
        }
    },

    /**
     * @param {string} mealId
     * @returns {boolean} False if it was already saved.
     */
    addMeal: function(mealId) {
        const savedIds = this.getSavedMealIds();
        if (savedIds.includes(mealId.toString())) {
            return false;
        }
        savedIds.push(mealId.toString());
        localStorage.setItem(this._storageKey, JSON.stringify(savedIds));
        this.updateBadgeCount();
        return true;
    },

    /**
     * @param {string} mealId
     * @returns {number} The index it occupied, so Undo can restore its position.
     */
    removeMeal: function(mealId) {
        const savedIds = this.getSavedMealIds();
        const index = savedIds.indexOf(mealId.toString());
        if (index === -1) return -1;

        savedIds.splice(index, 1);
        localStorage.setItem(this._storageKey, JSON.stringify(savedIds));
        this.updateBadgeCount();
        return index;
    },

    /**
     * Re-insert a meal at its old position, for Undo.
     * @param {string} mealId
     * @param {number} index
     */
    restoreMeal: function(mealId, index) {
        const savedIds = this.getSavedMealIds();
        if (savedIds.includes(mealId.toString())) return;

        const at = (index >= 0 && index <= savedIds.length) ? index : savedIds.length;
        savedIds.splice(at, 0, mealId.toString());
        localStorage.setItem(this._storageKey, JSON.stringify(savedIds));
        this.updateBadgeCount();
    },

    isMealSaved: function(mealId) {
        return this.getSavedMealIds().includes(mealId.toString());
    },

    /** @returns {Array<string>} The cleared IDs, so Undo can restore them. */
    clearAll: function() {
        const previous = this.getSavedMealIds();
        localStorage.removeItem(this._storageKey);
        this.updateBadgeCount();
        return previous;
    },

    /**
     * Replace the saved list. Used by Clear all's Undo.
     * @param {Array<string>} ids
     */
    replaceAll: function(ids) {
        localStorage.setItem(this._storageKey, JSON.stringify(ids));
        this.updateBadgeCount();
    },

    /**
     * Save or unsave a meal and show a toast. Removing offers Undo.
     * @param {string} mealId
     * @param {string} mealName Used in the toast text.
     * @param {function(boolean)} onChange Gets the new saved state after every
     *   change, including Undo.
     */
    toggleWithUndo: function(mealId, mealName, onChange) {
        if (this.isMealSaved(mealId)) {
            const index = this.removeMeal(mealId);
            onChange(false);
            showMessageToast(`Removed ${mealName}`, 'warning', {
                label: 'Undo',
                onClick: () => {
                    this.restoreMeal(mealId, index);
                    onChange(true);
                }
            });
        } else if (this.addMeal(mealId)) {
            onChange(true);
            showMessageToast(`Saved ${mealName}`, 'success');
        }
    },

    /** Update every saved-count badge. A count of zero hides the badge. */
    updateBadgeCount: function() {
        const count = this.getSavedMealIds().length;
        document.querySelectorAll('.savedMealsCount').forEach(el => {
            el.textContent = count;
            el.hidden = count === 0;
        });
    }
};

/** Loads foods.json and builds meal markup. */
const MealDataService = {
    _cachedMeals: null,

    /**
     * No cache-busting: the service worker serves this path network-first.
     * @returns {Promise<Array>} The meals, or [] if the fetch fails.
     */
    getMeals: async function() {
        if (this._cachedMeals) {
            return this._cachedMeals;
        }
        try {
            const response = await fetch('data/foods.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this._cachedMeals = await response.json();
            return this._cachedMeals;
        } catch (error) {
            console.error('Error fetching meals data:', error);
            return [];
        }
    },

    /** @returns {Promise<{categories: string[], types: string[]}>} Unique sorted values. */
    getFilterOptions: async function() {
        const meals = await this.getMeals();
        const categories = new Set();
        const types = new Set();

        meals.forEach(meal => {
            this.splitField(meal.category).forEach(c => categories.add(c));
            this.splitField(meal.type).forEach(t => types.add(t));
        });

        return {
            categories: Array.from(categories).sort(),
            types: Array.from(types).sort()
        };
    },

    /** Split a comma-separated field into trimmed values. */
    splitField: function(field) {
        return (field || '').split(',').map(v => v.trim()).filter(Boolean);
    },

    /** True for takeaway and dine-in meals. */
    isMapsRelevant: function(meal) {
        return this.splitField(meal.category).some(c => c === 'takeaway' || c === 'dine-in');
    },

    /**
     * Google Maps link markup, or '' for home-cooked meals.
     *
     * A plain https link, which iOS and Android open in the Maps app if it is
     * installed and on the web if not. Don't go back to `comgooglemaps://`: on
     * iOS without the app, Safari showed an error and the fallback then opened
     * Apple Maps on top of it.
     * @param {Object} meal
     * @param {'hero'|'tile'|'inline'} variant
     * @returns {string}
     */
    getMapsButtonHtml: function(meal, variant = 'inline') {
        if (!this.isMapsRelevant(meal)) return '';

        const query = encodeURIComponent(meal.name);
        // &amp; because this lands in an HTML attribute.
        const href = `https://www.google.com/maps/search/?api=1&amp;query=${query}`;
        const label = `Find ${escapeHtml(meal.name)} on Google Maps`;

        if (variant === 'tile') {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer"
                       class="tile-btn maps-btn" aria-label="${label}" title="Find on Google Maps">
                        <i class="bi bi-geo-alt" aria-hidden="true"></i>
                    </a>`;
        }

        const sizeClass = variant === 'hero' ? '' : 'btn-sm';
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-quiet ${sizeClass} maps-btn" aria-label="${label}">
                    <i class="bi bi-geo-alt" aria-hidden="true"></i> Find on Google Maps
                </a>`;
    },

    /** Category and type badge markup for a meal. */
    getCategoryBadgesHtml: function(meal) {
        const cats = this.splitField(meal.category).map(c =>
            `<span class="cat cat--${escapeAttr(c)}">${escapeHtml(c)}</span>`
        );
        const types = this.splitField(meal.type).map(t =>
            `<span class="cat cat--type">${escapeHtml(t)}</span>`
        );
        return cats.concat(types).join('');
    }
};

/** Photo tile markup shared by Browse and Saved. */
const MealGrid = {
    /**
     * @param {Object} meal
     * @param {{action: 'save'|'remove'}} [opts] Which trailing control the tile gets.
     * @returns {string}
     */
    tileHtml: function(meal, opts = {}) {
        const action = opts.action || 'save';
        const isSaved = MealManager.isMealSaved(meal.id);
        const name = escapeHtml(meal.name);
        const id = escapeHtml(meal.id);

        const actionBtn = action === 'remove'
            ? `<button type="button" class="tile-btn remove-meal-btn" data-meal-id="${id}"
                       data-meal-name="${name}" aria-label="Remove ${name} from saved">
                   <i class="bi bi-trash" aria-hidden="true"></i>
               </button>`
            : `<button type="button" class="tile-btn saveMealBtn ${isSaved ? 'is-saved' : ''}"
                       data-meal-id="${id}" data-meal-name="${name}"
                       aria-pressed="${isSaved}"
                       aria-label="${isSaved ? 'Remove' : 'Save'} ${name}">
                   <i class="bi ${isSaved ? 'bi-bookmark-check-fill' : 'bi-bookmark'}" aria-hidden="true"></i>
               </button>`;

        return `
            <article class="meal-tile" data-meal-id="${id}">
                <div class="meal-tile-media">
                    <img src="${escapeHtml(meal.image)}" alt="${name}"
                         class="fullscreen-img-modal" loading="lazy" decoding="async"
                         width="400" height="400"
                         onerror="this.onerror=null;this.src='images/food-placeholder.png';">
                    <div class="tile-actions">
                        ${MealDataService.getMapsButtonHtml(meal, 'tile')}
                        ${actionBtn}
                    </div>
                </div>
                <div class="meal-tile-body">
                    <h3 class="meal-tile-name">${name}</h3>
                    <div class="cat-row">${MealDataService.getCategoryBadgesHtml(meal)}</div>
                </div>
            </article>`;
    },

    /**
     * @param {HTMLElement} btn A .saveMealBtn
     * @param {boolean} saved
     */
    setSavedState: function(btn, saved) {
        const name = btn.dataset.mealName || 'meal';
        btn.classList.toggle('is-saved', saved);
        btn.setAttribute('aria-pressed', String(saved));
        btn.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${name}`);
        const icon = btn.querySelector('i');
        if (icon) icon.className = `bi ${saved ? 'bi-bookmark-check-fill' : 'bi-bookmark'}`;
    }
};

/**
 * Filter chips shared by Home and Browse. Both use the same localStorage key,
 * so a selection carries over. Expects #filter-sheet, #category-chips,
 * #type-chips and #clear-filters in the page.
 */
const MealFilters = {
    _storageKey: 'activeFilters',
    _onChange: null,
    active: { categories: [], types: [] },

    /**
     * Load the saved selection, render the chips and wire up the controls.
     * @param {Function} onChange Called after every change to the selection.
     */
    init: async function(onChange) {
        this._onChange = onChange;
        const options = await MealDataService.getFilterOptions();
        this._load(options);

        this._renderChips('category-chips', options.categories, 'categories');
        this._renderChips('type-chips', options.types, 'types');

        document.getElementById('filter-sheet').addEventListener('click', e => {
            const chip = e.target.closest('.chip');
            if (chip) this.toggle(chip.dataset.group, chip.dataset.value, chip);
        });
        document.getElementById('clear-filters').addEventListener('click', () => this.clear());
    },

    /**
     * Drops saved values that are no longer in the data, e.g. after a rename.
     * A stale value would filter with no chip on screen to turn it off.
     */
    _load: function(options) {
        try {
            const parsed = JSON.parse(localStorage.getItem(this._storageKey) || '{}');
            this.active.categories = (parsed.categories || []).filter(c => options.categories.includes(c));
            this.active.types = (parsed.types || []).filter(t => options.types.includes(t));
        } catch (e) {
            console.warn('Ignoring malformed saved filters', e);
        }
    },

    _save: function() {
        localStorage.setItem(this._storageKey, JSON.stringify(this.active));
        if (this._onChange) this._onChange();
    },

    _renderChips: function(containerId, options, group) {
        document.getElementById(containerId).innerHTML = options.map(option => {
            const isActive = this.active[group].includes(option);
            return `<button type="button" class="chip" aria-pressed="${isActive}"
                            data-group="${group}" data-value="${escapeHtml(option)}">
                        ${escapeHtml(option)}
                    </button>`;
        }).join('');
    },

    toggle: function(group, value, chip) {
        const nowActive = !this.active[group].includes(value);
        chip.setAttribute('aria-pressed', String(nowActive));
        this.active[group] = nowActive
            ? this.active[group].concat(value)
            : this.active[group].filter(v => v !== value);
        this._save();
    },

    clear: function() {
        this.active = { categories: [], types: [] };
        document.querySelectorAll('#filter-sheet .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        this._save();
    },

    /** Number of selected chips across both groups. */
    activeCount: function() {
        return this.active.categories.length + this.active.types.length;
    },

    /**
     * True when the meal fits the selection. Within a group any chip matches;
     * across groups both must match.
     */
    matches: function(meal) {
        const { categories, types } = this.active;
        const mealCats = MealDataService.splitField(meal.category);
        const mealTypes = MealDataService.splitField(meal.type);
        return (!categories.length || categories.some(c => mealCats.includes(c))) &&
               (!types.length || types.some(t => mealTypes.includes(t)));
    }
};

/* Meal data from JSON goes into innerHTML, so escape it with these. */

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function escapeAttr(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * @param {string} message
 * @param {'success'|'warning'} tone
 * @param {{label: string, onClick: Function}} [action] Optional inline action, e.g. Undo.
 */
const showMessageToast = (message = null, tone = 'success', action = null) => {
    const toastElement = document.getElementById('messageToast');
    if (!toastElement) return;

    if (message != null) {
        const body = toastElement.querySelector('.toast-body');
        if (body) body.textContent = message;
    }

    toastElement.classList.remove('is-success', 'is-warning');
    toastElement.classList.add(tone === 'warning' ? 'is-warning' : 'is-success');

    const icon = toastElement.querySelector('.toast-icon');
    if (icon) {
        icon.className = 'bi toast-icon ' +
            (tone === 'warning' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill');
    }

    // Rebuild the action button so old click handlers never leak between toasts.
    const oldBtn = toastElement.querySelector('.toast-action');
    const btn = oldBtn.cloneNode(false);
    btn.className = 'toast-action';
    oldBtn.replaceWith(btn);

    // animation: false makes show and hide synchronous. With Bootstrap's fade, a
    // toast shown during the previous one's fade-out ended up hidden, or threw
    // once the old instance was disposed. The entrance animation is in CSS.
    bootstrap.Toast.getInstance(toastElement)?.dispose();
    const instance = new bootstrap.Toast(toastElement, {
        animation: false,
        delay: action ? 6000 : 3000
    });

    if (action) {
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            action.onClick();
            instance.hide();
        });
    } else {
        btn.classList.add('d-none');
    }

    instance.show();
};

/**
 * Dark/light toggle. The inline script in each page's <head> sets the initial
 * theme to avoid a light flash; this only wires the toggle and system listener.
 */
const ThemeManager = {
    _storageKey: 'theme-preference',

    init: function() {
        const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
        this.updateToggleButton(current);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem(this._storageKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    },

    setTheme: function(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        this.updateToggleButton(theme);
        this.updateThemeColor();
    },

    toggle: function() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.setTheme(newTheme);
        localStorage.setItem(this._storageKey, newTheme);
    },

    updateToggleButton: function(theme) {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        const icon = btn.querySelector('i');
        const goingDark = theme !== 'dark';
        if (icon) {
            icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
        }
        btn.setAttribute('aria-label', goingDark ? 'Switch to dark theme' : 'Switch to light theme');
    },

    /** Keep the mobile status bar in step with the app background. */
    updateThemeColor: function() {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        const paper = getComputedStyle(document.documentElement)
            .getPropertyValue('--paper').trim();
        if (paper) meta.setAttribute('content', paper);
    }
};

/**
 * Attach medium-zoom if it loaded. The CDN script can be missing offline, and a
 * throw here used to stop the rest of the page script.
 * @param {Element|string} target
 */
function attachZoom(target) {
    try {
        if (window.zoom) window.zoom.attach(target);
    } catch (e) {
        console.warn('Image zoom unavailable:', e);
    }
}

/**
 * Run fn once the DOM is parsed, or right away if it already is.
 * @param {Function} fn
 */
function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

onReady(function() {
    MealManager.updateBadgeCount();
    ThemeManager.init();
    ThemeManager.updateThemeColor();

    if (typeof mediumZoom === 'function') {
        window.zoom = mediumZoom('.fullscreen-img-modal', { background: 'rgba(0,0,0,0.92)', margin: 24 });
    }

    document.getElementById('theme-toggle')?.addEventListener('click', () => ThemeManager.toggle());
});
