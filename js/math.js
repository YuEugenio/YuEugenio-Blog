// MathJax 配置
const MATH_CONFIG = {
    // MathJax 配置
    config: {
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            processEnvironments: true,
            tags: 'ams'
        },
        options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
            ignoreHtmlClass: 'tex2jax_ignore',
            processHtmlClass: 'tex2jax_process'
        },
        startup: {
            ready: () => {
                MathJax.startup.defaultReady();
            }
        }
    },
    
    // CDN 链接
    cdn: {
        polyfill: 'https://polyfill.io/v3/polyfill.min.js?features=es6',
        mathjax: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
    }
};

// 数学工具函数
const MathUtils = {
    rerender: () => {
        try {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                return MathJax.typesetPromise();
            }
        } catch (error) {
            console.warn('MathJax rerender failed:', error);
        }
        return Promise.resolve();
    },
    hasMath: (text) => {
        const patterns = [
            /\$[^$]+\$/,
            /\$\$[^$]+\$\$/,
            /\\\([^)]+\\\)/,
            /\\\[[^\]]+\\\]/
        ];
        return patterns.some(pattern => pattern.test(text));
    },
    formatPreview: (mathText) => {
        if (!mathText) return '';
        if (!mathText.startsWith('$') && !mathText.startsWith('\\(')) {
            return `$${mathText}$`;
        }
        return mathText;
    }
};

// 动态加载 MathJax
const loadMathJax = () => {
    return new Promise((resolve, reject) => {
        if (typeof MathJax !== 'undefined') {
            resolve();
            return;
        }
        
        // 设置超时时间
        const timeout = setTimeout(() => {
            reject(new Error('MathJax loading timeout'));
        }, 10000); // 10秒超时
        
        // 加载 polyfill
        const polyfillScript = document.createElement('script');
        polyfillScript.src = MATH_CONFIG.cdn.polyfill;
        polyfillScript.onload = () => {
            // 设置 MathJax 配置
            window.MathJax = MATH_CONFIG.config;
            
            // 加载 MathJax
            const mathjaxScript = document.createElement('script');
            mathjaxScript.src = MATH_CONFIG.cdn.mathjax;
            mathjaxScript.async = true;
            mathjaxScript.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            mathjaxScript.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Failed to load MathJax script'));
            };
            document.head.appendChild(mathjaxScript);
        };
        polyfillScript.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load polyfill script'));
        };
        document.head.appendChild(polyfillScript);
    });
};

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MathUtils };
} 