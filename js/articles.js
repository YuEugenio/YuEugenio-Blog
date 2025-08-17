// 文章数据
const ARTICLES_DATA = [
    {
        id: "circuit-variables",
        title: "Circuit Variables Fundamentals",
        date: "2025-07-04",
        category: "technology",
        tags: ["circuit analysis", "electrical engineering", "mathematics", "ohm's law"],
        excerpt: "Exploring the four fundamental variables in circuits: voltage, current, resistance, and power, along with their mathematical relationships. From Ohm's Law to Kirchhoff's Laws, master the foundations of circuit analysis.",
        mathPreview: "$v = iR$ and $p = vi = \\frac{v^2}{R} = i^2R$",
        content: {
            file: "articles/Circuit-Variables.html",
            hasLaTeX: true
        }
    },
    {
        id: "quantum-computing",
        title: "Mathematical Foundations of Quantum Computing",
        date: "2025-07-02",
        category: "technology",
        tags: ["quantum computing", "mathematics", "physics"],
        excerpt: "Exploring the linear algebra and complex number theory behind quantum computing, from Hilbert spaces to quantum gate operations.",
        mathPreview: "$$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$$ where $$|\\alpha|^2 + |\\beta|^2 = 1$$",
        content: {
            file: "articles/quantum-computing.html",
            hasLaTeX: true
        }
    }
];

// 文章工具函数
const ArticleUtils = {
    // 根据ID获取文章
    getById: (id) => {
        return ARTICLES_DATA.find(article => article.id === id);
    },
    
    // 根据分类获取文章
    getByCategory: (category) => {
        return ARTICLES_DATA.filter(article => article.category === category);
    },
    
    // 根据标签获取文章
    getByTag: (tag) => {
        return ARTICLES_DATA.filter(article => 
            article.tags.includes(tag)
        );
    },
    
    // 获取所有分类
    getAllCategories: () => {
        return [...new Set(ARTICLES_DATA.map(article => article.category))];
    },
    
    // 获取所有标签
    getAllTags: () => {
        const allTags = ARTICLES_DATA.flatMap(article => article.tags);
        return [...new Set(allTags)];
    },
    
    // 格式化日期
    formatDate: (dateString) => {
        try {
            // 确保日期字符串格式正确
            const date = new Date(dateString);
            
            // 检查日期是否有效
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', dateString);
                return 'INVALID DATE';
            }
            
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: '2-digit',
                timeZone: 'UTC'  // 使用UTC避免时区问题
            };
            
            return date.toLocaleDateString('en-US', options).toUpperCase();
        } catch (error) {
            console.error('Date formatting error:', error, dateString);
            return 'DATE ERROR';
        }
    },
    
    // 搜索文章
    search: (query) => {
        const lowerQuery = query.toLowerCase();
        return ARTICLES_DATA.filter(article => 
            article.title.toLowerCase().includes(lowerQuery) ||
            article.excerpt.toLowerCase().includes(lowerQuery) ||
            article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }
};

// 动态文章加载器
const ArticleLoader = {
    // 侦测分支（优先 main，fallback master）
    detectBranch: async (owner, repo) => {
        const tryBranch = async (branch) => {
            const url = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
            return res.ok ? branch : null;
        };
        try {
            const main = await tryBranch('main');
            if (main) return main;
            const master = await tryBranch('master');
            if (master) return master;
        } catch (e) {
            console.warn('Branch detect failed, default to main:', e);
        }
        return 'main';
    },

    // 从 HTML 文本中解析元数据
    parseArticleMetadata: (htmlText, filePath) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            // 标题：优先 h1.article-title，其次 <title> 去掉站点后缀
            let title = doc.querySelector('h1.article-title')?.textContent?.trim();
            if (!title) {
                const rawTitle = doc.querySelector('title')?.textContent || '';
                title = rawTitle.split(' - ')[0].trim() || filePath.split('/').pop().replace(/\.html$/i, '');
            }

            // 日期：优先 meta[name="article:date"], 其次从 .article-meta 中解析常见格式，最后留空
            let date = doc.querySelector('meta[name="article:date"]')?.getAttribute('content') || '';
            if (!date) {
                const metaText = doc.querySelector('.article-meta')?.textContent || '';
                const match = metaText.match(/([A-Za-z]+\s+\d{1,2},\s*\d{4})/); // e.g., July 4, 2025
                if (match) date = match[1];
            }

            // 摘要：取正文第一个 <p>
            let excerpt = doc.querySelector('main p')?.textContent?.trim() || '';
            const limit = (SITE_CONFIG?.articles?.excerptLength) || 150;
            if (excerpt.length > limit) excerpt = excerpt.slice(0, limit) + '…';

            return { title, date, excerpt };
        } catch (e) {
            console.warn('Parse metadata failed for', filePath, e);
            return { title: filePath.split('/').pop(), date: '', excerpt: '' };
        }
    },

    // 获取单个文件的最近提交日期作为备用日期
    fetchCommitDate: async (owner, repo, branch, path) => {
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=1`;
            const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
            if (!res.ok) return '';
            const data = await res.json();
            const iso = data?.[0]?.commit?.author?.date;
            return iso ? new Date(iso).toISOString().slice(0, 10) : '';
        } catch {
            return '';
        }
    },

    // 加载文章列表
    load: async () => {
        // 允许通过 SITE_CONFIG.repo 覆盖
        const owner = (SITE_CONFIG?.repo?.owner) || 'euphoriaYu';
        const repo = (SITE_CONFIG?.repo?.name) || 'YuEugenio-Blog';
        const branch = (SITE_CONFIG?.repo?.branch) || await ArticleLoader.detectBranch(owner, repo);

        try {
            // 列出 articles 目录
            const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/articles?ref=${encodeURIComponent(branch)}`;
            const res = await fetch(listUrl, { headers: { 'Accept': 'application/vnd.github+json' } });
            if (!res.ok) throw new Error(`List contents failed: ${res.status}`);
            const items = await res.json();

            const htmlFiles = (items || []).filter(it => it.type === 'file' && /\.html?$/i.test(it.name));

            // 并行抓取每个页面以解析标题/摘要；日期缺失时回退到 commit 日期
            const articles = await Promise.all(htmlFiles.map(async (it) => {
                const path = `articles/${it.name}`;
                // 从站点同源读取 HTML 内容以便解析
                let title = '', date = '', excerpt = '';
                try {
                    const pageRes = await fetch(`${path}?v=${Date.now()}`);
                    if (pageRes.ok) {
                        const htmlText = await pageRes.text();
                        const meta = ArticleLoader.parseArticleMetadata(htmlText, path);
                        title = meta.title;
                        date = meta.date;
                        excerpt = meta.excerpt;
                    }
                } catch {}

                if (!date) {
                    date = await ArticleLoader.fetchCommitDate(owner, repo, branch, path);
                }

                const id = it.name.replace(/\.html?$/i, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');

                return {
                    id,
                    title: title || it.name.replace(/\.html?$/i, ''),
                    date: date || '',
                    category: '',
                    tags: [],
                    excerpt: excerpt || '',
                    mathPreview: null,
                    content: { file: path, hasLaTeX: true }
                };
            }));

            // 排序：按日期降序（未知日期排后）
            const toDate = (d) => {
                const dt = new Date(d);
                return isNaN(dt.getTime()) ? 0 : dt.getTime();
            };
            articles.sort((a, b) => toDate(b.date) - toDate(a.date));

            return articles;
        } catch (e) {
            console.warn('Dynamic load failed, fallback to static ARTICLES_DATA:', e);
            return ARTICLES_DATA;
        }
    }
};

// 导出数据（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARTICLES_DATA, ArticleUtils, ArticleLoader };
}