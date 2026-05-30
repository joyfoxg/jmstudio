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
            }
            // 이모지 피커 다국어 로케일 동기화 (재렌더링 - 상태 인자 명시 주입)
            if (window.renderEmojiPicker) {
                window.renderEmojiPicker(true, currentTheme, currentLang);
            }
            
            lucide.createIcons();
            
            if (typeof window.renderTemplates === 'function') {
                window.renderTemplates();
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
            currentIndex: -1
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
            
            const state = cm.EditorState.create({
                doc: "",
                extensions: [
                    cm.basicSetup,
                    cm.markdown(),
                    window.cmPlaceholderConf.of(cm.placeholder(t('msg_editor_placeholder'))),
                    cm.keymap.of([{ key: "Enter", run: handleEnterKey }]),
                    cm.EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            handleEditorInput();
                        }
                    })
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

        window.setEditorContent = function(text) {
            if (window.cmEditor) {
                window.cmEditor.dispatch({
                    changes: { from: 0, to: window.cmEditor.state.doc.length, insert: text }
                });
            } else {
                window.pendingEditorContent = text;
            }
        };

        window.undoEditor = function() {
            const view = window.cmEditor;
            if (view && window.cm6) {
                import("https://esm.sh/@codemirror/commands").then(cmds => {
                    cmds.undo(view);
                }).catch(err => console.error("Undo error:", err));
            }
        };

        window.redoEditor = function() {
            const view = window.cmEditor;
            if (view && window.cm6) {
                import("https://esm.sh/@codemirror/commands").then(cmds => {
                    cmds.redo(view);
                }).catch(err => console.error("Redo error:", err));
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
                                
                                // Color logic based on rules:
                                let color = '#a855f7';
                                if (node.missing) {
                                    color = '#ef4444';
                                } else if (degree >= 5) {
                                    color = '#fbbf24';
                                } else if (node.path) {
                                    if (node.path.startsWith('doc/')) {
                                        color = '#0ea5e9';
                                    } else if (node.path.startsWith('docs/')) {
                                        color = '#10b981';
                                    }
                                }
                                
                                const fontSize = (degree >= 5 ? fontSizeVal + 1 : fontSizeVal - 1) / globalScale;
                                ctx.font = `${fontSize}px sans-serif`;
                                
                                // Node circle with glow effect
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                                ctx.fillStyle = color;
                                ctx.shadowBlur = degree >= 5 ? 15 : 8;
                                ctx.shadowColor = color;
                                ctx.fill();
                                ctx.shadowBlur = 0; // reset
                                
                                // Text label below
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
        }

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

        function renderFileTree(files) {
            localFiles = collectLocalFiles(files);
            const container = document.getElementById('file-tree-container');
            container.innerHTML = "";
            
            if (!files || files.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 10px; text-align: center;">${t('sidebar_no_files')}</div>`;
                return;
            }
            
            container.appendChild(createTreeDOM(files));
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
                
                const iconName = item.type === 'folder' ? 'folder' : 'file-text';
                
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

        // 파일 열기
        async function openFile(relPath) {
            const res = await pywebview.api.read_file(relPath);
            if (res.status === 'success') {
                currentFilePath = relPath;
                
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
                
                // 1. Math block 임시 마스킹 (Marked 파서 간섭 방지)
                const maskedText = maskLaTeX(markdownText);
                
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

        function resolveImagePaths(html) {
            // 이미지 주소가 relative일 경우 /workspace/ 경로로 우회 서빙
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const images = div.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
                    // relative 경로는 백엔드 Bottle static 서버 경로로 라우팅
                    img.setAttribute('src', `/workspace/${src}`);
                }
            });
            return div.innerHTML;
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
                    lucide.createIcons();
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
                    lucide.createIcons();
                }
            }
        }

        function toggleMermaidZoom(btn) {
            const container = btn.closest('.mermaid-container');
            const isZoomed = container.classList.toggle('zoomed');
            const svg = container.querySelector('.mermaid svg');
            const icon = btn.querySelector('[data-lucide]');
            
            if (svg) {
                if (isZoomed) {
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
                    icon.setAttribute('data-lucide', 'minimize-2');
                    
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
                    icon.setAttribute('data-lucide', 'maximize-2');
                    
                    // 원래 상태로 환원
                    svg.style.width = '';
                    svg.style.maxWidth = '';
                }
            } else {
                if (isZoomed) {
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
                    icon.setAttribute('data-lucide', 'minimize-2');
                } else {
                    btn.querySelector('span').innerText = t('mermaid_zoom_orig');
                    icon.setAttribute('data-lucide', 'maximize-2');
                }
            }
            lucide.createIcons();
        }

        function openMermaidFullscreen(btn) {
            const container = btn.closest('.mermaid-container');
            const svg = container.querySelector('.mermaid svg');
            if (!svg) return;
            
            const modal = document.getElementById('mermaid-fs-modal');
            const content = modal.querySelector('.fs-modal-content');
            
            // SVG를 깊은 클론(Deep Clone)하여 주입
            content.innerHTML = svg.outerHTML;
            
            // 전체화면 모달 내 wiki-link 클릭 시 파일 이동 + 모달 닫기
            content.querySelectorAll('.wiki-link').forEach(el => {
                el.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeMermaidFullscreen();
                    if (window.openWikiLink) window.openWikiLink(this.getAttribute('data-target'));
                });
            });
            
            // 모달 노출 및 애니메이션 트리거
            modal.style.display = 'flex';
            modal.offsetHeight; // force reflow
            modal.classList.add('show');
            
            // 모달 내부 SVG 크기 최대화 스타일 지정
            const fsSvg = content.querySelector('svg');
            if (fsSvg) {
                // viewBox에서 실제 가로/세로 추출하여 고정 픽셀로 지정 (CSS 순환 허탈 방지)
                const viewBox = fsSvg.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/\\s+/);
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
                fsSvg.style.setProperty('max-height', '80vh', 'important');
            }
            
            document.addEventListener('keydown', handleFsEsc);
            lucide.createIcons();
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

        function undoEditor() {
            if (window.undoManager) {
                const undone = window.undoManager.undo();
                if (undone) {
                    showToast(t('msg_undo_done'));
                }
            }
        }

        function redoEditor() {
            if (window.undoManager) {
                const redone = window.undoManager.redo();
                if (redone) {
                    showToast(t('msg_redo_done'));
                }
            }
        }

        // 사이드바 수식 입력기 및 화학식 검색기, 다이어그램 탭 전환 기능
        function setSidebarTab(tab) {
            const explorerPane = document.getElementById('sidebar-content-explorer');
            const mathPane = document.getElementById('sidebar-content-math');
            const chemistryPane = document.getElementById('sidebar-content-chemistry');
            const diagramPane = document.getElementById('sidebar-content-diagram');
            
            const tabBtnExplorer = document.getElementById('tab-explorer');
            const tabBtnMath = document.getElementById('tab-math');
            const tabBtnChemistry = document.getElementById('tab-chemistry');
            const tabBtnDiagram = document.getElementById('tab-diagram');
            
            // 모든 패널 숨김
            explorerPane.style.display = 'none';
            mathPane.style.display = 'none';
            if (chemistryPane) chemistryPane.style.display = 'none';
            if (diagramPane) diagramPane.style.display = 'none';
            
            // 모든 탭 버튼 비활성화
            tabBtnExplorer.classList.remove('active');
            tabBtnMath.classList.remove('active');
            if (tabBtnChemistry) tabBtnChemistry.classList.remove('active');
            if (tabBtnDiagram) tabBtnDiagram.classList.remove('active');
            
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
        let hasExternalMathDb = false;

        // 비동기 수식 DB 로드
        fetch('/static/data/math_db.json')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch math_db.json');
                return res.json();
            })
            .then(data => {
                mathDatabase = data;
            })
            .catch(err => {
                console.warn('Math database load failed, using local fallback:', err);
                mathDatabase = [];
            });

        const MATH_SUBTAB_CATEGORIES = {
            math: [
                { value: 'basic', label: '기본 수식' },
                { value: 'calculus', label: '미적분 및 극한' },
                { value: 'greek', label: '그리스 문자' },
                { value: 'symbols', label: '기본 수학 기호' },
                { value: 'spec_operators', label: '전문 수학 연산자' },
                { value: 'set_logic', label: '집합론 및 논리' },
                { value: 'lin_alg', label: '선형대수 및 행렬' }
            ],
            physics: [
                { value: 'phys_ops', label: '기본 연산자' },
                { value: 'em_gravity', label: '전자기학 및 중력' },
                { value: 'quantum', label: '양자 및 상대성' },
                { value: 'fluid', label: '유체역학' },
                { value: 'thermo', label: '열역학' }
            ],
            bio: [
                { value: 'rxn', label: '화학 반응 및 평형' },
                { value: 'genetics', label: '유전학 및 집단유전학' },
                { value: 'molbio', label: '분자생물학' },
                { value: 'protein', label: '단백질 및 생화학' }
            ],
            cs: [
                { value: 'cs_ops', label: '자주 쓰이는 연산자' },
                { value: 'algo_cs', label: '알고리즘 & 컴퓨터 과학' },
                { value: 'ml_ai', label: '머신러닝 & AI' },
                { value: 'deep_learning', label: '딥러닝' },
                { value: 'info_theory', label: '정보이론' },
                { value: 'comp_arch', label: '컴퓨터 구조' },
                { value: 'crypto', label: '암호학' },
                { value: 'hash_integrity', label: '해시 함수 & 무결성' },
                { value: 'net_security', label: '네트워크 보안' },
                { value: 'info_security', label: '정보이론 기반' }
            ],
            ee: [
                { value: 'ee_ops', label: '자주 쓰이는 연산자' },
                { value: 'ee_circuits', label: '회로 이론' },
                { value: 'ee_em', label: '전자기학' },
                { value: 'ee_signals', label: '신호 및 시스템' },
                { value: 'ee_semicon', label: '반도체 물리' },
                { value: 'ee_control', label: '제어공학' }
            ]
        };

        function updateMathCategorySelect(subtab) {
            const selectEl = document.getElementById('math-category-select');
            if (!selectEl) return;
            selectEl.innerHTML = '<option value="all">전체</option>';
            const categories = MATH_SUBTAB_CATEGORIES[subtab];
            if (categories) {
                categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.value;
                    opt.textContent = cat.label;
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
                    extendedSummary.innerHTML = `🔍 추가 검색 결과 (${matchedDbItems.length}개)`;
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
                        span.textContent = dbItem.name;
                        btn.appendChild(span);
                        
                        extendedGrid.appendChild(btn);
                    });
                    
                    if (matchedDbItems.length > maxDisplay) {
                        const moreInfo = document.createElement('div');
                        moreInfo.style.cssText = 'grid-column: 1 / -1; text-align: center; font-size: 0.78em; color: var(--text-muted); margin-top: 6px;';
                        moreInfo.textContent = `...외 ${matchedDbItems.length - maxDisplay}개의 공식이 더 있습니다. 더 자세한 키워드로 검색해 보세요.`;
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
                const smilesBlock = "\\n" + "```smiles\\n" + currentSearchResultSmiles + "\\n" + "```\\n";
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
            const smilesBlock = "\\n" + "```smiles\\n" + currentSearchResultSmiles + "\\n" + "```\\n";
            
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
                    h.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        });

        // 뷰 모드 조절
        function setViewMode(mode) {
            currentViewMode = mode;
            
            const paneEditor = document.getElementById('pane-editor');
            const panePreview = document.getElementById('pane-preview');
            const resizer = document.getElementById('pane-resizer');
            
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`mode-${mode}`).classList.add('active');
            
            if (mode === 'edit') {
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
            const content = getEditorContent();
            const res = await pywebview.api.save_file(currentFilePath, content);
            if (res.status === 'success') {
                showToast(t('msg_save_success'));
                
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

        // PDF 인쇄 실행 (미리보기 화면만 밝은 테마로 자동 최적화하여 깔끔하게 출력)
        async function printDocument() {
            if (!currentFilePath) {
                alert(t('msg_print_no_file'));
                return;
            }
            
            const originalTheme = currentTheme;
            
            // 다크 테마인 경우, 인쇄 가독성을 위해 일시적으로 고대비 라이트 테마로 자동 전환
            if (originalTheme === 'dark') {
                setTheme('light', false); // 파일 DB 저장을 우회하여 메모리 상에서만 테마 상태 변경
                
                // 테마가 가볍게 바뀐 뒤, Mermaid 다이어그램 및 화학 구조식(SMILES)이
                // 화이트 인쇄용 테마로 고해상도 리렌더링을 완전히 완료할 때까지 대기 (450ms)
                setTimeout(() => {
                    window.print();
                    
                    // 인쇄창이 호출되거나 닫힌 즉시 원래의 세련된 다크 테마로 깜쪽같이 원복
                    setTimeout(() => {
                        setTheme('dark', false);
                        showToast(t('msg_print_success'));
                    }, 100);
                }, 450);
            } else {
                // 이미 라이트 테마인 경우 즉시 출력
                window.print();
            }
        }

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

        async function deleteWorkspaceItem(event, relPath) {
            event.stopPropagation();
            const fileName = relPath.substring(relPath.lastIndexOf('/') + 1);
            if (confirm(t('msg_delete_confirm').replace('{fileName}', fileName))) {
                const res = await pywebview.api.delete_item(relPath);
                if (res.status === 'success') {
                    renderFileTree(res.files);
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
                    }
                    showToast(t('msg_delete_success'));
                } else {
                    alert(t('msg_delete_failed') + res.message);
                }
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

        // CodeMirror 6 모듈 가져오기 및 글로벌 바인딩
        import { basicSetup, EditorView } from 'https://esm.sh/codemirror';
        import { EditorState, Compartment } from 'https://esm.sh/@codemirror/state';
        import { markdown } from 'https://esm.sh/@codemirror/lang-markdown';
        import { placeholder, keymap } from 'https://esm.sh/@codemirror/view';

        window.cm6 = {
            basicSetup,
            EditorView,
            EditorState,
            Compartment,
            markdown,
            placeholder,
            keymap
        };
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
                btnText.innerText = level === 0 ? "단락" : `머리글 ${level}`;
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