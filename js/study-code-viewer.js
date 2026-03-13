(function() {
    const configElement = document.getElementById('study-page-config');
    if (!configElement) return;

    let config = null;
    try {
        config = JSON.parse(configElement.textContent);
    } catch (error) {
        console.error('Invalid study page config:', error);
        return;
    }

    const container = document.getElementById(config.containerId || 'study-sources');
    if (!container) return;

    const lang = config.lang === 'cn' ? 'cn' : 'en';
    const labels = {
        loading: lang === 'cn' ? '正在加载完整代码…' : 'Loading full source code…',
        open: lang === 'cn' ? '在 GitHub 中打开' : 'Open on GitHub',
        file: lang === 'cn' ? '文件路径：' : 'File path: ',
        script: lang === 'cn' ? '完整源码' : 'Full Source',
        codeCell: lang === 'cn' ? '代码单元' : 'Code Cell',
        empty: lang === 'cn' ? '该文件中没有可展示的代码。' : 'No code found in this file.',
        errorPrefix: lang === 'cn' ? '加载失败：' : 'Failed to load: '
    };

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (typeof text === 'string') element.textContent = text;
        return element;
    }

    function encodePath(path) {
        return String(path || '')
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
    }

    function getSourceContext(source) {
        return {
            owner: source.owner || config.owner || 'YuEugenio',
            repo: source.repo || config.repo || 'Agent-Studies',
            branch: source.branch || config.branch || 'main',
            path: source.path
        };
    }

    function buildRawUrl(source) {
        const ctx = getSourceContext(source);
        return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.branch}/${encodePath(ctx.path)}`;
    }

    function buildGithubUrl(source) {
        const ctx = getSourceContext(source);
        return `https://github.com/${ctx.owner}/${ctx.repo}/blob/${ctx.branch}/${encodePath(ctx.path)}`;
    }

    function detectType(source) {
        if (source.type) return source.type;
        return String(source.path || '').toLowerCase().endsWith('.ipynb') ? 'notebook' : 'script';
    }

    function createCodeBlock(codeText) {
        const pre = createElement('pre', 'code-block');
        const code = document.createElement('code');
        code.textContent = codeText;
        pre.appendChild(code);
        return pre;
    }

    function createSectionHeader(source) {
        const header = createElement('div', 'source-header');
        const titleRow = createElement('div', 'source-title-row');
        const title = createElement('h3', 'source-title', source.title || source.path || '');
        const link = createElement('a', 'source-link', labels.open);
        link.href = buildGithubUrl(source);
        link.target = '_blank';
        link.rel = 'noreferrer';
        titleRow.appendChild(title);
        titleRow.appendChild(link);
        header.appendChild(titleRow);

        const meta = createElement('div', 'source-meta', `${labels.file}${source.path}`);
        header.appendChild(meta);

        if (source.description) {
            header.appendChild(createElement('p', 'source-desc', source.description));
        }

        return header;
    }

    function renderScriptSection(source, text) {
        const section = createElement('section', 'source-section');
        section.appendChild(createSectionHeader(source));
        section.appendChild(createElement('div', 'cell-label', labels.script));
        section.appendChild(createCodeBlock(text));
        return section;
    }

    function renderNotebookSection(source, text) {
        const section = createElement('section', 'source-section');
        section.appendChild(createSectionHeader(source));

        let notebook = null;
        try {
            notebook = JSON.parse(text);
        } catch (error) {
            section.appendChild(createElement('div', 'error-box', `${labels.errorPrefix}${source.path}`));
            return section;
        }

        const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
        const codeCells = cells.filter((cell) => {
            if (cell.cell_type !== 'code') return false;
            const sourceText = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '');
            return sourceText.trim().length > 0;
        });

        if (!codeCells.length) {
            section.appendChild(createElement('div', 'empty-box', labels.empty));
            return section;
        }

        codeCells.forEach((cell, index) => {
            const block = createElement('div', 'cell-block');
            block.appendChild(createElement('div', 'cell-label', `${labels.codeCell} ${index + 1}`));
            const sourceText = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '');
            block.appendChild(createCodeBlock(sourceText));
            section.appendChild(block);
        });

        return section;
    }

    async function fetchAndRenderSource(source) {
        const response = await fetch(buildRawUrl(source));
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        return detectType(source) === 'notebook'
            ? renderNotebookSection(source, text)
            : renderScriptSection(source, text);
    }

    async function init() {
        container.innerHTML = '';
        container.appendChild(createElement('div', 'loading-box', labels.loading));

        const sources = Array.isArray(config.sources) ? config.sources : [];
        const renderedSections = await Promise.all(sources.map(async (source) => {
            try {
                return await fetchAndRenderSource(source);
            } catch (error) {
                const section = createElement('section', 'source-section');
                section.appendChild(createSectionHeader(source));
                section.appendChild(createElement('div', 'error-box', `${labels.errorPrefix}${source.path}`));
                console.error('Study source load failed:', source.path, error);
                return section;
            }
        }));

        container.innerHTML = '';
        renderedSections.forEach((section) => container.appendChild(section));
    }

    init();
})();
