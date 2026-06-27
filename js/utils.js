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
     */
    removeMeal: function(mealId) {
        let savedIds = this.getSavedMealIds();
        savedIds = savedIds.filter(id => id !== mealId.toString());
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
     */
    clearAll: function() {
        localStorage.removeItem(this._storageKey);
        this.updateBadgeCount();
    },

    /**
     * Update the UI badge count for saved meals.
     */
    updateBadgeCount: function() {
        const count = this.getSavedMealIds().length;
        $('.savedMealsCount').each(function() {
            $(this).text(count);
            // Optionally toggle visibility or style based on count
            if (count > 0) {
                $(this).removeClass('text-muted').addClass('text-warning');
            } else {
                $(this).removeClass('text-warning').addClass('text-muted');
            }
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
     * @returns {Promise<Array>} A promise that resolves to the array of meals.
     */
    getMeals: async function() {
        if (this._cachedMeals) {
            return this._cachedMeals;
        }
        try {
            const response = await fetch('data/foods.json', { cache: "reload" });
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
     * Returns the meal name as a Google Maps search query.
     * @param {Object} meal
     * @returns {string}
     */
    getMapsSearchQuery: function(meal) {
        return meal.name;
    },

    /**
     * Returns a Google Maps button HTML string if the meal is takeaway or dine-in.
     * @param {Object} meal
     * @param {boolean} large - Use large button variant (for the random card on index.html)
     * @returns {string}
     */
    getMapsButtonHtml: function(meal, large = false) {
        const categories = meal.category.split(',').map(c => c.trim());
        const isMapsRelevant = categories.some(c => c === 'takeaway' || c === 'dine-in');
        if (!isMapsRelevant) return '';
        const query = this.getMapsSearchQuery(meal).replace(/"/g, '&quot;');
        const sizeClass = large ? 'btn-lg py-3' : 'btn-sm';
        const label = large ? '📍 Find on Google Maps' : '📍';
        return `<button type="button" class="btn btn-secondary ${sizeClass} maps-btn" data-query="${query}">${label}</button>`;
    }
};

/**
 * Opens a maps app with a search query.
 * On iOS, tries Google Maps app first (via custom URL scheme), then falls back to Apple Maps.
 * On Android/desktop, uses the Google Maps web URL (Android auto-routes to the app).
 * @param {string} query
 */
function openMapsApp(query) {
    const encoded = encodeURIComponent(query);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
        // On iOS, custom URL schemes can't open in a new tab.
        // Try Google Maps app first; if not installed Safari ignores the URL,
        // then fall back to Apple Maps (always available on iOS).
        window.location.href = `comgooglemaps://?q=${encoded}`;
        setTimeout(function () {
            // If still here after 400ms, Google Maps app isn't installed.
            window.location.href = `maps://?q=${encoded}`;
        }, 400);
    } else {
        // Android auto-routes this URL to the Google Maps app.
        // Desktop just opens it in a browser tab.
        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    }
}

// Shows Toast with message
const showMessageToast = (message = null, toastColor = 'primary', toastId = 'messageToast') => {
    let toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    
    if (message != null){
        const body = toastElement.querySelector('.toast-body');
        if (body) {
            body.textContent = message;
        }
    }

    // Handle color change
    const toastClassList = toastElement.classList;

    // Remove existing text-bg-* class if any
    toastClassList.forEach(className => {
        if (className.startsWith('text-bg-')) {
            toastClassList.remove(className);
        }
    });

    // Change to new color
    toastClassList.add(`text-bg-${toastColor}`);
    
    // Dispose previous toast instance (if any), then recreate it
    const existingToast = bootstrap.Toast.getInstance(toastElement);
    if (existingToast) {
        existingToast.dispose(); // clear event listeners and timers
    }

    // Now re-init and show
    const newToast = new bootstrap.Toast(toastElement, { delay: 3000 });
    newToast.show();
}

// Opens #imageModal to view a larger image
$(document).on('click', '.fullscreen-img-modal', function () {
    const src = $(this).attr('src');
    const alt = $(this).attr('alt');
    $('#modalImage').attr('src', src);
    $('#modalImage').attr('alt', alt);
});

/**
 * ThemeManager handles dark/light mode switching and system preference detection.
 */
const ThemeManager = {
    _storageKey: 'theme-preference',

    init: function() {
        const savedTheme = localStorage.getItem(this._storageKey);
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;
        
        this.setTheme(theme);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem(this._storageKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    },

    setTheme: function(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        this.updateToggleButton(theme);
    },

    toggle: function() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.setTheme(newTheme);
        localStorage.setItem(this._storageKey, newTheme);
    },

    updateToggleButton: function(theme) {
        const $icon = $('#theme-toggle i');
        if (theme === 'dark') {
            $icon.removeClass('bi-moon-stars-fill').addClass('bi-sun-fill');
        } else {
            $icon.removeClass('bi-sun-fill').addClass('bi-moon-stars-fill');
        }
    }
};

// Auto-update badge count and init theme on page load
$(document).ready(function() {
    MealManager.updateBadgeCount();
     ThemeManager.init();
});

$(document).on('click', '#theme-toggle', function() {
    ThemeManager.toggle();
});

// Delegated handler for maps buttons — uses data-query to avoid scope issues
$(document).on('click', '.maps-btn', function() {
    openMapsApp($(this).data('query'));
});
