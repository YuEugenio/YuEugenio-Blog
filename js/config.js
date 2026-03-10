// 网站配置
const SITE_CONFIG = {
    // 网站基本信息
    title: "YuEugenio's Blog",
    author: "YuEugenio",
    description: "Hello, my name is YuEugenio and I write about technology, mathematics and life.",
    descriptionCN: "你好，我是 YuEugenio。我会在这里分享技术、学科知识与生活思考。",

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
    },

    // 首页导航
    navigation: [
        {
            id: "about-me",
            title: { en: "About Me", cn: "关于我" },
            excerpt: {
                en: "A dedicated profile page with my personality, education, and project journey.",
                cn: "独立个人页：用于展示性格、教育背景和项目经历。"
            },
            href: "pages/about-me.html"
        },
        {
            id: "project-briefing",
            title: { en: "Project Briefing", cn: "项目简报" },
            excerpt: {
                en: "A categorized feed for project-oriented briefs and practical summaries.",
                cn: "项目导向内容入口：用于发布项目简报和实践总结。"
            },
            href: "pages/project-briefing.html"
        },
        {
            id: "tech-insights",
            title: { en: "Tech Insights", cn: "技术洞察" },
            excerpt: {
                en: "A dedicated stream for technical observations, ideas, and takeaways.",
                cn: "技术观察入口：用于沉淀技术洞察、观点与方法。"
            },
            href: "pages/tech-insights.html"
        },
        {
            id: "studies",
            title: { en: "Studies", cn: "学科学习" },
            excerpt: {
                en: "Subject learning notes and knowledge-structure oriented writeups.",
                cn: "学科学习入口：用于整理课程学习与知识体系化笔记。"
            },
            href: "pages/studies.html"
        }
    ],

    // 分栏页面配置
    sections: {
        "project-briefing": {
            emptyText: {
                en: "No project briefs yet.",
                cn: "暂时还没有项目简报。"
            }
        },
        "tech-insights": {
            emptyText: {
                en: "No tech insights yet.",
                cn: "暂时还没有技术洞察文章。"
            }
        },
        "studies": {
            emptyText: {
                en: "No study notes yet.",
                cn: "暂时还没有学习笔记。"
            }
        }
    },

    // 文章分类映射（缺省时会回落到 studies）
    articleSectionMap: {
        "circuit-variables": "studies",
        "circuit-elements": "studies",
        "simple-resistive-circuits": "studies",
        "from-image-generator-to-artistic-creator": "tech-insights"
    },

    i18n: {
        defaultLanguage: "en",
        storageKey: "site-language",
        labels: {
            loadingArticles: { en: "Loading articles...", cn: "正在加载文章..." },
            loadingNavigation: { en: "Loading navigation...", cn: "正在加载导航..." },
            emptySectionDefault: { en: "No content yet.", cn: "暂时还没有内容。" }
        }
    }
};

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
}
