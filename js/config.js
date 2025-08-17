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
    },

    // 仓库设置（可选）：用于动态扫描文章目录
    // 如果不配置，将使用默认值 euphoriaYu/YuEugenio-Blog 和 main/master 自动探测
    repo: {
        owner: "YuEugenio",
        name: "YuEugenio-Blog",
        // 留空表示自动探测 main/master；也可显式指定，如 "main" 或 "master"
        branch: ""
    }
};

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
} 