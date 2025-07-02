// 网站配置
const SITE_CONFIG = {
    // 网站基本信息
    title: "YuEugenio's Blog",
    author: "YuEugenio",
    description: "Hello, my name is YuEugenio and I write about technology, mathematics and life.",
    
    // 网站设置
    settings: {
        enableLaTeX: true,
        animationDuration: 300
    },
    
    // 文章设置
    articles: {
        dateFormat: "MMM DD, YYYY",
        excerptLength: 150,
        showMathPreview: true
    }
};

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
} 