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
    }
};

// Shows Toast with message
const showMessageToast = (message = null, toastColor = 'primary', toastId = 'messageToast') => {
    var toastElement = document.getElementById(toastId);
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

// Auto-update badge count on page load
$(document).ready(function() {
    MealManager.updateBadgeCount();
});
