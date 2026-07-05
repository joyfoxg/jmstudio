class UndoManager {
            constructor(textarea) {
                this.textarea = textarea;
                this.history = [];
                this.currentIndex = -1;
                this.maxHistory = 100;
                this.isUndoRedoAction = false;
            }
            
            saveState() {
                if (this.isUndoRedoAction) return;
                
                const value = this.textarea.value;
                const selStart = this.textarea.selectionStart;
                const selEnd = this.textarea.selectionEnd;
                
                if (this.currentIndex >= 0 && this.history[this.currentIndex].value === value) {
                    return;
                }
                
                this.history = this.history.slice(0, this.currentIndex + 1);
                this.history.push({ value, selStart, selEnd });
                
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                }
                this.currentIndex = this.history.length - 1;
            }
            
            undo() {
                if (this.currentIndex > 0) {
                    this.currentIndex--;
                    this.restoreState();
                    return true;
                }
                return false;
            }
            
            redo() {
                if (this.currentIndex < this.history.length - 1) {
                    this.currentIndex++;
                    this.restoreState();
                    return true;
                }
                return false;
            }
            
            restoreState() {
                this.isUndoRedoAction = true;
                const state = this.history[this.currentIndex];
                this.textarea.value = state.value;
                this.textarea.selectionStart = state.selStart;
                this.textarea.selectionEnd = state.selEnd;
                this.textarea.focus();
                
                // 에디터 변경 리프레시
                updateLineNumbers();
                syncGutterScroll();
                triggerLiveRender();
                
                this.isUndoRedoAction = false;
            }
        }

        window.undoManager = null;
        let currentFilePath = "";
        let fileHistory = [];
        let fileHistoryIndex = -1;
        let isNavigatingHistory = false;
        let activeDocumentTags = []; // 현재 열린 문서의 해시태그 상태

        function updateNavigationButtons() {
            const backBtns = [document.getElementById('btn-nav-back'), document.getElementById('btn-preview-nav-back')];
            const forwardBtns = [document.getElementById('btn-nav-forward'), document.getElementById('btn-preview-nav-forward')];
            
            backBtns.forEach(backBtn => {
                if (!backBtn) return;
                backBtn.disabled = (fileHistoryIndex <= 0);
            });
            
            forwardBtns.forEach(forwardBtn => {
                if (!forwardBtn) return;
                forwardBtn.disabled = (fileHistoryIndex >= fileHistory.length - 1);
            });
        }

        async function navigateHistory(direction) {
            const newIndex = fileHistoryIndex + direction;
            if (newIndex >= 0 && newIndex < fileHistory.length) {
                isNavigatingHistory = true;
                fileHistoryIndex = newIndex;
                await openFile(fileHistory[fileHistoryIndex]);
                isNavigatingHistory = false;
                updateNavigationButtons();
            }
        }

        let currentViewMode = "split";
        let currentTheme = "dark";
        let currentLang = "ko";
        let localFiles = [];
        let currentFilesData = null;
        let pendingDeletePath = "";
        let isSyncScrolling = true;
        let renderTimeout;
        let isCreatingType = "file"; // 'file' or 'folder'
        let workspaceRoot = "";
        let currentNetworkConfig = { bind_ip: '0.0.0.0', port: 58220, access_password: '', local_ip: '127.0.0.1' };
        let currentFontConfig = { ui_font: 'Inter', editor_font: 'Fira Code', editor_font_size: 14 };

        function applyFontSettings(uiFont, editorFont, editorSize) {
            currentFontConfig.ui_font = uiFont || 'Inter';
            currentFontConfig.editor_font = editorFont || 'Fira Code';
            currentFontConfig.editor_font_size = parseInt(editorSize) || 14;

            let styleTag = document.getElementById('custom-font-settings');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'custom-font-settings';
                document.head.appendChild(styleTag);
            }

            let uiFontFamily = currentFontConfig.ui_font;
            if (uiFontFamily !== 'sans-serif' && uiFontFamily !== 'system-ui') {
                uiFontFamily = `"${uiFontFamily}"`;
            }

            let editorFontFamily = currentFontConfig.editor_font;
            if (editorFontFamily !== 'monospace') {
                editorFontFamily = `"${editorFontFamily}"`;
            }

            styleTag.textContent = `
                body, button, input, select, textarea {
                    font-family: ${uiFontFamily}, sans-serif !important;
                }
                .cm-editor, .cm-scroller, .cm-gutters, pre, code {
                    font-family: ${editorFontFamily}, monospace !important;
                }
                .cm-editor, .cm-editor .cm-scroller, .cm-editor .cm-gutters {
                    font-size: ${currentFontConfig.editor_font_size}px !important;
                }
            `;
        }


        function t(key) {
            if (translations[currentLang] && translations[currentLang][key]) {
                return translations[currentLang][key];
            }
            if (translations["en"] && translations["en"][key]) {
                return translations["en"][key];
            }
            return key;
        }

        function setLanguage(lang, saveConfig = true) {
            currentLang = lang;
            window.currentLang = lang;
            const body = document.body;
            
            if (lang === 'en') {
                body.classList.remove('lang-ko');
                body.classList.add('lang-en');
            } else {
                body.classList.remove('lang-en');
                body.classList.add('lang-ko');
            }
            
            // 1. data-i18n
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    const icon = el.querySelector('i[data-lucide]');
                    const svg = el.querySelector('svg');
                    
                    if (icon || svg) {
                        const iconHtml = icon ? icon.outerHTML : (svg ? svg.outerHTML : "");
                        el.innerHTML = iconHtml + ` <span>${translations[lang][key]}</span>`;
                    } else {
                        el.innerText = translations[lang][key];
                    }
                }
            });
            
            // 2. data-i18n-title
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (translations[lang] && translations[lang][key]) {
                    el.setAttribute('title', translations[lang][key]);
                }
            });
            
            // 3. data-i18n-placeholder
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[lang] && translations[lang][key]) {
                    el.setAttribute('placeholder', translations[lang][key]);
                }
            });
            
            // 4. Update editor placeholder
            if (window.cmEditor && window.cmPlaceholderConf && window.cm6) {
                window.cmEditor.dispatch({
                    effects: window.cmPlaceholderConf.reconfigure(window.cm6.placeholder(t('msg_editor_placeholder')))
                });
            }
            
            // 5. Update active file title if it says "선택된 파일 없음" or similar
            const titleEl = document.getElementById('active-file-title');
            if (titleEl && (!currentFilePath || titleEl.innerText === translations['ko']['msg_no_active_file'] || titleEl.innerText === translations['en']['msg_no_active_file'])) {
                titleEl.innerText = t('msg_no_active_file');
            }
            
            // 6. Update empty state if empty
            const previewContent = document.getElementById('preview-content');
            const editorVal = getEditorContent();
            if (previewContent && !editorVal.trim()) {
                previewContent.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                        <div style="font-size: 1.1em; font-weight: 500;">${t('empty_no_file')}</div>
                        <div style="font-size: 0.85em; opacity: 0.8;">${t('empty_no_file_desc')}</div>
                    </div>
                `;
                lucide.createIcons();
                if (typeof generateTOC === 'function') {
                    generateTOC(previewContent);
                }
            }
            // 이모지 피커 다국어 로케일 동기화 (재렌더링 - 상태 인자 명시 주입)
            if (window.renderEmojiPicker) {
                window.renderEmojiPicker(true, currentTheme, currentLang);
            }
            
            lucide.createIcons();
            
            if (typeof window.renderTemplates === 'function') {
                window.renderTemplates();
            }
            
            // 수식 카테고리 셀렉트 다국어 업데이트
            const activeSubtab = document.querySelector('.math-subtab-btn.active');
            if (activeSubtab && typeof updateMathCategorySelect === 'function') {
                const subtabId = activeSubtab.id.replace('subtab-math-', '');
                updateMathCategorySelect(subtabId);
            }
            
            // 7. Update heading button text based on active level
            const btnText = document.getElementById('heading-btn-text');
            if (btnText) {
                const activeLevel = btnText.getAttribute('data-active-level') || '0';
                btnText.innerText = activeLevel === '0' ? t('heading_p') : t('heading_h' + activeLevel);
            }
            
            // 8. Re-render file tree to apply translations to delete button titles or "No files found" message
            if (typeof renderFileTree === 'function' && currentFilesData !== null) {
                renderFileTree(currentFilesData);
            }
            
            if (window.pywebview && saveConfig) {
                pywebview.api.save_lang(lang);
            }
        }
        
        function toggleLanguage() {
            setLanguage(currentLang === 'ko' ? 'en' : 'ko');
            showToast(t('toast_default'));
        }

        // ----------------- CodeMirror 6 에디터 코어 고도화 및 헬퍼 -----------------
        window.cmEditor = null;
        window.cmPlaceholderConf = null;
        window.pendingEditorContent = null;
        
        // 하위 호환성을 위한 Mock undoManager
        window.undoManager = {
            saveState: () => {},
            history: [],
            currentIndex: -1,
            undo: () => { window.undoEditor && window.undoEditor(); },
            redo: () => { window.redoEditor && window.redoEditor(); }
        };

        function handleEnterKey(view) {
            const state = view.state;
            const selection = state.selection.main;
            if (!selection.empty) return false;
            
            const pos = selection.head;
            const line = state.doc.lineAt(pos);
            const text = line.text;
            const col = pos - line.from;
            
            const checklistRegex = /^(\s*[-*+]\s+\[[xX ]\]\s+)(.*)/;
            const orderedRegex = /^(\s*(\d+)\.\s+)(.*)/;
            const unorderedRegex = /^(\s*[-*+]\s+)(.*)/;
            
            let match;
            
            // 1. 체크리스트
            if ((match = text.match(checklistRegex))) {
                const prefix = match[1];
                const content = match[2];
                if (col < prefix.length) return false;
                
                if (content.trim() === "") {
                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: "" },
                        selection: { anchor: line.from }
                    });
                    return true;
                }
                
                const insertText = "\n" + prefix.replace(/\[[xX]\]/, "[ ]");
                view.dispatch({
                    changes: { from: pos, to: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                });
                return true;
            }
            
            // 2. 순서 목록
            if ((match = text.match(orderedRegex))) {
                const prefix = match[1];
                const num = parseInt(match[2]);
                const content = match[3];
                if (col < prefix.length) return false;
                
                if (content.trim() === "") {
                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: "" },
                        selection: { anchor: line.from }
                    });
                    return true;
                }
                
                const spaces = prefix.match(/^\s*/)[0];
                const nextNum = num + 1;
                const insertText = `\n${spaces}${nextNum}. `;
                view.dispatch({
                    changes: { from: pos, to: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                });
                return true;
            }
            
            // 3. 순서 없는 목록
            if ((match = text.match(unorderedRegex))) {
                const prefix = match[1];
                const content = match[2];
                if (col < prefix.length) return false;
                
                if (content.trim() === "") {
                    view.dispatch({
                        changes: { from: line.from, to: line.to, insert: "" },
                        selection: { anchor: line.from }
                    });
                    return true;
                }
                
                const insertText = "\n" + prefix;
                view.dispatch({
                    changes: { from: pos, to: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                });
                return true;
            }
            
            return false;
        }

        function initCodeMirror() {
            if (!window.cm6) {
                // 모듈 로드 대기
                window.addEventListener('cm6-loaded', initCodeMirror);
                return;
            }
            

            const cm = window.cm6;
            window.cmPlaceholderConf = new cm.Compartment();
            window.cmWysiwygConf = new cm.Compartment();
            window.cmReadOnlyConf = new cm.Compartment();
            
            const state = cm.EditorState.create({
                doc: "",
                extensions: [
                    cm.basicSetup,
                    cm.markdown(),
                    window.cmPlaceholderConf.of(cm.placeholder(t('msg_editor_placeholder'))),
                    window.cmWysiwygConf.of([]),
                    window.cmReadOnlyConf.of(cm.EditorState.readOnly ? cm.EditorState.readOnly.of(false) : []),
                    cm.keymap.of([{ key: "Enter", run: handleEnterKey }]),
                    cm.EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            handleEditorInput();
                        }
                    }),
                    wikiLinkPlugin
                ]
            });
            
            const parentEl = document.getElementById('editor-parent');
            if (!parentEl) return;
            
            const view = new cm.EditorView({
                state,
                parent: parentEl
            });
            
            window.cmEditor = view;
            
            // 대기 중이던 텍스트 파일이 있다면 로드
            if (window.pendingEditorContent !== null) {
                setEditorContent(window.pendingEditorContent);
                window.pendingEditorContent = null;
            }
        }

        window.getEditorContent = function() {
            if (window.cmEditor) {
                return window.cmEditor.state.doc.toString();
            }
            return window.pendingEditorContent || "";
        };

        function parseTagsFromFmText(fmText) {
            const lines = fmText.split(/\r?\n/);
            let inTags = false;
            let tags = [];
            
            for (let line of lines) {
                line = line.trim();
                if (line === '---') continue;
                
                if (line.startsWith('tags:')) {
                    const val = line.substring(5).trim();
                    if (val) {
                        if (val.startsWith('[') && val.endsWith(']')) {
                            tags = val.substring(1, val.length - 1)
                                      .split(',')
                                      .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
                                      .filter(t => t.length > 0);
                        } else {
                            tags = val.split(',')
                                      .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
                                      .filter(t => t.length > 0);
                        }
                    } else {
                        inTags = true;
                    }
                } else if (inTags) {
                    if (line.startsWith('-')) {
                        tags.push(line.substring(1).trim().replace(/^['"]|['"]$/g, ''));
                    } else if (line.includes(':')) {
                        inTags = false;
                    }
                }
            }
            return Array.from(new Set(tags));
        }

        window.setEditorContent = function(text) {
            let cleanText = text;
            let parsedTags = [];
            if (text.startsWith('---')) {
                const fmMatch = text.match(/^---[\s\S]*?\r?\n---(\r?\n)?/);
                if (fmMatch) {
                    const fmText = fmMatch[0];
                    parsedTags = parseTagsFromFmText(fmText);
                    cleanText = text.substring(fmText.length);
                }
            }
            activeDocumentTags = parsedTags;
            
            // 플로팅 태그 컨테이너 업데이트
            if (typeof updateFloatingTagsContainer === 'function') {
                updateFloatingTagsContainer();
            }
            
            if (window.cmEditor) {
                window.cmEditor.dispatch({
                    changes: { from: 0, to: window.cmEditor.state.doc.length, insert: cleanText }
                });
            } else {
                window.pendingEditorContent = cleanText;
            }
        };

        async function startApp() {
            // Apply fonts from localStorage immediately to prevent FOUT (Flash of Unstyled Text)
            const savedUiFont = localStorage.getItem('ui_font') || 'Inter';
            const savedEditorFont = localStorage.getItem('editor_font') || 'Fira Code';
            const savedEditorSize = localStorage.getItem('editor_font_size') || 14;
            applyFontSettings(savedUiFont, savedEditorFont, savedEditorSize);

            initCodeMirror();

            if (window.pywebview) {
                initApp();
            } else {
                let resolved = false;
                window.addEventListener('pywebviewready', () => {
                    if (!resolved) {
                        resolved = true;
                        initApp();
                    }
                });

                // 500ms 이내에 pywebview가 로드되지 않으면 브라우저 접속으로 판단
                setTimeout(() => {
            if (!resolved && !window.pywebview) {
                resolved = true;
                console.log("Running in Web Browser mode. Injecting HTTP API Proxy.");
                window.pywebview = {
                    is_browser_proxy: true,
                    api: new Proxy({}, {
                        get: function(target, prop) {
                            return function(...args) {
                                if (prop === 'open_library_folder') {
                                    alert(t('msg_web_folder_err'));
                                    return Promise.resolve({ status: 'cancel' });
                                }
                                if (prop === 'add_documents_to_library') {
                                    alert(t('msg_web_file_dialog_err'));
                                    return Promise.resolve({ status: 'cancel' });
                                }
                                
                                let bodyData = {};
                                if (prop === 'read_file') { bodyData.rel_path = args[0]; }
                                else if (prop === 'save_file') { bodyData.rel_path = args[0]; bodyData.content = args[1]; }
                                else if (prop === 'create_item') { bodyData.rel_path = args[0]; bodyData.item_type = args[1]; }
                                else if (prop === 'delete_item') { bodyData.rel_path = args[0]; }
                                else if (prop === 'rename_item') { bodyData.old_rel_path = args[0]; bodyData.new_rel_path = args[1]; }
                                else if (prop === 'search_pubchem_smiles') { bodyData.compound_name = args[0]; }
                                else if (prop === 'save_theme') { bodyData.theme_name = args[0]; }
                                else if (prop === 'save_lang') { bodyData.lang = args[0]; }
                                else if (prop === 'save_network_settings') { bodyData.bind_ip = args[0]; bodyData.port = args[1]; bodyData.access_password = args[2]; }
                                else if (prop === 'save_font_settings') { bodyData.ui_font = args[0]; bodyData.editor_font = args[1]; bodyData.editor_font_size = args[2]; }
                                else if (prop === 'export_html') { bodyData.rel_path = args[0]; bodyData.html_body = args[1]; bodyData.title = args[2]; }
                                else if (prop === 'save_graph_image') { bodyData.base64_data = args[0]; }
                                
                                let headers = { 'Content-Type': 'application/json' };
                                const savedPwd = localStorage.getItem('access_password');
                                if (savedPwd) { headers['X-Access-Password'] = savedPwd; }
                                
                                return fetch(`/api/${prop}`, {
                                    method: 'POST',
                                    headers: headers,
                                    body: JSON.stringify(bodyData)
                                }).then(res => res.json())
                                  .catch(err => ({ status: 'error', message: err.message }));
                            };
                        }
                    })
                };
                initApp();
            }
        }, 500);
            }
            
            // Graph View & Wiki Link
        let isGraphViewOpen = false;
        let myGraph = null;
        let forceGraphLoaded = false;
        let graphDegrees = {};
        
        function loadForceGraph() {
            return new Promise((resolve, reject) => {
                if (forceGraphLoaded || typeof ForceGraph !== 'undefined') { forceGraphLoaded = true; resolve(); return; }
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/force-graph@1.43.5/dist/force-graph.min.js';
                s.onload = () => { forceGraphLoaded = true; resolve(); };
                s.onerror = () => reject(new Error('force-graph load failed'));
                document.head.appendChild(s);
            });
        }
        
        window.openWikiLink = async function(targetName) {
            try {
                const gData = await pywebview.api.get_graph_data();
                const node = gData.nodes.find(n => n.id.toLowerCase() === targetName.toLowerCase());
                if (node && !node.missing) {
                    if (isGraphViewOpen) window.toggleGraphView();
                    openFile(node.path);
                } else {
                    const create = confirm('"' + targetName + '" - ' + t('msg_wiki_create_confirm'));
                    if (create) {
                        if (isGraphViewOpen) window.toggleGraphView();
                        const newPath = targetName + '.md';
                        await pywebview.api.save_file(newPath, '# ' + targetName);
                        const treeData = await pywebview.api.list_files();
                        renderFileTree(treeData);
                        openFile(newPath);
                    }
                }
            } catch(e) { console.error('openWikiLink error:', e); }
        };
        
        window.updateGraphDesign = function(reheat = false) {
            if (!myGraph) return;
            
            const showArrows = document.getElementById('graph-arrow-toggle').checked;
            const showParticles = document.getElementById('graph-particle-toggle').checked;
            const linkDistance = parseFloat(document.getElementById('graph-link-distance').value);
            const linkWidthVal = parseFloat(document.getElementById('graph-link-width').value);
            const linkColorVal = document.getElementById('graph-link-color').value;
            const nodeSizeVal = parseFloat(document.getElementById('graph-node-size').value);
            const fontSizeVal = parseFloat(document.getElementById('graph-font-size').value);
            const fontColorVal = document.getElementById('graph-font-color').value;
            
            document.getElementById('val-link-distance').innerText = linkDistance + 'px';
            document.getElementById('val-link-width').innerText = linkWidthVal.toFixed(1) + 'px';
            document.getElementById('val-node-size').innerText = nodeSizeVal.toFixed(1) + 'x';
            document.getElementById('val-font-size').innerText = fontSizeVal + 'px';
            
            // Apply styles to links dynamically
            myGraph
                .linkDirectionalArrowLength(showArrows ? 5 : 0)
                .linkWidth(linkWidthVal)
                .linkColor(() => linkColorVal)
                .linkDirectionalArrowColor(() => linkColorVal)
                .linkDirectionalParticles(showParticles ? 2 : 0)
                .linkDirectionalParticleWidth(linkWidthVal * 1.5)
                .linkDirectionalParticleColor(() => '#f472b6');
            
            // 물리엔진의 힘 설정은 언제나 슬라이더 값과 동기화시킵니다.
            myGraph.d3Force('link').distance(linkDistance);
            
            // charge의 반발력을 안정적으로 제한하고, distanceMax를 설정하여 멀어진 노드들이 서로 밀어내지 않게 합니다.
            // 이렇게 하면 선 길이를 줄였을 때 링크(선)의 인장력이 노드들을 중앙으로 부드럽게 다시 당겨줍니다.
            myGraph.d3Force('charge')
                .strength(-100)
                .distanceMax(linkDistance * 2.0);
            
            // 리히트(시뮬레이션 재가열)만 명시적으로 요청되었을 때 수행하여 불필요한 프레임 드랍 및 무한 쏠림 방지
            if (reheat) {
                myGraph.d3ReheatSimulation();
            }
        };

        window.onZoomSliderChange = function(val) {
            if (myGraph) {
                myGraph.zoom(parseFloat(val));
            }
        };

        window.zoomGraph = function(direction) {
            if (myGraph) {
                const currentZoom = myGraph.zoom();
                const nextZoom = direction === 'in' ? currentZoom * 1.25 : currentZoom / 1.25;
                myGraph.zoom(nextZoom, 200);
                const slider = document.getElementById('graph-zoom-slider');
                if (slider) slider.value = nextZoom;
            }
        };

        window.resetGraphZoom = function() {
            if (myGraph) {
                myGraph.zoomToFit(400);
            }
        };

        window.saveGraphPositions = async function() {
            if (!myGraph) return;
            const positions = {};
            myGraph.graphData().nodes.forEach(node => {
                if (node.fx !== undefined && node.fx !== null && node.fy !== undefined && node.fy !== null) {
                    positions[node.id] = { fx: node.fx, fy: node.fy };
                }
            });
            await pywebview.api.save_graph_node_positions(positions);
        };
        
        window.toggleGraphView = async function() {
            isGraphViewOpen = !isGraphViewOpen;
            document.body.classList.toggle('graph-view-active', isGraphViewOpen);
            const container = document.getElementById('graph-view-container');
            const btn = document.getElementById('mode-graph');
            
            if (isGraphViewOpen) {
                container.style.display = 'block';
                if(btn) btn.classList.add('active');
                
                try {
                    await loadForceGraph();
                    const gData = await pywebview.api.get_graph_data();
                    
                    // Reset and calculate degrees (number of links connected to each node)
                    graphDegrees = {};
                    gData.nodes.forEach(n => graphDegrees[n.id] = 0);
                    gData.links.forEach(l => {
                        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                        if (graphDegrees[sourceId] !== undefined) graphDegrees[sourceId]++;
                        if (graphDegrees[targetId] !== undefined) graphDegrees[targetId]++;
                    });
                    
                    if (!myGraph) {
                        const canvasEl = document.getElementById('graph-canvas');
                        myGraph = ForceGraph()(canvasEl)
                            .graphData(gData)
                            .nodeId('id')
                            .backgroundColor('#090a0f')
                            .nodeCanvasObject((node, ctx, globalScale) => {
                                const label = node.id;
                                const degree = graphDegrees[node.id] || 0;
                                
                                // Read live configuration values from Settings Panel
                                const nodeSizeVal = parseFloat(document.getElementById('graph-node-size').value);
                                const fontSizeVal = parseFloat(document.getElementById('graph-font-size').value);
                                const fontColorVal = document.getElementById('graph-font-color').value;
                                
                                // Dynamic radius based on degrees scaled by the slider!
                                const baseRadius = 5 + Math.min(degree, 8) * 1.5;
                                const radius = baseRadius * nodeSizeVal;
                                
                                // 문서 성격에 따른 이모지 및 색상 로드 (백엔드 매핑 결과 매칭)
                                let color = node.color || '#a855f7';
                                if (!node.color) {
                                    if (node.missing) {
                                        color = '#ef4444';
                                    } else if (degree >= 5) {
                                        color = '#fbbf24';
                                    } else if (node.path) {
                                        if (node.path.startsWith('doc/') || node.path.startsWith('docs/')) {
                                            color = '#0ea5e9';
                                        }
                                    }
                                }
                                const icon = node.icon || (node.missing ? '❓' : '📄');
                                
                                const isHub = degree >= 5;
                                const strokeWidth = isHub ? 2.2 : 1.2;
                                const glowBlur = isHub ? 16 : 6;
                                
                                // 1. 노드 원형 배경 및 네온 외곽 링 그리기
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                                ctx.fillStyle = color + '22'; // 약 13%의 불투명도로 은은하게 반투명 채움
                                ctx.strokeStyle = color;
                                ctx.lineWidth = strokeWidth;
                                ctx.shadowBlur = glowBlur;
                                ctx.shadowColor = color;
                                ctx.fill();
                                ctx.stroke();
                                ctx.shadowBlur = 0; // 그림자 효과 리셋
                                
                                // 2. 노드 중심부에 카테고리 이모지 아이콘 그리기
                                if (icon) {
                                    ctx.font = `${radius * 1.15}px sans-serif`;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText(icon, node.x, node.y);
                                }
                                
                                // 3. 하단 문서 제목 라벨 텍스트 그리기
                                const fontSize = (degree >= 5 ? fontSizeVal + 1 : fontSizeVal - 1) / globalScale;
                                ctx.font = `${fontSize}px sans-serif`;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillStyle = fontColorVal;
                                ctx.fillText(label, node.x, node.y + radius + 11);
                            })
                            .onNodeClick(node => {
                                if (node.path) {
                                    window.toggleGraphView();
                                    openFile(node.path);
                                } else {
                                    window.openWikiLink(node.id);
                                }
                            })
                            .onNodeDrag((node, translate) => {
                                node.fx = node.x;
                                node.fy = node.y;
                            })
                            .onNodeDragEnd(node => {
                                node.fx = node.x;
                                node.fy = node.y;
                                window.saveGraphPositions();
                            })
                            .onNodeRightClick(node => {
                                node.fx = null;
                                node.fy = null;
                                window.saveGraphPositions();
                            })
                            .onZoom(zoomObj => {
                                const slider = document.getElementById('graph-zoom-slider');
                                if (slider) {
                                    slider.value = zoomObj.k;
                                }
                            });
                        
                        // Initialize graph design and forces from sliders
                        window.updateGraphDesign();
                        
                        const resizeObserver = new ResizeObserver(() => {
                            myGraph.width(canvasEl.clientWidth).height(canvasEl.clientHeight);
                        });
                        resizeObserver.observe(canvasEl);
                    } else {
                        myGraph.graphData(gData);
                        window.updateGraphDesign();
                    }
                } catch(e) {
                    console.error('Graph view error:', e);
                    alert('Graph library load failed: ' + e.message);
                    isGraphViewOpen = false;
                    container.style.display = 'none';
                    if(btn) btn.classList.remove('active');
                }
            } else {
                container.style.display = 'none';
                if(btn) btn.classList.remove('active');
            }
        };
        
        window.exportGraphImage = async function() {
            try {
                const canvas = document.querySelector('#graph-canvas canvas');
                if (!canvas) {
                    alert(t('msg_export_failed') + ': Canvas not found');
                    return;
                }
                const dataUrl = canvas.toDataURL('image/png');
                if (window.pywebview && !window.pywebview.is_browser_proxy) {
                    const res = await pywebview.api.save_graph_image(dataUrl);
                    if (res.status === 'success') {
                        showToast(t('toast_default'));
                    } else if (res.status === 'error') {
                        alert(t('msg_export_failed') + ': ' + res.message);
                    }
                } else {
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = 'zettelkasten_graph.png';
                    a.click();
                    showToast(t('toast_default'));
                }
            } catch (e) {
                alert(t('msg_export_failed') + ': ' + e.message);
            }
        };

        window.printGraph = function() {
            if (!myGraph) return;
            
            const originalBg = myGraph.backgroundColor();
            
            myGraph.backgroundColor('#ffffff');
            
            const fontColorInput = document.getElementById('graph-font-color');
            const linkColorInput = document.getElementById('graph-link-color');
            const originalFontColor = fontColorInput.value;
            const originalLinkColor = linkColorInput.value;
            
            fontColorInput.value = '#000000';
            linkColorInput.value = '#555555';
            
            window.updateGraphDesign();
            myGraph.d3ReheatSimulation(); // Force canvas redraw with new colors
            
            setTimeout(() => {
                window.print();
                
                setTimeout(() => {
                    myGraph.backgroundColor(originalBg);
                    fontColorInput.value = originalFontColor;
                    linkColorInput.value = originalLinkColor;
                    window.updateGraphDesign();
                    myGraph.d3ReheatSimulation(); // Force restore redraw
                    showToast(t('msg_print_success'));
                }, 150);
            }, 300); // Wait 300ms to render light theme
        };
        
        // Drag and drop setup
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startApp);
        } else {
            startApp();
        }



        async function initApp() {
            const hideSplash = () => {
                const splash = document.getElementById('splash-screen');
                if (splash && splash.style.display !== 'none') {
                    splash.style.opacity = '0';
                    setTimeout(() => { splash.style.display = 'none'; }, 800);
                }
            };

            // 안전망: 8초 후에도 스플래시가 살아 있으면 강제 숨김
            const splashSafetyTimer = setTimeout(hideSplash, 8000);

            try {
                const state = await pywebview.api.get_initial_state();
                
                // HTTP API 보안 검증 통과 실패 시
                if (state && state.status === 'auth_failed') {
                    clearTimeout(splashSafetyTimer);
                    showAuthOverlay();
                    return;
                }
                
                // 네트워크 설정 저장
                currentNetworkConfig.bind_ip = state.bind_ip || '0.0.0.0';
                currentNetworkConfig.port = state.port || 58220;
                currentNetworkConfig.access_password = state.access_password || '';
                currentNetworkConfig.local_ip = state.local_ip || '127.0.0.1';

                // 글꼴 설정 저장 및 적용
                const uiFont = state.ui_font || 'Inter';
                const editorFont = state.editor_font || 'Fira Code';
                const editorSize = state.editor_font_size || 14;
                applyFontSettings(uiFont, editorFont, editorSize);
                
                localStorage.setItem('ui_font', uiFont);
                localStorage.setItem('editor_font', editorFont);
                localStorage.setItem('editor_font_size', editorSize);

                workspaceRoot = state.workspace;
                currentTheme = state.theme;
                
                const wsNameEl = document.getElementById('workspace-name');
                if (wsNameEl) {
                    wsNameEl.innerText = workspaceRoot.replace(/\\/g, '/');
                }
                setTheme(currentTheme);
                setLanguage(state.lang || 'ko', false);
                
                // 구글 드라이브 연동 상태 초기 로드 및 확인
                await updateGoogleDriveStatus();
                
                const blueLightStored = localStorage.getItem('blue_light_active') === 'true';
                if (blueLightStored) {
                    document.body.classList.add('blue-light-active');
                }
                updateBlueLightIcon(blueLightStored);
                
                renderFileTree(state.files);
                loadWorkspaceTags();
                
                // 실행파일 경로의 external math_db.json 존재 여부 확인 및 로드
                try {
                    const extDbRes = await pywebview.api.get_external_math_db();
                    if (extDbRes && extDbRes.status === 'success') {
                        mathDatabase = extDbRes.data;
                        hasExternalMathDb = true;
                        console.log('External math database loaded successfully from executable directory.');
                    } else {
                        hasExternalMathDb = false;
                        console.log('No external math database found in executable directory. Using default.');
                    }
                } catch (dbErr) {
                    console.warn('Failed to load external math_db.json:', dbErr);
                    hasExternalMathDb = false;
                }
                
                // last_file이 있으면 열기 (실패해도 스플래시는 반드시 숨김)
                if (state.last_file) {
                    try {
                        await openFile(state.last_file);
                    } catch (fileErr) {
                        console.warn('Failed to open last_file on startup:', fileErr);
                    }
                }
                
                // 정상 초기화 완료: 스플래시 1초 페이드아웃
                clearTimeout(splashSafetyTimer);
                setTimeout(hideSplash, 1000);

                // 업데이트 알림 체크
                if (state && state.update_available) {
                    setTimeout(() => {
                        const currentVersionEl = document.getElementById('update-current-version');
                        const latestVersionEl = document.getElementById('update-latest-version');
                        if (currentVersionEl) currentVersionEl.innerText = 'v' + state.current_version;
                        if (latestVersionEl) latestVersionEl.innerText = 'v' + state.latest_version;
                        
                        const updateModal = document.getElementById('update-modal');
                        if (updateModal) {
                            updateModal.style.display = 'flex';
                            if (window.lucide) lucide.createIcons();
                        }
                    }, 1800);
                }

            } catch (err) {
                clearTimeout(splashSafetyTimer);
                console.error("Initialization error:", err);
                hideSplash();
                if (err && err.message && (err.message.includes('401') || err.message.includes('auth_failed'))) {
                    showAuthOverlay();
                }
            }
        }

        // 테마 설정 (saveConfig가 false인 경우, 파일 인쇄 시 임시 테마 변경에 대처하여 DB 쓰기 방지)
        function setTheme(theme, saveConfig = true) {
            currentTheme = theme;
            const body = document.body;
            const themeIcon = document.getElementById('theme-icon');
            
            if (theme === 'light') {
                body.classList.add('theme-light');
                themeIcon.setAttribute('data-lucide', 'moon');
                mermaid.initialize({ theme: 'default', flowchart: { useMaxWidth: false } });
            } else {
                body.classList.remove('theme-light');
                themeIcon.setAttribute('data-lucide', 'sun');
                mermaid.initialize({ theme: 'dark', flowchart: { useMaxWidth: false } });
            }
            lucide.createIcons();
            
            
            // 프리뷰 리렌더링
            triggerLiveRender();
            
            // 이모지 피커 테마 동기화 (상태 인자 명시 주입)
            if (window.renderEmojiPicker) {
                window.renderEmojiPicker(true, currentTheme, currentLang);
            }
            
            if (window.pywebview && saveConfig) {
                pywebview.api.save_theme(theme);
            }
        }

        function toggleTheme() {
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        }

        function toggleBlueLight() {
            const isActive = document.body.classList.toggle('blue-light-active');
            localStorage.setItem('blue_light_active', isActive ? 'true' : 'false');
            updateBlueLightIcon(isActive);
            showToast(isActive ? t('msg_blue_light_on') : t('msg_blue_light_off'));
        }

        function updateBlueLightIcon(active) {
            const icon = document.getElementById('blue-light-icon');
            if (!icon) return;
            if (active) {
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                icon.setAttribute('data-lucide', 'eye');
            }
            if (window.lucide) {
                lucide.createIcons({
                    attrs: {
                        style: "width: 18px; height: 18px;"
                    },
                    nameAttr: 'data-lucide'
                });
            }
            const btn = icon.closest('button');
            if (btn) {
                btn.title = active ? t('tooltip_blue_light_off') : t('tooltip_blue_light_on');
            }
        }

        // 윈도우 탐색기에서 서재 폴더 열기
        async function openLibraryFolder() {
            if (window.pywebview) {
                const res = await pywebview.api.open_library_folder();
                if (res.status === 'success') {
                    showToast(t('msg_folder_open_success'));
                } else if (res.status === 'error') {
                    alert(t('msg_folder_open_failed') + res.message);
                }
            }
        }

        // 서재에 외부 문서 추가
        async function addDocumentToLibrary() {
            if (window.pywebview) {
                const res = await pywebview.api.add_documents_to_library();
                if (res.status === 'success') {
                    renderFileTree(res.files);
                    let msg = res.message;
                    if (currentLang === 'en' && msg) {
                        const match = msg.match(/(\\d+)개의 문서/);
                        if (match) {
                            msg = `${match[1]} documents successfully added to the library in their original location.`;
                        }
                    }
                    showToast(msg);
                } else if (res.status === 'error') {
                    alert(t('msg_doc_add_failed') + res.message);
                }
            }
        }

        // 워크스페이스 새로고침
        async function refreshWorkspace() {
            const files = await pywebview.api.list_files();
            renderFileTree(files);
            showToast(t('msg_library_refreshed'));
            if (currentFilePath) {
                updateBacklinks(currentFilePath);
            }
        }
        window.refreshWorkspace = refreshWorkspace;

        // 파일 트리 렌더링
        function collectLocalFiles(items) {
            let res = [];
            if (!items) return res;
            items.forEach(item => {
                if (item.type === 'file') {
                    let name = item.name;
                    if (name.startsWith('📄 ')) {
                        name = name.substring(2);
                    }
                    res.push(name.toLowerCase());
                } else if (item.children) {
                    res = res.concat(collectLocalFiles(item.children));
                }
            });
            return res;
        }

        function splitTree(items) {
            const docItems = [];
            const mediaItems = [];
            const mediaExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'mp3', 'mp4', 'wav', 'webm', 'mov', 'avi', 'ogg'];

            items.forEach(item => {
                if (item.type === 'folder') {
                    const { docItems: subDocs, mediaItems: subMedia } = splitTree(item.children || []);
                    if (subDocs.length > 0) {
                        docItems.push({
                            ...item,
                            children: subDocs
                        });
                    }
                    if (subMedia.length > 0) {
                        mediaItems.push({
                            ...item,
                            children: subMedia
                        });
                    }
                } else {
                    const pathLower = (item.path || '').toLowerCase();
                    const ext = pathLower.split('.').pop();
                    if (mediaExtensions.includes(ext)) {
                        mediaItems.push(item);
                    } else {
                        docItems.push(item);
                    }
                }
            });

            return { docItems, mediaItems };
        }

        function renderFileTree(files) {
            currentFilesData = files;
            localFiles = collectLocalFiles(files);
            
            const { docItems, mediaItems } = splitTree(files);
            
            // 1. 내서재 문서 트리 렌더링
            const docContainer = document.getElementById('file-tree-container');
            docContainer.innerHTML = "";
            if (docItems.length === 0) {
                docContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 10px; text-align: center;">${t('sidebar_no_files')}</div>`;
            } else {
                docContainer.appendChild(createTreeDOM(docItems));
            }
            
            // 2. 내미디어 트리 렌더링
            const mediaContainer = document.getElementById('sidebar-media-list');
            if (mediaContainer) {
                mediaContainer.innerHTML = "";
                if (mediaItems.length === 0) {
                    mediaContainer.innerHTML = `<div style="font-size: 0.78em; color: var(--text-muted); padding: 4px 0;" data-i18n="msg_no_media">${t('msg_no_media') || '추가된 미디어 파일이 없습니다.'}</div>`;
                } else {
                    mediaContainer.appendChild(createTreeDOM(mediaItems));
                }
            }
            
            lucide.createIcons();
            
            if (gdriveAuthenticated) {
                refreshRemoteFiles().catch(e => console.error(e));
            }
        }

        function createTreeDOM(items) {
            const ul = document.createElement('div');
            
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'tree-item';
                if (currentFilePath === item.path) {
                    itemEl.classList.add('active');
                }
                
                let iconName = 'file-text';
                if (item.type === 'folder') {
                    iconName = 'folder';
                } else {
                    const ext = (item.path || '').split('.').pop().toLowerCase();
                    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                        iconName = 'image';
                    } else if (ext === 'pdf') {
                        iconName = 'file-text';
                    } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
                        iconName = 'video';
                    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                        iconName = 'music';
                    }
                }
                
                itemEl.innerHTML = `
                    <i data-lucide="${iconName}" style="width: 16px; height: 16px; min-width: 16px;"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
                    <div class="tree-item-actions">
                        <button class="icon-btn" onclick="deleteWorkspaceItem(event, '${item.path}')" title="${t('tooltip_delete')}"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                    </div>
                `;
                
                if (item.type === 'folder') {
                    // 폴더 토글 메커니즘
                    const folderWrapper = document.createElement('div');
                    const childrenWrapper = document.createElement('div');
                    childrenWrapper.className = 'tree-folder-children';
                    
                    // 폴더도 드래그 앤 드롭으로 캔버스에 추가 가능하도록 설정
                    itemEl.setAttribute('draggable', 'true');
                    itemEl.ondragstart = (e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData("text/plain", item.path);
                    };
                    
                    itemEl.onclick = (e) => {
                        if (e.target.closest('.tree-item-actions')) return;
                        childrenWrapper.classList.toggle('open');
                        const icon = itemEl.querySelector('[data-lucide]');
                        const isOpen = childrenWrapper.classList.contains('open');
                        icon.setAttribute('data-lucide', isOpen ? 'folder-open' : 'folder');
                        lucide.createIcons();
                    };
                    
                    if (item.children && item.children.length > 0) {
                        childrenWrapper.appendChild(createTreeDOM(item.children));
                    } else {
                        childrenWrapper.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8em; padding: 4px 16px;">${t('sidebar_empty_folder')}</div>`;
                    }
                    
                    folderWrapper.appendChild(itemEl);
                    folderWrapper.appendChild(childrenWrapper);
                    ul.appendChild(folderWrapper);
                } else {
                    itemEl.setAttribute('draggable', 'true');
                    itemEl.ondragstart = (e) => {
                        e.dataTransfer.setData("text/plain", item.path);
                    };
                    itemEl.onclick = (e) => {
                        if (e.target.closest('.tree-item-actions')) return;
                        // 활성화 스타일 해제 후 신규 지정
                        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                        itemEl.classList.add('active');
                        openFile(item.path);
                    };
                    ul.appendChild(itemEl);
                }
            });
            
            return ul;
        }

        // WikiLink 열기
        window.openWikiLink = async function(wikiName) {
            if (!window.pywebview) return;
            try {
                const res = await pywebview.api.open_wiki_link(wikiName);
                if (res.status === 'success') {
                    if (res.is_new) {
                        showToast(`'${wikiName}' ${t('msg_create_success') || '새 문서가 생성되었습니다.'}`);
                        await refreshWorkspace();
                    }
                    await openFile(res.filepath);
                } else {
                    showToast("오류: " + res.message);
                }
            } catch (e) {
                console.error("openWikiLink error:", e);
            }
        };

        // 백링크 갱신 및 렌더링
        window.updateBacklinks = async function(relPath) {
            if (!window.pywebview) return;
            try {
                const res = await pywebview.api.get_backlinks(relPath);
                if (res.status === 'success') {
                    const backlinks = res.backlinks || [];
                    
                    // 1. 좌측 사이드바 백링크 목록 업데이트
                    const sidebarList = document.getElementById('sidebar-backlinks-list');
                    if (sidebarList) {
                        if (backlinks.length === 0) {
                            sidebarList.innerHTML = `<div style="font-size: 0.78em; color: var(--text-muted); padding: 4px 0;">${t('msg_no_backlinks') || '이 문서를 참조하는 다른 문서가 없습니다.'}</div>`;
                        } else {
                            sidebarList.innerHTML = backlinks.map(b => `
                                <div class="sidebar-backlink-item" onclick="openFile('${b.path}')">
                                    <i data-lucide="file-text" style="width: 12px; height: 12px;"></i>
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.name}</span>
                                </div>
                            `).join('');
                            if (window.lucide) {
                                window.lucide.createIcons({node: sidebarList});
                            }
                        }
                    }
                    
                    // 2. 우측 미리보기 하단 백링크 목록 업데이트
                    const previewPane = document.getElementById('preview-pane');
                    if (previewPane) {
                        const oldFooter = document.getElementById('preview-backlinks-footer');
                        if (oldFooter) oldFooter.remove();
                        
                        const previewContent = document.getElementById('preview-content');
                        if (previewContent) {
                            const footer = document.createElement('div');
                            footer.id = 'preview-backlinks-footer';
                            footer.className = 'backlinks-footer';
                            
                            const titleText = t('lbl_backlinks_title') || '백링크 (Backlinks)';
                            const noBacklinksText = t('msg_no_backlinks') || '이 문서를 참조하는 다른 문서가 없습니다.';
                            
                            let cardsHtml = '';
                            if (backlinks.length === 0) {
                                cardsHtml = `<div style="font-size: 0.9em; color: var(--text-muted);">${noBacklinksText}</div>`;
                            } else {
                                cardsHtml = `
                                    <div class="backlinks-list">
                                        ${backlinks.map(b => `
                                            <div class="backlink-card" onclick="openFile('${b.path}')">
                                                <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
                                                <div class="backlink-name">${b.name}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                `;
                            }
                            
                            footer.innerHTML = `
                                <div class="backlinks-title">
                                    <i data-lucide="link-2" style="width: 16px; height: 16px;"></i>
                                    <span>${titleText} (${backlinks.length})</span>
                                </div>
                                ${cardsHtml}
                            `;
                            
                            previewContent.appendChild(footer);
                            if (window.lucide) {
                                window.lucide.createIcons({node: footer});
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("updateBacklinks error:", e);
            }
        };

        // 파일 열기
        async function openFile(relPath) {
            const pathLower = relPath.toLowerCase();
            const ext = pathLower.split('.').pop();
            const isMedia = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'mp3', 'mp4', 'wav', 'webm', 'mov', 'avi', 'ogg'].includes(ext);

            if (isMedia) {
                currentFilePath = relPath;
                
                // 캔버스 뷰 열려 있다면 닫기
                if (window.toggleCanvasView) {
                    window.toggleCanvasView(false);
                }
                
                // 파일 열기 성공 시 히스토리 기록
                if (!isNavigatingHistory) {
                    if (fileHistoryIndex === -1 || fileHistory[fileHistoryIndex] !== relPath) {
                        fileHistory = fileHistory.slice(0, fileHistoryIndex + 1);
                        fileHistory.push(relPath);
                        fileHistoryIndex = fileHistory.length - 1;
                    }
                }
                updateNavigationButtons();
                
                // 파일 이름만 노출하고 물리적 전체 저장 경로는 툴팁으로 우아하게 표시
                const titleEl = document.getElementById('active-file-title');
                const normalizedRelPath = relPath.replace(/\\/g, '/');
                const fileName = normalizedRelPath.substring(normalizedRelPath.lastIndexOf('/') + 1);
                if (titleEl) {
                    titleEl.innerText = fileName;
                    const safeRoot = (workspaceRoot || "").replace(/\\/g, '/');
                    const fullSavingPath = (safeRoot + '/' + normalizedRelPath).replace(/\/+/g, '/');
                    titleEl.title = t('msg_active_file_tooltip') + fullSavingPath;
                }
                
                // 미디어 종류별 마크다운 생성하여 에디터 렌더링에 우회 제공
                let virtualContent = "";
                const urlEncodedPath = encodeURIComponent(relPath);
                
                if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                    virtualContent = `# 🖼️ ${fileName}\n\n> **${t('tab_media')}** - ${t('tooltip_delete')}\n\n![${fileName}](/workspace/${urlEncodedPath})`;
                } else if (ext === 'pdf') {
                    virtualContent = `# 📄 ${fileName}\n\n> **${t('tab_media')}** - ${t('tooltip_delete')}\n\n<iframe src="/workspace/${urlEncodedPath}#toolbar=0" style="width: 100%; height: calc(100vh - 220px); border: none;"></iframe>`;
                } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
                    virtualContent = `# 🎥 ${fileName}\n\n> **${t('tab_media')}** - ${t('tooltip_delete')}\n\n<video src="/workspace/${urlEncodedPath}" controls style="max-width: 100%; max-height: 70vh; background: #000; border-radius: 8px;"></video>`;
                } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                    virtualContent = `# 🎵 ${fileName}\n\n> **${t('tab_media')}** - ${t('tooltip_delete')}\n\n<audio src="/workspace/${urlEncodedPath}" controls style="width: 100%; margin-top: 20px;"></audio>`;
                } else {
                    virtualContent = `# 📂 ${fileName}\n\n> **${t('tab_media')}** - ${t('tooltip_delete')}\n\n[Download / Open File](/workspace/${urlEncodedPath})`;
                }
                
                setEditorContent(virtualContent);
                
                // 에디터 비활성화 (pointer-events & opacity)
                const editorParent = document.getElementById('editor-parent');
                if (editorParent) {
                    editorParent.style.pointerEvents = 'none';
                    editorParent.style.opacity = '0.5';
                }
                
                // CodeMirror readOnly 적용 (지원 시)
                const cm = window.cm6;
                if (window.cmEditor && window.cmReadOnlyConf && cm && cm.EditorState && cm.EditorState.readOnly) {
                    window.cmEditor.dispatch({
                        effects: window.cmReadOnlyConf.reconfigure(cm.EditorState.readOnly.of(true))
                    });
                }
                
                // 마크다운 그래픽 파싱 & 렌더링
                triggerLiveRender();
                
                // 구글 드라이브 동기화 상태 갱신
                await updateActiveFileSyncStatus();
                
                // Undo Manager 초기화 및 첫 스냅샷 기록
                if (window.undoManager) {
                    window.undoManager.history = [];
                    window.undoManager.currentIndex = -1;
                    window.undoManager.saveState();
                }
                
                // 백링크 정보 갱신
                updateBacklinks(relPath);
                return;
            }

            // 미디어가 아닌 기존 문서 파일 열기 시 에디터 활성화
            const editorParent = document.getElementById('editor-parent');
            if (editorParent) {
                editorParent.style.pointerEvents = 'auto';
                editorParent.style.opacity = '1';
            }
            const cm = window.cm6;
            if (window.cmEditor && window.cmReadOnlyConf && cm && cm.EditorState && cm.EditorState.readOnly) {
                window.cmEditor.dispatch({
                    effects: window.cmReadOnlyConf.reconfigure(cm.EditorState.readOnly.of(false))
                });
            }

            if (relPath.endsWith('.canvas')) {
                currentFilePath = relPath;
                if (!isNavigatingHistory) {
                    if (fileHistoryIndex === -1 || fileHistory[fileHistoryIndex] !== relPath) {
                        fileHistory = fileHistory.slice(0, fileHistoryIndex + 1);
                        fileHistory.push(relPath);
                        fileHistoryIndex = fileHistory.length - 1;
                    }
                }
                updateNavigationButtons();
                
                const titleEl = document.getElementById('active-file-title');
                const normalizedRelPath = relPath.replace(/\\/g, '/');
                const fileName = normalizedRelPath.substring(normalizedRelPath.lastIndexOf('/') + 1);
                if (titleEl) {
                    titleEl.innerText = fileName;
                    const safeRoot = (workspaceRoot || "").replace(/\\/g, '/');
                    const fullSavingPath = (safeRoot + '/' + normalizedRelPath).replace(/\/+/g, '/');
                    titleEl.title = t('msg_active_file_tooltip') + fullSavingPath;
                }
                
                if (window.toggleCanvasView) {
                    window.toggleCanvasView(true);
                    await window.loadCanvas(relPath);
                }
                return;
            }
            
            const res = await pywebview.api.read_file(relPath);
            if (res.status === 'success') {
                currentFilePath = relPath;
                
                // 캔버스 뷰 열려 있다면 닫기
                if (window.toggleCanvasView) {
                    window.toggleCanvasView(false);
                }
                
                // 파일 열기 성공 시 히스토리 기록
                if (!isNavigatingHistory) {
                    if (fileHistoryIndex === -1 || fileHistory[fileHistoryIndex] !== relPath) {
                        fileHistory = fileHistory.slice(0, fileHistoryIndex + 1);
                        fileHistory.push(relPath);
                        fileHistoryIndex = fileHistory.length - 1;
                    }
                }
                updateNavigationButtons();
                
                // 파일 이름만 노출하고 물리적 전체 저장 경로는 툴팁으로 우아하게 표시
                const titleEl = document.getElementById('active-file-title');
                const normalizedRelPath = relPath.replace(/\\/g, '/');
                const fileName = normalizedRelPath.substring(normalizedRelPath.lastIndexOf('/') + 1);
                titleEl.innerText = fileName;
                const safeRoot = (workspaceRoot || "").replace(/\\/g, '/');
                const fullSavingPath = (safeRoot + '/' + normalizedRelPath).replace(/\/+/g, '/');
                titleEl.title = t('msg_active_file_tooltip') + fullSavingPath;
                
                setEditorContent(res.content);
                
                // 마크다운 그래픽 파싱 & 렌더링
                triggerLiveRender();
                
                // 구글 드라이브 동기화 상태 갱신
                await updateActiveFileSyncStatus();
                
                // Undo Manager 초기화 및 첫 스냅샷 기록
                if (window.undoManager) {
                    window.undoManager.history = [];
                    window.undoManager.currentIndex = -1;
                    window.undoManager.saveState();
                }
                
                // 백링크 정보 갱신
                updateBacklinks(relPath);
            } else {
                alert(t('msg_file_read_failed') + res.message);
            }
        }

        // 라인 넘버 및 gutter 스크롤 연동 (CodeMirror 6 네이티브 처리로 대체됨)
        function updateLineNumbers() {}
        function syncGutterScroll() {}

        // 실시간 미리보기 배율 제어 (확대/축소)
        let previewZoomLevel = 1.0;
        
        window.zoomPreview = function(amount) {
            previewZoomLevel = Math.max(0.5, Math.min(2.5, previewZoomLevel + amount));
            applyPreviewZoom();
        };
        
        window.resetPreviewZoom = function() {
            previewZoomLevel = 1.0;
            applyPreviewZoom();
        };
        
        function applyPreviewZoom() {
            const content = document.getElementById('preview-content');
            if (content) {
                // Chromium 기반 Webview2에 완전히 최적화된 zoom 스타일 사용
                content.style.zoom = previewZoomLevel;
                
                // 크로스 브라우저 호환성을 위한 백업 transform-origin 지정
                content.style.transformOrigin = "top left";
                
                // 배율 UI 텍스트 갱신
                const textEl = document.getElementById('preview-zoom-level');
                if (textEl) {
                    textEl.innerText = Math.round(previewZoomLevel * 100) + '%';
                }
            }
        }

        // 실시간 미리보기 렌더링 제어
        function handleEditorInput() {
            triggerLiveRender();
        }

        function triggerLiveRender() {
            clearTimeout(renderTimeout);
            
            // 타이핑 도중 렉 유발 방지를 위한 디바운싱 (300ms)
            renderTimeout = setTimeout(async () => {
                const markdownText = getEditorContent();
                if (!markdownText.trim()) {
                    document.getElementById('preview-content').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon"><i data-lucide="file-text" style="width: 64px; height: 64px;"></i></div>
                            <div style="font-size: 1.1em; font-weight: 500;">${t('empty_no_content')}</div>
                        </div>
                    `;
                    lucide.createIcons();
                    return;
                }
                
                // Front Matter (태그 등 메타데이터)가 있으면 미리보기 렌더링에서 제거
                let cleanMarkdownText = markdownText;
                if (markdownText.startsWith('---')) {
                    const fmMatch = markdownText.match(/^---[\s\S]*?\r?\n---(\r?\n)?/);
                    if (fmMatch) {
                        cleanMarkdownText = markdownText.slice(fmMatch[0].length);
                    }
                }
                
                // 1. Math block 임시 마스킹 (Marked 파서 간섭 방지)
                const maskedText = maskLaTeX(cleanMarkdownText);
                
                // 2. 콜아웃 (Quarto 및 Github 스타일) 변환
                const calloutParsed = parseCallouts(maskedText);
                
                // 2.5 Wiki link [[name]] or [[name|display]] conversion
                let wikiLinked = "";
                let wIdx = 0;
                while (wIdx < calloutParsed.length) {
                    const openBr = calloutParsed.indexOf("[[", wIdx);
                    if (openBr === -1) { wikiLinked += calloutParsed.slice(wIdx); break; }
                    const closeBr = calloutParsed.indexOf("]]", openBr + 2);
                    if (closeBr === -1) { wikiLinked += calloutParsed.slice(wIdx); break; }
                    wikiLinked += calloutParsed.slice(wIdx, openBr);
                    const inner = calloutParsed.slice(openBr + 2, closeBr);
                    let target = inner, display = inner;
                    if (inner.indexOf("|") !== -1) { const pp = inner.split("|"); target = pp[0].trim(); display = pp[1].trim(); }
                    wikiLinked += '<a href="#" class="wiki-link" data-target="' + target + '">' + display + '</a>';
                    wIdx = closeBr + 2;
                }

                // 3. Marked 기본 마크다운 컴파일
                let renderedHtml = marked.parse(wikiLinked);
                
                // 4. 로컬 워크스페이스 이미지 경로 수정
                renderedHtml = resolveImagePaths(renderedHtml);
                
                // 5. LaTeX 수식 복원 및 KaTeX 렌더링
                renderedHtml = unmaskAndRenderLaTeX(renderedHtml);
                
                // 6. DOM 뷰 적용
                const container = document.getElementById('preview-content');
                container.innerHTML = renderedHtml;
                
                // 6.5 위키 링크 클릭 이벤트 바인딩
                container.querySelectorAll('.wiki-link').forEach(el => {
                    el.addEventListener('click', function(e) {
                        e.preventDefault();
                        if (window.openWikiLink) window.openWikiLink(this.getAttribute('data-target'));
                    });
                });
                
                // Quarto 스타일의 클래스 명 보정 (예: language-{mermaid} -> language-mermaid)
                container.querySelectorAll('pre code').forEach(codeEl => {
                    const classes = Array.from(codeEl.classList);
                    classes.forEach(cls => {
                        if (cls.startsWith('language-{') && cls.endsWith('}')) {
                            const cleanLang = cls.slice(10, -1);
                            codeEl.classList.remove(cls);
                            codeEl.classList.add(`language-${cleanLang}`);
                        }
                    });
                });
                
                // 7. Mermaid 다이어그램 렌더링
                await renderMermaid(container);
                
                // 7.5. 화학 분자식 (SMILES) 렌더링
                renderSmiles(container);
                
                // 8. 코드 하이라이트 (PrismJS) 적용 및 복사 버튼 생성
                applyCodeHighlighting(container);
                
                // 9. TOC(목차) 재생성
                generateTOC(container);
            }, 300);
        }

        // SMILES 화학 분자식 실시간 렌더링
        function renderSmiles(container) {
            const smilesBlocks = container.querySelectorAll('code.language-smiles');
            for (let i = 0; i < smilesBlocks.length; i++) {
                const block = smilesBlocks[i];
                const pre = block.parentElement;
                const smilesText = block.innerText.trim();
                
                // 고유 ID 생성
                const svgId = `smiles-svg-${Date.now()}-${i}`;
                
                // 컨테이너 HTML 교체 (벡터 드로잉을 위해 svg 태그로 선언)
                const wrapper = document.createElement('div');
                wrapper.className = 'smiles-container';
                wrapper.innerHTML = `
                    <svg id="${svgId}" style="width: 320px; height: 320px; max-width: 100%; height: auto; display: block; margin: 0 auto;"></svg>
                    <div style="text-align: center; font-size: 0.8em; color: var(--text-muted); margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 500; letter-spacing: 0.5px;">분자식: ${smilesText}</div>
                `;
                
                pre.parentNode.replaceChild(wrapper, pre);
                
                // SmilesDrawer SVG 렌더링 실행
                try {
                    const theme = currentTheme === 'light' ? 'light' : 'dark';
                    
                    // 테마에 맞는 색상 설정
                    const drawerOptions = {
                        width: 320,
                        height: 320,
                        theme: theme,
                        bondThickness: 2.2,
                        bondLength: 18,
                        fontSizeLarge: 6,
                        fontSizeSmall: 4,
                        overlapSensitivity: 1.8,
                        doubleBondSpacing: 4
                    };
                    
                    const drawer = new SmilesDrawer.SvgDrawer(drawerOptions);
                    
                    SmilesDrawer.parse(smilesText, function(tree) {
                        drawer.draw(tree, svgId, theme, false);
                    }, function(err) {
                        console.error("Smiles parsing error: ", err);
                        wrapper.innerHTML = `<div style="color: var(--callout-important); border: 1px solid var(--border); padding: 12px; border-radius: 8px; font-size: 0.9em; font-family: 'Inter', sans-serif;">분자식 파싱 실패: <span style="font-family: monospace;">${smilesText}</span></div>`;
                    });
                } catch (e) {
                    console.error("SmilesDrawer error: ", e);
                }
            }
        }

        // ----------------- 수식 & 그래픽 & 콜아웃 파싱 핵심 로직 -----------------
        
        let mathBlocks = [];
        
        function maskLaTeX(text) {
            mathBlocks = [];
            // 1. Block 수식 ($$수식$$) 마스킹
            text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
                const placeholder = `%%BLOCK_MATH_${mathBlocks.length}%%`;
                mathBlocks.push({ id: placeholder, math: math.trim(), block: true });
                return placeholder;
            });
            // 2. Inline 수식 ($수식$) 마스킹
            text = text.replace(/\$([^\$\n\r]+?)\$/g, (match, math) => {
                const placeholder = `%%INLINE_MATH_${mathBlocks.length}%%`;
                mathBlocks.push({ id: placeholder, math: math.trim(), block: false });
                return placeholder;
            });
            return text;
        }

        function unmaskAndRenderLaTeX(html) {
            mathBlocks.forEach(item => {
                try {
                    const rendered = katex.renderToString(item.math, {
                        displayMode: item.block,
                        throwOnError: false
                    });
                    html = html.replace(item.id, rendered);
                } catch (e) {
                    html = html.replace(item.id, `<span class="math-error" title="${e.message}">${item.math}</span>`);
                }
            });
            return html;
        }

        function resolveImagePaths(html) {
            // 이미지 주소가 relative일 경우 /workspace/ 경로로 우회 서빙
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const images = div.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/workspace/')) {
                    // relative 경로는 백엔드 Bottle static 서버 경로로 라우팅
                    img.setAttribute('src', `/workspace/${src}`);
                }
            });
            return div.innerHTML;
        }

        function parseCallouts(text) {
            // 1. Quarto 스타일 콜아웃: ::: {.callout-note} ... :::
            const quartoRegex = new RegExp(":::[\\s]*[\\{][\\s]*[\\.]callout-([\\w]+)[\\s]*[\\}][\\s]*[\\n]([\\s\\S]*?)[\\n][\\s]*:::", "g");
            text = text.replace(quartoRegex, (match, type, content) => {
                const title = type.charAt(0).toUpperCase() + type.slice(1);
                return `<div class="callout callout-${type}">
                            <div class="callout-header"><span class="callout-icon"></span>${title}</div>
                            <div class="callout-content">${marked.parse(content)}</div>
                        </div>`;
            });

            // 2. Github Alert 스타일 콜아웃: > [!NOTE]
            const githubRegex = new RegExp(">[ \\t]*\\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\\][ \\t]*\\n((?:>[ \\t]*.*\\n?)*)", "gi");
            text = text.replace(githubRegex, (match, type, content) => {
                const cleanContent = content.replace(/^>[ \t]?/gm, '');
                const lowerType = type.toLowerCase();
                return `<div class="callout callout-${lowerType}">
                            <div class="callout-header"><span class="callout-icon"></span>${type.toUpperCase()}</div>
                            <div class="callout-content">${marked.parse(cleanContent)}</div>
                        </div>`;
            });
            
            return text;
        }

        async function renderMermaid(container) {
            const blocks = container.querySelectorAll('pre code.language-mermaid');
            for (let index = 0; index < blocks.length; index++) {
                const codeEl = blocks[index];
                const preEl = codeEl.parentElement;
                const codeText = codeEl.textContent.trim();
                
                const containerDiv = document.createElement('div');
                containerDiv.className = 'mermaid-container';
                
                const id = `mermaid-chart-${index}`;
                const graphDiv = document.createElement('div');
                graphDiv.className = 'mermaid';
                graphDiv.id = id;
                
                // 컨트롤 패널 overlay 생성
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'mermaid-controls';
                
                // 돋보기(확대/축소) 버튼 생성
                const zoomBtn = document.createElement('button');
                zoomBtn.className = 'mermaid-zoom-btn';
                zoomBtn.innerHTML = '<i data-lucide="maximize-2" style="width: 12px; height: 12px;"></i><span>' + t('mermaid_zoom_orig') + '</span>';
                zoomBtn.onclick = () => toggleMermaidZoom(zoomBtn);
                
                // 전체화면 버튼 생성
                const fsBtn = document.createElement('button');
                fsBtn.className = 'mermaid-fs-btn';
                fsBtn.innerHTML = '<i data-lucide="expand" style="width: 12px; height: 12px;"></i><span>' + t('mermaid_fullscreen') + '</span>';
                fsBtn.onclick = () => openMermaidFullscreen(fsBtn);
                
                controlsDiv.appendChild(zoomBtn);
                controlsDiv.appendChild(fsBtn);
                
                containerDiv.appendChild(controlsDiv);
                containerDiv.appendChild(graphDiv);
                preEl.replaceWith(containerDiv);
                
                try {
                    // Mermaid 문법 검사 후 드로잉
                    await mermaid.parse(codeText);
                    const { svg, bindFunctions } = await mermaid.render(`mermaid-svg-${index}`, codeText);
                    graphDiv.innerHTML = svg;
                    
                    const renderedSvg = graphDiv.querySelector('svg');
                    if (renderedSvg) {
                        // WebView2 폰트 렌더링 오차로 인한 하단 잘림 해결: 높이를 15px 보정하여 안전 공간 확보
                        const curHeightAttr = renderedSvg.getAttribute('height');
                        if (curHeightAttr) {
                            const curHeight = parseFloat(curHeightAttr);
                            if (!isNaN(curHeight)) {
                                renderedSvg.setAttribute('height', (curHeight + 15) + 'px');
                            }
                        }
                        if (renderedSvg.style.height) {
                            const curStyleHeight = parseFloat(renderedSvg.style.height);
                            if (!isNaN(curStyleHeight)) {
                                renderedSvg.style.height = (curStyleHeight + 15) + 'px';
                            }
                        }
                    }

                    if (bindFunctions) {
                        bindFunctions(graphDiv);
                    }
                    if (window.lucide) lucide.createIcons();
                } catch (err) {
                    // 에러 시 컨트롤 패널 제거
                    controlsDiv.remove();
                    containerDiv.innerHTML = `
                        <div class="mermaid-error">
                            <div class="error-title">
                                <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
                                <span>${t('mermaid_syntax_error')}</span>
                            </div>
                            <div style="font-size: 0.85em; opacity: 0.85; margin-bottom: 8px;">${t('mermaid_syntax_error_desc')}</div>
                            <pre style="margin: 0; background: rgba(0,0,0,0.2) !important; font-size:0.8em; color: #ef4444; border:none; padding:8px;">${err.message || err}</pre>
                        </div>
                    `;
                    if (window.lucide) lucide.createIcons();
                }
            }
        }

        function toggleMermaidZoom(btn) {
            const container = btn.closest('.mermaid-container') || btn.closest('.cm-wysiwyg-mermaid-container');
            if (!container) return;
            const isZoomed = container.classList.toggle('zoomed');
            const svg = container.querySelector('svg:not(.lucide)');
            const icon = btn.querySelector('[data-lucide]');
            
            if (svg) {
                if (isZoomed) {
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
                    if (icon) icon.setAttribute('data-lucide', 'minimize-2');
                    
                    // 원본 크기로 강제 확대하기 위해 viewBox 또는 원래 style의 max-width 값을 width로 임시 설정
                    const maxWidthStyle = svg.style.maxWidth;
                    if (maxWidthStyle && maxWidthStyle !== 'none') {
                        svg.setAttribute('data-original-max-width', maxWidthStyle);
                        svg.style.width = maxWidthStyle; // e.g. "638px"
                        svg.style.maxWidth = 'none';
                    } else {
                        // style에 없으면 viewBox에서 추출
                        const viewBox = svg.getAttribute('viewBox');
                        if (viewBox) {
                            const widthVal = viewBox.split(' ')[2];
                            if (widthVal) {
                                svg.style.width = widthVal + 'px';
                                svg.style.maxWidth = 'none';
                            }
                        }
                    }
                } else {
                    btn.querySelector('span').innerText = t('mermaid_zoom_orig');
                    if (icon) icon.setAttribute('data-lucide', 'maximize-2');
                    
                    // 원래 상태로 환원
                    svg.style.width = '';
                    svg.style.maxWidth = '';
                }
            } else {
                if (isZoomed) {
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
                    if (icon) icon.setAttribute('data-lucide', 'minimize-2');
                } else {
                    btn.querySelector('span').innerText = t('mermaid_zoom_orig');
                    if (icon) icon.setAttribute('data-lucide', 'maximize-2');
                }
            }
            if (window.lucide) lucide.createIcons();
        }

        function openMermaidFullscreen(btn) {
            const container = btn.closest('.mermaid-container') || 
                              btn.closest('.cm-wysiwyg-mermaid-container') || 
                              btn.closest('.cm-wysiwyg-html-container') || 
                              btn.closest('.cm-content') || 
                              btn.parentElement.parentElement;
                              
            if (!container) return;
            
            // 버튼 내부의 아이콘 svg를 완전히 배제하고 진짜 본체 svg만 골라냄
            let svgs = container.querySelectorAll('svg');
            let svg = null;
            for (let s of svgs) {
                if (s.closest('button')) continue; // 버튼 자식으로 포섭된 아이콘 svg 필터링
                if (s.classList.contains('lucide') || s.getAttribute('data-lucide')) continue;
                svg = s;
                break;
            }
            
            if (!svg) {
                svg = container.querySelector('.mermaid svg') || container.querySelector('svg[id*="svg"]') || container.querySelector('svg');
                if (svg && svg.closest('button')) svg = null;
            }
            
            if (!svg) return;
            
            const modal = document.getElementById('mermaid-fs-modal');
            const content = modal.querySelector('.fs-modal-content');
            
            content.innerHTML = svg.outerHTML;
            
            content.querySelectorAll('.wiki-link').forEach(el => {
                el.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeMermaidFullscreen();
                    if (window.openWikiLink) window.openWikiLink(this.getAttribute('data-target'));
                });
            });
            
            modal.style.display = 'flex';
            modal.offsetHeight;
            modal.classList.add('show');
            
            const fsSvg = content.querySelector('svg');
            if (fsSvg) {
                const viewBox = fsSvg.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/\s+/);
                    if (parts.length >= 4) {
                        const vbWidth = parseFloat(parts[2]);
                        const vbHeight = parseFloat(parts[3]);
                        if (!isNaN(vbWidth) && !isNaN(vbHeight)) {
                            fsSvg.style.setProperty('width', vbWidth + 'px', 'important');
                            fsSvg.style.setProperty('height', vbHeight + 'px', 'important');
                        }
                    }
                } else {
                    fsSvg.style.setProperty('width', 'auto', 'important');
                    fsSvg.style.setProperty('height', 'auto', 'important');
                }
                fsSvg.style.setProperty('max-width', '100%', 'important');
                fsSvg.style.setProperty('max-height', '90vh', 'important');
            }
            
            document.addEventListener('keydown', handleFsEsc);
            if (window.lucide) lucide.createIcons();
        }

        function closeMermaidFullscreen(event) {
            if (event && event.target.closest('.fs-modal-content')) return;
            
            const modal = document.getElementById('mermaid-fs-modal');
            modal.classList.remove('show');
            
            setTimeout(() => {
                modal.style.display = 'none';
                modal.querySelector('.fs-modal-content').innerHTML = "";
            }, 300);
            
            document.removeEventListener('keydown', handleFsEsc);
        }

        function handleFsEsc(e) {
            if (e.key === 'Escape') {
                closeMermaidFullscreen();
            }
        }

        // 글로벌 바인딩 (사용자 수동 HTML/SVG 마인드맵의 onclick 속성 대응)
        window.openMermaidFullscreen = openMermaidFullscreen;
        window.closeMermaidFullscreen = closeMermaidFullscreen;
        window.toggleMermaidZoom = toggleMermaidZoom;

        function undoEditor() {
            const view = window.cmEditor;
            if (view && window.cm6) {
                import("https://esm.sh/@codemirror/commands@6.3.3?deps=@codemirror/view@6.42.0,@codemirror/state@6.4.1").then(cmds => {
                    const undone = cmds.undo(view);
                    if (undone) {
                        showToast(t('msg_undo_done'));
                    }
                }).catch(err => console.error("Undo error:", err));
            }
        }

        function redoEditor() {
            const view = window.cmEditor;
            if (view && window.cm6) {
                import("https://esm.sh/@codemirror/commands@6.3.3?deps=@codemirror/view@6.42.0,@codemirror/state@6.4.1").then(cmds => {
                    const redone = cmds.redo(view);
                    if (redone) {
                        showToast(t('msg_redo_done'));
                    }
                }).catch(err => console.error("Redo error:", err));
            }
        }

        // 사이드바 수식 입력기 및 화학식 검색기, 다이어그램, 태그 탭 전환 기능
        function setSidebarTab(tab) {
            const explorerPane = document.getElementById('sidebar-content-explorer');
            const mathPane = document.getElementById('sidebar-content-math');
            const chemistryPane = document.getElementById('sidebar-content-chemistry');
            const diagramPane = document.getElementById('sidebar-content-diagram');
            const tagsPane = document.getElementById('sidebar-content-tags');
            
            const tabBtnExplorer = document.getElementById('tab-explorer');
            const tabBtnMath = document.getElementById('tab-math');
            const tabBtnChemistry = document.getElementById('tab-chemistry');
            const tabBtnDiagram = document.getElementById('tab-diagram');
            const tabBtnTags = document.getElementById('tab-tags');
            
            // 모든 패널 숨김
            explorerPane.style.display = 'none';
            mathPane.style.display = 'none';
            if (chemistryPane) chemistryPane.style.display = 'none';
            if (diagramPane) diagramPane.style.display = 'none';
            if (tagsPane) tagsPane.style.display = 'none';
            
            // 모든 탭 버튼 비활성화
            tabBtnExplorer.classList.remove('active');
            tabBtnMath.classList.remove('active');
            if (tabBtnChemistry) tabBtnChemistry.classList.remove('active');
            if (tabBtnDiagram) tabBtnDiagram.classList.remove('active');
            if (tabBtnTags) tabBtnTags.classList.remove('active');
            
            tabBtnExplorer.style.borderBottom = '2px solid transparent';
            tabBtnExplorer.style.color = 'var(--text-muted)';
            tabBtnMath.style.borderBottom = '2px solid transparent';
            tabBtnMath.style.color = 'var(--text-muted)';
            if (tabBtnChemistry) {
                tabBtnChemistry.style.borderBottom = '2px solid transparent';
                tabBtnChemistry.style.color = 'var(--text-muted)';
            }
            if (tabBtnDiagram) {
                tabBtnDiagram.style.borderBottom = '2px solid transparent';
                tabBtnDiagram.style.color = 'var(--text-muted)';
            }
            if (tabBtnTags) {
                tabBtnTags.style.borderBottom = '2px solid transparent';
                tabBtnTags.style.color = 'var(--text-muted)';
            }
            
            // 선택된 탭 활성화
            if (tab === 'explorer') {
                explorerPane.style.display = 'flex';
                tabBtnExplorer.classList.add('active');
                tabBtnExplorer.style.borderBottom = '2px solid var(--accent)';
                tabBtnExplorer.style.color = 'var(--text-main)';
            } else if (tab === 'math') {
                mathPane.style.display = 'flex';
                tabBtnMath.classList.add('active');
                tabBtnMath.style.borderBottom = '2px solid var(--accent)';
                tabBtnMath.style.color = 'var(--text-main)';
                renderSidebarMath();
            } else if (tab === 'chemistry') {
                if (chemistryPane) chemistryPane.style.display = 'flex';
                if (tabBtnChemistry) {
                    tabBtnChemistry.classList.add('active');
                    tabBtnChemistry.style.borderBottom = '2px solid var(--accent)';
                    tabBtnChemistry.style.color = 'var(--text-main)';
                }
            } else if (tab === 'diagram') {
                if (diagramPane) diagramPane.style.display = 'flex';
                if (tabBtnDiagram) {
                    tabBtnDiagram.classList.add('active');
                    tabBtnDiagram.style.borderBottom = '2px solid var(--accent)';
                    tabBtnDiagram.style.color = 'var(--text-main)';
                }
            } else if (tab === 'tags') {
                if (tagsPane) tagsPane.style.display = 'flex';
                if (tabBtnTags) {
                    tabBtnTags.classList.add('active');
                    tabBtnTags.style.borderBottom = '2px solid var(--accent)';
                    tabBtnTags.style.color = 'var(--text-main)';
                }
                loadWorkspaceTags();
            }
        }

        // 다이어그램 템플릿 삽입 기능
        function insertDiagramTemplate(type) {
            let template = "";
            switch (type) {
                case 'mindmap':
                    template = "```mermaid\\nmindmap\\n  root((?중심 토픽))\\n    주제 1\\n      세부내용 A\\n      세부내용 B\\n    주제 2\\n      세부내용 C\\n      세부내용 D\\n```\\n";
                    break;
                case 'orgchart':
                    template = "```mermaid\\nflowchart TD\\n  CEO(?대표이사) --> 이사회\\n  CEO --> 부사장\\n  부사장 --> 개발본부\\n  부사장 --> 마케팅본부\\n  개발본부 --> 개발1팀\\n  개발본부 --> 개발2팀\\n```\\n";
                    break;
                case 'flowchart':
                    template = "```mermaid\\nflowchart TD\\n  Start(시작) --> Input(?데이터 입력)\\n  Input --> Dec{조건 판단}\\n  Dec -- Yes --> Process[작업 처리]\\n  Dec -- No --> End(종료)\\n  Process --> End\\n```\\n";
                    break;
                case 'state':
                    template = "```mermaid\\nstateDiagram-v2\\n  [*] --> Idle\\n  Idle --> Processing: ?작업 시작\\n  Processing --> Success: 성공\\n  Processing --> Failed: 실패\\n  Success --> [*]\\n  Failed --> Idle: 재시도\\n```\\n";
                    break;
                case 'sequence':
                    template = "```mermaid\\nsequenceDiagram\\n  actor User as ?사용자\\n  participant App as 클라이언트\\n  participant Server as 서버\\n\\n  User->>App: 버튼 클릭\\n  App->>Server: API 요청 (data)\\n  Server-->>App: JSON 응답 (success)\\n  App-->>User: 결과 화면 렌더링\\n```\\n";
                    break;
                case 'class':
                    template = "```mermaid\\nclassDiagram\\n  class ?Animal {\\n    +String name\\n    +int age\\n    +makeSound()\\n  }\\n  class Dog {\\n    +String breed\\n    +bark()\\n  }\\n  Animal <|-- Dog\\n```\\n";
                    break;
                case 'gantt':
                    template = "```mermaid\\ngantt\\n  title ?프로젝트 개발 일정\\n  dateFormat  YYYY-MM-DD\\n  section 분석 및 설계\\n  요구사항 분석           :a1, 2026-05-25, 5d\\n  시스템 설계             :after a1  , 4d\\n  section 구현 및 테스트\\n  핵심 프론트엔드 개발     :active, b1, 2026-05-30, 8d\\n  백엔드 API 연동         :b2, after b1  , 6d\\n  통합 테스트             :c1, after b2  , 4d\\n```\\n";
                    break;
                case 'pie':
                    template = "```mermaid\\npie title ?시장 점유율 분석\\n  \\\"A사\\\" : 42.5\\n  \\\"B사\\\" : 31.8\\n  \\\"C사\\\" : 15.2\\n  \\\"기타\\\" : 10.5\\n```\\n";
                    break;
            }
            insertMathSymbol(template);
        }

        let mathDatabase = [];
        let mathTranslations = {};
        let hasExternalMathDb = false;

        // 비동기 수식 DB 및 번역 맵 로드
        Promise.all([
            fetch('/static/data/math_db.json').then(res => {
                if (!res.ok) throw new Error('Failed to fetch math_db.json');
                return res.json();
            }),
            fetch('/static/data/math_db_translations.json').then(res => {
                if (!res.ok) throw new Error('Failed to fetch math_db_translations.json');
                return res.json();
            }).catch(() => ({}))
        ])
        .then(([db, trans]) => {
            mathDatabase = db;
            mathTranslations = trans;
        })
        .catch(err => {
            console.warn('Math database or translations load failed, using local fallback:', err);
            mathDatabase = [];
            mathTranslations = {};
        });

        function formatFormulaName(name, keywords, lang) {
            const parenRegex = /\s*\(\s*([A-Za-z0-9\s\-',]+)\s*\)/;
            const match = name.match(parenRegex);
            
            if (lang === 'en') {
                if (match) {
                    return match[1].trim();
                } else {
                    const trimmedName = name.trim();
                    if (mathTranslations && mathTranslations[trimmedName]) {
                        return mathTranslations[trimmedName];
                    }
                    if (keywords && keywords.length > 0) {
                        const engKws = keywords.filter(kw => /^[a-zA-Z0-9\+\-]+$/.test(kw));
                        if (engKws.length > 0) {
                            const words = engKws.slice(0, 3).map(kw => {
                                return kw.charAt(0).toUpperCase() + kw.slice(1);
                            });
                            return words.join(' ');
                        }
                    }
                    return name;
                }
            } else {
                if (match) {
                    return name.replace(parenRegex, '').trim();
                }
                return name;
            }
        }

        const MATH_SUBTAB_CATEGORIES = {
            math: [
                { value: 'basic', labelKey: 'math_title_basic', label: '기본 수식' },
                { value: 'calculus', labelKey: 'math_title_calculus', label: '미적분 및 극한' },
                { value: 'greek', labelKey: 'math_title_greek', label: '그리스 문자' },
                { value: 'symbols', labelKey: 'math_title_symbols', label: '기본 수학 기호' },
                { value: 'spec_operators', labelKey: 'math_title_spec_operators', label: '전문 수학 연산자' },
                { value: 'set_logic', labelKey: 'math_title_set_logic', label: '집합론 및 논리' },
                { value: 'lin_alg', labelKey: 'math_title_lin_alg', label: '선형대수 및 행렬' }
            ],
            physics: [
                { value: 'phys_ops', labelKey: 'math_title_physics_ops', label: '기본 연산자' },
                { value: 'em_gravity', labelKey: 'math_title_em_gravity', label: '전자기학 및 중력' },
                { value: 'quantum', labelKey: 'math_title_quantum', label: '양자 및 상대성' },
                { value: 'fluid', labelKey: 'math_title_fluid', label: '유체역학' },
                { value: 'thermo', labelKey: 'math_title_thermo', label: '열역학' }
            ],
            bio: [
                { value: 'rxn', labelKey: 'math_title_rxn', label: '화학 반응 및 평형' },
                { value: 'genetics', labelKey: 'math_title_genetics', label: '유전학 및 집단유전학' },
                { value: 'molbio', labelKey: 'math_title_molbio', label: '분자생물학' },
                { value: 'protein', labelKey: 'math_title_biochem', label: '단백질 및 생화학' }
            ],
            cs: [
                { value: 'cs_ops', labelKey: 'math_title_cs_ops', label: '자주 쓰이는 연산자' },
                { value: 'algo_cs', labelKey: 'math_title_algo_cs', label: '알고리즘 & 컴퓨터 과학' },
                { value: 'ml_ai', labelKey: 'math_title_ml_ai', label: '머신러닝 & AI' },
                { value: 'deep_learning', labelKey: 'math_title_deep_learning', label: '딥러닝' },
                { value: 'info_theory', labelKey: 'math_title_info_theory', label: '정보이론' },
                { value: 'comp_arch', labelKey: 'math_title_comp_arch', label: '컴퓨터 구조' },
                { value: 'crypto', labelKey: 'math_title_crypto', label: '암호학' },
                { value: 'hash_integrity', labelKey: 'math_title_hash_integrity', label: '해시 함수 & 무결성' },
                { value: 'net_security', labelKey: 'math_title_net_security', label: '네트워크 보안' },
                { value: 'info_security', labelKey: 'math_title_info_security', label: '정보이론 기반' }
            ],
            ee: [
                { value: 'ee_ops', labelKey: 'math_title_ee_ops', label: '자주 쓰이는 연산자' },
                { value: 'ee_circuits', labelKey: 'math_title_ee_circuits', label: '회로 이론' },
                { value: 'ee_em', labelKey: 'math_title_ee_em', label: '전자기학' },
                { value: 'ee_signals', labelKey: 'math_title_ee_signals', label: '신호 및 시스템' },
                { value: 'ee_semicon', labelKey: 'math_title_ee_semicon', label: '반도체 물리' },
                { value: 'ee_control', labelKey: 'math_title_ee_control', label: '제어공학' }
            ]
        };

        function updateMathCategorySelect(subtab) {
            const selectEl = document.getElementById('math-category-select');
            if (!selectEl) return;
            const allText = (translations[currentLang] && translations[currentLang]['lbl_all']) || '전체';
            selectEl.innerHTML = `<option value="all">${allText}</option>`;
            const categories = MATH_SUBTAB_CATEGORIES[subtab];
            if (categories) {
                categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.value;
                    let text = cat.label;
                    if (cat.labelKey && translations[currentLang] && translations[currentLang][cat.labelKey]) {
                        text = translations[currentLang][cat.labelKey];
                    }
                    opt.textContent = text;
                    selectEl.appendChild(opt);
                });
            }
        }

        function filterMathSymbols() {
            const query = (document.getElementById('math-search-input')?.value || '').toLowerCase().trim();
            const subcategory = document.getElementById('math-category-select')?.value || 'all';
            
            const activeSubtab = document.querySelector('.math-subtab-btn.active');
            if (!activeSubtab) return;
            const subtabId = activeSubtab.id.replace('subtab-math-', '');
            const activeContent = document.getElementById(`math-subtab-content-${subtabId}`);
            if (!activeContent) return;
            
            let totalStaticMatches = 0;

            // 1. 기존 정적 DOM 수식 항목 필터링
            const sections = activeContent.querySelectorAll('.math-section, details.math-section-accordion');
            sections.forEach(section => {
                if (section.id === 'math-extended-search-accordion') return;
                
                let sectionMatchCount = 0;
                const sectionId = section.getAttribute('data-section-id');
                
                const items = section.querySelectorAll('.math-item, .math-item-small');
                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    const rawMath = (item.getAttribute('data-raw-math') || '').toLowerCase();
                    
                    const matchesQuery = !query || text.includes(query) || rawMath.includes(query);
                    const matchesCategory = (subcategory === 'all' || sectionId === subcategory);
                    
                    if (matchesQuery && matchesCategory) {
                        item.style.display = '';
                        sectionMatchCount++;
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                if (sectionMatchCount > 0) {
                    section.style.display = '';
                    if (section.tagName === 'DETAILS' && query) {
                        section.open = true;
                    }
                    totalStaticMatches += sectionMatchCount;
                } else {
                    section.style.display = 'none';
                }
            });
            
            // 2. 확장 수식 DB 검색 및 결과 동적 렌더링
            const existingExtended = activeContent.querySelector('#math-extended-search-accordion');
            if (existingExtended) {
                existingExtended.remove();
            }
            
            // 실행파일 경로에 math_db.json이 존재하는 경우(hasExternalMathDb = true)에는 기본검색에서 매칭된 결과가 없을 때(totalStaticMatches === 0)만 검색되도록 설정
            const shouldSearchDb = query && mathDatabase.length > 0 && (!hasExternalMathDb || totalStaticMatches === 0);
            
            if (shouldSearchDb) {
                // 현재 분야에 매칭되고 쿼리에 부합하는 항목 필터링
                const matchedDbItems = mathDatabase.filter(item => {
                    if (item.category !== subtabId) return false;
                    if (subcategory !== 'all') return false;
                    
                    const nameMatch = item.name.toLowerCase().includes(query);
                    const latexMatch = item.latex.toLowerCase().includes(query);
                    const kwMatch = item.keywords.some(kw => kw.toLowerCase().includes(query));
                    return nameMatch || latexMatch || kwMatch;
                });
                
                if (matchedDbItems.length > 0) {
                    const maxDisplay = 15;
                    const displayItems = matchedDbItems.slice(0, maxDisplay);
                    
                    const extendedDetails = document.createElement('details');
                    extendedDetails.className = 'math-section-accordion';
                    extendedDetails.id = 'math-extended-search-accordion';
                    extendedDetails.open = true;
                    extendedDetails.setAttribute('data-section-id', 'extended');
                    
                    const extendedSummary = document.createElement('summary');
                    extendedSummary.className = 'math-section-title';
                    const searchResultsText = currentLang === 'en' ? 'Extra Search Results' : '추가 검색 결과';
                    const itemsText = currentLang === 'en' ? 'items' : '개';
                    extendedSummary.innerHTML = `🔍 ${searchResultsText} (${matchedDbItems.length}${itemsText})`;
                    extendedDetails.appendChild(extendedSummary);
                    
                    const extendedGrid = document.createElement('div');
                    extendedGrid.className = 'math-grid';
                    
                    displayItems.forEach(dbItem => {
                        const btn = document.createElement('button');
                        btn.className = 'math-item';
                        
                        let latex = dbItem.latex;
                        let insertVal = (latex.startsWith('$') && latex.endsWith('$')) ? latex : `\$${latex}\$`;
                        
                        btn.setAttribute('onclick', `insertMathSymbol(${JSON.stringify(insertVal)})`);
                        btn.setAttribute('data-raw-math', dbItem.latex);
                        
                        const span = document.createElement('span');
                        span.textContent = formatFormulaName(dbItem.name, dbItem.keywords, currentLang);
                        btn.appendChild(span);
                        
                        extendedGrid.appendChild(btn);
                    });
                    
                    if (matchedDbItems.length > maxDisplay) {
                        const moreInfo = document.createElement('div');
                        moreInfo.style.cssText = 'grid-column: 1 / -1; text-align: center; font-size: 0.78em; color: var(--text-muted); margin-top: 6px;';
                        if (currentLang === 'en') {
                            moreInfo.textContent = `...and ${matchedDbItems.length - maxDisplay} more formulas. Search with more specific keywords.`;
                        } else {
                            moreInfo.textContent = `...외 ${matchedDbItems.length - maxDisplay}개의 공식이 더 있습니다. 더 자세한 키워드로 검색해 보세요.`;
                        }
                        extendedGrid.appendChild(moreInfo);
                    }
                    
                    extendedDetails.appendChild(extendedGrid);
                    activeContent.appendChild(extendedDetails);
                    
                    isSidebarMathRendered = false;
                    renderSidebarMath();
                }
            }
        }

        function setMathSubTab(subtab) {
            const subtabMath = document.getElementById('subtab-math-math');
            const subtabPhysics = document.getElementById('subtab-math-physics');
            const subtabBio = document.getElementById('subtab-math-bio');
            const subtabCs = document.getElementById('subtab-math-cs');
            const subtabEe = document.getElementById('subtab-math-ee');
            
            const contentMath = document.getElementById('math-subtab-content-math');
            const contentPhysics = document.getElementById('math-subtab-content-physics');
            const contentBio = document.getElementById('math-subtab-content-bio');
            const contentCs = document.getElementById('math-subtab-content-cs');
            const contentEe = document.getElementById('math-subtab-content-ee');
            
            // 모든 콘텐츠 숨김
            contentMath.style.display = 'none';
            contentPhysics.style.display = 'none';
            contentBio.style.display = 'none';
            if (contentCs) contentCs.style.display = 'none';
            if (contentEe) contentEe.style.display = 'none';
            
            // 모든 탭 버튼 비활성화
            subtabMath.classList.remove('active');
            subtabPhysics.classList.remove('active');
            subtabBio.classList.remove('active');
            if (subtabCs) subtabCs.classList.remove('active');
            if (subtabEe) subtabEe.classList.remove('active');
            
            subtabMath.style.background = 'transparent';
            subtabMath.style.color = 'var(--text-muted)';
            subtabPhysics.style.background = 'transparent';
            subtabPhysics.style.color = 'var(--text-muted)';
            subtabBio.style.background = 'transparent';
            subtabBio.style.color = 'var(--text-muted)';
            if (subtabCs) {
                subtabCs.style.background = 'transparent';
                subtabCs.style.color = 'var(--text-muted)';
            }
            if (subtabEe) {
                subtabEe.style.background = 'transparent';
                subtabEe.style.color = 'var(--text-muted)';
            }
            
            // 선택된 탭 활성화
            if (subtab === 'math') {
                contentMath.style.display = 'flex';
                subtabMath.classList.add('active');
                subtabMath.style.background = 'var(--accent-glow)';
                subtabMath.style.color = 'var(--accent)';
            } else if (subtab === 'physics') {
                contentPhysics.style.display = 'flex';
                subtabPhysics.classList.add('active');
                subtabPhysics.style.background = 'var(--accent-glow)';
                subtabPhysics.style.color = 'var(--accent)';
            } else if (subtab === 'bio') {
                contentBio.style.display = 'flex';
                subtabBio.classList.add('active');
                subtabBio.style.background = 'var(--accent-glow)';
                subtabBio.style.color = 'var(--accent)';
            } else if (subtab === 'cs') {
                if (contentCs) contentCs.style.display = 'flex';
                if (subtabCs) {
                    subtabCs.classList.add('active');
                    subtabCs.style.background = 'var(--accent-glow)';
                    subtabCs.style.color = 'var(--accent)';
                }
            } else if (subtab === 'ee') {
                if (contentEe) contentEe.style.display = 'flex';
                if (subtabEe) {
                    subtabEe.classList.add('active');
                    subtabEe.style.background = 'var(--accent-glow)';
                    subtabEe.style.color = 'var(--accent)';
                }
            }
            
            // 카테고리 셀렉트 업데이트 및 검색필터 초기화
            updateMathCategorySelect(subtab);
            const searchInput = document.getElementById('math-search-input');
            if (searchInput) searchInput.value = '';
            filterMathSymbols();
            
            // KaTeX 렌더링 트리거 (렌더러 상태 플래그 초기화하여 새로운 영역도 렌더링되게 함)
            isSidebarMathRendered = false; 
            renderSidebarMath();
        }

        function insertMathSymbol(latex) {
            const view = window.cmEditor;
            if (!view) {
                // Fallback to legacy textarea if not initialized
                const textarea = document.getElementById('editor');
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                let replacement = latex;
                if (start !== end) {
                    const selected = text.substring(start, end);
                    if (latex.includes('?')) {
                        replacement = latex.replace('?', selected);
                    } else {
                        replacement = selected + latex;
                    }
                }
                const before = text.substring(0, start);
                const after = text.substring(end);
                textarea.value = before + replacement + after;
                const qIndex = replacement.indexOf('?');
                textarea.focus();
                if (replacement.includes('?') && qIndex !== -1) {
                    const targetPos = start + qIndex;
                    textarea.selectionStart = targetPos;
                    textarea.selectionEnd = targetPos + 1;
                } else {
                    textarea.selectionStart = textarea.selectionEnd = start + replacement.length;
                }
                handleEditorInput();
                showToast(t('msg_math_inserted'));
                return;
            }
            
            const state = view.state;
            const ranges = state.selection.ranges;
            if (ranges.length === 0) return;
            
            const range = ranges[0];
            const start = range.from;
            const end = range.to;
            const text = state.doc.toString();
            const selected = text.substring(start, end);
            
            let replacement = latex;
            if (start !== end) {
                if (latex.includes('?')) {
                    replacement = latex.replace('?', selected);
                } else {
                    replacement = selected + latex;
                }
            }
            
            view.dispatch(view.state.replaceSelection(replacement));
            
            const qIndex = replacement.indexOf('?');
            view.focus();
            if (replacement.includes('?') && qIndex !== -1) {
                const targetPos = start + qIndex;
                view.dispatch({
                    selection: { anchor: targetPos, head: targetPos + 1 }
                });
            } else {
                const newPos = start + replacement.length;
                view.dispatch({
                    selection: { anchor: newPos, head: newPos }
                });
            }
            
            handleEditorInput();
            showToast(t('msg_math_inserted'));
        }

        let isSidebarMathRendered = false;
        function renderSidebarMath() {
            // 모든 수식 항목 단추에 data-raw-math가 이미 하드코딩되어 있으므로 특별한 렌더링 작업을 하지 않고 바로 리턴합니다.
            isSidebarMathRendered = true;
        }

        // PubChem 화학식 연동 검색 실행
        let currentSearchResultSmiles = "";
        
        async function searchChemistryPubChem() {
            const inputEl = document.getElementById('chemistry-search-input');
            const query = inputEl.value.trim();
            if (!query) {
                alert(t('msg_chem_search_empty'));
                return;
            }
            
            const loadingEl = document.getElementById('chemistry-search-loading');
            const resultEl = document.getElementById('chemistry-search-result');
            
            loadingEl.style.display = 'flex';
            resultEl.style.display = 'none';
            
            try {
                if (!window.pywebview) {
                    throw new Error(t('msg_chem_backend_err'));
                }
                
                const res = await pywebview.api.search_pubchem_smiles(query);
                loadingEl.style.display = 'none';
                
                if (res.status === 'success') {
                    // 성공 피드백 및 프리뷰 바인딩
                    document.getElementById('chem-result-name').innerText = res.name;
                    document.getElementById('chem-result-cid').innerText = `PubChem CID: ${res.cid}`;
                    document.getElementById('chem-result-smiles').value = res.smiles;
                    currentSearchResultSmiles = res.smiles;
                    
                    resultEl.style.display = 'flex';
                    
                    // 2D 벡터 구조식 즉시 프리뷰 렌더링
                    renderSearchPreview(res.smiles);
                    showToast(t('msg_chem_found'));
                } else {
                    alert(res.message);
                }
            } catch (err) {
                loadingEl.style.display = 'none';
                alert(t('msg_chem_search_failed') + err.message);
            }
        }
        
        // 검색 결과 분자 구조 프리뷰 렌더링
        function renderSearchPreview(smiles) {
            const svgId = 'chem-preview-svg';
            const svgEl = document.getElementById(svgId);
            svgEl.innerHTML = ""; // 이전 프리뷰 클리어
            
            try {
                const theme = currentTheme === 'light' ? 'light' : 'dark';
                const drawerOptions = {
                    width: 150,
                    height: 150,
                    theme: theme,
                    bondThickness: 2.0,
                    bondLength: 15,
                    fontSizeLarge: 6,
                    fontSizeSmall: 4,
                    overlapSensitivity: 1.8,
                    doubleBondSpacing: 4
                };
                
                const drawer = new SmilesDrawer.SvgDrawer(drawerOptions);
                SmilesDrawer.parse(smiles, function(tree) {
                    drawer.draw(tree, svgId, theme, false);
                }, function(err) {
                    console.error("Preview render parsing error: ", err);
                });
            } catch (e) {
                console.error("Preview render exception: ", e);
            }
        }
        
        // 에디터 커서 위치에 분자식 삽입
        function insertChemistryToEditor() {
            if (!currentSearchResultSmiles) return;
            const view = window.cmEditor;
            if (!view) {
                // Fallback to legacy textarea if not initialized
                const textarea = document.getElementById('editor');
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const smilesBlock = "\n" + "```smiles\n" + currentSearchResultSmiles + "\n" + "```\n";
                textarea.value = text.substring(0, start) + smilesBlock + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + smilesBlock.length;
                handleEditorInput();
                showToast(t('msg_chem_inserted'));
                return;
            }
            
            const state = view.state;
            const ranges = state.selection.ranges;
            if (ranges.length === 0) return;
            
            const start = ranges[0].from;
            const smilesBlock = "\n" + "```smiles\n" + currentSearchResultSmiles + "\n" + "```\n";
            
            view.dispatch(view.state.replaceSelection(smilesBlock));
            
            const newPos = start + smilesBlock.length;
            view.dispatch({
                selection: { anchor: newPos, head: newPos }
            });
            
            view.focus();
            handleEditorInput();
            showToast(t('msg_chem_inserted'));
        }

        function toggleDocumentFullscreen() {
            const pane = document.getElementById('preview-pane');
            if (!document.fullscreenElement) {
                pane.requestFullscreen().then(() => {
                    showToast(t('msg_fullscreen_toast'));
                }).catch(err => {
                    console.error("Fullscreen failed:", err);
                });
            } else {
                document.exitFullscreen();
            }
        }

        // 사이드바 슬라이딩 토글 실행
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar-panel');
            const icon = document.getElementById('sidebar-slide-icon');
            const btn = document.getElementById('sidebar-slide-btn');
            
            const isCollapsed = sidebar.classList.toggle('collapsed');
            
            if (isCollapsed) {
                icon.setAttribute('data-lucide', 'chevron-right');
                btn.title = t('tooltip_toggle_sidebar');
                showToast(t('msg_sidebar_collapsed'));
            } else {
                icon.setAttribute('data-lucide', 'chevron-left');
                btn.title = t('tooltip_toggle_sidebar');
                showToast(t('msg_sidebar_opened'));
            }
            lucide.createIcons();
        }

        // 우측 TOC 슬라이딩 토글 실행
        function toggleToc() {
            const toc = document.getElementById('sidebar-toc');
            const icon = document.getElementById('toc-slide-icon');
            const btn = document.getElementById('toc-slide-btn');
            
            const isCollapsed = toc.classList.toggle('collapsed');
            isTocManualCollapsed = isCollapsed;
            
            if (isCollapsed) {
                icon.setAttribute('data-lucide', 'chevron-left');
                btn.title = t('tooltip_toggle_toc');
                showToast(t('toc_collapsed_msg'));
            } else {
                icon.setAttribute('data-lucide', 'chevron-right');
                btn.title = t('tooltip_toggle_toc');
                showToast(t('toc_opened_msg'));
            }
            lucide.createIcons();
        }

        // Fullscreen 이벤트 및 더블클릭 리스너 등록
        document.addEventListener('fullscreenchange', () => {
            const icon = document.getElementById('fs-doc-icon');
            if (icon) {
                const isFs = !!document.fullscreenElement;
                icon.setAttribute('data-lucide', isFs ? 'shrink' : 'expand');
                lucide.createIcons();
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            const pane = document.getElementById('preview-pane');
            if (pane) {
                pane.addEventListener('dblclick', (e) => {
                    // 버튼, 링크, 코드박스, 이미지 등을 클릭한 게 아닐 때만 작동
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('pre') || e.target.closest('img') || e.target.closest('.mermaid-container')) return;
                    toggleDocumentFullscreen();
                });
            }

            // 수식 입력기 커스텀 미리보기 툴팁 이벤트 바인딩 (이벤트 위임 활용)
            const mathPane = document.getElementById('sidebar-content-math');
            if (mathPane) {
                mathPane.addEventListener('mouseover', (e) => {
                    const item = e.target.closest('.math-item, .math-item-small');
                    if (!item) return;
                    const rawMath = item.getAttribute('data-raw-math');
                    if (!rawMath) return;
                    showMathTooltip(item, rawMath);
                });

                mathPane.addEventListener('mousemove', (e) => {
                    const item = e.target.closest('.math-item, .math-item-small');
                    if (!item) {
                        hideMathTooltip();
                        return;
                    }
                    positionMathTooltip(e.clientX, e.clientY);
                });

                mathPane.addEventListener('mouseout', (e) => {
                    const item = e.target.closest('.math-item, .math-item-small');
                    if (!item) return;
                    hideMathTooltip();
                });
            }
        });

        function applyCodeHighlighting(container) {
            const preBlocks = container.querySelectorAll('pre');
            preBlocks.forEach(pre => {
                const code = pre.querySelector('code');
                if (code) {
                    // 복사 버튼 추가
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'code-copy-btn';
                    copyBtn.innerText = t('btn_copy_code');
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(code.textContent);
                        copyBtn.innerText = t('btn_copy_code_done');
                        copyBtn.style.color = '#10b981';
                        setTimeout(() => {
                            copyBtn.innerText = t('btn_copy_code');
                            copyBtn.style.color = '';
                        }, 2000);
                    };
                    pre.appendChild(copyBtn);
                    
                    // PrismJS 코드 하이라이트
                    Prism.highlightElement(code);
                }
            });
        }

        let isTocManualCollapsed = false;

        function generateTOC(container) {
            const list = document.getElementById('toc-list');
            list.innerHTML = "";
            
            const headings = container.querySelectorAll('h1, h2, h3');
            const tocPanel = document.getElementById('sidebar-toc');
            const tocBtn = document.getElementById('toc-slide-btn');
            
            if (headings.length === 0) {
                tocPanel.style.display = 'none';
                if (tocBtn) tocBtn.style.display = 'none';
                return;
            }
            
            tocPanel.style.display = 'flex';
            if (tocBtn) tocBtn.style.display = 'flex';
            
            // 인라인 스타일 제거하여 CSS 규칙(width)이 적용되도록 함
            tocPanel.style.width = '';
            tocPanel.style.padding = '';
            
            // 수동 접힘 상태에 맞춰 클래스 유지
            if (isTocManualCollapsed) {
                tocPanel.classList.add('collapsed');
                const icon = document.getElementById('toc-slide-icon');
                const btn = document.getElementById('toc-slide-btn');
                if (icon) icon.setAttribute('data-lucide', 'chevron-left');
                if (btn) btn.title = t('tooltip_toggle_toc');
            } else {
                tocPanel.classList.remove('collapsed');
                const icon = document.getElementById('toc-slide-icon');
                const btn = document.getElementById('toc-slide-btn');
                if (icon) icon.setAttribute('data-lucide', 'chevron-right');
                if (btn) btn.title = t('tooltip_toggle_toc');
            }
            if (window.lucide) lucide.createIcons();
            
            headings.forEach((h, index) => {
                const id = `heading-jump-${index}`;
                h.id = id;
                
                const li = document.createElement('li');
                li.className = `toc-item toc-${h.tagName.toLowerCase()}`;
                li.innerText = h.innerText;
                li.onclick = () => {
                    // 1. 미리보기 스크롤 (미리보기 및 스플릿 모드)
                    if (currentViewMode === 'preview' || currentViewMode === 'split') {
                        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    
                    // 2. 에디터 스크롤 (WYSIWYG, 편집기 및 스플릿 모드)
                    if (currentViewMode === 'edit' || currentViewMode === 'wysiwyg' || currentViewMode === 'split') {
                        if (window.cmEditor) {
                            const doc = window.cmEditor.state.doc;
                            const cleanText = h.innerText.trim();
                            const level = parseInt(h.tagName.substring(1));
                            
                            let targetPos = -1;
                            const prefix = "#".repeat(level) + " ";
                            
                            // A. 정확한 헤더 레벨 매칭
                            for (let i = 1; i <= doc.lines; i++) {
                                const lineText = doc.line(i).text.trim();
                                if (lineText.startsWith(prefix) && lineText.substring(prefix.length).trim() === cleanText) {
                                    targetPos = doc.line(i).from;
                                    break;
                                }
                            }
                            
                            // B. 매칭 실패 시 부분 검색 폴백
                            if (targetPos === -1) {
                                for (let i = 1; i <= doc.lines; i++) {
                                    const lineText = doc.line(i).text.trim();
                                    if (lineText.startsWith("#") && lineText.includes(cleanText)) {
                                        targetPos = doc.line(i).from;
                                        break;
                                    }
                                }
                            }
                            
                            if (targetPos !== -1) {
                                window.cmEditor.dispatch({
                                    selection: { anchor: targetPos, head: targetPos },
                                    scrollIntoView: true
                                });
                                window.cmEditor.focus();
                            }
                        }
                    }
                    
                    // 활성화 표시
                    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                };
                
                list.appendChild(li);
            });
        }

        // ----------------- 단축키 및 에디터 키 편의 기능 -----------------
        
        // 글로벌 단축키 지원 (저장 / 되돌리기 / 다시 실행)
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveActiveFile();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoEditor();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redoEditor();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                addDocumentToLibrary();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                exportToHtml();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                printDocument();
            }
            if (e.key === 'F11') {
                e.preventDefault();
                toggleDocumentFullscreen();
            }
        });

        // 뷰 모드 조절
        function setViewMode(mode) {
            currentViewMode = mode;
            
            if (mode === 'wysiwyg') {
                document.body.classList.add('wysiwyg-active');
            } else {
                document.body.classList.remove('wysiwyg-active');
            }
            
            const paneEditor = document.getElementById('pane-editor');
            const panePreview = document.getElementById('pane-preview');
            const resizer = document.getElementById('pane-resizer');
            
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            const modeBtn = document.getElementById(`mode-${mode}`);
            if (modeBtn) modeBtn.classList.add('active');
            
            if (mode === 'edit' || mode === 'wysiwyg') {
                paneEditor.style.display = 'flex';
                paneEditor.style.flex = '1';
                paneEditor.style.width = '';
                panePreview.style.display = 'none';
                if (resizer) resizer.style.display = 'none';
            } else if (mode === 'preview') {
                paneEditor.style.display = 'none';
                panePreview.style.display = 'flex';
                panePreview.style.flex = '1';
                panePreview.style.width = '';
                if (resizer) resizer.style.display = 'none';
            } else {
                paneEditor.style.display = 'flex';
                panePreview.style.display = 'flex';
                if (resizer) resizer.style.display = 'block';
                
                // 기존 크기 조절값 복원 또는 50:50 분할
                if (paneEditor.style.width) {
                    paneEditor.style.flex = 'none';
                    panePreview.style.flex = 'none';
                } else {
                    paneEditor.style.flex = '1';
                    paneEditor.style.width = '';
                    panePreview.style.flex = '1';
                    panePreview.style.width = '';
                }
            }
            
            // CodeMirror 6 WYSIWYG 확장 적용/해제
            if (window.cmEditor && window.cmWysiwygConf && window.cm6) {
                if (mode === 'wysiwyg') {
                    window.cmEditor.dispatch({
                        effects: window.cmWysiwygConf.reconfigure(window.wysiwygExtension || [])
                    });
                } else {
                    window.cmEditor.dispatch({
                        effects: window.cmWysiwygConf.reconfigure([])
                    });
                }
            }
            
            // 뷰 변경 시 Mermaid 차트 사이즈 등 리사이징 보정
            triggerLiveRender();
        }

        // 스플릿 뷰 드래그 크기 조절 기능
        let isDraggingResizer = false;

        document.addEventListener('DOMContentLoaded', () => {
            const resizer = document.getElementById('pane-resizer');
            const paneEditor = document.getElementById('pane-editor');
            const panePreview = document.getElementById('pane-preview');
            const workspace = document.querySelector('.workspace-panes');

            if (!resizer) return;

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingResizer = true;
                resizer.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                
                // 드래그 전용 오버레이 추가하여 마우스 포인터 유실 방지
                const overlay = document.createElement('div');
                overlay.id = 'resizer-drag-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.zIndex = '99999';
                overlay.style.cursor = 'col-resize';
                document.body.appendChild(overlay);
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDraggingResizer) return;

                const workspaceRect = workspace.getBoundingClientRect();
                const offsetX = e.clientX - workspaceRect.left;
                
                // 조절 범위 제한 (15% ~ 85%)
                const minWidth = workspaceRect.width * 0.15;
                const maxWidth = workspaceRect.width * 0.85;
                
                let newWidth = offsetX;
                if (newWidth < minWidth) newWidth = minWidth;
                if (newWidth > maxWidth) newWidth = maxWidth;

                const percent = (newWidth / workspaceRect.width) * 100;
                
                paneEditor.style.flex = 'none';
                paneEditor.style.width = `${percent}%`;
                
                panePreview.style.flex = 'none';
                panePreview.style.width = `${100 - percent}%`;
            });

            document.addEventListener('mouseup', () => {
                if (!isDraggingResizer) return;
                
                isDraggingResizer = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                
                const overlay = document.getElementById('resizer-drag-overlay');
                if (overlay) overlay.remove();
                
                // 크기 변경 완료 후 Live Render 갱신 및 차트 리사이즈 보정
                triggerLiveRender();
            });
        });

        // 파일 저장 (Python 연동)
        async function saveActiveFile() {
            if (!currentFilePath) {
                alert(t('msg_save_no_file'));
                return;
            }
            const pathLower = currentFilePath.toLowerCase();
            const ext = pathLower.split('.').pop();
            const isMedia = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'mp3', 'mp4', 'wav', 'webm', 'mov', 'avi', 'ogg'].includes(ext);
            if (isMedia) {
                showToast(currentLang === 'en' ? "Media files cannot be saved." : "미디어 파일은 저장할 수 없습니다.");
                return;
            }
            const editorContent = getEditorContent();
            let finalContent = editorContent;
            if (activeDocumentTags && activeDocumentTags.length > 0) {
                const tagsStr = `tags: [${activeDocumentTags.join(', ')}]`;
                finalContent = `---\n${tagsStr}\n---\n\n` + editorContent;
            }
            const res = await pywebview.api.save_file(currentFilePath, finalContent);
            if (res.status === 'success') {
                showToast(t('msg_save_success'));
                loadWorkspaceTags(); // Refresh tags index on save
                
                // 백링크 정보 실시간 갱신
                updateBacklinks(currentFilePath);
                
                // 구글 드라이브 자동 동기화 처리
                if (gdriveAuthenticated) {
                    const statusRes = await pywebview.api.gdrive_get_file_sync_status(currentFilePath);
                    if (statusRes.status === 'success' && statusRes.auto_sync) {
                        pywebview.api.gdrive_sync_active_file(currentFilePath).then(syncRes => {
                            if (syncRes.status === 'success') {
                                updateActiveFileSyncStatus();
                            } else if (syncRes.status === 'conflict') {
                                openGdriveConflictModal();
                            }
                        }).catch(e => console.error("Auto-sync error:", e));
                    } else {
                        updateActiveFileSyncStatus();
                    }
                }
            } else {
                alert(t('msg_save_failed') + res.message);
            }
        }

        // HTML standalone 파일 내보내기
        async function exportToHtml() {
            if (!currentFilePath) {
                alert(t('msg_export_no_file'));
                return;
            }
            const htmlBody = document.getElementById('preview-content').innerHTML;
            const res = await pywebview.api.export_html(currentFilePath, htmlBody, currentFilePath);
            if (res.status === 'success') {
                showToast(t('msg_export_success') + res.dest);
            } else {
                alert(t('msg_export_failed') + res.message);
            }
        }

        // 콤보박스 선택에 따른 사용자 지정 입력 필드 토글 전역 헬퍼
        window.toggleCustomInput = function(id) {
            const sel = document.getElementById(id + '-select');
            const custom = document.getElementById(id + '-custom');
            if (sel && custom) {
                if (sel.value === 'custom') {
                    custom.style.display = 'block';
                } else {
                    custom.style.display = 'none';
                }
            }
        };

        // PDF 인쇄 실행 (머리말/꼬리말 고급 설정 모달 팝업으로 연계)
        async function printDocument() {
            openPrintSettingsModal();
        }

        function openPrintSettingsModal() {
            if (!currentFilePath) {
                alert(t('msg_print_no_file'));
                return;
            }
            
            // 오늘 날짜 포맷팅 (예: 2026. 06. 02.)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayStr = `${year}. ${month}. ${day}.`;
            
            // 파일명 추출
            const filename = currentFilePath.split(/[\\/]/).pop() || "document.md";
            
            // 기본 선택값 세팅
            document.getElementById('print-header-left-select').value = 'date';
            document.getElementById('print-header-center-select').value = 'none';
            
            document.getElementById('print-header-right-select').value = 'custom';
            document.getElementById('print-header-right-custom').value = filename;
            
            document.getElementById('print-footer-left-select').value = 'custom';
            document.getElementById('print-footer-left-custom').value = "Joy Markdown Studio";
            
            document.getElementById('print-footer-center-select').value = 'page_total';
            document.getElementById('print-footer-right-select').value = 'none';
            
            // 모든 부위의 토글 상태 강제 적용
            toggleCustomInput('print-header-left');
            toggleCustomInput('print-header-center');
            toggleCustomInput('print-header-right');
            toggleCustomInput('print-footer-left');
            toggleCustomInput('print-footer-center');
            toggleCustomInput('print-footer-right');
            
            // 모달 열기
            document.getElementById('print-settings-modal').style.display = 'flex';
            
            if (window.lucide) lucide.createIcons();
        }
        
        function closePrintSettingsModal() {
            document.getElementById('print-settings-modal').style.display = 'none';
        }
        
        async function executePrintWithSettings() {
            // 선택 콤보박스 및 커스텀 입력 매핑 헬퍼
            const getSelectedValue = (id) => {
                const sel = document.getElementById(id + '-select');
                if (!sel) return "";
                const val = sel.value;
                
                if (val === 'none') return "";
                if (val === 'custom') {
                    const customInput = document.getElementById(id + '-custom');
                    return customInput ? customInput.value.trim() : "";
                }
                if (val === 'date') {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}. ${month}. ${day}.`;
                }
                if (val === 'time') {
                    const today = new Date();
                    const hours = String(today.getHours()).padStart(2, '0');
                    const minutes = String(today.getMinutes()).padStart(2, '0');
                    return `${hours}:${minutes}`;
                }
                if (val === 'page') {
                    return '<span class="print-page-number"></span>';
                }
                if (val === 'page_total') {
                    return '<span class="print-page-number-total"></span>';
                }
                return "";
            };

            const leftText = getSelectedValue('print-header-left');
            const centerText = getSelectedValue('print-header-center');
            const rightText = getSelectedValue('print-header-right');
            
            const fLeftText = getSelectedValue('print-footer-left');
            const fCenterText = getSelectedValue('print-footer-center');
            const fRightText = getSelectedValue('print-footer-right');
            
            const marginStyle = document.getElementById('print-margin-style').value;
            const themeMode = document.getElementById('print-theme-mode').value;
            
            // 모달 닫기
            closePrintSettingsModal();
            
            // 기존에 남아있을 수 있는 인쇄 엘리먼트 제거
            cleanupPrintElements();
            
            // 인쇄 텍스트 HTML 정제 헬퍼
            const formatPrintText = (val) => {
                if (!val) return "";
                // 이미 span 엘리먼트 태그를 포함한 템일릿 스트링인 경우 이스케이프 방지
                if (val.includes('<span class="print-page-number')) {
                    return val;
                }
                const escaped = val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return escaped.replace(/\[page\]/gi, '<span class="print-page-number"></span>');
            };
            
            // 2. 인쇄 여백 스타일에 따른 동적 수치 계산
            let pageMarginSideMm = 18;
            let pageMarginTopBottomMm = 22;
            let showHeaderFooter = "flex";
            let bodyPaddingTopBottomMm = 14;
            
            if (marginStyle === "narrow") {
                pageMarginSideMm = 8;
                pageMarginTopBottomMm = 14;
                bodyPaddingTopBottomMm = 10;
            } else if (marginStyle === "none") {
                pageMarginSideMm = 0;
                pageMarginTopBottomMm = 0;
                bodyPaddingTopBottomMm = 0;
                showHeaderFooter = "none";
            }

            const pageMarginTopBottom = `${pageMarginTopBottomMm}mm`;
            const pageMarginSide = `${pageMarginSideMm}mm`;
            
            // 2.1 A4 정밀 시뮬레이션을 활용한 자바스크립트 기반 동적 페이지 수 계산
            const printableWidthMm = 210 - (pageMarginSideMm * 2);
            const printableHeightMm = 297 - (pageMarginTopBottomMm * 2);
            
            const pageWidthPx = Math.round((printableWidthMm * 96) / 25.4);
            const pageHeightPx = Math.round((printableHeightMm * 96) / 25.4);

            const previewContent = document.getElementById('preview-content');
            const printClone = previewContent.cloneNode(true);
            printClone.id = 'dynamic-print-clone';
            
            const printWrapper = document.createElement('div');
            printWrapper.id = 'dynamic-print-wrapper-container';
            printWrapper.appendChild(printClone);
            
            // 임시 측정용 오프스크린 스타일 강제 부여
            printWrapper.style.position = 'absolute';
            printWrapper.style.left = '-9999px';
            printWrapper.style.top = '0';
            printWrapper.style.width = `${pageWidthPx}px`;
            printWrapper.style.display = 'block';
            printWrapper.style.visibility = 'hidden';
            printWrapper.style.boxSizing = 'border-box';
            
            document.body.appendChild(printWrapper);
            
            // 2.2 자바스크립트 기반 정적 페이지 분할 & 정적 헤더/푸터 강제 주입 엔진 기동
            const headerHeightPx = 30 + 15; // 머리글 높이 30px + 마진 15px
            const footerHeightPx = 30 + 15;
            const pureContentHeightPx = pageHeightPx - (showHeaderFooter === "none" ? 0 : (headerHeightPx + footerHeightPx)); // 순수 텍스트 가용 한도
            
            const children = Array.from(printClone.children);
            printClone.innerHTML = ""; // 기존 콘텐츠 비움
            
            let currentPageEl = document.createElement('div');
            currentPageEl.className = 'print-page-wrapper';
            currentPageEl.style.position = 'relative';
            currentPageEl.style.height = `${pageHeightPx}px`;
            currentPageEl.style.boxSizing = 'border-box';
            currentPageEl.style.display = 'flex';
            currentPageEl.style.flexDirection = 'column';
            currentPageEl.style.justifyContent = 'space-between';
            printClone.appendChild(currentPageEl);
            
            // 1페이지 정적 머리글 삽입
            const staticHeader1 = document.createElement('div');
            staticHeader1.className = 'custom-print-header-static';
            staticHeader1.innerHTML = `
                <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(leftText)}</div>
                <div style="flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;">${formatPrintText(centerText)}</div>
                <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(rightText)}</div>
            `;
            currentPageEl.appendChild(staticHeader1);
            
            // 본문 콘텐츠를 담을 내부 영역 생성
            let currentContentEl = document.createElement('div');
            currentContentEl.className = 'custom-print-body-content';
            currentContentEl.style.flex = '1';
            currentContentEl.style.overflow = 'hidden';
            currentPageEl.appendChild(currentContentEl);
            
            // 1페이지 정적 바닥글 공간 확보를 위해 임시 바닥글 생성
            let staticFooter1 = document.createElement('div');
            staticFooter1.className = 'custom-print-footer-static';
            currentPageEl.appendChild(staticFooter1);
            
            let currentAccumulatedHeight = 0;
            let pageIndex = 1;
            
            children.forEach((child) => {
                // 임시 추가하여 높이 측정
                currentContentEl.appendChild(child);
                const childHeight = child.offsetHeight;
                
                if (currentAccumulatedHeight + childHeight > pureContentHeightPx && currentAccumulatedHeight > 0) {
                    // 한도 초과 시, 방금 넣은 자식을 다시 빼서 다음 페이지로 보냄
                    currentContentEl.removeChild(child);
                    
                    // 현재 페이지 실제 바닥글 세팅!
                    staticFooter1.innerHTML = `
                        <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(fLeftText)}</div>
                        <div style="flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pageIndex} / <span class="total-pages-placeholder"></span></div>
                        <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(fRightText)}</div>
                    `;
                    
                    // 다음 가상 페이지 생성!
                    pageIndex++;
                    currentPageEl = document.createElement('div');
                    currentPageEl.className = 'print-page-wrapper';
                    currentPageEl.style.position = 'relative';
                    currentPageEl.style.height = `${pageHeightPx}px`;
                    currentPageEl.style.boxSizing = 'border-box';
                    currentPageEl.style.display = 'flex';
                    currentPageEl.style.flexDirection = 'column';
                    currentPageEl.style.justifyContent = 'space-between';
                    currentPageEl.style.pageBreakBefore = 'always';
                    currentPageEl.style.breakBefore = 'page';
                    
                    // 새 페이지 머리글 세팅!
                    const staticHeaderNext = document.createElement('div');
                    staticHeaderNext.className = 'custom-print-header-static';
                    staticHeaderNext.innerHTML = `
                        <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(leftText)}</div>
                        <div style="flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;">${formatPrintText(centerText)}</div>
                        <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(rightText)}</div>
                    `;
                    currentPageEl.appendChild(staticHeaderNext);
                    
                    // 새 페이지 본문 영역 세팅!
                    currentContentEl = document.createElement('div');
                    currentContentEl.className = 'custom-print-body-content';
                    currentContentEl.style.flex = '1';
                    currentContentEl.style.overflow = 'hidden';
                    currentPageEl.appendChild(currentContentEl);
                    
                    // 새 페이지 바닥글 세팅! (바닥글 높이 유지를 위해 삽입)
                    const staticFooterNext = document.createElement('div');
                    staticFooterNext.className = 'custom-print-footer-static';
                    currentPageEl.appendChild(staticFooterNext);
                    
                    printClone.appendChild(currentPageEl);
                    
                    // 뺐던 자식을 새 본문 영역에 추가
                    currentContentEl.appendChild(child);
                    currentAccumulatedHeight = child.offsetHeight;
                    
                    // 다음 루프에서 사용할 수 있도록 꼬리글 레퍼런스 업데이트
                    staticFooter1 = staticFooterNext;
                } else {
                    currentAccumulatedHeight += childHeight;
                }
            });
            
            // 마지막 페이지 바닥글 최종 확정 세팅
            staticFooter1.innerHTML = `
                <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(fLeftText)}</div>
                <div style="flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pageIndex} / <span class="total-pages-placeholder"></span></div>
                <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPrintText(fRightText)}</div>
            `;
            
            // 전체 페이지 플레이스홀더 채우기
            printClone.querySelectorAll('.total-pages-placeholder').forEach((el) => {
                el.textContent = pageIndex;
            });
            
            // 오프스크린 측정 완료되었으므로 absolute 스타일 제거
            printWrapper.style.position = '';
            printWrapper.style.left = '';
            printWrapper.style.top = '';
            printWrapper.style.width = '';
            printWrapper.style.display = '';
            printWrapper.style.visibility = '';
            printWrapper.style.boxSizing = '';
            
            // 3. 인쇄시 화면 레이아웃 및 폰트를 보정하는 동적 CSS 주입
            const styleEl = document.createElement('style');
            styleEl.id = 'dynamic-print-style';
            styleEl.innerHTML = `
                @media print {
                    @page {
                        size: auto;
                        margin: 0 !important;
                    }
                    
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        overflow: visible !important;
                        display: block !important;
                        position: static !important;
                    }
                    
                    /* 화면 전용 컨테이너들을 강력하게 숨김 */
                    body > header,
                    body > main,
                    body .workspace-panes,
                    body #pane-preview,
                    body #preview-pane,
                    body #preview-content,
                    body .sidebar-slide-toggle,
                    body .toc-slide-toggle,
                    body .pane-header,
                    body .modal,
                    body .toast,
                    body #splash-screen {
                        display: none !important;
                    }
                    
                    /* 오직 인쇄용 복제 컨테이너만 인쇄 영역에 노출 */
                    #dynamic-print-wrapper-container {
                        display: block !important;
                        width: 100% !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                        position: static !important;
                    }
                    
                    /* 가상 A4 페이지 단위 */
                    .print-page-wrapper {
                        width: 210mm !important;
                        height: 297mm !important;
                        padding-top: ${pageMarginTopBottom} !important;
                        padding-bottom: ${pageMarginTopBottom} !important;
                        padding-left: ${pageMarginSide} !important;
                        padding-right: ${pageMarginSide} !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    
                    #dynamic-print-clone {
                        background: transparent !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        display: block !important;
                    }
                    
                    .custom-print-header-static {
                        width: 100% !important;
                        height: 30px !important;
                        display: ${showHeaderFooter} !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        border-bottom: 0.5px solid #ccc !important;
                        font-size: 8.5pt !important;
                        color: #555 !important;
                        font-family: 'Inter', 'Segoe UI', 'Malgun Gothic', sans-serif !important;
                        background: transparent !important;
                        box-sizing: border-box !important;
                        margin-bottom: 15px !important;
                    }
                    
                    .custom-print-footer-static {
                        width: 100% !important;
                        height: 30px !important;
                        display: ${showHeaderFooter} !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        border-top: 0.5px solid #ccc !important;
                        font-size: 8.5pt !important;
                        color: #555 !important;
                        font-family: 'Inter', 'Segoe UI', 'Malgun Gothic', sans-serif !important;
                        background: transparent !important;
                        box-sizing: border-box !important;
                        margin-top: 15px !important;
                    }
                    
                    .markdown-body {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: transparent !important;
                        max-width: 100% !important;
                    }
                    
                    /* 테이블 좌우 테두리선 잘림 현상 완벽 방지 */
                    #dynamic-print-clone table {
                        width: calc(100% - 2px) !important;
                        max-width: calc(100% - 2px) !important;
                        box-sizing: border-box !important;
                        margin: 0 1px 16px 1px !important;
                        border-collapse: collapse !important;
                    }
                    
                    #dynamic-print-clone th, #dynamic-print-clone td {
                        box-sizing: border-box !important;
                    }
                }
                
                @media screen {
                    .custom-print-header-static, .custom-print-footer-static, #dynamic-print-wrapper-container {
                        display: none !important;
                    }
                }
            `;
            
            document.head.appendChild(styleEl);
            
            // 4. 임시 브라우저 인쇄 타이틀 변경 (브라우저 기본 머리글에 반영)
            const originalDocTitle = document.title;
            if (centerText) {
                document.title = centerText;
            } else if (rightText) {
                document.title = rightText.replace(/\.md$/i, "");
            }
            
            // 5.2. 마운트된 복제본 내의 SMILES 화학식 요소를 인쇄에 최적화된 라이트(light) 모드로 강제 재렌더링
            const smilesContainers = printWrapper.querySelectorAll('.smiles-container');
            smilesContainers.forEach((container, idx) => {
                const svg = container.querySelector('svg');
                const infoDiv = container.querySelector('div');
                if (svg && infoDiv) {
                    const textContent = infoDiv.textContent || "";
                    const smilesText = textContent.replace(/^분자식:\s*/i, "").trim();
                    if (smilesText && typeof SmilesDrawer !== 'undefined') {
                        const printSvgId = `print-smiles-svg-${Date.now()}-${idx}`;
                        svg.id = printSvgId;
                        svg.innerHTML = ""; // 기존 다크 드로잉 소거
                        
                        const drawerOptions = {
                            width: 320,
                            height: 320,
                            theme: 'light', // 무조건 라이트 테마 강제
                            bondThickness: 2.2,
                            bondLength: 18,
                            fontSizeLarge: 6,
                            fontSizeSmall: 4,
                            overlapSensitivity: 1.8,
                            doubleBondSpacing: 4
                        };
                        
                        try {
                            const drawer = new SmilesDrawer.SvgDrawer(drawerOptions);
                            SmilesDrawer.parse(smilesText, function(tree) {
                                drawer.draw(tree, printSvgId, 'light', false);
                            }, function(err) {
                                console.error("Print SMILES parse error:", err);
                            });
                        } catch (e) {
                            console.error("Print SMILES render exception:", e);
                        }
                    }
                }
            });
            
            // 6. 가독성 모드 테마 토글 처리 및 인쇄 실행
            const originalTheme = currentTheme;
            
            const restoreAll = () => {
                if (themeMode !== originalTheme) {
                    setTheme(originalTheme, false);
                }
                document.title = originalDocTitle;
                cleanupPrintElements();
                showToast(t('msg_print_success'));
            };
            
            let restored = false;
            const onAfterPrint = () => {
                if (!restored) {
                    restored = true;
                    restoreAll();
                    window.removeEventListener('afterprint', onAfterPrint);
                }
            };
            window.addEventListener('afterprint', onAfterPrint);
            
            const triggerPrint = () => {
                window.print();
                
                // afterprint 비활성 상태 대비용 세이프가드
                setTimeout(() => {
                    if (!restored) {
                        restored = true;
                        restoreAll();
                        window.removeEventListener('afterprint', onAfterPrint);
                    }
                }, 1500);
            };
            
            if (themeMode !== originalTheme) {
                setTheme(themeMode, false);
                setTimeout(triggerPrint, 450);
            } else {
                setTimeout(triggerPrint, 250);
            }
        }
        
        function cleanupPrintElements() {
            const h = document.getElementById('dynamic-custom-print-header');
            if (h) h.remove();
            
            const f = document.getElementById('dynamic-custom-print-footer');
            if (f) f.remove();
            
            const s = document.getElementById('dynamic-print-style');
            if (s) s.remove();
            
            const w = document.getElementById('dynamic-print-wrapper-container');
            if (w) w.remove();
        }

        // 전역 노출 바인딩
        window.openPrintSettingsModal = openPrintSettingsModal;
        window.closePrintSettingsModal = closePrintSettingsModal;
        window.executePrintWithSettings = executePrintWithSettings;

        // ----------------- 모달 & 파일 트리 CRUD 연동 -----------------
        
        function openCreateModal(type) {
            isCreatingType = type;
            let titleText = t('create_modal_title_file');
            let defaultName = 'document.md';
            
            if (type === 'folder') {
                titleText = t('create_modal_title_folder');
                defaultName = 'new_folder';
            } else if (type === 'file_template') {
                titleText = t('create_modal_title_template');
                const tId = window.selectedTemplateId || 'thesis';
                defaultName = t('template_' + tId + '_filename') || (tId + '_template.md');
            }
            
            document.getElementById('modal-card-title').innerText = titleText;
            document.getElementById('modal-card-input').value = defaultName;
            document.getElementById('create-modal').style.display = 'flex';
            document.getElementById('modal-card-input').focus();
        }

        function closeCreateModal() {
            document.getElementById('create-modal').style.display = 'none';
        }

        async function submitCreateItem() {
            const name = document.getElementById('modal-card-input').value.trim();
            if (!name) {
                alert(t('msg_create_invalid_name'));
                return;
            }
            
            const actualType = isCreatingType === 'file_template' ? 'file' : isCreatingType;
            const res = await pywebview.api.create_item(name, actualType);
            
            if (res.status === 'success') {
                renderFileTree(res.files);
                loadWorkspaceTags(); // Refresh tags index on creation
                closeCreateModal();
                
                if (isCreatingType === 'file_template' && window.selectedTemplateId) {
                    const content = window.DOCUMENT_TEMPLATES ? window.DOCUMENT_TEMPLATES[window.selectedTemplateId] : "";
                    await openFile(name);
                    
                    if (content) {
                        if (typeof setEditorContent === 'function') {
                            setEditorContent(content);
                        } else if (typeof window.setEditorContent === 'function') {
                            window.setEditorContent(content);
                        }
                        await saveActiveFile();
                    }
                    
                    if (typeof setViewMode === 'function') {
                        setViewMode('split');
                    } else if (typeof window.setViewMode === 'function') {
                        window.setViewMode('split');
                    }
                    
                    if (typeof window.toggleTemplateSelector === 'function') {
                        window.toggleTemplateSelector(false);
                    }
                    
                    showToast(t('msg_create_success'));
                } else {
                    showToast(t('msg_create_success'));
                    if (isCreatingType === 'file') {
                        openFile(name);
                    }
                }
            } else {
                alert(t('msg_create_failed') + res.message);
            }
        }

        window.deleteWorkspaceItem = function(event, relPath) {
            event.stopPropagation();
            pendingDeletePath = relPath;
            
            const fileName = relPath.substring(relPath.lastIndexOf('/') + 1);
            const descEl = document.getElementById('delete-confirm-desc');
            if (descEl) {
                descEl.innerHTML = t('delete_confirm_body').replace('{fileName}', fileName);
            }
            
            // Re-translate title and buttons instantly
            const modalTitleEl = document.querySelector('#delete-confirm-modal [data-i18n="delete_confirm_title"]');
            if (modalTitleEl) modalTitleEl.innerText = t('delete_confirm_title');
            
            const cancelBtnEl = document.querySelector('#delete-confirm-modal [data-i18n="btn_cancel"]');
            if (cancelBtnEl) cancelBtnEl.innerText = t('btn_cancel');
            
            const confirmBtnEl = document.querySelector('#delete-confirm-modal [data-i18n="btn_confirm"]');
            if (confirmBtnEl) confirmBtnEl.innerText = t('btn_confirm');
            
            document.getElementById('delete-confirm-modal').style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        }
        
        window.closeDeleteConfirmModal = function() {
            document.getElementById('delete-confirm-modal').style.display = 'none';
            pendingDeletePath = "";
        }
        
        window.submitDeleteWorkspaceItem = async function() {
            if (!pendingDeletePath) return;
            const relPath = pendingDeletePath;
            window.closeDeleteConfirmModal();
            
            const res = await pywebview.api.delete_item(relPath);
            if (res.status === 'success') {
                renderFileTree(res.files);
                loadWorkspaceTags(); // Refresh tags index on deletion
                if (currentFilePath === relPath || currentFilePath.startsWith(relPath + "/")) {
                    currentFilePath = "";
                    document.getElementById('active-file-title').innerText = t('msg_no_active_file');
                    setEditorContent("");
                    updateLineNumbers();
                    document.getElementById('preview-content').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                            <div style="font-size: 1.1em; font-weight: 500;">${t('empty_removed')}</div>
                        </div>
                    `;
                    lucide.createIcons();
                    if (typeof generateTOC === 'function') {
                        generateTOC(document.getElementById('preview-content'));
                    }
                }
                showToast(t('msg_delete_success'));
            } else {
                alert(t('msg_delete_failed') + res.message);
            }
        }

        // ----------------- 네트워크 설정 및 인증 -----------------
        function openSettingsModal() {
            document.getElementById('settings-bind-ip').value = currentNetworkConfig.bind_ip;
            document.getElementById('settings-port').value = currentNetworkConfig.port;
            document.getElementById('settings-password').value = currentNetworkConfig.access_password;
            
            // 내부 및 공인 IP 정보 표시
            document.getElementById('settings-local-ip').innerText = currentNetworkConfig.local_ip;
            const publicIpEl = document.getElementById('settings-public-ip');
            publicIpEl.innerText = t('settings_retrieving');
            
            // 글꼴 설정 표시
            document.getElementById('settings-ui-font').value = currentFontConfig.ui_font;
            document.getElementById('settings-editor-font').value = currentFontConfig.editor_font;
            document.getElementById('settings-editor-size').value = currentFontConfig.editor_font_size;
            
            fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => {
                    publicIpEl.innerText = data.ip;
                })
                .catch(err => {
                    publicIpEl.innerText = t('settings_retrieval_failed');
                });

            document.getElementById('settings-modal').style.display = 'flex';
            lucide.createIcons();
        }

        function closeSettingsModal() {
            document.getElementById('settings-modal').style.display = 'none';
        }

        function toggleSettingsPasswordView() {
            const pwdInput = document.getElementById('settings-password');
            pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        }

        async function saveSettings() {
            const bindIp = document.getElementById('settings-bind-ip').value;
            const port = parseInt(document.getElementById('settings-port').value) || 58220;
            const accessPassword = document.getElementById('settings-password').value;

            const uiFont = document.getElementById('settings-ui-font').value;
            const editorFont = document.getElementById('settings-editor-font').value;
            const editorSize = parseInt(document.getElementById('settings-editor-size').value) || 14;

            try {
                const resNetwork = await pywebview.api.save_network_settings(bindIp, port, accessPassword);
                if (resNetwork.status !== 'success') {
                    alert(t('msg_settings_failed') + resNetwork.message);
                    return;
                }

                const resFont = await pywebview.api.save_font_settings(uiFont, editorFont, editorSize);
                if (resFont.status !== 'success') {
                    alert(t('msg_settings_failed') + resFont.message);
                    return;
                }

                currentNetworkConfig.bind_ip = bindIp;
                currentNetworkConfig.port = port;
                currentNetworkConfig.access_password = accessPassword;
                localStorage.setItem('access_password', accessPassword);

                applyFontSettings(uiFont, editorFont, editorSize);
                localStorage.setItem('ui_font', uiFont);
                localStorage.setItem('editor_font', editorFont);
                localStorage.setItem('editor_font_size', editorSize);

                showToast(t('msg_settings_saved'));
                closeSettingsModal();
            } catch (err) {
                alert(t('msg_settings_err') + err.message);
            }
        }

        function closeUpdateModal() {
            const modal = document.getElementById('update-modal');
            if (modal) modal.style.display = 'none';
        }

        function copyPipCommand() {
            const cmdText = document.getElementById('pip-update-command').innerText;
            navigator.clipboard.writeText(cmdText).then(() => {
                showToast(t('msg_copy_success') || '클립보드에 복사되었습니다.');
            }).catch(err => {
                console.error('Copy failed:', err);
            });
        }

        function showAuthOverlay() {
            // 데스크톱 앱 내부 직접 실행 시에는 암호 오버레이창 차단
            if (window.pywebview && !window.pywebview.is_browser_proxy) {
                console.log("Native Desktop mode. Bypassing auth overlay.");
                const splash = document.getElementById('splash-screen');
                if (splash) splash.style.display = 'none';
                return;
            }
            const splash = document.getElementById('splash-screen');
            if (splash) splash.style.display = 'none';
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('auth-password-input').focus();
            lucide.createIcons();
        }

        async function submitAuthPassword() {
            const pwdInput = document.getElementById('auth-password-input');
            const password = pwdInput.value;
            const errorMsg = document.getElementById('auth-error-msg');
            errorMsg.style.display = 'none';
            localStorage.setItem('access_password', password);
            try {
                const res = await pywebview.api.get_initial_state();
                if (res && res.status !== 'auth_failed') {
                    document.getElementById('auth-overlay').style.display = 'none';
                    initApp();
                } else {
                    errorMsg.style.display = 'block';
                    pwdInput.value = "";
                    pwdInput.focus();
                    localStorage.removeItem('access_password');
                }
            } catch (err) {
                errorMsg.style.display = 'block';
                pwdInput.value = "";
                pwdInput.focus();
                localStorage.removeItem('access_password');
            }
        }

        // 토스트 팝업 띄우기
// ----------------- 수식 입력기 커스텀 툴팁 팝업 기능 -----------------
        function showMathTooltip(item, rawMath) {
            let tooltip = document.getElementById('math-custom-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'math-custom-tooltip';
                tooltip.className = 'math-custom-tooltip';
                document.body.appendChild(tooltip);
            }

            // Use rawMath directly (HTML data-raw-math attributes already contain clean LaTeX)
            const cleanMath = rawMath;

            let rendered = '';
            try {
                // KaTeX 수식 렌더링
                rendered = katex.renderToString(cleanMath.trim(), { displayMode: false, throwOnError: false });
            } catch (err) {
                rendered = cleanMath;
            }

            const formulaName = item.textContent.trim();
            tooltip.innerHTML = `
                <div class="math-custom-tooltip-title" style="color: var(--accent); font-family: 'Outfit', sans-serif; font-size: 0.85em; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; margin-bottom: 6px; text-align: left; width: 100%; letter-spacing: 0.3px;">${formulaName}</div>
                <div class="math-custom-tooltip-preview" style="margin-bottom: 6px;">${rendered}</div>
                <div class="math-custom-tooltip-latex">${escapeHtml(cleanMath)}</div>
            `;

            tooltip.style.display = 'flex';
            // Reflow 강제 실행하여 트랜지션 적용
            tooltip.offsetHeight;
            tooltip.classList.add('visible');
        }

        function hideMathTooltip() {
            const tooltip = document.getElementById('math-custom-tooltip');
            if (tooltip) {
                tooltip.classList.remove('visible');
                // 트랜지션 완료 후 display: none 처리 (150ms)
                setTimeout(() => {
                    if (!tooltip.classList.contains('visible')) {
                        tooltip.style.display = 'none';
                    }
                }, 150);
            }
        }

        function positionMathTooltip(clientX, clientY) {
            const tooltip = document.getElementById('math-custom-tooltip');
            if (!tooltip) return;

            const margin = 15;
            let targetX = clientX + margin;
            let targetY = clientY + margin;

            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 화면 우측 및 하단 경계선 밖으로 나가는 것 방지
            if (targetX + tooltipWidth > viewportWidth) {
                targetX = clientX - tooltipWidth - margin;
            }
            if (targetY + tooltipHeight > viewportHeight) {
                targetY = clientY - tooltipHeight - margin;
            }

            tooltip.style.left = targetX + 'px';
            tooltip.style.top = targetY + 'px';
        }

        function escapeHtml(string) {
            return String(string).replace(/[&<>"']/g, function (s) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[s];
            });
        }

                function showToast(message) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-message').innerText = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        window.showToast = showToast;
        
        // ----------------- 외부 드래그 앤 드롭 파일 로드 -----------------
        function setupDragAndDrop() {
            const dropzone = document.getElementById('main-dropzone');
            const overlay = document.getElementById('drag-overlay');
            
            window.addEventListener('dragenter', (e) => {
                e.preventDefault();
                overlay.classList.add('active');
            });
            
            overlay.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            overlay.addEventListener('dragleave', (e) => {
                e.preventDefault();
                overlay.classList.remove('active');
            });
            
            window.addEventListener('drop', async (e) => {
                e.preventDefault();
                overlay.classList.remove('active');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.md') || file.name.endsWith('.qmd') || file.name.endsWith('.txt')) {
                        // 만약 워크스페이스 외부 파일인 경우, 임시로 읽거나 경고 후 새 파일 생성 방식으로 서빙
                        // 에디터 텍스트에 직접 드랍 데이터 로드
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            currentFilePath = file.name; // 로컬 가상 주소
                            document.getElementById('active-file-title').innerText = file.name + t('msg_active_file_external');
                            setEditorContent(evt.target.result);
                            updateLineNumbers();
                            triggerLiveRender();
                            showToast(t('msg_external_file_loaded'));
                        };
                        reader.readAsText(file);
                    } else {
                        alert(t('msg_external_file_unsupported'));
                    }
                }
            });
        }
    

window.onerror = function(message, source, lineno, colno, error) {
            alert("JS Error: " + message + " in " + source + " at line " + lineno + ":" + colno + "\\nStack: " + (error ? error.stack : "N/A"));
            return false;
        };
        window.onunhandledrejection = function(event) {
            alert("Unhandled Promise Rejection: " + event.reason + "\\nStack: " + (event.reason ? event.reason.stack : "N/A"));
        };

import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
        window.mermaid = mermaid;
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true }
        });

        // CodeMirror 6 모듈 가져오기 및 글로벌 바인딩 (버전 고정 및 deps 지정으로 esm.sh 컴파일 500 에러 우회)
        import { basicSetup, EditorView } from 'https://esm.sh/codemirror@6.0.1?deps=@codemirror/view@6.42.0,@codemirror/state@6.4.1';
        import { EditorState, Compartment, RangeSetBuilder } from 'https://esm.sh/@codemirror/state@6.4.1';
        import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@6.2.2?deps=@codemirror/view@6.42.0,@codemirror/state@6.4.1';
        import { placeholder, keymap, Decoration, ViewPlugin, WidgetType } from 'https://esm.sh/@codemirror/view@6.42.0?deps=@codemirror/state@6.4.1';
        import { syntaxTree } from 'https://esm.sh/@codemirror/language@6.10.1?deps=@codemirror/view@6.42.0,@codemirror/state@6.4.1';

        window.cm6 = {
            basicSetup,
            EditorView,
            EditorState,
            Compartment,
            RangeSetBuilder,
            markdown,
            placeholder,
            keymap,
            Decoration,
            ViewPlugin,
            WidgetType,
            syntaxTree
        };
        // WikiLink Widget 및 ViewPlugin 정의
        class WikiLinkWidget extends window.cm6.WidgetType {
            constructor(wikiName) {
                super();
                this.wikiName = wikiName;
            }
            eq(other) {
                return other.wikiName === this.wikiName;
            }
            toDOM() {
                const btn = document.createElement("button");
                btn.className = "cm-wiki-link-btn";
                btn.innerHTML = `<i data-lucide="link" style="width: 12px; height: 12px;"></i>${this.wikiName}`;
                btn.title = `클릭하여 '${this.wikiName}' 문서 열기/생성`;
                
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.openWikiLink === "function") {
                        window.openWikiLink(this.wikiName);
                    }
                });
                
                setTimeout(() => {
                    if (window.lucide) {
                        window.lucide.createIcons({node: btn});
                    }
                }, 0);
                
                return btn;
            }
        }

        const wikiLinkPlugin = window.cm6.ViewPlugin.fromClass(class {
            constructor(view) {
                this.decorations = this.getDecorations(view);
            }
            update(update) {
                if (update.docChanged || update.selectionSet) {
                    this.decorations = this.getDecorations(update.view);
                }
            }
            getDecorations(view) {
                const builder = new window.cm6.RangeSetBuilder();
                const state = view.state;
                
                const selectedLines = new Set();
                for (const range of state.selection.ranges) {
                    const startLine = state.doc.lineAt(range.from).number;
                    const endLine = state.doc.lineAt(range.to).number;
                    for (let i = startLine; i <= endLine; i++) {
                        selectedLines.add(i);
                    }
                }
                
                for (let l = 1; l <= state.doc.lines; l++) {
                    const line = state.doc.line(l);
                    if (selectedLines.has(l)) {
                        continue;
                    }
                    
                    let wikiRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                    let match;
                    while ((match = wikiRegex.exec(line.text)) !== null) {
                        const wikiName = match[1].trim();
                        if (!wikiName) continue;
                        
                        const startPos = line.from + match.index;
                        const endPos = startPos + match[0].length;
                        
                        try {
                            builder.add(
                                startPos,
                                endPos,
                                window.cm6.Decoration.replace({ widget: new WikiLinkWidget(wikiName) })
                            );
                        } catch (err) {
                            // ignore range error
                        }
                    }
                }
                return builder.finish();
            }
        }, {
            decorations: v => v.decorations
        });

        // --- WYSIWYG 하이브리드 에디터 데코레이션 및 위젯 정의 ---
        const hideDeco = Decoration.mark({ class: "cm-hidden-mark" });
        const h1Deco = Decoration.mark({ class: "cm-wysiwyg-h1" });
        const h2Deco = Decoration.mark({ class: "cm-wysiwyg-h2" });
        const h3Deco = Decoration.mark({ class: "cm-wysiwyg-h3" });
        const h4Deco = Decoration.mark({ class: "cm-wysiwyg-h4" });
        const quoteDeco = Decoration.mark({ class: "cm-wysiwyg-blockquote" });

        // 1. KaTeX 수식 위젯
        class KaTeXWidget extends WidgetType {
            constructor(math, block) {
                super();
                this.math = math;
                this.block = block;
            }
            eq(other) {
                return other.math === this.math && other.block === this.block;
            }
            toDOM() {
                const span = document.createElement("span");
                span.className = this.block ? "cm-wysiwyg-math-block" : "cm-wysiwyg-math-inline";
                try {
                    if (typeof katex !== 'undefined') {
                        katex.render(this.math, span, {
                            displayMode: this.block,
                            throwOnError: false
                        });
                    } else {
                        span.textContent = this.math;
                    }
                } catch (err) {
                    span.textContent = this.math;
                    span.style.color = "#ef4444";
                }
                return span;
            }
            ignoreEvent() { return true; }
        }

        // 2. 이미지 위젯
        class ImageWidget extends WidgetType {
            constructor(alt, url) {
                super();
                this.alt = alt;
                this.url = url;
            }
            eq(other) {
                return other.url === this.url && other.alt === this.alt;
            }
            toDOM() {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-image-container";
                
                const img = document.createElement("img");
                img.src = this.url;
                img.alt = this.alt;
                img.style.maxWidth = "100%";
                img.style.maxHeight = "400px";
                img.style.borderRadius = "8px";
                img.style.border = "1px solid var(--border)";
                img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                
                const caption = document.createElement("div");
                caption.className = "cm-wysiwyg-image-caption";
                caption.textContent = this.alt || "Image";
                caption.style.fontSize = "0.8em";
                caption.style.color = "var(--text-muted)";
                caption.style.marginTop = "4px";
                caption.style.textAlign = "center";
                
                div.appendChild(img);
                div.appendChild(caption);
                return div;
            }
            ignoreEvent() { return true; }
        }

        // 3. SMILES 분자식 위젯
        class SmilesWidget extends WidgetType {
            constructor(smiles) {
                super();
                this.smiles = smiles;
            }
            eq(other) {
                return other.smiles === this.smiles;
            }
            toDOM() {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-smiles-container";
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.style.width = "200px";
                svg.style.height = "200px";
                svg.style.display = "block";
                div.appendChild(svg);
                
                setTimeout(() => {
                    try {
                        if (typeof SmilesDrawer !== 'undefined') {
                            const drawer = new SmilesDrawer.SvgDrawer({
                                width: 200,
                                height: 200,
                                compactDrawing: true
                            });
                            SmilesDrawer.parse(this.smiles, (tree) => {
                                drawer.draw(tree, svg, 'dark', false);
                            }, (err) => {
                                console.error(err);
                                div.textContent = `[SMILES Error: ${this.smiles}]`;
                            });
                        } else {
                            div.textContent = `CC(=O)OC1=CC=CC=C1C(=O)O (SMILES: ${this.smiles})`;
                        }
                    } catch (e) {
                        div.textContent = `[SMILES Error: ${this.smiles}]`;
                    }
                }, 0);
                
                return div;
            }
            ignoreEvent() { return true; }
        }

        // 3.5. 표(Table) 위젯
        class TableWidget extends WidgetType {
            constructor(rawMarkdown) {
                super();
                this.rawMarkdown = rawMarkdown;
                this.activeRowIdx = -1;
                this.activeColIdx = -1;
            }
            eq(other) {
                return other.rawMarkdown === this.rawMarkdown;
            }
            ignoreEvent(e) {
                return true;
            }
            
            getCleanCellText(cell) {
                const clone = cell.cloneNode(true);
                const controls = clone.querySelectorAll('.wysiwyg-table-col-add, .wysiwyg-table-row-add, .wysiwyg-table-btn, .wysiwyg-table-control, .wysiwyg-table-col-delete, .wysiwyg-table-row-delete');
                controls.forEach(el => el.remove());
                return clone.textContent.trim().replace(/\r?\n/g, ' ');
            }
            
            syncTableToEditor() {
                const view = this.view || window.cmEditor;
                if (!view) return;
                
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const headerCells = table.querySelectorAll("thead th");
                const headers = [];
                headerCells.forEach(th => {
                    headers.push(this.getCleanCellText(th));
                });
                
                if (headers.length === 0) return;
                
                let newMarkdown = "\n| " + headers.join(" | ") + " |\n";
                newMarkdown += "| " + headers.map(() => "---").join(" | ") + " |\n";
                
                const rows = table.querySelectorAll("tbody tr");
                rows.forEach(tr => {
                    const cells = tr.querySelectorAll("td");
                    const rowData = [];
                    cells.forEach(td => {
                        rowData.push(this.getCleanCellText(td));
                    });
                    newMarkdown += "| " + rowData.join(" | ") + " |\n";
                });
                newMarkdown += "\n";
                
                // 불필요한 중복 갱신 및 화면 포커스 소실 방지용 최적화
                if (newMarkdown.trim() === this.rawMarkdown.trim()) return;
                
                
                let pos = -1;
                try {
                    pos = view.posAtDOM(this.dom);
                } catch(e) {}
                
                const docText = view.state.doc.toString();
                let occurrences = [];
                let idx = docText.indexOf(this.rawMarkdown);
                while (idx !== -1) {
                    occurrences.push(idx);
                    idx = docText.indexOf(this.rawMarkdown, idx + 1);
                }
                
                let targetPos = -1;
                if (occurrences.length === 0) {
                    let trimmed = this.rawMarkdown.trim();
                    let trimmedIdx = docText.indexOf(trimmed);
                    if (trimmedIdx !== -1) {
                        targetPos = trimmedIdx;
                    }
                } else if (occurrences.length === 1) {
                    targetPos = occurrences[0];
                } else if (pos !== -1) {
                    let closest = occurrences[0];
                    let minDiff = Math.abs(occurrences[0] - pos);
                    for (let i = 1; i < occurrences.length; i++) {
                        let diff = Math.abs(occurrences[i] - pos);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closest = occurrences[i];
                        }
                    }
                    targetPos = closest;
                } else {
                    targetPos = occurrences[0];
                }
                
                if (targetPos !== -1) {
                    const len = occurrences.length === 0 ? this.rawMarkdown.trim().length : this.rawMarkdown.length;
                    view.dispatch({
                        changes: { from: targetPos, to: targetPos + len, insert: newMarkdown }
                    });
                    this.rawMarkdown = newMarkdown;
                }
            }
            
            rebindHelperSelectors() {
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const tbody = table.querySelector("tbody");
                if (!tbody) return;
                
                const rows = tbody.querySelectorAll("tr");
                rows.forEach(tr => {
                    const cells = tr.querySelectorAll("td");
                    cells.forEach((td, cIdx) => {
                        const existingAdd = td.querySelector(".wysiwyg-table-row-add");
                        if (existingAdd) existingAdd.remove();
                        
                        if (cIdx === 0) {
                            const rowAdd = document.createElement("span");
                            rowAdd.className = "wysiwyg-table-row-add";
                            rowAdd.innerText = "+";
                            rowAdd.title = "아래에 행 추가";
                            rowAdd.contentEditable = "false";
                            rowAdd.addEventListener("mousedown", (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const currentRIdx = Array.from(tbody.querySelectorAll("tr")).indexOf(tr);
                                this.insertRow(currentRIdx + 1);
                            });
                            td.appendChild(rowAdd);
                        }
                    });
                });
            }
            
            insertRow(rowIdx) {
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const tbody = table.querySelector("tbody");
                if (!tbody) return;
                
                const headers = table.querySelectorAll("thead th");
                const colCount = headers.length;
                
                const tr = document.createElement("tr");
                for (let c = 0; c < colCount; c++) {
                    const td = document.createElement("td");
                    td.contentEditable = "true";
                    td.innerHTML = "";
                    
                    td.addEventListener("blur", () => {
                        this.syncTableToEditor();
                    });
                    
                    td.addEventListener("focus", () => {
                        this.activeRowIdx = Array.from(tbody.querySelectorAll("tr")).indexOf(tr);
                        this.activeColIdx = Array.from(tr.querySelectorAll("td")).indexOf(td);
                    });
                    
                    tr.appendChild(td);
                }
                
                const existingRows = tbody.querySelectorAll("tr");
                if (rowIdx >= existingRows.length) {
                    tbody.appendChild(tr);
                } else {
                    tbody.insertBefore(tr, existingRows[rowIdx]);
                }
                
                this.rebindHelperSelectors();
                this.syncTableToEditor();
            }
            
            insertColumn(colIdx) {
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const theadRow = table.querySelector("thead tr");
                if (!theadRow) return;
                
                const th = document.createElement("th");
                th.contentEditable = "true";
                th.innerHTML = "Header";
                
                th.addEventListener("blur", () => {
                    this.syncTableToEditor();
                });
                
                th.addEventListener("focus", () => {
                    this.activeRowIdx = -1;
                    const headerCells = Array.from(theadRow.querySelectorAll("th"));
                    this.activeColIdx = headerCells.indexOf(th);
                });
                
                const colAdd = document.createElement("span");
                colAdd.className = "wysiwyg-table-col-add";
                colAdd.innerText = "+";
                colAdd.title = "우측에 열 추가";
                colAdd.contentEditable = "false";
                colAdd.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const headerCells = Array.from(theadRow.querySelectorAll("th"));
                    const currentColIdx = headerCells.indexOf(th);
                    this.insertColumn(currentColIdx + 1);
                });
                th.appendChild(colAdd);
                
                const headers = theadRow.querySelectorAll("th");
                if (colIdx >= headers.length) {
                    theadRow.appendChild(th);
                } else {
                    theadRow.insertBefore(th, headers[colIdx]);
                }
                
                const tbody = table.querySelector("tbody");
                if (tbody) {
                    const rows = tbody.querySelectorAll("tr");
                    rows.forEach(tr => {
                        const td = document.createElement("td");
                        td.contentEditable = "true";
                        td.innerHTML = "";
                        
                        td.addEventListener("blur", () => {
                            this.syncTableToEditor();
                        });
                        
                        td.addEventListener("focus", () => {
                            this.activeRowIdx = Array.from(tbody.querySelectorAll("tr")).indexOf(tr);
                            const cells = Array.from(tr.querySelectorAll("td"));
                            this.activeColIdx = cells.indexOf(td);
                        });
                        
                        const cells = tr.querySelectorAll("td");
                        if (colIdx >= cells.length) {
                            tr.appendChild(td);
                        } else {
                            tr.insertBefore(td, cells[colIdx]);
                        }
                    });
                }
                
                this.rebindHelperSelectors();
                this.syncTableToEditor();
            }
            
            deleteActiveRow() {
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const tbody = table.querySelector("tbody");
                if (!tbody) return;
                
                const rows = tbody.querySelectorAll("tr");
                if (rows.length <= 1) {
                    alert("최소한 1개의 행이 존재해야 합니다.");
                    return;
                }
                
                let targetRowIdx = this.activeRowIdx;
                if (targetRowIdx === -1) {
                    alert("삭제할 행을 선택(클릭)해주세요.");
                    return;
                }
                
                if (targetRowIdx >= 0 && targetRowIdx < rows.length) {
                    rows[targetRowIdx].remove();
                    this.activeRowIdx = -1;
                    this.rebindHelperSelectors();
                    this.syncTableToEditor();
                }
            }
            
            deleteActiveColumn() {
                const table = this.dom.querySelector("table");
                if (!table) return;
                
                const theadRow = table.querySelector("thead tr");
                if (!theadRow) return;
                
                const headerCells = theadRow.querySelectorAll("th");
                if (headerCells.length <= 1) {
                    alert("최소한 1개의 열이 존재해야 합니다.");
                    return;
                }
                
                let targetColIdx = this.activeColIdx;
                if (targetColIdx === -1) {
                    alert("삭제할 열을 선택(클릭)해주세요.");
                    return;
                }
                
                if (targetColIdx >= 0 && targetColIdx < headerCells.length) {
                    headerCells[targetColIdx].remove();
                    
                    const tbody = table.querySelector("tbody");
                    if (tbody) {
                        const rows = tbody.querySelectorAll("tr");
                        rows.forEach(tr => {
                            const cells = tr.querySelectorAll("td");
                            if (cells[targetColIdx]) {
                                cells[targetColIdx].remove();
                            }
                        });
                    }
                    
                    this.activeColIdx = -1;
                    this.rebindHelperSelectors();
                    this.syncTableToEditor();
                }
            }
            
            toDOM(view) {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-table-container";
                this.dom = div;
                this.view = view;
                
                const lines = this.rawMarkdown.trim().split("\n");
                if (lines.length < 2) {
                    div.textContent = this.rawMarkdown;
                    return div;
                }
                
                const table = document.createElement("table");
                table.className = "cm-wysiwyg-table";
                
                const parseCols = (lineText) => {
                    const parts = lineText.split(/(?<!\\)\|/).map(s => s.trim());
                    let filtered = [...parts];
                    if (filtered[0] === "") filtered.shift();
                    if (filtered[filtered.length - 1] === "") filtered.pop();
                    return filtered.map(s => s.replace(/\\\|/g, '|'));
                };
                
                const headers = parseCols(lines[0]);
                const thead = document.createElement("thead");
                const headerRow = document.createElement("tr");
                
                headers.forEach((h, colIdx) => {
                    const th = document.createElement("th");
                    th.contentEditable = "true";
                    th.innerHTML = h;
                    
                    th.addEventListener("focus", () => {
                        this.activeRowIdx = -1;
                        this.activeColIdx = Array.from(headerRow.querySelectorAll("th")).indexOf(th);
                    });
                    
                    const colAdd = document.createElement("span");
                    colAdd.className = "wysiwyg-table-col-add";
                    colAdd.innerText = "+";
                    colAdd.title = "우측에 열 추가";
                    colAdd.contentEditable = "false";
                    colAdd.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const headerCells = Array.from(headerRow.querySelectorAll("th"));
                        const currentColIdx = headerCells.indexOf(th);
                        this.insertColumn(currentColIdx + 1);
                    });
                    th.appendChild(colAdd);
                    
                    th.addEventListener("blur", () => {
                        this.syncTableToEditor();
                    });
                    
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);
                
                const tbody = document.createElement("tbody");
                for (let i = 2; i < lines.length; i++) {
                    const cells = parseCols(lines[i]);
                    const row = document.createElement("tr");
                    
                    while (cells.length < headers.length) {
                        cells.push("");
                    }
                    
                    cells.forEach((c, colIdx) => {
                        const td = document.createElement("td");
                        td.contentEditable = "true";
                        td.innerHTML = c;
                        
                        td.addEventListener("focus", () => {
                            this.activeRowIdx = Array.from(tbody.querySelectorAll("tr")).indexOf(row);
                            this.activeColIdx = Array.from(row.querySelectorAll("td")).indexOf(td);
                        });
                        
                        td.addEventListener("blur", () => {
                            this.syncTableToEditor();
                        });
                        
                        row.appendChild(td);
                    });
                    tbody.appendChild(row);
                }
                table.appendChild(tbody);
                div.appendChild(table);
                
                this.rebindHelperSelectors();
                
                const configPanel = document.createElement("div");
                configPanel.className = "wysiwyg-table-config";
                configPanel.contentEditable = "false";
                
                const deleteRowBtn = document.createElement("button");
                deleteRowBtn.className = "table-conf-btn";
                deleteRowBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>행 삭제</span>
                `;
                deleteRowBtn.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteActiveRow();
                });
                
                const deleteColBtn = document.createElement("button");
                deleteColBtn.className = "table-conf-btn";
                deleteColBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>열 삭제</span>
                `;
                deleteColBtn.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteActiveColumn();
                });
                
                configPanel.appendChild(deleteRowBtn);
                configPanel.appendChild(deleteColBtn);
                div.appendChild(configPanel);
                
                return div;
            }
        }

        // 3.6. HTML/SVG 블록 위젯 (마인드맵 등 직접 구성된 SVG 렌더링 지원)
        class HTMLBlockWidget extends WidgetType {
            constructor(html) {
                super();
                this.html = html;
            }
            eq(other) {
                return other.html === this.html;
            }
            toDOM() {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-html-container";
                div.style.width = "100%";
                div.style.overflowX = "auto";
                div.style.margin = "16px 0";
                div.style.display = "block";
                
                // HTML/SVG 주입
                div.innerHTML = this.html;
                
                // 만약 주입된 SVG에 명시적인 height 스타일이 없다면 가독성을 위해 auto 설정
                const svgElement = div.querySelector('svg');
                if (svgElement) {
                    svgElement.style.maxWidth = "100%";
                    svgElement.style.height = "auto";
                    svgElement.style.display = "block";
                    svgElement.style.margin = "0 auto";
                }
                
                // 스크립트 노드가 있는 경우 활성화 처리
                const scripts = div.querySelectorAll("script");
                scripts.forEach(oldScript => {
                    const newScript = document.createElement("script");
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                
                return div;
            }
            ignoreEvent() { return true; }
        }

        // 3.7. Mermaid 다이어그램 위젯
        class MermaidWidget extends WidgetType {
            constructor(code) {
                super();
                this.code = code;
            }
            eq(other) {
                return other.code === this.code;
            }
            toDOM() {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-mermaid-container";
                div.style.margin = "16px auto";
                div.style.padding = "16px";
                div.style.background = "rgba(0,0,0,0.2)";
                div.style.border = "1px solid var(--border)";
                div.style.borderRadius = "10px";
                div.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                div.style.display = "flex";
                div.style.flexDirection = "column";
                div.style.alignItems = "center";
                div.style.justifyContent = "center";
                
                const id = `wysiwyg-mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const graphDiv = document.createElement("div");
                graphDiv.className = "mermaid";
                graphDiv.id = id;
                graphDiv.style.width = "100%";
                graphDiv.style.display = "block";
                graphDiv.innerHTML = `<div style="text-align: center; padding: 10px; color: var(--text-muted); font-size: 0.85em;"><i data-lucide="loader" class="spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>Mermaid 렌더링 중...</div>`;
                div.appendChild(graphDiv);
                
                setTimeout(async () => {
                    try {
                        if (typeof mermaid !== 'undefined') {
                            await mermaid.parse(this.code);
                            const { svg, bindFunctions } = await mermaid.render(`wysiwyg-svg-${id}`, this.code);
                            graphDiv.innerHTML = svg;
                            
                            const renderedSvg = graphDiv.querySelector('svg');
                            if (renderedSvg) {
                                renderedSvg.style.maxWidth = "100%";
                                renderedSvg.style.height = "auto";
                                renderedSvg.style.display = "block";
                                renderedSvg.style.margin = "0 auto";
                            }
                            if (bindFunctions) {
                                bindFunctions(graphDiv);
                            }
                        } else {
                            graphDiv.textContent = "Mermaid 라이브러리를 로드하지 못했습니다.";
                        }
                    } catch (err) {
                        graphDiv.innerHTML = `
                            <div style="color: #ef4444; padding: 12px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); border-radius: 8px; font-size: 0.9em; font-family: 'Inter', sans-serif; width: 100%;">
                                <div style="font-weight: 600; margin-bottom: 4px; display: flex; alignItems: center; gap: 6px;">
                                    <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i> Mermaid 문법 오류
                                </div>
                                <pre style="margin: 0; font-family: monospace; white-space: pre-wrap; font-size: 0.85em; background: transparent; border: none; padding: 0; color: #ef4444;">${err.message || err}</pre>
                            </div>
                        `;
                        if (window.lucide) lucide.createIcons();
                    }
                    if (window.lucide) lucide.createIcons();
                }, 50);
                
                return div;
            }
            ignoreEvent() { return true; }
        }

        // 3.8. Chart.js 연동 차트 위젯
        class ChartWidget extends WidgetType {
            constructor(code) {
                super();
                this.code = code;
            }
            eq(other) {
                return other.code === this.code;
            }
            toDOM() {
                const div = document.createElement("div");
                div.className = "cm-wysiwyg-chart-container";
                div.style.position = "relative";
                div.style.margin = "16px auto";
                div.style.maxWidth = "600px";
                div.style.padding = "20px";
                div.style.background = "rgba(255, 255, 255, 0.01)";
                div.style.border = "1px solid var(--border)";
                div.style.borderRadius = "10px";
                div.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                div.style.backdropFilter = "blur(8px)";
                div.style.webkitBackdropFilter = "blur(8px)";
                
                const canvas = document.createElement("canvas");
                canvas.style.maxWidth = "100%";
                canvas.style.height = "auto";
                div.appendChild(canvas);
                
                const loadChartJS = () => {
                    return new Promise((resolve, reject) => {
                        if (typeof Chart !== 'undefined') { resolve(); return; }
                        const s = document.createElement('script');
                        s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                        s.onload = () => resolve();
                        s.onerror = () => reject(new Error('Chart.js 로드 실패'));
                        document.head.appendChild(s);
                    });
                };
                
                setTimeout(async () => {
                    try {
                        await loadChartJS();
                        let config;
                        try {
                            config = JSON.parse(this.code);
                        } catch (e) {
                            config = this.parseFallbackConfig(this.code);
                        }
                        
                        if (config) {
                            // 다크모드 차트 테마 최적화 적용
                            if (!config.options) config.options = {};
                            if (!config.options.plugins) config.options.plugins = {};
                            if (!config.options.plugins.legend) config.options.plugins.legend = {};
                            if (!config.options.plugins.legend.labels) config.options.plugins.legend.labels = {};
                            config.options.plugins.legend.labels.color = '#e2e8f0';
                            config.options.plugins.legend.labels.font = { family: 'Inter, sans-serif', size: 12 };
                            
                            if (config.options.scales) {
                                Object.keys(config.options.scales).forEach(scaleKey => {
                                    const scale = config.options.scales[scaleKey];
                                    if (!scale.grid) scale.grid = {};
                                    scale.grid.color = 'rgba(255, 255, 255, 0.08)';
                                    if (!scale.ticks) scale.ticks = {};
                                    scale.ticks.color = '#94a3b8';
                                    scale.ticks.font = { family: 'Fira Code, monospace', size: 10 };
                                });
                            }
                            
                            new Chart(canvas, config);
                        } else {
                            div.innerHTML = `<div style="color: #ef4444; font-size: 0.9em; text-align: center; padding: 10px;">차트 데이터 포맷이 유효하지 않습니다. (JSON 또는 type/labels/data 형식이 필요합니다)</div>`;
                        }
                    } catch (err) {
                        div.innerHTML = `<div style="color: #ef4444; font-size: 0.9em; text-align: center; padding: 10px;">차트 드로잉 중 오류 발생: ${err.message}</div>`;
                    }
                }, 50);
                
                return div;
            }
            
            parseFallbackConfig(code) {
                const lines = code.split("\n");
                let type = "bar";
                let labels = [];
                let data = [];
                let label = "Data";
                
                for (let line of lines) {
                    const parts = line.split(":");
                    if (parts.length < 2) continue;
                    const key = parts[0].trim().toLowerCase();
                    const val = parts.slice(1).join(":").trim();
                    
                    if (key === "type") {
                        type = val;
                    } else if (key === "label") {
                        label = val;
                    } else if (key === "labels") {
                        labels = val.replace(/[\[\]]/g, "").split(",").map(s => s.trim());
                    } else if (key === "data") {
                        data = val.replace(/[\[\]]/g, "").split(",").map(s => parseFloat(s.trim()));
                    }
                }
                
                if (labels.length > 0 && data.length > 0) {
                    return {
                        type: type,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: label,
                                data: data,
                                backgroundColor: 'rgba(69, 243, 255, 0.35)',
                                borderColor: '#45f3ff',
                                borderWidth: 1.5
                            }]
                        },
                        options: {
                            responsive: true
                        }
                    };
                }
                return null;
            }
            
            ignoreEvent() { return true; }
        }

        // 4. WYSIWYG 뷰 플러그인 (뷰포트 내 렌더링 최적화)
        const wysiwygPlugin = ViewPlugin.fromClass(class {
            constructor(view) {
                this.decorations = this.getDecorations(view);
            }
            update(update) {
                if (update.docChanged || update.selectionSet || update.viewportChanged) {
                    this.decorations = this.getDecorations(update.view);
                }
            }
            getDecorations(view) {
                const state = view.state;
                
                // 선택(커서)이 놓여있는 행들 계산 -> 해당 행은 생얼 마크다운 유지
                const selectedLines = new Set();
                for (const range of state.selection.ranges) {
                    const lineStart = state.doc.lineAt(range.from).number;
                    const lineEnd = state.doc.lineAt(range.to).number;
                    for (let i = lineStart; i <= lineEnd; i++) {
                        selectedLines.add(i);
                    }
                }
                
                const { from, to } = view.viewport;
                const docLines = state.doc.lines;
                const rawDecos = [];
                
                // Lezer 구문 트리를 기반으로 마크다운 장식물 숨김/스타일 적용
                syntaxTree(state).iterate({
                    from, to,
                    enter(node) {
                        const nodeLine = state.doc.lineAt(node.from).number;
                        if (selectedLines.has(nodeLine)) {
                            return; // 현재 편집 중인 행은 그대로 둠
                        }
                        
                        const name = node.name;
                        
                        // 마크다운 구문 문자 기호 숨기기
                        if (name === "EmphasisMark" || name === "HeaderMark" || name === "CodeMark" || name === "ListMark" || name === "QuoteMark") {
                            rawDecos.push({ from: node.from, to: node.to, value: hideDeco, type: "mark" });
                        } else if (name === "LinkMark" || name === "ImageMark") {
                            rawDecos.push({ from: node.from, to: node.to, value: hideDeco, type: "mark" });
                        } else if (name === "URL") {
                            rawDecos.push({ from: node.from, to: node.to, value: hideDeco, type: "mark" });
                        }
                        
                        // 헤더 스타일링 (ATXHeading1 ~ ATXHeading6)
                        if (name.startsWith("ATXHeading")) {
                            const level = name.replace("ATXHeading", "");
                            let headerStyle = h1Deco;
                            if (level === "2") headerStyle = h2Deco;
                            else if (level === "3") headerStyle = h3Deco;
                            else if (level === "4") headerStyle = h4Deco;
                            else if (level === "5" || level === "6") headerStyle = h4Deco;
                            rawDecos.push({ from: node.from, to: node.to, value: headerStyle, type: "mark" });
                        }
                        
                        // 인용구 스타일링
                        if (name === "Blockquote") {
                            rawDecos.push({ from: node.from, to: node.to, value: quoteDeco, type: "mark" });
                        }
                    }
                });
                
                // 블록단위 위젯 렌더링 (KaTeX, 이미지, SMILES, Table, Mermaid, Chart, HTML/SVG)
                const startLine = state.doc.lineAt(from).number;
                const endLine = state.doc.lineAt(Math.min(to, state.doc.length)).number;
                
                for (let l = startLine; l <= endLine; l++) {
                    const line = state.doc.line(l);
                    const text = line.text.trim();
                    
                    // A. 표(Table) 실시간 디텍팅
                    if (text.startsWith("|")) {
                        let tableLines = [];
                        let isTable = false;
                        
                        // 구분선(| --- |) 라인이 있는지 확인하여 표 여부 판단
                        if (l + 1 <= docLines) {
                            const nextLineText = state.doc.line(l + 1).text.trim();
                            if (nextLineText.startsWith("|") && (nextLineText.includes("---") || nextLineText.includes(":-"))) {
                                isTable = true;
                            }
                        }
                        
                        if (isTable) {
                            tableLines.push(line.text);
                            let tableEndLine = l;
                            for (let nextL = l + 1; nextL <= docLines; nextL++) {
                                const nextLineText = state.doc.line(nextL).text.trim();
                                if (nextLineText.startsWith("|")) {
                                    tableLines.push(state.doc.line(nextL).text);
                                    tableEndLine = nextL;
                                } else {
                                    break;
                                }
                            }
                            
                            // WYSIWYG 모드에서는 표가 항상 테이블 위젯으로 유지되어 인라인 편집을 지원합니다.
                            const tableCode = tableLines.join("\n");
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new TableWidget(tableCode) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= tableEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = tableEndLine; // 스캔 점프
                            continue;
                        }
                    }
                    
                    // B. HTML/SVG 블록 검출 (커스텀 마인드맵 등 직접 구현된 SVG/HTML 대응)
                    if (text.startsWith("<svg") || text.startsWith("<div") || text.startsWith("<defs") || text.startsWith("<style") || text.startsWith("<linearGradient") || text.startsWith("<span") || text.startsWith("<button")) {
                        let htmlLines = [];
                        let htmlEndLine = l;
                        
                        htmlLines.push(state.doc.line(l).text);
                        
                        for (let nextL = l + 1; nextL <= docLines; nextL++) {
                            const nextLineText = state.doc.line(nextL).text.trim();
                            
                            // 새로운 마크다운 요소(헤더, 코드블록, 목록, 표 등)가 시작되면 블록의 끝으로 판정
                            if (nextLineText.startsWith("#") || 
                                nextLineText.startsWith("---") || 
                                nextLineText.startsWith("```") || 
                                nextLineText.startsWith("- ") || 
                                nextLineText.startsWith("* ") || 
                                nextLineText.startsWith("|")) {
                                break;
                            }
                            
                            htmlLines.push(state.doc.line(nextL).text);
                            htmlEndLine = nextL;
                        }
                        
                        let htmlActive = false;
                        for (let hL = l; hL <= htmlEndLine; hL++) {
                            if (selectedLines.has(hL)) {
                                htmlActive = true;
                                break;
                            }
                        }
                        
                        if (!htmlActive) {
                            const htmlCode = htmlLines.join("\n");
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new HTMLBlockWidget(htmlCode) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= htmlEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = htmlEndLine; // 스캔 점프
                            continue;
                        }
                    }
                    
                    if (selectedLines.has(l)) {
                        continue; // 편집 중인 행은 아래 개별 위젯 치환 건너뜀
                    }
                    
                    // C. SMILES 코드 블록
                    if (text.startsWith("```smiles")) {
                        let smilesLines = [];
                        let foundEnd = false;
                        let smilesEndLine = l;
                        for (let nextL = l + 1; nextL <= docLines; nextL++) {
                            const nextLineText = state.doc.line(nextL).text.trim();
                            smilesEndLine = nextL;
                            if (nextLineText === "```") {
                                foundEnd = true;
                                break;
                            }
                            smilesLines.push(state.doc.line(nextL).text);
                        }
                        if (foundEnd && smilesLines.length > 0) {
                            const smilesCode = smilesLines.join("\n").trim();
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new SmilesWidget(smilesCode) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= smilesEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = smilesEndLine;
                            continue;
                        }
                    }
                    
                    // D. Mermaid 다이어그램 코드 블록
                    if (text.startsWith("```mermaid")) {
                        let mermaidLines = [];
                        let foundEnd = false;
                        let mermaidEndLine = l;
                        for (let nextL = l + 1; nextL <= docLines; nextL++) {
                            const nextLineText = state.doc.line(nextL).text.trim();
                            mermaidEndLine = nextL;
                            if (nextLineText === "```") {
                                foundEnd = true;
                                break;
                            }
                            mermaidLines.push(state.doc.line(nextL).text);
                        }
                        
                        let mermaidActive = false;
                        for (let mL = l; mL <= mermaidEndLine; mL++) {
                            if (selectedLines.has(mL)) {
                                mermaidActive = true;
                                break;
                            }
                        }
                        
                        if (foundEnd && mermaidLines.length > 0 && !mermaidActive) {
                            const mermaidCode = mermaidLines.join("\n").trim();
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new MermaidWidget(mermaidCode) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= mermaidEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = mermaidEndLine;
                            continue;
                        }
                    }
                    
                    // E. Chart 차트 코드 블록
                    if (text.startsWith("```chart")) {
                        let chartLines = [];
                        let foundEnd = false;
                        let chartEndLine = l;
                        for (let nextL = l + 1; nextL <= docLines; nextL++) {
                            const nextLineText = state.doc.line(nextL).text.trim();
                            chartEndLine = nextL;
                            if (nextLineText === "```") {
                                foundEnd = true;
                                break;
                            }
                            chartLines.push(state.doc.line(nextL).text);
                        }
                        
                        let chartActive = false;
                        for (let cL = l; cL <= chartEndLine; cL++) {
                            if (selectedLines.has(cL)) {
                                chartActive = true;
                                break;
                            }
                        }
                        
                        if (foundEnd && chartLines.length > 0 && !chartActive) {
                            const chartCode = chartLines.join("\n").trim();
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new ChartWidget(chartCode) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= chartEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = chartEndLine;
                            continue;
                        }
                    }
                    
                    // F. 블록 수식 $$formula$$ (단일행 및 다행 지원)
                    if (text.startsWith("$$")) {
                        // 1. 단일행 블록 수식: $$formula$$
                        if (text.endsWith("$$") && text.length > 4) {
                            const math = text.substring(2, text.length - 2);
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new KaTeXWidget(math, true) }),
                                type: "replace"
                            });
                            continue;
                        }
                        
                        // 2. 다행 블록 수식: $$ 로 시작해서 다음 $$ 까지 수집
                        let mathLines = [];
                        let foundEnd = false;
                        let mathEndLine = l;
                        
                        let firstLineMath = text.substring(2).trim();
                        if (firstLineMath.length > 0) {
                            mathLines.push(firstLineMath);
                        }
                        
                        for (let nextL = l + 1; nextL <= docLines; nextL++) {
                            const nextLineText = state.doc.line(nextL).text.trim();
                            mathEndLine = nextL;
                            
                            if (nextLineText === "$$") {
                                foundEnd = true;
                                break;
                            }
                            if (nextLineText.endsWith("$$")) {
                                const lastLineMath = nextLineText.substring(0, nextLineText.length - 2).trim();
                                if (lastLineMath.length > 0) {
                                    mathLines.push(lastLineMath);
                                }
                                foundEnd = true;
                                break;
                            }
                            
                            mathLines.push(state.doc.line(nextL).text);
                        }
                        
                        let mathActive = false;
                        for (let cL = l; cL <= mathEndLine; cL++) {
                            if (selectedLines.has(cL)) {
                                mathActive = true;
                                break;
                            }
                        }
                        
                        if (foundEnd && !mathActive) {
                            const mathCode = mathLines.join("\n").trim();
                            rawDecos.push({
                                from: line.from,
                                to: line.to,
                                value: Decoration.replace({ widget: new KaTeXWidget(mathCode, true) }),
                                type: "replace"
                            });
                            for (let currL = l + 1; currL <= mathEndLine; currL++) {
                                const currLine = state.doc.line(currL);
                                rawDecos.push({
                                    from: currLine.from,
                                    to: currLine.from,
                                    value: Decoration.line({ attributes: { style: "display: none !important;" } }),
                                    type: "line"
                                });
                            }
                            l = mathEndLine;
                            continue;
                        }
                    }
                    
                    // G. 인라인 수식 $formula$
                    let mathRegex = /\$([^\$]+?)\$/g;
                    let match;
                    while ((match = mathRegex.exec(line.text)) !== null) {
                        const startPos = line.from + match.index;
                        const endPos = startPos + match[0].length;
                        rawDecos.push({
                            from: startPos,
                            to: endPos,
                            value: Decoration.replace({ widget: new KaTeXWidget(match[1], false) }),
                            type: "replace"
                        });
                    }
                    
                    // H. 이미지 ![alt](url)
                    let imgRegex = /!\[(.*?)\]\((.*?)\)/g;
                    while ((match = imgRegex.exec(line.text)) !== null) {
                        const startPos = line.from + match.index;
                        const endPos = startPos + match[0].length;
                        rawDecos.push({
                            from: startPos,
                            to: endPos,
                            value: Decoration.replace({ widget: new ImageWidget(match[1], match[2]) }),
                            type: "replace"
                        });
                    }
                }
                
                // --- 겹침 필터링 및 정렬 프로세스 ---
                // 1. replace 타입 데코레이션만 먼저 추려내어 겹치지 않는 확실한 영역을 매핑
                const replaces = rawDecos.filter(d => d.type === "replace").sort((a, b) => a.from - b.from);
                const filteredReplaces = [];
                
                let lastReplaceEnd = -1;
                for (const r of replaces) {
                    if (r.from >= lastReplaceEnd) {
                        filteredReplaces.push(r);
                        lastReplaceEnd = r.to;
                    }
                }
                
                // 2. 다른 데코레이션(mark, line 등)들을 replace 영역과 겹치는지 체크하여 걸러냄
                const finalDecos = [...filteredReplaces];
                const nonReplaces = rawDecos.filter(d => d.type !== "replace");
                
                for (const d of nonReplaces) {
                    if (d.type === "line") {
                        // line 데코레이션은 라인 시작 위치에 적용되므로 겹치지 않게 그대로 둠
                        finalDecos.push(d);
                    } else if (d.type === "mark") {
                        // mark 데코레이션은 replace 범위 내부에 포함되거나 걸치면 무시
                        let overlaps = false;
                        for (const r of filteredReplaces) {
                            if (d.from < r.to && d.to > r.from) {
                                overlaps = true;
                                break;
                            }
                        }
                        if (!overlaps) {
                            finalDecos.push(d);
                        }
                    }
                }
                
                // 3. 최종 데코레이션을 from 순서로 정렬
                finalDecos.sort((a, b) => {
                    if (a.from !== b.from) {
                        return a.from - b.from;
                    }
                    if (a.type === "line" && b.type !== "line") return -1;
                    if (a.type !== "line" && b.type === "line") return 1;
                    return 0;
                });
                
                // 4. RangeSetBuilder에 순차적으로 추가
                const builder = new RangeSetBuilder();
                let lastAddedFrom = -1;
                let lastAddedTo = -1;
                
                for (const deco of finalDecos) {
                    if (deco.from < 0 || deco.to > state.doc.length || deco.from > deco.to) {
                        continue;
                    }
                    
                    if (deco.from >= lastAddedFrom) {
                        if (deco.from === lastAddedFrom && deco.type === "replace" && lastAddedTo > deco.from) {
                            console.warn("Skipping overlapping replace deco at same start point:", deco);
                            continue;
                        }
                        
                        try {
                            builder.add(deco.from, deco.to, deco.value);
                            lastAddedFrom = deco.from;
                            lastAddedTo = deco.to;
                        } catch (e) {
                            console.warn("Error adding decoration to RangeSetBuilder, skipping:", e, deco);
                        }
                    } else {
                        console.warn("Out of order decoration skipped:", deco, "lastAddedFrom:", lastAddedFrom);
                    }
                }
                
                return builder.finish();
            }
        }, {
            decorations: v => v.decorations
        });

        window.wysiwygExtension = [wysiwygPlugin];

        // 모듈 로드 완료 이벤트 발생
        window.dispatchEvent(new Event('cm6-loaded'));

if (window.lucide) {
            lucide.createIcons();
        }

        // ==========================================
        // Google Drive Synchronization JavaScript API
        // ==========================================

        let gdriveAuthenticated = false;

        async function updateGoogleDriveStatus() {
            if (!window.pywebview) return;
            try {
                const res = await pywebview.api.gdrive_get_status();
                if (res.status === 'success') {
                    gdriveAuthenticated = res.authenticated;
                    const disconnectedDiv = document.getElementById('gdrive-status-disconnected');
                    const connectedDiv = document.getElementById('gdrive-status-connected');
                    const emailDiv = document.getElementById('gdrive-account-email');
                    const fileSyncSection = document.getElementById('gdrive-file-sync-section');
                    const remoteSection = document.getElementById('gdrive-remote-files-section');
                    const indicator = document.getElementById('active-file-cloud-indicator');

                    if (res.authenticated) {
                        if (disconnectedDiv) disconnectedDiv.style.display = 'none';
                        if (connectedDiv) connectedDiv.style.display = 'flex';
                        if (emailDiv) emailDiv.innerText = res.user ? res.user.emailAddress : '-';
                        if (fileSyncSection) fileSyncSection.style.display = 'flex';
                        if (remoteSection) remoteSection.style.display = 'flex';
                        if (indicator) indicator.style.display = 'inline-flex';
                        
                        await updateActiveFileSyncStatus();
                        await refreshRemoteFiles();
                    } else {
                        if (disconnectedDiv) disconnectedDiv.style.display = 'flex';
                        if (connectedDiv) connectedDiv.style.display = 'none';
                        if (fileSyncSection) fileSyncSection.style.display = 'none';
                        if (remoteSection) remoteSection.style.display = 'none';
                        if (indicator) indicator.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error("Error updating Google Drive status:", err);
            }
        }

        async function refreshRemoteFiles() {
            if (!window.pywebview || !gdriveAuthenticated) return;
            const container = document.getElementById('gdrive-remote-files-list');
            if (!container) return;
            
            container.innerHTML = `<div style="text-align: center; padding: 10px;"><i data-lucide="loader" class="spinner" style="width: 16px; height: 16px; color: var(--text-muted);"></i></div>`;
            if (window.lucide) lucide.createIcons();
            
            try {
                const res = await pywebview.api.gdrive_list_remote_files();
                if (res.status === 'success') {
                    container.innerHTML = "";
                    const files = res.files || [];
                    if (files.length === 0) {
                        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8em; text-align: center; padding: 10px;">클라우드에 저장된 문서가 없습니다.</div>`;
                        return;
                    }
                    
                    files.forEach(f => {
                        const itemEl = document.createElement('div');
                        itemEl.style.display = 'flex';
                        itemEl.style.alignItems = 'center';
                        itemEl.style.justifyContent = 'space-between';
                        itemEl.style.padding = '8px 10px';
                        itemEl.style.background = 'rgba(255,255,255,0.02)';
                        itemEl.style.border = '1px solid var(--border)';
                        itemEl.style.borderRadius = '6px';
                        itemEl.style.fontSize = '0.82em';
                        
                        const isLocal = localFiles.includes(f.name.toLowerCase());
                        
                        let actionHtml = "";
                        if (isLocal) {
                            actionHtml = `<span class="badge" style="font-size: 0.7em; padding: 2px 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 500;" data-i18n="status_local_exists">${t('status_local_exists')}</span>`;
                        } else {
                            actionHtml = `
                                <button class="icon-btn-sm" onclick="downloadRemoteFile('${f.id}', '${f.name}')" title="${t('btn_import_cloud')}" style="padding: 4px; background: rgba(69, 243, 255, 0.1); border: 1px solid rgba(69, 243, 255, 0.2); border-radius: 4px; cursor: pointer;">
                                    <i data-lucide="download-cloud" style="width: 14px; height: 14px; color: var(--accent);"></i>
                                </button>
                            `;
                        }
                        
                        const sizeKb = (f.size / 1024).toFixed(1);
                        
                        itemEl.innerHTML = `
                            <div style="display: flex; flex-direction: column; gap: 2px; max-width: 70%; overflow: hidden; text-align: left;">
                                <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-main);">${f.name}</span>
                                <span style="font-size: 0.72em; color: var(--text-muted); font-family: monospace;">${sizeKb} KB</span>
                            </div>
                            <div>
                                ${actionHtml}
                            </div>
                        `;
                        container.appendChild(itemEl);
                    });
                    if (window.lucide) lucide.createIcons();
                } else {
                    container.innerHTML = `<div style="color: #ef4444; font-size: 0.8em; text-align: center; padding: 10px;">${res.message}</div>`;
                }
            } catch (err) {
                container.innerHTML = `<div style="color: #ef4444; font-size: 0.8em; text-align: center; padding: 10px;">에러: ${err.message}</div>`;
            }
        }

        async function downloadRemoteFile(fileId, filename) {
            if (!window.pywebview) return;
            
            if (localFiles.includes(filename.toLowerCase())) {
                const overwrite = confirm(t('msg_file_exists_warn'));
                if (!overwrite) return;
            }
            
            showToast(t('msg_sync_in_progress'));
            try {
                const res = await pywebview.api.gdrive_download_remote_file(fileId, filename);
                if (res.status === 'success') {
                    showToast(t('msg_import_success'));
                    if (res.files) {
                        renderFileTree(res.files);
                    }
                    if (res.rel_path) {
                        await openFile(res.rel_path);
                    }
                    await refreshRemoteFiles();
                } else {
                    alert(res.message);
                }
            } catch (err) {
                alert("다운로드 실패: " + err.message);
            }
        }

        async function connectGoogleDrive() {
            if (!window.pywebview) return;
            showToast(t('msg_sync_in_progress'));
            try {
                const res = await pywebview.api.gdrive_login();
                if (res.status === 'success') {
                    showToast(res.message || t('msg_save_success'));
                    await updateGoogleDriveStatus();
                } else if (res.message && res.message.includes("client_secrets.json")) {
                    openGdriveSetupModal();
                } else {
                    alert(res.message);
                }
            } catch (err) {
                alert("연동 실패: " + err.message);
            }
        }

        function openGdriveSetupModal() {
            const modal = document.getElementById('gdrive-setup-modal');
            if (modal) {
                modal.style.display = 'flex';
                if (window.lucide) lucide.createIcons();
            }
        }

        function closeGdriveSetupModal() {
            const modal = document.getElementById('gdrive-setup-modal');
            if (modal) modal.style.display = 'none';
        }

        async function importGdriveClientSecrets() {
            if (!window.pywebview) return;
            try {
                const res = await pywebview.api.gdrive_import_client_secrets();
                if (res.status === 'success') {
                    showToast(res.message);
                    closeGdriveSetupModal();
                    setTimeout(connectGoogleDrive, 500);
                } else if (res.status === 'error') {
                    alert(res.message);
                }
            } catch (err) {
                alert("가져오기 실패: " + err.message);
            }
        }

        async function disconnectGoogleDrive() {
            if (!window.pywebview) return;
            try {
                const res = await pywebview.api.gdrive_logout();
                if (res.status === 'success') {
                    showToast(res.message);
                    await updateGoogleDriveStatus();
                }
            } catch (err) {
                console.error(err);
            }
        }

        async function updateActiveFileSyncStatus() {
            if (!window.pywebview || !gdriveAuthenticated || !currentFilePath) {
                const indicator = document.getElementById('active-file-cloud-indicator');
                if (indicator) indicator.style.display = 'none';
                return;
            }
            
            try {
                const res = await pywebview.api.gdrive_get_file_sync_status(currentFilePath);
                const pathEl = document.getElementById('active-file-sync-path');
                const badgeEl = document.getElementById('active-file-sync-badge');
                const toggle = document.getElementById('gdrive-auto-sync-toggle');
                const indicator = document.getElementById('active-file-cloud-indicator');
                const icon = document.getElementById('cloud-indicator-icon');

                if (pathEl) pathEl.innerText = currentFilePath.substring(currentFilePath.lastIndexOf('/') + 1);
                
                if (indicator) indicator.style.display = 'inline-flex';

                if (res.status === 'success') {
                    if (toggle) toggle.checked = res.auto_sync;
                    
                    if (res.synced) {
                        if (badgeEl) {
                            badgeEl.innerText = t('cloud_sync_status_synced');
                            badgeEl.className = 'badge badge-success';
                            badgeEl.style.backgroundColor = '#10b981';
                        }
                        if (icon) {
                            icon.setAttribute('data-lucide', 'cloud');
                            icon.style.color = '#10b981';
                            icon.parentElement.title = "구글 드라이브와 동기화됨";
                        }
                    } else {
                        if (badgeEl) {
                            badgeEl.innerText = t('cloud_sync_status_not_synced');
                            badgeEl.className = 'badge badge-warning';
                            badgeEl.style.backgroundColor = '#f59e0b';
                        }
                        if (icon) {
                            icon.setAttribute('data-lucide', 'cloud-off');
                            icon.style.color = 'var(--text-muted)';
                            icon.parentElement.title = "구글 드라이브와 동기화되지 않음";
                        }
                    }
                    if (window.lucide) lucide.createIcons();
                }
            } catch (err) {
                console.error(err);
            }
        }

        async function syncActiveFileNow() {
            if (!window.pywebview || !currentFilePath) return;
            
            const btn = document.getElementById('btn-sync-file-now');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="spinner" style="width: 14px; height: 14px;"></i> <span data-i18n="msg_sync_in_progress">${t('msg_sync_in_progress')}</span>`;
            if (window.lucide) lucide.createIcons();

            try {
                const res = await pywebview.api.gdrive_sync_active_file(currentFilePath);
                if (res.status === 'success') {
                    showToast(t('msg_sync_success'));
                    await updateActiveFileSyncStatus();
                } else if (res.status === 'conflict') {
                    openGdriveConflictModal();
                } else {
                    alert(t('msg_sync_failed') + res.message);
                }
            } catch (err) {
                alert(t('msg_sync_failed') + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                if (window.lucide) lucide.createIcons();
            }
        }

        async function toggleFileAutoSync(enabled) {
            if (!window.pywebview || !currentFilePath) return;
            try {
                const res = await pywebview.api.gdrive_toggle_file_auto_sync(currentFilePath, enabled);
                if (res.status !== 'success') {
                    alert(res.message);
                    document.getElementById('gdrive-auto-sync-toggle').checked = !enabled;
                }
            } catch (err) {
                console.error(err);
            }
        }

        function openGdriveConflictModal() {
            const modal = document.getElementById('gdrive-conflict-modal');
            if (modal) modal.style.display = 'flex';
        }

        function closeGdriveConflictModal() {
            const modal = document.getElementById('gdrive-conflict-modal');
            if (modal) modal.style.display = 'none';
        }

        async function resolveGdriveConflict(resolution) {
            closeGdriveConflictModal();
            if (!window.pywebview || !currentFilePath) return;
            
            showToast(t('msg_sync_in_progress'));
            try {
                const res = await pywebview.api.gdrive_resolve_conflict(currentFilePath, resolution);
                if (res.status === 'success') {
                    showToast(t('msg_sync_success'));
                    if (resolution === 'download' && res.content !== undefined) {
                        setEditorContent(res.content);
                        triggerLiveRender();
                    }
                    await updateActiveFileSyncStatus();
                } else if (res.status === 'error') {
                    alert(res.message);
                }
            } catch (err) {
                alert(err.message);
            }
        }
        // ----------------- 에디터 마크다운 툴바 액션 함수 -----------------
        function insertFormatting(type) {
            const view = window.cmEditor;
            if (!view) return;
            
            const state = view.state;
            const selection = state.selection.main;
            const from = selection.from;
            const to = selection.to;
            const selectedText = state.doc.sliceString(from, to);
            
            let wrapStart = "", wrapEnd = "";
            if (type === 'bold') {
                wrapStart = "**";
                wrapEnd = "**";
            } else if (type === 'italic') {
                wrapStart = "*";
                wrapEnd = "*";
            } else if (type === 'code') {
                if (selectedText.includes('\n')) {
                    wrapStart = "\n```\n";
                    wrapEnd = "\n```\n";
                } else {
                    wrapStart = "`";
                    wrapEnd = "`";
                }
            }
            
            const insertText = wrapStart + selectedText + wrapEnd;
            
            view.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: from + wrapStart.length + selectedText.length }
            });
            view.focus();
        }

        function setHeading(level) {
            const view = window.cmEditor;
            if (!view) return;
            
            const state = view.state;
            const selection = state.selection.main;
            const line = state.doc.lineAt(selection.head);
            const text = line.text;
            
            // 기존 머리글 패턴 제거
            const cleanText = text.replace(/^#+\s+/, "");
            
            let prefix = "";
            if (level > 0 && level <= 4) {
                prefix = "#".repeat(level) + " ";
            }
            
            const insertText = prefix + cleanText;
            
            view.dispatch({
                changes: { from: line.from, to: line.to, insert: insertText },
                selection: { anchor: line.from + insertText.length }
            });
            view.focus();
            
            // UI 텍스트 갱신
            const btnText = document.getElementById('heading-btn-text');
            if (btnText) {
                btnText.setAttribute('data-active-level', level);
                btnText.innerText = level === 0 ? t('heading_p') : t('heading_h' + level);
            }
            
            // 활성화 스타일 체크 표시 갱신
            const items = document.querySelectorAll('#toolbar-heading-menu .dropdown-item');
            items.forEach((item, idx) => {
                item.classList.remove('active');
                const checkIcon = item.querySelector('svg, i[data-lucide]');
                if (checkIcon) checkIcon.remove();
                
                const itemLevel = idx === 4 ? 0 : idx + 1;
                if (itemLevel === level) {
                    item.classList.add('active');
                    const checkEl = document.createElement('i');
                    checkEl.setAttribute('data-lucide', 'check');
                    checkEl.style.width = '14px';
                    checkEl.style.height = '14px';
                    item.appendChild(checkEl);
                }
            });
            if (window.lucide) lucide.createIcons();
            
            document.getElementById('toolbar-heading-dropdown').classList.remove('show');
        }

        function insertListStyle(type) {
            const view = window.cmEditor;
            if (!view) return;
            
            const state = view.state;
            const selection = state.selection.main;
            const line = state.doc.lineAt(selection.head);
            const text = line.text;
            
            // 기존 목록 패턴 제거
            const cleanText = text.replace(/^(\s*([-*+]\s+\[[xX ]\]\s+|\d+\.\s+|[-*+]\s+))/, "");
            
            let prefix = "";
            if (type === 'unordered') {
                prefix = "- ";
            } else if (type === 'ordered') {
                prefix = "1. ";
            } else if (type === 'checklist') {
                prefix = "- [ ] ";
            }
            
            const insertText = prefix + cleanText;
            
            view.dispatch({
                changes: { from: line.from, to: line.to, insert: insertText },
                selection: { anchor: line.from + insertText.length }
            });
            view.focus();
            
            document.getElementById('toolbar-list-dropdown').classList.remove('show');
        }


        // 드롭다운 외부 클릭 시 숨김 처리 및 버튼 클릭 토글 등록
        document.addEventListener('click', function(e) {
            const dropdowns = document.querySelectorAll('.toolbar-dropdown');
            dropdowns.forEach(dd => {
                const btn = dd.querySelector('.toolbar-dropdown-btn, .toolbar-btn');
                if (btn && btn.contains(e.target)) {
                    dd.classList.toggle('show');
                    
                    // 이모지 드롭다운이 열리는 시점에 Lazy 렌더링 수행 (애니메이션 완료 대기 200ms 지연 및 인자 명시 주입, 재사용을 위해 force=false 지정)
                    if (dd.id === 'toolbar-emoji-dropdown' && dd.classList.contains('show')) {
                        if (window.renderEmojiPicker) {
                            setTimeout(() => {
                                window.renderEmojiPicker(false, currentTheme, currentLang);
                            }, 200);
                        }
                    }

                } else if (!dd.contains(e.target)) {
                    dd.classList.remove('show');
                }
            });
        });

// ES Module의 전역 스코프 격리 해제를 위한 윈도우 바인딩 코드
window.insertFormatting = insertFormatting;
window.setHeading = setHeading;
window.insertListStyle = insertListStyle;

window.addDocumentToLibrary = addDocumentToLibrary;
window.closeCreateModal = closeCreateModal;
window.closeMermaidFullscreen = closeMermaidFullscreen;
window.closeSettingsModal = closeSettingsModal;
window.exportGraphImage = exportGraphImage;
window.exportToHtml = exportToHtml;
window.filterMathSymbols = filterMathSymbols;
window.insertChemistryToEditor = insertChemistryToEditor;
window.insertDiagramTemplate = insertDiagramTemplate;
window.insertMathSymbol = insertMathSymbol;
window.navigateHistory = navigateHistory;
window.openCreateModal = openCreateModal;
window.openSettingsModal = openSettingsModal;
window.printDocument = printDocument;
window.printGraph = printGraph;
window.redoEditor = redoEditor;
window.refreshWorkspace = refreshWorkspace;
window.resetGraphZoom = resetGraphZoom;
window.resetPreviewZoom = resetPreviewZoom;
window.saveActiveFile = saveActiveFile;
window.saveSettings = saveSettings;
window.searchChemistryPubChem = searchChemistryPubChem;
window.setMathSubTab = setMathSubTab;
window.setSidebarTab = setSidebarTab;
window.setViewMode = setViewMode;
window.submitAuthPassword = submitAuthPassword;
window.submitCreateItem = submitCreateItem;
window.toggleBlueLight = toggleBlueLight;
window.toggleDocumentFullscreen = toggleDocumentFullscreen;
window.toggleGraphView = toggleGraphView;
window.toggleLanguage = toggleLanguage;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.toggleToc = toggleToc;
window.undoEditor = undoEditor;
window.zoomGraph = zoomGraph;
window.zoomPreview = zoomPreview;

// 구글 드라이브 동기화 관련 기능 전역 바인딩
window.connectGoogleDrive = connectGoogleDrive;
window.disconnectGoogleDrive = disconnectGoogleDrive;
window.syncActiveFileNow = syncActiveFileNow;
window.toggleFileAutoSync = toggleFileAutoSync;
window.resolveGdriveConflict = resolveGdriveConflict;
window.closeGdriveConflictModal = closeGdriveConflictModal;
window.openGdriveSetupModal = openGdriveSetupModal;
window.closeGdriveSetupModal = closeGdriveSetupModal;
window.importGdriveClientSecrets = importGdriveClientSecrets;
window.updateGoogleDriveStatus = updateGoogleDriveStatus;
window.updateActiveFileSyncStatus = updateActiveFileSyncStatus;
window.refreshRemoteFiles = refreshRemoteFiles;
window.downloadRemoteFile = downloadRemoteFile;
window.closeUpdateModal = closeUpdateModal;
window.copyPipCommand = copyPipCommand;

let activeTagFilter = null;
let modalEditedTags = [];
let cachedWorkspaceTags = {};
let tagSearchQuery = "";

function openTagsManager() {
    const sidebar = document.getElementById('sidebar-panel');
    if (sidebar && sidebar.classList.contains('collapsed')) {
        toggleSidebar();
    }
    setSidebarTab('tags');
    setTimeout(() => {
        const searchInput = document.getElementById('tags-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, 150);
}

async function loadWorkspaceTags() {
    if (!window.pywebview) return;
    try {
        const res = await pywebview.api.get_workspace_tags();
        if (res.status === 'success') {
            cachedWorkspaceTags = res.tags;
            filterAndRenderTags();
        }
    } catch (err) {
        console.error("Error loading workspace tags:", err);
    }
}

function filterAndRenderTags() {
    let filteredTags = {};
    if (tagSearchQuery) {
        Object.keys(cachedWorkspaceTags).forEach(tag => {
            if (tag.toLowerCase().includes(tagSearchQuery)) {
                filteredTags[tag] = cachedWorkspaceTags[tag];
            }
        });
    } else {
        filteredTags = cachedWorkspaceTags;
    }
    
    renderTagsCloud(filteredTags);
    renderFilteredFiles(filteredTags);
}

function onTagSearchInput() {
    const input = document.getElementById('tags-search-input');
    const clearBtn = document.getElementById('tags-search-clear-btn');
    if (input) {
        tagSearchQuery = input.value.trim().toLowerCase();
        if (clearBtn) {
            clearBtn.style.display = tagSearchQuery ? 'flex' : 'none';
        }
        filterAndRenderTags();
    }
}

function clearTagSearch() {
    const input = document.getElementById('tags-search-input');
    const clearBtn = document.getElementById('tags-search-clear-btn');
    if (input) {
        input.value = '';
        tagSearchQuery = '';
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        filterAndRenderTags();
        input.focus();
    }
}

function renderTagsCloud(tagsMap) {
    const container = document.getElementById('tags-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const tags = Object.keys(tagsMap);
    if (tags.length === 0) {
        const msgKey = tagSearchQuery ? 'tags_no_search_results' : 'tags_no_tags';
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center;">${t(msgKey)}</span>`;
        return;
    }

    tags.sort().forEach(tag => {
        const count = tagsMap[tag].length;
        const tagEl = document.createElement('span');
        tagEl.className = 'tag-cloud-item';
        tagEl.style.cursor = 'pointer';
        tagEl.style.padding = '4px 8px';
        tagEl.style.borderRadius = '12px';
        tagEl.style.fontSize = '0.8em';
        tagEl.style.fontWeight = '500';
        tagEl.style.display = 'inline-flex';
        tagEl.style.alignItems = 'center';
        tagEl.style.gap = '4px';
        tagEl.style.transition = 'all 0.2s';
        
        if (activeTagFilter === tag) {
            tagEl.style.background = 'var(--accent)';
            tagEl.style.color = '#000000';
            tagEl.style.border = '1px solid var(--accent)';
        } else {
            tagEl.style.background = 'rgba(255, 255, 255, 0.05)';
            tagEl.style.color = 'var(--text-main)';
            tagEl.style.border = '1px solid var(--border)';
        }
        
        tagEl.innerHTML = `#${tag} <span style="font-size: 0.85em; opacity: 0.6;">(${count})</span>`;
        tagEl.onclick = () => {
            filterFilesByTag(tag);
        };
        
        tagEl.onmouseover = () => {
            if (activeTagFilter !== tag) {
                tagEl.style.borderColor = 'var(--accent)';
                tagEl.style.color = 'var(--accent)';
                tagEl.style.background = 'rgba(69, 243, 255, 0.05)';
            }
        };
        tagEl.onmouseout = () => {
            if (activeTagFilter !== tag) {
                tagEl.style.background = 'rgba(255, 255, 255, 0.05)';
                tagEl.style.color = 'var(--text-main)';
                tagEl.style.borderColor = 'var(--border)';
            }
        };
        
        container.appendChild(tagEl);
    });
}

function renderFilteredFiles(tagsMap) {
    const container = document.getElementById('filtered-files-container');
    const clearBtn = document.getElementById('clear-tag-filter-btn');
    const titleEl = document.getElementById('filtered-tags-title');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!activeTagFilter) {
        if (clearBtn) clearBtn.style.display = 'none';
        if (titleEl) titleEl.innerText = t('tags_filtered_files');
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center; padding: 10px;">태그를 선택하여 파일을 필터링하세요.</span>`;
        return;
    }
    
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    if (titleEl) titleEl.innerText = `${t('tags_filtered_files')} (#${activeTagFilter})`;
    
    const files = tagsMap[activeTagFilter] || [];
    if (files.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center; padding: 10px;">이 태그에 속한 파일이 없습니다.</span>`;
        return;
    }
    
    files.forEach(f => {
        const itemEl = document.createElement('div');
        itemEl.style.display = 'flex';
        itemEl.style.alignItems = 'center';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.padding = '8px 10px';
        itemEl.style.background = 'rgba(255,255,255,0.02)';
        itemEl.style.border = '1px solid var(--border)';
        itemEl.style.borderRadius = '6px';
        itemEl.style.fontSize = '0.82em';
        itemEl.style.cursor = 'pointer';
        itemEl.style.transition = 'all 0.2s';
        
        itemEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden;">
                <i data-lucide="file-text" style="width: 14px; height: 14px; color: var(--accent); flex-shrink: 0;"></i>
                <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-main);">${f.name}</span>
            </div>
        `;
        
        itemEl.onclick = () => {
            openFile(f.path);
        };
        
        itemEl.onmouseover = () => {
            itemEl.style.borderColor = 'var(--accent)';
            itemEl.style.background = 'rgba(69, 243, 255, 0.05)';
        };
        itemEl.onmouseout = () => {
            itemEl.style.borderColor = 'var(--border)';
            itemEl.style.background = 'rgba(255,255,255,0.02)';
        };
        
        container.appendChild(itemEl);
    });
    if (window.lucide) lucide.createIcons();
}

function filterFilesByTag(tag) {
    if (activeTagFilter === tag) {
        activeTagFilter = null;
    } else {
        activeTagFilter = tag;
    }
    loadWorkspaceTags();
}

function clearTagFilter() {
    activeTagFilter = null;
    loadWorkspaceTags();
}

function getActiveDocumentTags() {
    return activeDocumentTags || [];
}

function updateActiveDocumentTags(newTags) {
    activeDocumentTags = newTags;
    if (typeof updateFloatingTagsContainer === 'function') {
        updateFloatingTagsContainer();
    }
}

        async function openHashtagModal() {
            if (!currentFilePath) {
                alert(t('msg_no_active_file') || "먼저 파일을 열어주세요.");
                return;
            }
            
            modalEditedTags = getActiveDocumentTags();
            renderModalCurrentTags();
            
            const modal = document.getElementById('hashtag-modal');
            if (modal) {
                modal.style.display = 'flex';
            }
            
            if (window.pywebview) {
                try {
                    const res = await pywebview.api.get_workspace_tags();
                    if (res.status === 'success') {
                        renderModalSuggestTags(res.tags);
                    }
                } catch (err) {
                    console.error("Error loading suggest tags:", err);
                }
            }
        }

        function closeHashtagModal() {
            const modal = document.getElementById('hashtag-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            const input = document.getElementById('hashtag-new-input');
            if (input) input.value = '';
        }

        function renderModalCurrentTags() {
            const container = document.getElementById('hashtag-current-tags-container');
            if (!container) return;
            container.innerHTML = '';
            
            if (modalEditedTags.length === 0) {
                container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em;">등록된 태그가 없습니다.</span>`;
                return;
            }
            
            modalEditedTags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.style.background = 'rgba(69, 243, 255, 0.15)';
                tagEl.style.color = 'var(--accent)';
                tagEl.style.border = '1px solid rgba(69, 243, 255, 0.3)';
                tagEl.style.padding = '4px 8px';
                tagEl.style.borderRadius = '12px';
                tagEl.style.fontSize = '0.8em';
                tagEl.style.fontWeight = '500';
                tagEl.style.display = 'inline-flex';
                tagEl.style.alignItems = 'center';
                tagEl.style.gap = '6px';
                tagEl.style.cursor = 'pointer';
                
                tagEl.innerHTML = `#${tag} <i data-lucide="x" style="width: 12px; height: 12px; opacity: 0.7; transition: opacity 0.2s;"></i>`;
                tagEl.onclick = () => removeHashtag(tag);
                
                tagEl.onmouseover = () => {
                    const icon = tagEl.querySelector('svg');
                    if (icon) icon.style.opacity = '1';
                };
                tagEl.onmouseout = () => {
                    const icon = tagEl.querySelector('svg');
                    if (icon) icon.style.opacity = '0.7';
                };
                
                container.appendChild(tagEl);
            });
            if (window.lucide) lucide.createIcons();
        }

        function renderModalSuggestTags(workspaceTagsMap) {
            const container = document.getElementById('hashtag-suggest-tags-container');
            if (!container) return;
            container.innerHTML = '';
            
            const allTags = Object.keys(workspaceTagsMap);
            const suggestTags = allTags.filter(t => !modalEditedTags.includes(t));
            
            if (suggestTags.length === 0) {
                container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em;">추천할 태그가 없습니다.</span>`;
                return;
            }
            
            suggestTags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.style.background = 'rgba(255, 255, 255, 0.03)';
                tagEl.style.color = 'var(--text-muted)';
                tagEl.style.border = '1px solid var(--border)';
                tagEl.style.padding = '4px 8px';
                tagEl.style.borderRadius = '12px';
                tagEl.style.fontSize = '0.78em';
                tagEl.style.cursor = 'pointer';
                tagEl.style.transition = 'all 0.2s';
                
                tagEl.innerText = `#${tag}`;
                tagEl.onclick = () => addHashtag(tag);
                
                tagEl.onmouseover = () => {
                    tagEl.style.borderColor = 'var(--accent)';
                    tagEl.style.color = 'var(--accent)';
                    tagEl.style.background = 'rgba(69, 243, 255, 0.05)';
                };
                tagEl.onmouseout = () => {
                    tagEl.style.borderColor = 'var(--border)';
                    tagEl.style.color = 'var(--text-muted)';
                    tagEl.style.background = 'rgba(255, 255, 255, 0.03)';
                };
                
                container.appendChild(tagEl);
            });
        }

        function addHashtag(tag) {
            tag = tag.trim().replace(/^#/, '');
            if (!tag) return;
            if (!modalEditedTags.includes(tag)) {
                modalEditedTags.push(tag);
                renderModalCurrentTags();
                if (window.pywebview) {
                    pywebview.api.get_workspace_tags().then(res => {
                        if (res.status === 'success') {
                            renderModalSuggestTags(res.tags);
                        }
                    });
                }
            }
        }

        function removeHashtag(tag) {
            modalEditedTags = modalEditedTags.filter(t => t !== tag);
            renderModalCurrentTags();
            if (window.pywebview) {
                pywebview.api.get_workspace_tags().then(res => {
                    if (res.status === 'success') {
                        renderModalSuggestTags(res.tags);
                    }
                });
            }
        }

        function addHashtagFromInput() {
            const input = document.getElementById('hashtag-new-input');
            if (!input) return;
            
            const rawVal = input.value.trim();
            if (!rawVal) return;
            
            const newTags = rawVal.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
            newTags.forEach(tag => {
                if (!modalEditedTags.includes(tag)) {
                    modalEditedTags.push(tag);
                }
            });
            
            input.value = '';
            renderModalCurrentTags();
            
            if (window.pywebview) {
                pywebview.api.get_workspace_tags().then(res => {
                    if (res.status === 'success') {
                        renderModalSuggestTags(res.tags);
                    }
                });
            }
        }

        async function saveHashtagChanges() {
            updateActiveDocumentTags(modalEditedTags);
            closeHashtagModal();
            if (window.saveActiveFile) {
                await saveActiveFile();
            }
            triggerLiveRender();
        }

        // 플로팅 태그 UI 갱신 함수
        function updateFloatingTagsContainer() {
            const container = document.getElementById('floating-hashtag-container');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!activeDocumentTags || activeDocumentTags.length === 0) {
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'flex';
            activeDocumentTags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'floating-tag-chip';
                chip.innerText = `#${tag}`;
                chip.onclick = () => openTagSelectModal(tag);
                container.appendChild(chip);
            });
        }

        // 태그별 문서 선택 모달 제어 함수
        async function openTagSelectModal(tag) {
            const modal = document.getElementById('tag-select-modal');
            const titleEl = document.getElementById('tag-select-modal-title');
            const container = document.getElementById('tag-select-files-container');
            
            if (!modal || !container) return;
            
            if (titleEl) {
                titleEl.innerText = `${t('tag_select_modal_title') || '해시태그 문서선택'} (#${tag})`;
            }
            
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px; font-size: 0.85em;">조회 중...</div>`;
            modal.style.display = 'flex';
            
            if (window.pywebview) {
                try {
                    const res = await pywebview.api.get_workspace_tags();
                    if (res.status === 'success') {
                        container.innerHTML = '';
                        const files = res.tags[tag] || [];
                        if (files.length === 0) {
                            container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center; padding: 10px;">이 태그에 속한 파일이 없습니다.</span>`;
                        } else {
                            files.forEach(f => {
                                const itemEl = document.createElement('div');
                                itemEl.style.display = 'flex';
                                itemEl.style.alignItems = 'center';
                                itemEl.style.justifyContent = 'space-between';
                                itemEl.style.padding = '8px 10px';
                                itemEl.style.background = 'rgba(255,255,255,0.02)';
                                itemEl.style.border = '1px solid var(--border)';
                                itemEl.style.borderRadius = '6px';
                                itemEl.style.fontSize = '0.85em';
                                itemEl.style.cursor = 'pointer';
                                itemEl.style.transition = 'all 0.2s';
                                
                                itemEl.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden;">
                                        <i data-lucide="file-text" style="width: 14px; height: 14px; color: var(--accent); flex-shrink: 0;"></i>
                                        <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-main);">${f.name}</span>
                                    </div>
                                `;
                                
                                itemEl.onclick = () => {
                                    openFile(f.path);
                                    closeTagSelectModal();
                                };
                                
                                itemEl.onmouseover = () => {
                                    itemEl.style.borderColor = 'var(--accent)';
                                    itemEl.style.background = 'rgba(69, 243, 255, 0.05)';
                                };
                                itemEl.onmouseout = () => {
                                    itemEl.style.borderColor = 'var(--border)';
                                    itemEl.style.background = 'rgba(255,255,255,0.02)';
                                };
                                
                                container.appendChild(itemEl);
                            });
                            if (window.lucide) lucide.createIcons();
                        }
                    } else {
                        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center; padding: 10px;">태그 조회 실패</span>`;
                    }
                } catch (err) {
                    console.error("Error loading tag select files:", err);
                    container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85em; width: 100%; text-align: center; padding: 10px;">태그 조회 실패</span>`;
                }
            }
        }

        function closeTagSelectModal() {
            const modal = document.getElementById('tag-select-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        // 1+4 테이블(표) 네온 그리드 셀렉터 초기화 및 이벤트 등록
        function setupTablePicker() {
            const gridContainer = document.getElementById('table-picker-grid');
            const sizeDisplay = document.getElementById('table-picker-size-display');
            if (!gridContainer || !sizeDisplay) return;

            // 1. 10x10 격자 셀(100개) 동적 생성
            gridContainer.innerHTML = '';
            for (let r = 1; r <= 10; r++) {
                for (let c = 1; c <= 10; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    
                    // 마우스 진입 시 해당 범위(1,1 ~ r,c) 하이라이트 처리
                    cell.addEventListener('mouseover', () => {
                        highlightGrid(r, c);
                    });
                    
                    // 클릭 시 해당 행렬 크기 마크다운 표 코드 삽입
                    cell.addEventListener('click', () => {
                        insertMarkdownTable(r, c);
                    });
                    
                    gridContainer.appendChild(cell);
                }
            }

            // 마우스가 그리드 밖으로 나가면 0 x 0으로 리셋
            gridContainer.addEventListener('mouseleave', () => {
                highlightGrid(0, 0);
            });

            // 그리드 하이라이팅 연출 함수 (네온 발광 유도)
            function highlightGrid(maxRow, maxCol) {
                const cells = gridContainer.querySelectorAll('.grid-cell');
                cells.forEach(cell => {
                    const r = parseInt(cell.dataset.row);
                    const c = parseInt(cell.dataset.col);
                    if (r <= maxRow && c <= maxCol) {
                        cell.classList.add('highlighted');
                    } else {
                        cell.classList.remove('highlighted');
                    }
                });
                sizeDisplay.innerText = `${maxRow} x ${maxCol}`;
            }

            // 마크다운 표 스니펫 에디터 삽입 함수
            function insertMarkdownTable(rows, cols) {
                const view = window.cmEditor;
                if (!view) return;

                let tableMarkdown = "\n";
                
                // 1. 헤더 생성
                let headerLine = "|";
                let dividerLine = "|";
                for (let c = 1; c <= cols; c++) {
                    headerLine += ` Header ${c} |`;
                    dividerLine += " --- |";
                }
                tableMarkdown += headerLine + "\n" + dividerLine + "\n";
                
                // 2. 데이터 행 생성
                for (let r = 1; r <= rows; r++) {
                    let rowLine = "|";
                    for (let c = 1; c <= cols; c++) {
                        rowLine += ` Cell (${r},${c}) |`;
                    }
                    tableMarkdown += rowLine + "\n";
                }
                tableMarkdown += "\n";

                const state = view.state;
                const selection = state.selection.main;
                
                view.dispatch({
                    changes: { from: selection.from, to: selection.to, insert: tableMarkdown },
                    selection: { anchor: selection.from + tableMarkdown.length }
                });
                view.focus();

                document.getElementById('toolbar-table-dropdown').classList.remove('show');
            }
        }

        // 실행
        setTimeout(setupTablePicker, 100);

// 날짜 및 시간 동적 삽입 함수
function insertDateTime(type) {
    const view = window.cmEditor;
    if (!view) return;
    
    const now = new Date();
    let textToInsert = "";
    
    if (type === 'date') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        textToInsert = `${year}-${month}-${day}`;
    } else if (type === 'time') {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        textToInsert = `${hours}:${minutes}:${seconds}`;
    }
    
    const state = view.state;
    const selection = state.selection.main;
    
    view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: textToInsert },
        selection: { anchor: selection.from + textToInsert.length }
    });
    view.focus();
}
window.insertDateTime = insertDateTime;

// 해시태그 전역 바인딩
window.openTagsManager = openTagsManager;
window.openHashtagModal = openHashtagModal;
window.closeHashtagModal = closeHashtagModal;
window.addHashtagFromInput = addHashtagFromInput;
window.saveHashtagChanges = saveHashtagChanges;
window.removeHashtag = removeHashtag;
window.addHashtag = addHashtag;
window.loadWorkspaceTags = loadWorkspaceTags;
window.filterFilesByTag = filterFilesByTag;
window.clearTagFilter = clearTagFilter;
window.onTagSearchInput = onTagSearchInput;
window.clearTagSearch = clearTagSearch;
window.updateFloatingTagsContainer = updateFloatingTagsContainer;
window.openTagSelectModal = openTagSelectModal;
window.closeTagSelectModal = closeTagSelectModal;
window.setupTablePicker = setupTablePicker;