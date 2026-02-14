let translations = {};
const DEFAULT_LANG = "en";

/**
 * Safely get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    return path.split(".").reduce((acc, part) => {
        return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
}

/**
 * Apply translations to DOM
 */
function applyTranslations(lang) {
    const fallbackLang = translations[DEFAULT_LANG] || {};
    const currentLang = translations[lang] || fallbackLang;

    document.querySelectorAll("[data-translate]").forEach(el => {
        const key = el.dataset.translate;

        const value =
            getNestedValue(currentLang, key) ??
            getNestedValue(fallbackLang, key) ??
            key;

        el.textContent = value;
    });

    document.documentElement.lang = lang;
}

/**
 * Change language
 */
function setLanguage(lang) {
    if (!translations[lang]) {
        lang = DEFAULT_LANG;
    }

    applyTranslations(lang);

    localStorage.setItem("lang", lang);
    updateSelectedFlag(lang);
}

/**
 * Update selected flag icon
 */
function updateSelectedFlag(lang) {
    const selectedLangImg = document.querySelector(".selected-lang img");
    const activeFlag = document.querySelector(`.lang-options .flag[data-lang="${lang}"]`);

    if (selectedLangImg && activeFlag) {
        selectedLangImg.src = activeFlag.src;
        selectedLangImg.dataset.lang = lang;
    }
}

/**
 * Detect best language
 */
function detectLanguage() {
    const savedLang = localStorage.getItem("lang");
    const browserLang = navigator.language.split("-")[0];

    if (savedLang && translations[savedLang]) {
        return savedLang;
    }

    if (translations[browserLang]) {
        return browserLang;
    }

    return DEFAULT_LANG;
}

/**
 * Load translations
 */
async function loadTranslations() {
    try {
        const response = await fetch("translations.json?v=" + Date.now());

        if (!response.ok) {
            throw new Error("Failed to load translations.json");
        }

        translations = await response.json();

        const langToUse = detectLanguage();
        setLanguage(langToUse);

    } catch (error) {
        console.error("Translation loading error:", error);
    }
}

/**
 * Initialize after DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
    loadTranslations();
});
