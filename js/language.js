(function() {
    const STORAGE_KEY = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.i18n && SITE_CONFIG.i18n.storageKey)
        ? SITE_CONFIG.i18n.storageKey
        : 'site-language';

    const DEFAULT_LANG = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.i18n && SITE_CONFIG.i18n.defaultLanguage)
        ? SITE_CONFIG.i18n.defaultLanguage
        : 'en';

    const VALID_LANG = new Set(['en', 'cn']);

    function getPageLanguage() {
        const pageLang = document.body && document.body.dataset ? document.body.dataset.langPage : null;
        return VALID_LANG.has(pageLang) ? pageLang : null;
    }

    function getLanguageRoute(lang) {
        if (!document.body || !document.body.dataset) return null;
        return lang === 'cn'
            ? (document.body.dataset.langRouteCn || null)
            : (document.body.dataset.langRouteEn || null);
    }

    function shouldRedirect(route) {
        if (!route) return false;

        try {
            const targetUrl = new URL(route, window.location.href);
            const currentUrl = new URL(window.location.href);
            return targetUrl.pathname !== currentUrl.pathname
                || targetUrl.search !== currentUrl.search
                || targetUrl.hash !== currentUrl.hash;
        } catch {
            return false;
        }
    }

    function getLanguage() {
        let stored = null;
        try {
            stored = localStorage.getItem(STORAGE_KEY);
        } catch {
            stored = null;
        }

        if (VALID_LANG.has(stored)) return stored;

        const pageLang = getPageLanguage();
        if (pageLang) return pageLang;

        return VALID_LANG.has(DEFAULT_LANG) ? DEFAULT_LANG : 'en';
    }

    function setLanguage(lang, shouldBroadcast = true) {
        const safeLang = VALID_LANG.has(lang) ? lang : 'en';

        try {
            localStorage.setItem(STORAGE_KEY, safeLang);
        } catch {
            // Ignore localStorage write failures
        }

        const route = getLanguageRoute(safeLang);
        if (shouldRedirect(route)) {
            window.location.href = route;
            return;
        }

        document.documentElement.lang = safeLang === 'cn' ? 'zh-CN' : 'en';

        applyStaticTranslations(safeLang);
        updateSwitcherState(safeLang);

        if (shouldBroadcast) {
            window.dispatchEvent(new CustomEvent('languagechange', {
                detail: { language: safeLang }
            }));
        }
    }

    function applyStaticTranslations(lang) {
        const isCN = lang === 'cn';
        const nodes = document.querySelectorAll('[data-i18n-en]');

        nodes.forEach(node => {
            const en = node.getAttribute('data-i18n-en');
            const cn = node.getAttribute('data-i18n-cn');
            const nextText = isCN ? (cn || en || '') : (en || cn || '');
            node.textContent = nextText;
        });
    }

    function updateSwitcherState(lang) {
        const switcher = document.querySelector('.lang-switcher');
        if (!switcher) return;

        const buttons = switcher.querySelectorAll('button[data-lang]');
        buttons.forEach(button => {
            const isActive = button.getAttribute('data-lang') === lang;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function createSwitcher() {
        if (document.querySelector('.lang-switcher')) return;

        const switcher = document.createElement('div');
        switcher.className = 'lang-switcher';
        switcher.innerHTML = [
            '<button type="button" data-lang="cn" aria-label="Switch language to Chinese">CN</button>',
            '<button type="button" data-lang="en" aria-label="Switch language to English">EN</button>'
        ].join('');

        switcher.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-lang]');
            if (!button) return;
            const lang = button.getAttribute('data-lang');
            setLanguage(lang, true);
        });

        const target = document.querySelector('.container') || document.querySelector('.page-container') || document.body;

        if (target === document.body) {
            switcher.classList.add('lang-switcher--fixed');
            document.body.appendChild(switcher);
            return;
        }

        target.insertBefore(switcher, target.firstChild);
    }

    document.addEventListener('DOMContentLoaded', () => {
        createSwitcher();
        const initialLang = getLanguage();
        setLanguage(initialLang, true);
    });

    window.LanguageManager = {
        getLanguage,
        setLanguage
    };
})();
