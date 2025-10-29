// scripts/i18n/i18n.js
const i18n = {
  currentLocale: 'fr',
  locales: {
    en: {
      welcome: "Welcome to MoodShare",
      expressMood: "Express your mood",
      recentPosts: "Recent Posts",
      followAccounts: "Accounts to Follow",
      share: "Share",
      // Add more translations as needed
    },
    fr: {
      welcome: "Bienvenue sur MoodShare",
      expressMood: "Exprime ton mood",
      recentPosts: "Posts récents",
      followAccounts: "Comptes à suivre",
      share: "Partager",
      // Add more translations as needed
    }
  },

  setLocale(locale) {
    if (this.locales[locale]) {
      this.currentLocale = locale;
      this.updateText();
    }
  },

  translate(key) {
    return this.locales[this.currentLocale][key] || key;
  },

  updateText() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.translate(key);
    });
  }
};

// Initialize i18n
document.addEventListener('DOMContentLoaded', () => {
  i18n.updateText();
});

// Example of changing the language
function changeLanguage(locale) {
  i18n.setLocale(locale);
}