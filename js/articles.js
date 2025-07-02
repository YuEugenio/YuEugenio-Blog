// 文章数据
const ARTICLES_DATA = [
    {
        id: "quantum-computing",
        title: "Mathematical Foundations of Quantum Computing",
        date: "2025-07-02",
        category: "technology",
        tags: ["quantum computing", "mathematics", "physics"],
        excerpt: "Exploring the linear algebra and complex number theory behind quantum computing, from Hilbert spaces to quantum gate operations.",
        mathPreview: "$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$ where $|\\alpha|^2 + |\\beta|^2 = 1$",
        content: {
            file: "articles/quantum-computing.html",
            hasLaTeX: true
        }
    },
    {
        id: "machine-learning",
        title: "Optimization Algorithms in Deep Learning",
        date: "2025-07-02",
        category: "technology",
        tags: ["machine learning", "optimization", "deep learning"],
        excerpt: "From gradient descent to Adam optimizers, understanding the mathematical principles behind neural network training.",
        mathPreview: "$\\theta_{t+1} = \\theta_t - \\frac{\\eta}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t$",
        content: {
            file: "articles/machine-learning.html",
            hasLaTeX: true
        }
    },
    {
        id: "algorithms",
        title: "The Art of Dynamic Programming",
        date: "2025-07-02",
        category: "technology",
        tags: ["algorithms", "dynamic programming", "programming"],
        excerpt: "Understanding the essence of dynamic programming through classic problems, from Fibonacci sequence to longest common subsequence.",
        mathPreview: "$dp[i][j] = \\max(dp[i-1][j], dp[i][j-1])$",
        content: {
            file: "articles/algorithms.html",
            hasLaTeX: true
        }
    },
    {
        id: "philosophy",
        title: "Dialogue Between Technology and Humanities",
        date: "2025-07-02",
        category: "philosophy",
        tags: ["philosophy", "technology", "humanities"],
        excerpt: "In an era of rapid technological development, how do we maintain our pursuit of humanistic thinking and values.",
        mathPreview: null,
        content: {
            file: "articles/philosophy.html",
            hasLaTeX: false
        }
    },
    {
        id: "life-reflections",
        title: "Thoughts Beyond Code",
        date: "2025-07-02",
        category: "life",
        tags: ["life", "reflections", "programming"],
        excerpt: "Bits and pieces of a programmer's life, from debugging to life insights and random thoughts.",
        mathPreview: null,
        content: {
            file: "articles/life-reflections.html",
            hasLaTeX: false
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
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
        }).toUpperCase();
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

// 导出数据（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARTICLES_DATA, ArticleUtils };
} 