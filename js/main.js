// 主应用类
class BlogApp {
    constructor() {
        this.articles = [];
        this.allArticles = [];
        this.isInitialized = false;
        this.hasBoundEvents = false;

        this.pageType = (document.body?.dataset?.pageType || 'home').toLowerCase();
        this.sectionId = (document.body?.dataset?.sectionId || '').toLowerCase();
        this.basePath = document.body?.dataset?.basePath || '';
        this.navigation = Array.isArray(SITE_CONFIG?.navigation) ? SITE_CONFIG.navigation : [];
        this.language = this.getCurrentLanguage();

        this.handleLanguageChange = this.handleLanguageChange.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
    }

    getCurrentLanguage() {
        const key = SITE_CONFIG?.i18n?.storageKey || 'site-language';
        const fallback = SITE_CONFIG?.i18n?.defaultLanguage || 'en';
        const stored = (() => {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        })();

        return stored === 'cn' ? 'cn' : fallback;
    }

    // 初始化应用
    async init() {
        if (this.isInitialized) return;

        try {
            this.renderHeader();
            this.showLoadingState();

            if (this.pageType === 'home') {
                this.renderNavigation();
                this.setupEventListeners();
                this.isInitialized = true;
                return;
            }

            await this.loadArticles();
            this.applySectionFilter();
            this.renderArticles();
            this.setupEventListeners();
            this.isInitialized = true;

            setTimeout(() => {
                if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                    MathJax.typesetPromise();
                }
            }, 800);
        } catch (error) {
            console.error('Failed to initialize blog app:', error);
            this.allArticles = this.normalizeArticles(ARTICLES_DATA || []);
            this.applySectionFilter();
            this.renderHeader();

            if (this.pageType === 'home') {
                this.renderNavigation();
            } else {
                this.renderArticles();
            }

            this.setupEventListeners();
        }
    }

    showLoadingState() {
        const articleList = document.querySelector('.article-list');
        if (!articleList) return;

        const labels = SITE_CONFIG?.i18n?.labels || {};
        const text = this.pageType === 'home'
            ? this.pickByLang(labels.loadingNavigation, 'Loading navigation...')
            : this.pickByLang(labels.loadingArticles, 'Loading articles...');

        articleList.innerHTML = `<div class="loading">${text}</div>`;
    }

    pickByLang(textMap, fallback) {
        if (!textMap || typeof textMap !== 'object') {
            return fallback || '';
        }
        if (this.language === 'cn') {
            return textMap.cn || textMap.en || fallback || '';
        }
        return textMap.en || textMap.cn || fallback || '';
    }

    // 渲染页面头部
    renderHeader() {
        const siteTitle = document.querySelector('.site-title');
        const mainTitle = document.querySelector('.main-title');

        if (siteTitle && !siteTitle.hasAttribute('data-i18n-en')) {
            siteTitle.textContent = SITE_CONFIG.title;
        }

        if (mainTitle && !mainTitle.hasAttribute('data-i18n-en')) {
            mainTitle.textContent = this.language === 'cn'
                ? (SITE_CONFIG.descriptionCN || SITE_CONFIG.description)
                : SITE_CONFIG.description;
        }
    }

    async loadArticles() {
        let loaded = [];
        try {
            if (typeof ArticleLoader !== 'undefined' && ArticleLoader.load) {
                loaded = await ArticleLoader.load();
            }
        } catch (e) {
            console.warn('ArticleLoader failed, fallback to static:', e);
        }

        const source = this.mergeArticles(loaded, ARTICLES_DATA || []);
        this.allArticles = this.normalizeArticles(source);
        this.articles = this.allArticles;
    }

    mergeArticles(dynamicArticles, staticArticles) {
        const merged = new Map();

        (Array.isArray(dynamicArticles) ? dynamicArticles : []).forEach(article => {
            if (!article || !article.id) return;
            merged.set(article.id, article);
        });

        (Array.isArray(staticArticles) ? staticArticles : []).forEach(article => {
            if (!article || !article.id) return;
            const current = merged.get(article.id) || {};
            merged.set(article.id, {
                ...current,
                ...article,
                content: {
                    ...(current.content || {}),
                    ...(article.content || {})
                }
            });
        });

        const toTime = (dateValue) => {
            const date = new Date(dateValue || '');
            return isNaN(date.getTime()) ? 0 : date.getTime();
        };

        return Array.from(merged.values()).sort((a, b) => toTime(b.date) - toTime(a.date));
    }

    normalizeArticles(articles) {
        return (articles || []).map(article => {
            const mappedSection = SITE_CONFIG?.articleSectionMap?.[article.id] || '';
            const rawSection = article.section || article.category || mappedSection;
            const section = this.normalizeSection(rawSection) || this.normalizeSection(mappedSection) || 'studies';

            return {
                ...article,
                section
            };
        });
    }

    normalizeSection(sectionValue) {
        if (!sectionValue || typeof sectionValue !== 'string') return '';

        const normalized = sectionValue.trim().toLowerCase().replace(/\s+/g, '-');
        const aliases = {
            'project-briefing': 'project-briefing',
            'project': 'project-briefing',
            'projects': 'project-briefing',
            'tech-insights': 'tech-insights',
            'tech': 'tech-insights',
            'insights': 'tech-insights',
            'studies': 'studies',
            'study': 'studies',
            'learning': 'studies'
        };

        return aliases[normalized] || '';
    }

    applySectionFilter() {
        if (this.pageType !== 'section') {
            this.articles = this.allArticles;
            return;
        }

        const section = this.normalizeSection(this.sectionId);
        this.articles = this.allArticles.filter(article => this.normalizeSection(article.section) === section);
    }

    // 渲染首页导航
    renderNavigation() {
        const articleList = document.querySelector('.article-list');
        if (!articleList) return;

        articleList.innerHTML = '';

        this.navigation.forEach(item => {
            articleList.appendChild(this.createNavigationElement(item));
        });
    }

    createNavigationElement(item) {
        const articleElement = document.createElement('article');
        articleElement.className = 'article-item nav-title-only';
        articleElement.setAttribute('data-item-type', 'navigation');
        articleElement.setAttribute('data-target-href', this.buildInternalHref(item.href || '#'));

        const title = this.pickByLang(item.title, item.id || '');

        articleElement.innerHTML = `
            <div class="article-content">
                <h2 class="article-title">${title}</h2>
            </div>
        `;

        return articleElement;
    }

    // 渲染文章列表
    renderArticles() {
        const articleList = document.querySelector('.article-list');
        if (!articleList) return;

        articleList.innerHTML = '';

        if (!this.articles.length) {
            const emptyText = this.getSectionEmptyText();
            articleList.innerHTML = `<div class="loading">${emptyText}</div>`;
            return;
        }

        this.articles.forEach(article => {
            const articleElement = this.createArticleElement(article);
            articleList.appendChild(articleElement);
        });

        setTimeout(() => {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise();
            }
        }, 400);
    }

    getSectionEmptyText() {
        const sectionConfig = SITE_CONFIG?.sections?.[this.sectionId] || {};
        const sectionText = this.pickByLang(sectionConfig.emptyText, '');
        if (sectionText) return sectionText;

        return this.pickByLang(SITE_CONFIG?.i18n?.labels?.emptySectionDefault, 'No content yet.');
    }

    // 创建文章元素
    createArticleElement(article) {
        const articleElement = document.createElement('article');
        articleElement.className = 'article-item';
        articleElement.setAttribute('data-item-type', 'article');
        articleElement.setAttribute('data-article-id', article.id);

        const formattedDate = article.date ? ArticleUtils.formatDate(article.date) : '';

        const title = this.pickByLang(article.title, article.title || '');
        const excerpt = this.pickByLang(article.excerpt, article.excerpt || '');

        articleElement.innerHTML = `
            <div class="article-content">
                <div class="article-date">${formattedDate || ''}</div>
                <h2 class="article-title">${title || ''}</h2>
                <p class="article-excerpt">${excerpt || ''}</p>
            </div>
        `;

        return articleElement;
    }

    // 设置事件监听
    setupEventListeners() {
        if (this.hasBoundEvents) return;

        document.addEventListener('click', this.handleDocumentClick);
        window.addEventListener('languagechange', this.handleLanguageChange);

        this.hasBoundEvents = true;
    }

    handleDocumentClick(e) {
        const item = e.target.closest('.article-item');
        if (!item) return;

        const itemType = item.getAttribute('data-item-type');

        if (itemType === 'navigation') {
            const href = item.getAttribute('data-target-href');
            if (href) {
                window.location.href = href;
            }
            return;
        }

        if (itemType === 'article') {
            const articleId = item.getAttribute('data-article-id');
            this.openArticle(articleId);
        }
    }

    handleLanguageChange() {
        this.language = this.getCurrentLanguage();
        this.renderHeader();

        if (this.pageType === 'home') {
            this.renderNavigation();
            return;
        }

        this.applySectionFilter();
        this.renderArticles();
    }

    // 打开文章
    openArticle(articleId) {
        const list = this.allArticles && this.allArticles.length ? this.allArticles : (ARTICLES_DATA || []);
        const article = (list || []).find(a => a.id === articleId);
        if (!article) {
            console.error('Article not found:', articleId);
            return;
        }

        const href = this.getArticleHref(article);
        if (href) {
            window.location.href = href;
        }
    }

    getArticleHref(article) {
        const content = article?.content || {};
        if (this.language === 'cn') {
            return this.buildInternalHref(content.fileCn || content.routeCn || content.file || '');
        }
        return this.buildInternalHref(content.fileEn || content.routeEn || content.file || '');
    }

    buildInternalHref(path) {
        if (!path) return '';
        if (/^(https?:)?\/\//i.test(path) || path.startsWith('#')) return path;
        if (path.startsWith('./') || path.startsWith('../') || path.startsWith('/')) return path;

        if (!this.basePath) return path;

        return `${this.basePath}${path}`;
    }

    // 搜索功能
    search(query) {
        const q = (query || '').toLowerCase();
        const source = this.pageType === 'section' ? this.allArticles.filter(article => this.normalizeSection(article.section) === this.normalizeSection(this.sectionId)) : this.allArticles;
        const asText = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'object') return `${value.en || ''} ${value.cn || ''}`.trim();
            return '';
        };

        this.articles = (source || []).filter(article =>
            asText(article.title).toLowerCase().includes(q) ||
            asText(article.excerpt).toLowerCase().includes(q) ||
            (Array.isArray(article.tags) && article.tags.some(tag => (tag || '').toLowerCase().includes(q)))
        );
        this.renderArticles();
    }

    // 重置文章列表
    resetArticles() {
        this.applySectionFilter();
        this.renderArticles();
    }

    // 按分类过滤（兼容旧接口）
    filterByCategory(category) {
        const section = this.normalizeSection(category);
        this.articles = (this.allArticles || []).filter(article => this.normalizeSection(article.section) === section);
        this.renderArticles();
    }
}

// 工具函数
const Utils = {
    // 防抖函数
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 节流函数
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// 全局实例
let blogApp;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        blogApp = new BlogApp();
        await blogApp.init();
    } catch (error) {
        console.error('Failed to start blog app:', error);
    }
});

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BlogApp };
}
