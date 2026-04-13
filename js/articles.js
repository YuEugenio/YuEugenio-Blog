// 文章数据
const ARTICLES_DATA = [
    {
        id: "ai-arts-project-brief",
        title: {
            en: "AIGC Art Portfolio",
            cn: "AIGC 艺术作品集"
        },
        date: "2026-04-12",
        category: "project-briefing",
        section: "project-briefing",
        tags: ["aigc", "ai art", "visual creation", "character series", "project showcase"],
        excerpt: {
            en: "I want to be an artist too.",
            cn: "我也想当艺术家呢"
        },
        mathPreview: null,
        content: {
            file: "articles/AI-Arts-Project-Brief.html",
            fileEn: "articles/AI-Arts-Project-Brief.html",
            fileCn: "pages/ai-arts-project-brief-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "pes-multi-task-classification-project-brief",
        title: {
            en: "PES Multi-Task Classification: A Project Brief",
            cn: "本科毕业设计：PES 多任务分类框架"
        },
        date: "2026-03-14",
        category: "project-briefing",
        section: "project-briefing",
        tags: ["undergraduate thesis", "medical ai", "multi-task learning", "clip", "lora"],
        excerpt: {
            en: "A compact introduction to my undergraduate thesis project: a modular PES multi-task classification framework with architecture search and LoRA refinement.",
            cn: "对我的本科毕业设计做一个整体介绍：一个面向 PES 自动评估的多任务分类框架，包含架构搜索与 LoRA 微调搜索。"
        },
        mathPreview: null,
        content: {
            file: "articles/PES-Multi-Task-Classification-Project-Brief.html",
            fileEn: "articles/PES-Multi-Task-Classification-Project-Brief.html",
            fileCn: "pages/pes-multi-task-classification-project-brief-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "cybersoul-product-brief",
        title: {
            en: "Cybersoul: A Product Brief",
            cn: "Cybersoul：产品简报"
        },
        date: "2026-03-13",
        category: "project-briefing",
        section: "project-briefing",
        tags: ["companion ai", "agent", "cyber world", "fastapi", "world model"],
        excerpt: {
            en: "A runtime-focused brief on Cybersoul: a world-driven companion system built to test continuous presence, memory accumulation, and observability.",
            cn: "一篇围绕运行时对象展开的 Cybersoul 简报，重点说明持续存在、记忆累积与可观察性如何在 CyberWorld demo 中成立。"
        },
        mathPreview: null,
        content: {
            file: "articles/Cybersoul-Product-Brief.html",
            fileEn: "articles/Cybersoul-Product-Brief.html",
            fileCn: "pages/cybersoul-product-brief-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "greenforest-rag-project-brief",
        title: {
            en: "GreenForest_RAG: A Project Brief",
            cn: "GreenForest_RAG：项目简报"
        },
        date: "2026-03-13",
        category: "project-briefing",
        section: "project-briefing",
        tags: ["rag", "langchain", "chroma", "retrieval", "knowledge base"],
        excerpt: {
            en: "A compact brief on GreenForest_RAG, showing how mixed local documents are reorganized into a grounded retrieval-and-answer workflow.",
            cn: "一篇关于 GreenForest_RAG 的紧凑简报，说明混合本地资料如何被整理成可追溯的检索问答链路。"
        },
        mathPreview: null,
        content: {
            file: "articles/GreenForest-RAG-Project-Brief.html",
            fileEn: "articles/GreenForest-RAG-Project-Brief.html",
            fileCn: "pages/greenforest-rag-project-brief-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "from-image-generator-to-artistic-creator",
        title: {
            en: "From Image Generator to Artistic Creator: A Survey of Pretraining, Supervised Fine-Tuning, and Reinforcement Alignment for Anime and Fine-Grained Style Generation",
            cn: "AIGC：如何从“图像生成器”走向“艺术创作家”？——面向动漫与高细粒度风格生成的预训练、监督微调与强化对齐研究综述"
        },
        date: "2026-03-10",
        category: "tech-insights",
        section: "tech-insights",
        tags: ["aigc", "text-to-image", "anime", "diffusion models", "lora", "reinforcement learning"],
        excerpt: {
            en: "A survey of how AIGC can move from generic image synthesis toward artist-like creation in anime and fine-grained style generation through pretraining, SFT, and RL alignment.",
            cn: "综述 AIGC 如何通过预训练、监督微调与强化对齐，从通用图像生成走向动漫与高细粒度风格下更接近艺术创作主体的生成范式。"
        },
        mathPreview: null,
        content: {
            file: "articles/From-Image-Generator-to-Artistic-Creator.html",
            fileEn: "articles/From-Image-Generator-to-Artistic-Creator.html",
            fileCn: "pages/from-image-generator-to-artistic-creator-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "langchain-learning-notes",
        title: {
            en: "LangChain Learning Notes",
            cn: "LangChain 学习笔记"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["langchain", "langgraph", "workflow", "llm apps"],
        excerpt: {
            en: "Workflow-oriented notes on LangChain and LangGraph, with emphasis on explicit nodes, state flow, retrieval, and tool orchestration.",
            cn: "一篇面向工作流编排的 LangChain 学习笔记，重点讨论节点、状态流、检索与工具连接。"
        },
        mathPreview: null,
        content: {
            file: "articles/LangChain-Learning-Notes.html",
            fileEn: "articles/LangChain-Learning-Notes.html",
            fileCn: "pages/langchain-learning-notes-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "python-basics-learning-notes",
        title: {
            en: "Python Basics Learning Notes",
            cn: "Python 基础学习笔记"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["python", "functions", "classes", "numpy"],
        excerpt: {
            en: "A structured Python foundation note covering syntax, control flow, functions, classes, and NumPy as the base of later AI scripts.",
            cn: "一篇结构化的 Python 基础笔记，围绕语法、控制流、函数、类与 NumPy 搭建后续 AI 脚本底座。"
        },
        mathPreview: null,
        content: {
            file: "articles/Python-Basics-Learning-Notes.html",
            fileEn: "articles/Python-Basics-Learning-Notes.html",
            fileCn: "pages/python-basics-learning-notes-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "openai-api-learning-notes",
        title: {
            en: "OpenAI API Learning Notes",
            cn: "OpenAI API 学习笔记"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["openai api", "streaming", "multimodal", "async"],
        excerpt: {
            en: "Interface-focused notes on message design, streaming, async requests, multimodal input, and state handling in model applications.",
            cn: "一篇围绕消息设计、流式输出、异步请求、多模态输入与状态管理展开的接口层学习笔记。"
        },
        mathPreview: null,
        content: {
            file: "articles/OpenAI-API-Learning-Notes.html",
            fileEn: "articles/OpenAI-API-Learning-Notes.html",
            fileCn: "pages/openai-api-learning-notes-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "semantic-search-learning-notes",
        title: {
            en: "Semantic Search Learning Notes",
            cn: "语义搜索学习笔记"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["semantic search", "embeddings", "vector store", "rag"],
        excerpt: {
            en: "A pipeline-oriented note on semantic search, from document ingestion and chunking to vector recall and minimal RAG.",
            cn: "一篇面向检索流水线的语义搜索笔记，从文档导入、切块到向量召回与最小 RAG。"
        },
        mathPreview: null,
        content: {
            file: "articles/Semantic-Search-Learning-Notes.html",
            fileEn: "articles/Semantic-Search-Learning-Notes.html",
            fileCn: "pages/semantic-search-learning-notes-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "agent-basics-and-demos",
        title: {
            en: "Agent Basics and Demos",
            cn: "Agent 基础与 Demo"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["agent", "react", "tools", "workflow"],
        excerpt: {
            en: "Agent notes centered on explicit execution loops, tool calls, observations, and why control logic matters more than prompt size.",
            cn: "一篇围绕显式执行回路、工具调用与观察写回展开的 Agent 笔记，重点说明控制逻辑的重要性。"
        },
        mathPreview: null,
        content: {
            file: "articles/Agent-Basics-and-Demos.html",
            fileEn: "articles/Agent-Basics-and-Demos.html",
            fileCn: "pages/agent-basics-and-demos-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "attention-mechanism-learning-notes",
        title: {
            en: "Attention Mechanism Learning Notes",
            cn: "注意力机制学习笔记"
        },
        date: "2026-03-13",
        category: "studies",
        section: "studies",
        tags: ["attention", "transformer", "llm", "deep learning"],
        excerpt: {
            en: "A structured note on attention, from token-relation modeling and multi-head attention to the full Transformer block.",
            cn: "一篇结构化的注意力机制笔记，从 token 关系建模、多头注意力一直推进到完整 Transformer block。"
        },
        mathPreview: null,
        content: {
            file: "articles/Attention-Mechanism-Learning-Notes.html",
            fileEn: "articles/Attention-Mechanism-Learning-Notes.html",
            fileCn: "pages/attention-mechanism-learning-notes-cn.html",
            hasLaTeX: false
        }
    },
    {
        id: "circuit-variables",
        title: "Circuit Variables Fundamentals",
        date: "2025-07-04",
        category: "studies",
        section: "studies",
        tags: ["circuit analysis", "electrical engineering", "mathematics", "ohm's law"],
        excerpt: "Exploring the four fundamental variables in circuits: voltage, current, resistance, and power, along with their mathematical relationships. From Ohm's Law to Kirchhoff's Laws, master the foundations of circuit analysis.",
        mathPreview: "$v = iR$ and $p = vi = \\frac{v^2}{R} = i^2R$",
        content: {
            file: "articles/Circuit-Variables.html",
            hasLaTeX: true
        }
    },
    {
        id: "circuit-elements",
        title: "Chapter 2: Circuit Elements",
        date: "2025-08-17",
        category: "studies",
        section: "studies",
        tags: ["circuit elements", "electrical engineering", "kcl", "kvl"],
        excerpt: "A structured note on ideal sources, resistance, Ohm's law, and Kirchhoff's laws, with worked examples and annotated figures.",
        mathPreview: "$v = iR$ and $\\sum v = 0,\\ \\sum i = 0$",
        content: {
            file: "articles/Circuit-Elements.html",
            hasLaTeX: true
        }
    },
    {
        id: "simple-resistive-circuits",
        title: "Simple Resistive Circuits",
        date: "2025-08-17",
        category: "studies",
        section: "studies",
        tags: ["resistors", "voltage divider", "current divider", "wheatstone bridge"],
        excerpt: "Consolidated notes on series/parallel resistors, divider rules, and equivalent circuit transformations for resistive analysis.",
        mathPreview: "$R_{eq}=\\sum R_i$ and $\\frac{1}{R_{eq}}=\\sum\\frac{1}{R_i}$",
        content: {
            file: "articles/Simple-Resistive-Circuits.html",
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
    resolveSitePath: (path) => {
        if (!path) return '';
        if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;

        const basePath = document.body?.dataset?.basePath || '';
        return `${basePath}${path}`;
    },

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

            // 分类：优先 meta[name=\"article:section\"]
            const section = doc.querySelector('meta[name=\"article:section\"]')?.getAttribute('content') || '';

            return { title, date, excerpt, section };
        } catch (e) {
            console.warn('Parse metadata failed for', filePath, e);
            return { title: filePath.split('/').pop(), date: '', excerpt: '', section: '' };
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
                let title = '', date = '', excerpt = '', section = '';
                try {
                    const resolvedPath = ArticleLoader.resolveSitePath(path);
                    const pageRes = await fetch(`${resolvedPath}?v=${Date.now()}`);
                    if (pageRes.ok) {
                        const htmlText = await pageRes.text();
                        const meta = ArticleLoader.parseArticleMetadata(htmlText, path);
                        title = meta.title;
                        date = meta.date;
                        excerpt = meta.excerpt;
                        section = meta.section;
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
                    category: section || '',
                    section: section || '',
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
