/**
 * SampleClass - A sample JavaScript class for testing parsing
 * This class demonstrates various method types and patterns
 */
class SampleClass {
    /**
     * Constructor for SampleClass
     * @param {string} name - The name of the instance
     * @param {number} value - Initial value
     */
    constructor(name, value = 0) {
        this.name = name;
        this._value = value;
        this.items = [];
    }

    /**
     * Public method to get the name
     * @returns {string} The name
     */
    getName() {
        return this.name;
    }

    /**
     * Public method to set the name
     * @param {string} newName - The new name
     */
    setName(newName) {
        this.name = newName;
    }

    /**
     * Getter for value property
     * @returns {number} The current value
     */
    get value() {
        return this._value;
    }

    /**
     * Setter for value property
     * @param {number} newValue - The new value
     */
    set value(newValue) {
        if (typeof newValue === 'number' && newValue >= 0) {
            this._value = newValue;
        } else {
            throw new Error('Value must be a non-negative number');
        }
    }

    /**
     * Public method to add two numbers
     * @param {number} a - First number
     * @param {number} b - Second number
     * @returns {number} Sum of a and b
     */
    add(a, b) {
        return a + b;
    }

    /**
     * Public method to multiply two numbers
     * @param {number} a - First number
     * @param {number} b - Second number
     * @returns {number} Product of a and b
     */
    multiply(a, b) {
        return a * b;
    }

    /**
     * Public method to add an item to the items array
     * @param {any} item - Item to add
     */
    addItem(item) {
        this.items.push(item);
    }

    /**
     * Public method to remove an item from the items array
     * @param {any} item - Item to remove
     * @returns {boolean} True if item was removed, false otherwise
     */
    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Public async method to fetch data
     * @param {string} url - URL to fetch from
     * @returns {Promise<Object>} Fetched data
     */
    async fetchData(url) {
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            throw new Error(`Failed to fetch data: ${error.message}`);
        }
    }

    /**
     * Public method that uses a callback
     * @param {Function} callback - Callback function to execute
     * @param {any} data - Data to pass to callback
     */
    processWithCallback(callback, data) {
        if (typeof callback === 'function') {
            return callback(data);
        }
        return null;
    }

    /**
     * Private method (convention with underscore)
     * @param {number} num - Number to validate
     * @returns {boolean} True if valid
     */
    _validateNumber(num) {
        return typeof num === 'number' && !isNaN(num);
    }

    /**
     * Static method - can be called without instance
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    static capitalize(str) {
        if (typeof str !== 'string' || str.length === 0) {
            return str;
        }
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Static method to create instance from object
     * @param {Object} config - Configuration object
     * @returns {SampleClass} New instance
     */
    static fromConfig(config) {
        return new SampleClass(config.name || 'Default', config.value || 0);
    }

    /**
     * Method with default parameters
     * @param {string} message - Message to log
     * @param {string} level - Log level (default: 'info')
     * @param {boolean} timestamp - Include timestamp (default: true)
     */
    log(message, level = 'info', timestamp = true) {
        const prefix = timestamp ? `[${new Date().toISOString()}]` : '';
        console.log(`${prefix} [${level.toUpperCase()}] ${message}`);
    }

    /**
     * Method using arrow function internally
     * @param {Array<number>} numbers - Array of numbers
     * @returns {Array<number>} Doubled numbers
     */
    doubleNumbers(numbers) {
        return numbers.map(num => num * 2);
    }

    /**
     * Method with destructuring
     * @param {Object} options - Options object
     * @param {string} options.type - Type option
     * @param {number} options.count - Count option
     */
    processOptions({ type, count = 1 }) {
        return {
            type: type || 'default',
            count: count,
            processed: true
        };
    }

    /**
     * Method with rest parameters
     * @param {...number} numbers - Variable number of numbers
     * @returns {number} Sum of all numbers
     */
    sum(...numbers) {
        return numbers.reduce((total, num) => total + num, 0);
    }

    /**
     * Get all items in the items array
     * @returns {Array} Copy of the items array
     */
    getItems() {
        return [...this.items];
    }

    /**
     * Clear all items from the items array
     */
    clearItems() {
        this.items = [];
    }

    /**
     * Check if the items array is empty
     * @returns {boolean} True if items array is empty
     */
    isEmpty() {
        return this.items.length === 0;
    }

    /**
     * Get the count of items in the array
     * @returns {number} Number of items
     */
    getItemCount() {
        return this.items.length;
    }

    /**
     * Calculate the average of numeric items
     * @returns {number} Average value or 0 if no numeric items
     */
    calculateAverage() {
        const numericItems = this.items.filter(item => typeof item === 'number');
        if (numericItems.length === 0) {
            return 0;
        }
        const sum = numericItems.reduce((total, num) => total + num, 0);
        return sum / numericItems.length;
    }

    /**
     * Filter items based on a predicate function
     * @param {Function} predicate - Function to test each item
     * @returns {Array} Filtered items
     */
    filterItems(predicate) {
        if (typeof predicate !== 'function') {
            throw new Error('Predicate must be a function');
        }
        return this.items.filter(predicate);
    }

    /**
     * Find an item in the items array
     * @param {Function} predicate - Function to test each item
     * @returns {any} Found item or undefined
     */
    findItem(predicate) {
        if (typeof predicate !== 'function') {
            throw new Error('Predicate must be a function');
        }
        return this.items.find(predicate);
    }

    /**
     * Increment the value by a specified amount
     * @param {number} amount - Amount to increment (default: 1)
     */
    increment(amount = 1) {
        if (!this._validateNumber(amount)) {
            throw new Error('Amount must be a valid number');
        }
        this._value += amount;
    }

    /**
     * Decrement the value by a specified amount
     * @param {number} amount - Amount to decrement (default: 1)
     */
    decrement(amount = 1) {
        if (!this._validateNumber(amount)) {
            throw new Error('Amount must be a valid number');
        }
        const newValue = this._value - amount;
        if (newValue < 0) {
            throw new Error('Value cannot be negative');
        }
        this._value = newValue;
    }

    /**
     * Create a clone of this instance
     * @returns {SampleClass} New instance with copied properties
     */
    clone() {
        const cloned = new SampleClass(this.name, this._value);
        cloned.items = [...this.items];
        return cloned;
    }

    /**
     * Convert the instance to a JSON string
     * @returns {string} JSON representation
     */
    toJSON() {
        return JSON.stringify({
            name: this.name,
            value: this._value,
            items: this.items
        });
    }

    /**
     * Create instance from JSON string
     * @param {string} jsonString - JSON string to parse
     * @returns {SampleClass} New instance from JSON
     */
    static fromJSON(jsonString) {
        const data = JSON.parse(jsonString);
        const instance = new SampleClass(data.name, data.value);
        instance.items = data.items || [];
        return instance;
    }

    /**
     * Get a summary of the instance
     * @returns {Object} Summary object with key information
     */
    getSummary() {
        return {
            name: this.name,
            value: this._value,
            itemCount: this.items.length,
            isEmpty: this.items.length === 0
        };
    }

    /**
     * Reset the instance to initial state
     * @param {string} newName - Optional new name (keeps current if not provided)
     */
    reset(newName = null) {
        this._value = 0;
        this.items = [];
        if (newName !== null) {
            this.name = newName;
        }
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleClass;
}


