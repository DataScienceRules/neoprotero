let translations = {};

async function loadTranslations() {
    const response = await fetch("translations.json?v=" + Date.now());
    translations = await response.json();

    const savedLang = localStorage.getItem("lang") || "en";
    setLanguage(savedLang);
}

function setLanguage(lang) {
    document.querySelectorAll("[data-translate]").forEach(el => {
        const key = el.getAttribute("data-translate");
        el.textContent = translations[lang][key];
    });
    localStorage.setItem("lang", lang);
}

// Initialize
loadTranslations();





