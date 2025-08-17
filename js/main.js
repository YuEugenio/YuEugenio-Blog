// 主应用类
class BlogApp {
    constructor() {
        this.articles = [];
        this.allArticles = [];
        this.isInitialized = false;
    }
    
    // 初始化应用
    async init() {
        if (this.isInitialized) return;
        
        try {
            this.renderHeader();

            // 显示加载状态
            const articleList = document.querySelector('.article-list');
            if (articleList) {
                articleList.innerHTML = '<div class="loading">Loading articles...</div>';
            }

            // 动态加载文章（失败则回退到静态数据）
            let loaded = [];
            try {
                if (typeof ArticleLoader !== 'undefined' && ArticleLoader.load) {
                    loaded = await ArticleLoader.load();
                }
            } catch (e) {
                console.warn('ArticleLoader failed, fallback to static:', e);
            }

            this.allArticles = Array.isArray(loaded) && loaded.length ? loaded : ARTICLES_DATA;
            this.articles = this.allArticles;

            this.renderArticles();
            this.setupEventListeners();
            this.isInitialized = true;
            
            setTimeout(() => {
                if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                    MathJax.typesetPromise();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Failed to initialize blog app:', error);
            this.allArticles = ARTICLES_DATA;
            this.articles = this.allArticles;
            this.renderHeader();
            this.renderArticles();
            this.setupEventListeners();
        }
    }
    
    // 渲染页面头部
    renderHeader() {
        const siteTitle = document.querySelector('.site-title');
        const mainTitle = document.querySelector('.main-title');
        
        if (siteTitle) {
            siteTitle.textContent = SITE_CONFIG.title;
        }
        
        if (mainTitle) {
            mainTitle.textContent = SITE_CONFIG.description;
        }
    }
    
    // 渲染文章列表
    renderArticles() {
        const articleList = document.querySelector('.article-list');
        if (!articleList) return;
        
        articleList.innerHTML = '';
        
        this.articles.forEach(article => {
            const articleElement = this.createArticleElement(article);
            articleList.appendChild(articleElement);
        });
        
        setTimeout(() => {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise();
            }
        }, 500);
    }
    
    // 创建文章元素
    createArticleElement(article) {
        const articleElement = document.createElement('article');
        articleElement.className = 'article-item';
        articleElement.setAttribute('data-article-id', article.id);
        
        // 调试日期格式化
        const formattedDate = article.date ? ArticleUtils.formatDate(article.date) : '';
        console.log(`Formatting date for ${article.id}: ${article.date} -> ${formattedDate}`);
        
        articleElement.innerHTML = `
            <div class="article-content">
                <div class="article-date">${formattedDate || ''}</div>
                <h2 class="article-title">${article.title}</h2>
                <p class="article-excerpt">${article.excerpt}</p>
            </div>
        `;
        
        return articleElement;
    }
    
    // 设置事件监听
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const articleItem = e.target.closest('.article-item');
            if (articleItem) {
                const articleId = articleItem.getAttribute('data-article-id');
                this.openArticle(articleId);
            }
        });
    }
    
    // 打开文章
    openArticle(articleId) {
        const list = this.allArticles && this.allArticles.length ? this.allArticles : ARTICLES_DATA;
        const article = (list || []).find(a => a.id === articleId);
        if (!article) {
            console.error('Article not found:', articleId);
            return;
        }
        
        if (article.content.file) {
            window.location.href = article.content.file;
        }
    }
    
    // 搜索功能
    search(query) {
        const q = (query || '').toLowerCase();
        const results = (this.allArticles || []).filter(article =>
            (article.title || '').toLowerCase().includes(q) ||
            (article.excerpt || '').toLowerCase().includes(q) ||
            (Array.isArray(article.tags) && article.tags.some(tag => (tag || '').toLowerCase().includes(q)))
        );
        this.articles = results;
        this.renderArticles();
    }
    
    // 重置文章列表
    resetArticles() {
        this.articles = this.allArticles;
        this.renderArticles();
    }
    
    // 按分类过滤
    filterByCategory(category) {
        this.articles = (this.allArticles || []).filter(article => article.category === category);
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