export let currentTranslations = {}; // <-- ajout

export async function loadLanguage(lang) {

    // 🔥 mémorisation automatique
    if (!lang) {
        lang = localStorage.getItem("lang") || "fr";
    } else {
        localStorage.setItem("lang", lang);
    }

    const res = await fetch(`/lang/${lang}.json`);
    const translations = await res.json();

    // set HTML lang attribute so les librairies et screen readers savent la langue
    document.documentElement.lang = lang;

    // Support both text and HTML injections
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });

    // new: allow HTML content keys (e.g. for links/buttons)
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
        const key = el.dataset.i18nHtml;
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });

    // cache global pour réutilisation côté app.js (évite fetch répétés)
    currentTranslations = translations;
    window.__translations__ = translations;

    // 🔥 Renvoie les traductions pour les appels dans app.js
    return translations;
}

// Fonction utilitaire pour traduire une clé
// Traduction avec variables : t("key", {var1: "..."} )
export function t(key, vars = {}) {
    let text = currentTranslations[key] || key;

    Object.keys(vars).forEach(k => {
        text = text.replace(`{${k}}`, vars[k]);
    });

    return text;
}
