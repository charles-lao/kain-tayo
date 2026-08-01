/**
 * MealManager handles all the logic for managing saved meals in localStorage.
 */
const MealManager = {
    _storageKey: 'savedMeals',

    /**
     * Get all saved meal IDs from localStorage.
     * @returns {Array<string>} Array of meal IDs.
     */
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
     * Save a meal ID to localStorage.
     * @param {string} mealId The ID of the meal to save.
     * @returns {boolean} True if successfully added, false if already exists.
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
     * Remove a meal ID from localStorage.
     * @param {string} mealId The ID of the meal to remove.
     * @returns {number} The index it occupied, so an undo can restore its position.
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
     * Re-insert a meal at a specific position (used by the undo affordance).
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

    /**
     * Check if a meal is already saved.
     * @param {string} mealId The ID of the meal.
     * @returns {boolean} True if saved.
     */
    isMealSaved: function(mealId) {
        return this.getSavedMealIds().includes(mealId.toString());
    },

    /**
     * Clear all saved meals.
     * @returns {Array<string>} The IDs that were cleared, so an undo can restore them.
     */
    clearAll: function() {
        const previous = this.getSavedMealIds();
        localStorage.removeItem(this._storageKey);
        this.updateBadgeCount();
        return previous;
    },

    /**
     * Replace the whole saved list (used to undo a Clear All).
     * @param {Array<string>} ids
     */
    replaceAll: function(ids) {
        localStorage.setItem(this._storageKey, JSON.stringify(ids));
        this.updateBadgeCount();
    },

    /**
     * Update every saved-count indicator on the page. Counts of zero are hidden
     * rather than shown as "0" — an empty badge is noise.
     */
    updateBadgeCount: function() {
        const count = this.getSavedMealIds().length;
        document.querySelectorAll('.savedMealsCount').forEach(el => {
            el.textContent = count;
            el.hidden = count === 0;
        });
    }
};

/**
 * MealDataService handles fetching and caching of the meals data.
 */
const MealDataService = {
    _cachedMeals: null,

    /**
     * Fetches all meals from the JSON data source.
     * Freshness is the service worker's job (network-first on this path), so no
     * cache-busting here.
     * @returns {Promise<Array>} A promise that resolves to the array of meals.
     */
    getMeals: async function() {
        if (this._cachedMeals) {
            return this._cachedMeals;
        }
        try {
            const response = await fetch('data/foods.json');
            this._cachedMeals = await response.json();
            return this._cachedMeals;
        } catch (error) {
            console.error('Error fetching meals data:', error);
            return [];
        }
    },

    /**
     * Get a meal by its ID.
     * @param {string} id The meal ID.
     * @returns {Promise<Object|null>}
     */
    getMealById: async function(id) {
        const meals = await this.getMeals();
        return meals.find(m => m.id.toString() === id.toString()) || null;
    },

    /**
     * Dynamically extracts unique categories and types from the meal data.
     * @returns {Promise<Object>} Object containing arrays of unique types and categories.
     */
    getFilterOptions: async function() {
        const meals = await this.getMeals();
        const categories = new Set();
        const types = new Set();

        meals.forEach(meal => {
            meal.category.split(',').forEach(c => categories.add(c.trim()));
            meal.type.split(',').forEach(t => types.add(t.trim()));
        });

        return {
            categories: Array.from(categories).sort(),
            types: Array.from(types).sort()
        };
    },

    /**
     * Split a comma-separated field into trimmed values.
     * @param {string} field
     * @returns {Array<string>}
     */
    splitField: function(field) {
        return (field || '').split(',').map(v => v.trim()).filter(Boolean);
    },

    /**
     * Returns the meal name as a Google Maps search query.
     * @param {Object} meal
     * @returns {string}
     */
    getMapsSearchQuery: function(meal) {
        return meal.name;
    },

    /**
     * True when the meal is something you'd go out for.
     * @param {Object} meal
     * @returns {boolean}
     */
    isMapsRelevant: function(meal) {
        return this.splitField(meal.category).some(c => c === 'takeaway' || c === 'dine-in');
    },

    /**
     * Google Maps link markup, or '' when the meal isn't something you go out for.
     *
     * A plain https link rather than a scripted custom-scheme launch. On iOS this
     * is a Universal Link, so it opens the Google Maps app when installed and
     * Google Maps on the web when not — the old `comgooglemaps://` approach threw
     * a Safari "address is invalid" dialog for anyone without the app, and then
     * its fallback timer opened Apple Maps on top of it. Android resolves the
     * same URL to the app; desktop opens a tab.
     *
     * The icon-only variant still carries an accessible name.
     * @param {Object} meal
     * @param {'hero'|'tile'|'inline'} variant
     * @returns {string}
     */
    getMapsButtonHtml: function(meal, variant = 'inline') {
        if (!this.isMapsRelevant(meal)) return '';

        const query = encodeURIComponent(this.getMapsSearchQuery(meal));
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

    /**
     * Category/type labels for a meal, as letterspaced badge markup.
     * @param {Object} meal
     * @returns {string}
     */
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

/**
 * Shared photo-tile renderer used by both Browse and Saved, so the two pages
 * stay visually identical.
 */
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
     * Flip a save button between its two states in place.
     * @param {HTMLElement} btn
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

/* -------------------------------------------------------------------------
   Escaping helpers — meal names come from JSON and land in innerHTML.
   ------------------------------------------------------------------------- */

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function escapeAttr(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Show a toast.
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

    let instance = bootstrap.Toast.getInstance(toastElement);
    if (instance) instance.dispose();
    instance = new bootstrap.Toast(toastElement, { delay: action ? 6000 : 3000 });

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
 * ThemeManager handles dark/light mode switching.
 * The *initial* attribute is set by a blocking inline script in <head> so there is
 * no light-mode flash; this only wires up the toggle and the system listener.
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
 * Attach medium-zoom if it loaded. The CDN can fail (or be missing offline on a
 * cold cache), and a hard failure here used to take down whatever ran after it.
 * @param {Element|string} target
 */
function attachZoom(target) {
    try {
        if (window.zoom) window.zoom.attach(target);
    } catch (e) {
        console.warn('Image zoom unavailable:', e);
    }
}

// Auto-update badge count, init theme, and image zoom on page load
$(document).ready(function() {
    MealManager.updateBadgeCount();
    ThemeManager.init();
    ThemeManager.updateThemeColor();

    if (typeof mediumZoom === 'function') {
        window.zoom = mediumZoom('.fullscreen-img-modal', { background: 'rgba(0,0,0,0.92)', margin: 24 });
    }
});

$(document).on('click', '#theme-toggle', function() {
    ThemeManager.toggle();
});
