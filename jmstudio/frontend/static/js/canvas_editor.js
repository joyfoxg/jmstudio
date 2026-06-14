(function() {
    class CanvasEditor {
        constructor() {
            this.filePath = "";
            this.nodes = [];
            this.edges = [];
            this.transform = { x: 0, y: 0, k: 1 };
            
            this.board = null;
            this.zoom = null;
            this.svgLayer = null;
            this.svgGroup = null;
            this.nodesLayer = null;
            
            this.selectedNodeIds = new Set();
            this.selectedEdgeIds = new Set();
            
            this.activeCM6 = null; // { nodeId, view }
            this.saveTimeout = null;
            this.fileCache = {}; // 마크다운 파일 로컬 캐시
            
            // 연결선 드래그 드로잉 상태
            this.isDrawingEdge = false;
            this.edgeStartNodeId = null;
            this.edgeStartSide = null;
            
            // 실행 취소/다시 실행 히스토리 스택
            this.undoStack = [];
            this.redoStack = [];
            this.maxHistory = 50;
            
            this.init();
        }
        
        init() {
            this.board = d3.select("#canvas-board");
            this.nodesLayer = d3.select("#canvas-nodes-layer");
            this.svgLayer = d3.select("#canvas-svg-layer");
            
            // SVG 내부에 transform을 먹일 <g> 그룹 확보
            this.svgGroup = this.svgLayer.select("#canvas-svg-layer-g");
            if (this.svgGroup.empty()) {
                this.svgGroup = this.svgLayer.append("g").attr("id", "canvas-svg-layer-g");
            }
            
            // D3 줌 세팅
            this.zoom = d3.zoom()
                .filter((event) => {
                    if (event.type === "wheel") return event.ctrlKey || event.metaKey; // Ctrl+Wheel로만 줌
                    if (event.type === "mousedown" && event.shiftKey) return false; // Shift+Drag는 박스 선택
                    return !event.ctrlKey && !event.button; // 좌클릭 및 Space+Drag(스페이스는 커스텀) 허용
                })
                .scaleExtent([0.15, 3.0])
                .on("zoom", (event) => {
                    this.transform = event.transform;
                    this.applyTransform();
                    this.updateFloatingToolbarPosition();
                });
                
            this.board.call(this.zoom);
            this.board.on("dblclick.zoom", null); // 더블클릭 줌 방지 (텍스트 카드 편집과 충돌 회피)
            
            // 기존 마우스 휠 상하 스크롤 (Ctrl 없을 때) -> 상하좌우 패닝
            this.board.on("wheel.custom", (event) => {
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    this.zoom.translateBy(this.board, -event.deltaX / this.transform.k, -event.deltaY / this.transform.k);
                }
            });
            
            // 박스 선택(Marquee Tool) 세팅
            let isBoxSelecting = false;
            let boxStart = null;
            let selectionBox = null;
            
            const boardDrag = d3.drag()
                .filter(event => event.shiftKey)
                .on("start", (event) => {
                    isBoxSelecting = true;
                    this.deselectAll();
                    const rect = this.board.node().getBoundingClientRect();
                    const mouseWorldX = (event.sourceEvent.clientX - rect.left - this.transform.x) / this.transform.k;
                    const mouseWorldY = (event.sourceEvent.clientY - rect.top - this.transform.y) / this.transform.k;
                    boxStart = { x: mouseWorldX, y: mouseWorldY };
                    
                    selectionBox = this.svgGroup.append("rect")
                        .attr("class", "canvas-selection-box")
                        .attr("x", mouseWorldX).attr("y", mouseWorldY)
                        .attr("width", 0).attr("height", 0)
                        .attr("fill", "rgba(69, 243, 255, 0.1)")
                        .attr("stroke", "rgba(69, 243, 255, 0.5)")
                        .attr("stroke-width", 2 / this.transform.k);
                })
                .on("drag", (event) => {
                    if (!isBoxSelecting) return;
                    const rect = this.board.node().getBoundingClientRect();
                    const mouseWorldX = (event.sourceEvent.clientX - rect.left - this.transform.x) / this.transform.k;
                    const mouseWorldY = (event.sourceEvent.clientY - rect.top - this.transform.y) / this.transform.k;
                    
                    const minX = Math.min(boxStart.x, mouseWorldX);
                    const minY = Math.min(boxStart.y, mouseWorldY);
                    const width = Math.abs(mouseWorldX - boxStart.x);
                    const height = Math.abs(mouseWorldY - boxStart.y);
                    
                    selectionBox.attr("x", minX).attr("y", minY).attr("width", width).attr("height", height);
                    
                    this.selectedNodeIds.clear();
                    this.nodes.forEach(n => {
                        const nx2 = n.x + n.width, ny2 = n.y + n.height;
                        if (minX < nx2 && minX + width > n.x && minY < ny2 && minY + height > n.y) {
                            this.selectedNodeIds.add(n.id);
                        }
                    });
                    
                    this.nodes.forEach(n => {
                        const nodeEl = document.getElementById(`node-${n.id}`);
                        if (nodeEl) {
                            if (this.selectedNodeIds.has(n.id)) nodeEl.classList.add("selected");
                            else nodeEl.classList.remove("selected");
                        }
                    });
                })
                .on("end", () => {
                    isBoxSelecting = false;
                    if (selectionBox) { selectionBox.remove(); selectionBox = null; }
                    if (this.selectedNodeIds.size === 1) {
                        const n = this.nodes.find(node => node.id === Array.from(this.selectedNodeIds)[0]);
                        if (n) this.showFloatingToolbarForNode(n);
                    }
                });
            this.board.call(boardDrag);
            
            // 보드 빈 영역 클릭 시 선택 해제 및 CM6 닫기, 컨텍스트 메뉴 닫기
            this.board.on("click", (event) => {
                const target = event.target;
                this.closeContextMenu();
                if (target.id === "canvas-board" || target.id === "canvas-nodes-layer" || target.tagName === "svg" || target.id === "canvas-svg-layer-g") {
                    this.deselectAll();
                    this.closeActiveCM6();
                }
            });
            
            // 마우스 우클릭 보드 컨텍스트 메뉴
            this.board.on("contextmenu", (event) => {
                event.preventDefault();
                this.showBoardContextMenu(event);
            });
            
            // 키보드 Delete 단추로 노드/엣지 삭제 및 Undo/Redo/Save 단축키 지원
            d3.select(window).on("keydown.canvas", (event) => {
                // CM6 에디터 포커스 중에는 단축키/삭제 우회 (단, Esc/Ctrl+Enter는 허용)
                if (this.activeCM6) {
                    if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
                        event.preventDefault();
                        this.closeActiveCM6();
                        this.deselectAll();
                    }
                    return;
                }
                
                if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
                
                // Esc: 전체 선택 해제
                if (event.key === "Escape") {
                    this.deselectAll();
                }
                // Enter / F2: 텍스트 노드 편집 진입
                else if (event.key === "Enter" || event.key === "F2") {
                    if (this.selectedNodeIds.size === 1) {
                        const id = Array.from(this.selectedNodeIds)[0];
                        const n = this.nodes.find(node => node.id === id);
                        if (n && n.type === "text") {
                            event.preventDefault();
                            const contentEl = document.getElementById(`content-${n.id}`);
                            if (contentEl) {
                                this.editMarkdownNode(n, contentEl);
                            }
                        }
                    }
                }
                // Undo: Ctrl + Z
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
                    event.preventDefault();
                    this.undo();
                }
                // Redo: Ctrl + Y
                else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
                    event.preventDefault();
                    this.redo();
                }
                // Save: Ctrl + S
                else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    this.saveCanvasImmediately();
                }
                // Select All: Ctrl + A
                else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                    event.preventDefault();
                    this.nodes.forEach(n => this.selectedNodeIds.add(n.id));
                    d3.selectAll(".canvas-node").classed("selected", true);
                    this.removeFloatingToolbar();
                }
                // Zoom to Fit: Ctrl + 0 or Shift + 1
                else if (((event.ctrlKey || event.metaKey) && event.key === "0") || (event.shiftKey && event.key === "1") || (event.shiftKey && event.key === "!")) {
                    event.preventDefault();
                    this.fitToView();
                }
                // Delete / Backspace 삭제
                else if (event.key === "Delete" || event.key === "Backspace") {
                    if (this.selectedNodeIds.size > 0 || this.selectedEdgeIds.size > 0) {
                        this.pushHistory();
                        this.selectedNodeIds.forEach(id => {
                            this.nodes = this.nodes.filter(n => n.id !== id);
                            this.edges = this.edges.filter(e => e.fromNode !== id && e.toNode !== id);
                            if (this.activeCM6 && this.activeCM6.nodeId === id) {
                                this.activeCM6.view.destroy();
                                this.activeCM6 = null;
                            }
                        });
                        this.selectedEdgeIds.forEach(id => {
                            this.edges = this.edges.filter(e => e.id !== id);
                        });
                        this.selectedNodeIds.clear();
                        this.selectedEdgeIds.clear();
                        this.renderCanvas();
                        this.saveCanvasDebounced();
                    }
                }
                // Ctrl + D: 복제
                else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
                    event.preventDefault();
                    if (this.selectedNodeIds.size > 0) {
                        this.duplicateSelected();
                    }
                }
                // Ctrl + G / Ctrl + Shift + G: 그룹화
                else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.ungroupSelected();
                    } else if (this.selectedNodeIds.size > 1) {
                        this.groupSelected();
                    }
                }
                // Nudge: Arrow Keys
                else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                    if (this.selectedNodeIds.size > 0) {
                        event.preventDefault();
                        const amount = event.shiftKey ? 10 : 1;
                        let dx = 0, dy = 0;
                        if (event.key === "ArrowUp") dy = -amount;
                        else if (event.key === "ArrowDown") dy = amount;
                        else if (event.key === "ArrowLeft") dx = -amount;
                        else if (event.key === "ArrowRight") dx = amount;
                        
                        this.pushHistory();
                        this.selectedNodeIds.forEach(id => {
                            const n = this.nodes.find(node => node.id === id);
                            if (n) {
                                n.x += dx;
                                n.y += dy;
                                const nodeEl = document.getElementById(`node-${id}`);
                                if (nodeEl) {
                                    nodeEl.style.left = `${n.x}px`;
                                    nodeEl.style.top = `${n.y}px`;
                                }
                            }
                        });
                        this.drawEdges();
                        this.saveCanvasDebounced();
                        if (this.selectedNodeIds.size === 1) {
                            const n = this.nodes.find(node => node.id === Array.from(this.selectedNodeIds)[0]);
                            if (n) this.showFloatingToolbarForNode(n);
                        }
                    }
                }
            });
            
            // Space 바 누를 때 커서 모양 변경 (패닝 힌트)
            d3.select(window).on("keydown.space", (e) => {
                if (e.code === "Space" && !this.activeCM6 && document.activeElement.tagName !== "INPUT") {
                    this.board.style("cursor", "grab");
                }
            }).on("keyup.space", (e) => {
                if (e.code === "Space") {
                    this.board.style("cursor", "default");
                }
            });
            
            // Drag and Drop (사이드바 등에서 드래그된 파일 처리)
            const boardEl = document.getElementById("canvas-board");
            boardEl.addEventListener("dragover", (e) => e.preventDefault());
            boardEl.addEventListener("drop", async (e) => {
                e.preventDefault();
                const filePath = e.dataTransfer.getData("text/plain");
                if (filePath) {
                    const rect = boardEl.getBoundingClientRect();
                    const dropX = e.clientX - rect.left;
                    const dropY = e.clientY - rect.top;
                    
                    // 월드 좌표 변환
                    const worldX = (dropX - this.transform.x) / this.transform.k;
                    const worldY = (dropY - this.transform.y) / this.transform.k;
                    
                    this.pushHistory();
                    this.addFileNodeAt(filePath, worldX, worldY);
                }
            });
        }
        
        applyTransform() {
            const { x, y, k } = this.transform;
            
            // HTML 노드 및 SVG 에지 트랜스폼 동기화
            this.nodesLayer.style("transform", `translate(${x}px, ${y}px) scale(${k})`);
            
            // SVG 내부 변환은 브라우저 렌더링 버그 방지를 위해 style.transform 대신 SVG native transform 어트리뷰트 사용
            this.svgGroup.attr("transform", `translate(${x}, ${y}) scale(${k})`);
            
            // 그리드 배경 패턴 동적 스케일링 (16px 기준)
            const bgSize = 16 * k;
            this.board
                .style("background-size", `${bgSize}px ${bgSize}px`)
                .style("background-position", `${x}px ${y}px`);
        }
        
        deselectAll() {
            const hasSelectedEdge = (this.selectedEdgeIds.size > 0);
            this.selectedNodeIds.clear();
            this.selectedEdgeIds.clear();
            d3.selectAll(".canvas-node").classed("selected", false);
            d3.selectAll(".canvas-edge").classed("selected", false);
            this.removeFloatingToolbar();
            if (hasSelectedEdge) {
                this.drawEdges();
            }
        }
        
        async loadCanvas(filePath) {
            this.filePath = filePath;
            this.deselectAll();
            this.closeActiveCM6();
            this.fileCache = {}; // 캐시 비우기
            this.undoStack = [];
            this.redoStack = [];
            
            const res = await pywebview.api.read_canvas(filePath);
            if (res.status === "success") {
                const data = res.content || {};
                this.nodes = data.nodes || [];
                this.edges = data.edges || [];
                
                this.renderCanvas();
                this.fitToView();
            } else {
                alert("캔버스 로딩 실패: " + res.message);
            }
        }
        
        saveCanvasDebounced() {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                const data = {
                    nodes: this.nodes,
                    edges: this.edges
                };
                const res = await pywebview.api.save_canvas(this.filePath, JSON.stringify(data));
                if (res.status !== "success") {
                    console.error("캔버스 자동 저장 오류: ", res.message);
                }
            }, 400);
        }
        
        async saveCanvasImmediately() {
            clearTimeout(this.saveTimeout);
            
            // workspace.canvas와 같이 임시로 생성된 기본 캔버스인 경우 다른 이름으로 저장 유도
            if (this.filePath === "workspace.canvas") {
                await this.saveCanvasAs();
                return;
            }
            
            const data = {
                nodes: this.nodes,
                edges: this.edges
            };
            const res = await pywebview.api.save_canvas(this.filePath, JSON.stringify(data));
            if (res.status === "success") {
                this.showToast("캔버스 저장 완료");
            } else {
                alert("캔버스 저장 실패: " + res.message);
            }
        }
        
        async saveCanvasAs() {
            clearTimeout(this.saveTimeout);
            const data = {
                nodes: this.nodes,
                edges: this.edges
            };
            
            const res = await pywebview.api.save_canvas_as_dialog(JSON.stringify(data));
            if (res.status === "success") {
                this.filePath = res.path;
                
                // 타이틀 업데이트 및 탐색기 리프레시
                const titleEl = document.getElementById('active-file-title');
                if (titleEl) {
                    const norm = this.filePath.replace(/\\/g, '/');
                    titleEl.innerText = norm.substring(norm.lastIndexOf('/') + 1);
                }
                
                if (typeof window.refreshWorkspace === "function") {
                    await window.refreshWorkspace();
                }
                
                this.showToast("캔버스 다른 이름으로 저장 완료");
            } else if (res.status === "error") {
                alert("캔버스 저장 실패: " + res.message);
            }
        }
        
        // --- History (Undo/Redo) ---
        pushHistory() {
            const state = JSON.stringify({
                nodes: this.nodes.map(n => ({...n})),
                edges: this.edges.map(e => ({...e}))
            });
            this.undoStack.push(state);
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            this.redoStack = []; // 새로운 변경 작업 발생 시 redo 스택 초기화
        }
        
        undo() {
            if (this.undoStack.length === 0) return;
            const currentState = JSON.stringify({
                nodes: this.nodes.map(n => ({...n})),
                edges: this.edges.map(e => ({...e}))
            });
            this.redoStack.push(currentState);
            
            const prevState = JSON.parse(this.undoStack.pop());
            this.nodes = prevState.nodes || [];
            this.edges = prevState.edges || [];
            
            this.deselectAll();
            this.closeActiveCM6();
            this.renderCanvas();
            this.saveCanvasDebounced();
            this.showToast("실행 취소됨");
        }
        
        redo() {
            if (this.redoStack.length === 0) return;
            const currentState = JSON.stringify({
                nodes: this.nodes.map(n => ({...n})),
                edges: this.edges.map(e => ({...e}))
            });
            this.undoStack.push(currentState);
            
            const nextState = JSON.parse(this.redoStack.pop());
            this.nodes = nextState.nodes || [];
            this.edges = nextState.edges || [];
            
            this.deselectAll();
            this.closeActiveCM6();
            this.renderCanvas();
            this.saveCanvasDebounced();
            this.showToast("다시 실행됨");
        }
        
        showToast(msg) {
            if (typeof window.showToast === "function") {
                window.showToast(msg);
            } else {
                console.log("Toast: " + msg);
            }
        }
        
        renderCanvas() {
            // HTML 노드 레이어 리셋
            const nodesContainer = document.getElementById("canvas-nodes-layer");
            nodesContainer.innerHTML = "";
            
            // 노드 렌더링
            this.nodes.forEach(node => {
                this.renderNode(node);
            });
            
            // 연결 에지 렌더링
            this.drawEdges();
        }
        
        renderNode(node) {
            const nodesContainer = document.getElementById("canvas-nodes-layer");
            
            const nodeEl = document.createElement("div");
            nodeEl.className = "canvas-node";
            nodeEl.id = `node-${node.id}`;
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            nodeEl.style.width = `${node.width}px`;
            nodeEl.style.height = `${node.height}px`;
            
            // 노드 색상 테마 주입 (Obsidian 컬러 번호 1~6 매핑)
            if (node.color) {
                nodeEl.setAttribute("data-color", node.color);
            }
            
            if (this.selectedNodeIds.has(node.id)) {
                nodeEl.classList.add("selected");
            }
            
            // 1. 헤더 (이름 & 드래그 바)
            const header = document.createElement("div");
            header.className = "canvas-node-header";
            
            const title = document.createElement("div");
            title.className = "canvas-node-title";
            if (node.type === "text") {
                title.innerHTML = '<i data-lucide="sticky-note" style="width: 14px; height: 14px; margin-right: 4px;"></i> Text Card';
            } else if (node.type === "file") {
                const baseName = node.file.split(/[\\/]/).pop();
                title.innerHTML = `<i data-lucide="file-text" style="width: 14px; height: 14px; margin-right: 4px;"></i> ${baseName}`;
                title.title = node.file;
            } else if (node.type === "group") {
                title.innerHTML = '<i data-lucide="layers" style="width: 14px; height: 14px; margin-right: 4px;"></i> Group';
                nodeEl.style.backgroundColor = "var(--bg-tertiary)";
                nodeEl.style.border = "2px dashed var(--border)";
                nodeEl.style.zIndex = "0";
            } else {
                title.innerHTML = '<i data-lucide="box" style="width: 14px; height: 14px; margin-right: 4px;"></i> Node';
            }
            
            header.appendChild(title);
            nodeEl.appendChild(header);
            
            // 2. 콘텐츠 본문 영역
            const contentEl = document.createElement("div");
            contentEl.className = "canvas-node-content";
            contentEl.id = `content-${node.id}`;
            nodeEl.appendChild(contentEl);
            
            // 3. 네 면의 엣지 연결 포트 (Ports)
            const sides = ["top", "right", "bottom", "left"];
            sides.forEach(side => {
                const port = document.createElement("div");
                port.className = `canvas-node-port port-${side}`;
                
                // 포트 드래그 연결선 바인딩
                this.bindPortDrag(port, node.id, side);
                nodeEl.appendChild(port);
            });
            
            // 4. 리사이즈 핸들
            const resizer = document.createElement("div");
            resizer.className = "canvas-node-resizer";
            this.bindResizerDrag(resizer, node);
            nodeEl.appendChild(resizer);
            
            nodesContainer.appendChild(nodeEl);
            
            // 콘텐츠 로드
            this.loadNodeContent(node, contentEl);
            
            // 노드 드래그 바인딩 (D3)
            this.bindNodeDrag(nodeEl, node);
            
            // 클릭 선택 바인딩 (이벤트 버블링으로 인한 deselectAll 오작동 방지)
            d3.select(nodeEl).on("mousedown", (event) => {
                event.stopPropagation();
                if (event.shiftKey || event.ctrlKey || event.metaKey) {
                    if (this.selectedNodeIds.has(node.id)) {
                        this.selectedNodeIds.delete(node.id);
                        d3.select(nodeEl).classed("selected", false);
                    } else {
                        this.selectedNodeIds.add(node.id);
                        d3.select(nodeEl).classed("selected", true);
                    }
                } else {
                    if (!this.selectedNodeIds.has(node.id)) {
                        this.deselectAll();
                        this.selectedNodeIds.add(node.id);
                        d3.select(nodeEl).classed("selected", true);
                    }
                }
                
                // 플로팅 메뉴 노출 (단일 선택일 때만)
                if (this.selectedNodeIds.size === 1) {
                    this.showFloatingToolbarForNode(node);
                } else {
                    this.removeFloatingToolbar();
                }
            });
            d3.select(nodeEl).on("click", (event) => {
                event.stopPropagation();
            });
            
            // 더블클릭 이벤트 처리
            d3.select(nodeEl).on("dblclick", (event) => {
                event.stopPropagation();
                if (node.type === "text") {
                    this.editMarkdownNode(node, contentEl);
                } else if (node.type === "file") {
                    // 마크다운 파일일 경우 캔버스를 임시로 접고 그 문서를 열어줌
                    if (node.file.toLowerCase().endsWith(".md") || node.file.toLowerCase().endsWith(".qmd")) {
                        if (typeof window.openFile === "function") {
                            this.closeCanvasView();
                            window.openFile(node.file);
                        }
                    }
                }
            });
            
            lucide.createIcons({ attrs: { style: "width: 14px; height: 14px;" } });
        }
        
        async loadNodeContent(node, container) {
            if (node.type === "text") {
                container.innerHTML = `<div class="markdown-body" style="padding: 10px; font-size: 0.9em; user-select: text;">${marked.parse(node.text || "")}</div>`;
            } else if (node.type === "file") {
                if (node.missing) {
                    container.innerHTML = `
                        <div class="empty-state" style="padding: 20px; text-align: center; color: #ef4444;">
                            <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 8px;"></i>
                            <div style="font-size: 0.85em; font-weight: 500;">유실된 파일</div>
                            <div style="font-size: 0.75em; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;" title="${node.file}">${node.file}</div>
                        </div>
                    `;
                    lucide.createIcons();
                    return;
                }
                
                // 폴더/디렉토리 구조 임베딩 여부 체크
                try {
                    const resFiles = await pywebview.api.list_files();
                    const folderItem = this.findFolderInTree(resFiles, node.file);
                    if (folderItem) {
                        this.renderFolderNodeContent(node, folderItem, container);
                        return;
                    }
                } catch (err) {
                    console.error("폴더 트리 검색 실패: ", err);
                }
                
                const ext = node.file.split('.').pop().toLowerCase();
                
                // 마크다운 계열 임베드
                if (["md", "qmd", "markdown", "txt"].includes(ext)) {
                    container.innerHTML = `<div style="padding: 10px; font-size: 0.8em; opacity: 0.6;">문서 로딩 중...</div>`;
                    try {
                        let content = this.fileCache[node.file];
                        if (!content) {
                            const res = await pywebview.api.read_file(node.file);
                            if (res.status === "success") {
                                content = res.content;
                                this.fileCache[node.file] = content;
                            }
                        }
                        
                        if (content !== undefined) {
                            // 프런트매터 영역 제거 후 렌더링
                            let cleanText = content;
                            if (content.startsWith('---')) {
                                const fmMatch = content.match(/^---[\s\S]*?\r?\n---(\r?\n)?/);
                                if (fmMatch) {
                                    cleanText = content.substring(fmMatch[0].length);
                                }
                            }
                            container.innerHTML = `<div class="markdown-body" style="padding: 12px; font-size: 0.85em; height: 100%; overflow: auto; user-select: text;">${marked.parse(cleanText)}</div>`;
                        } else {
                            throw new Error("읽기 실패");
                        }
                    } catch (err) {
                        container.innerHTML = `
                            <div class="empty-state" style="padding: 20px; text-align: center; color: #f43f5e;">
                                <i data-lucide="file-x" style="width: 32px; height: 32px; margin-bottom: 8px;"></i>
                                <div style="font-size: 0.85em;">문서 로드 실패</div>
                            </div>
                        `;
                    }
                } 
                // 이미지 임베드
                else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
                    container.innerHTML = `<img src="/workspace/${encodeURIComponent(node.file)}" style="width: 100%; height: 100%; object-fit: contain; background: rgba(0,0,0,0.1); pointer-events: none;" />`;
                }
                // PDF 임베드
                else if (ext === "pdf") {
                    container.innerHTML = `<iframe src="/workspace/${encodeURIComponent(node.file)}#toolbar=0" style="width: 100%; height: 100%; border: none;" />`;
                }
                // 기타 파일 포인터
                else {
                    container.innerHTML = `
                        <div class="empty-state" style="padding: 20px; text-align: center;">
                            <i data-lucide="file" style="width: 32px; height: 32px; margin-bottom: 8px; color: var(--accent);"></i>
                            <div style="font-size: 0.85em;">${node.file.split(/[\\/]/).pop()}</div>
                            <div style="font-size: 0.7em; opacity: 0.5;">지원이 되지 않는 포맷입니다.</div>
                        </div>
                    `;
                }
                lucide.createIcons();
            }
        }
        
        findFolderInTree(items, path) {
            if (!items) return null;
            const normTarget = path.replace(/\\/g, '/').toLowerCase();
            for (const item of items) {
                const normPath = item.path.replace(/\\/g, '/').toLowerCase();
                if (item.type === "folder" && normPath === normTarget) {
                    return item;
                }
                if (item.children) {
                    const found = this.findFolderInTree(item.children, path);
                    if (found) return found;
                }
            }
            return null;
        }
        
        renderFolderNodeContent(node, folderItem, container) {
            // 노드 상태 속성 초기화
            if (node.isGridView === undefined) node.isGridView = false;
            if (node.sortOrder === undefined) node.sortOrder = "asc";
            if (node.filterType === undefined) node.filterType = "all";
            if (node.searchQuery === undefined) node.searchQuery = "";
            if (node.showSearchInput === undefined) node.showSearchInput = false;

            container.innerHTML = "";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.height = "100%";
            container.style.background = "rgba(10, 12, 18, 0.5)";
            
            // 폴더 내부 상단 툴바 데코레이션
            const folderToolbar = document.createElement("div");
            folderToolbar.className = "canvas-folder-toolbar";
            folderToolbar.style.display = "flex";
            folderToolbar.style.alignItems = "center";
            folderToolbar.style.justifyContent = "space-between";
            folderToolbar.style.padding = "6px 10px";
            folderToolbar.style.background = "rgba(255, 255, 255, 0.04)";
            folderToolbar.style.borderBottom = "1px solid rgba(255, 255, 255, 0.08)";
            folderToolbar.style.fontSize = "0.75em";
            folderToolbar.style.color = "var(--text-muted)";
            
            const titleInfo = document.createElement("div");
            titleInfo.style.fontWeight = "bold";
            titleInfo.style.overflow = "hidden";
            titleInfo.style.textOverflow = "ellipsis";
            titleInfo.style.whiteSpace = "nowrap";
            titleInfo.style.maxWidth = "45%";
            titleInfo.innerText = folderItem.name;
            titleInfo.title = folderItem.path;
            
            const decoIcons = document.createElement("div");
            decoIcons.style.display = "flex";
            decoIcons.style.alignItems = "center";
            decoIcons.style.gap = "8px";
            
            // Grid/List toggle icon
            const gridIcon = document.createElement("i");
            gridIcon.setAttribute("data-lucide", node.isGridView ? "list" : "layout-grid");
            gridIcon.style.cursor = "pointer";
            gridIcon.title = node.isGridView ? "리스트 뷰로 전환" : "그리드 뷰로 전환";
            gridIcon.onclick = (e) => {
                e.stopPropagation();
                node.isGridView = !node.isGridView;
                this.saveCanvasDebounced();
                this.renderFolderNodeContent(node, folderItem, container);
            };
            
            // Sort toggle icon
            const sortIcon = document.createElement("i");
            sortIcon.setAttribute("data-lucide", "arrow-up-down");
            sortIcon.style.cursor = "pointer";
            sortIcon.title = `이름 정렬: 현재 ${node.sortOrder === "asc" ? "오름차순" : "내림차순"}`;
            sortIcon.onclick = (e) => {
                e.stopPropagation();
                node.sortOrder = node.sortOrder === "asc" ? "desc" : "asc";
                this.saveCanvasDebounced();
                sortIcon.title = `이름 정렬: 현재 ${node.sortOrder === "asc" ? "오름차순" : "내림차순"}`;
                updateList();
            };
            
            // Filter icon
            const filterIcon = document.createElement("i");
            filterIcon.setAttribute("data-lucide", "filter");
            filterIcon.style.cursor = "pointer";
            filterIcon.style.color = node.filterType === "md" ? "var(--accent)" : "";
            filterIcon.title = node.filterType === "md" ? "모든 파일 보기" : "마크다운 문서만 필터링";
            filterIcon.onclick = (e) => {
                e.stopPropagation();
                node.filterType = node.filterType === "all" ? "md" : "all";
                this.saveCanvasDebounced();
                filterIcon.style.color = node.filterType === "md" ? "var(--accent)" : "";
                filterIcon.title = node.filterType === "md" ? "모든 파일 보기" : "마크다운 문서만 필터링";
                updateList();
            };
            
            // Search icon
            const searchIcon = document.createElement("i");
            searchIcon.setAttribute("data-lucide", "search");
            searchIcon.style.cursor = "pointer";
            searchIcon.style.color = node.showSearchInput ? "var(--accent)" : "";
            searchIcon.title = "카드 내 파일 검색";
            searchIcon.onclick = (e) => {
                e.stopPropagation();
                node.showSearchInput = !node.showSearchInput;
                this.saveCanvasDebounced();
                searchIcon.style.color = node.showSearchInput ? "var(--accent)" : "";
                if (node.showSearchInput) {
                    searchInput.style.display = "block";
                    searchInput.focus();
                } else {
                    searchInput.style.display = "none";
                    node.searchQuery = "";
                    searchInput.value = "";
                    updateList();
                }
            };
            
            // Plus icon (Create File)
            const plusIcon = document.createElement("i");
            plusIcon.setAttribute("data-lucide", "plus");
            plusIcon.style.cursor = "pointer";
            plusIcon.title = "이 폴더 내에 새 문서 만들기";
            plusIcon.onclick = async (e) => {
                e.stopPropagation();
                const fileName = prompt("생성할 새 마크다운 파일 이름 (예: 새문서.md):");
                if (fileName) {
                    let cleanName = fileName.trim();
                    if (!cleanName) return;
                    if (!cleanName.endsWith(".md") && !cleanName.endsWith(".qmd") && !cleanName.endsWith(".txt")) {
                        cleanName += ".md";
                    }
                    const fullPath = node.file ? `${node.file}/${cleanName}` : cleanName;
                    const res = await pywebview.api.save_file(fullPath, `# ${cleanName.replace(/\.[^/.]+$/, "")}\n\n`);
                    if (res.status === "success") {
                        this.showToast(`새 파일 생성됨: ${cleanName}`);
                        if (typeof window.refreshWorkspace === "function") {
                            await window.refreshWorkspace();
                        }
                        const resFiles = await pywebview.api.list_files();
                        const newFolderItem = this.findFolderInTree(resFiles, node.file);
                        if (newFolderItem) {
                            this.renderFolderNodeContent(node, newFolderItem, container);
                        }
                    } else {
                        alert("파일 생성 실패: " + res.message);
                    }
                }
            };
            
            decoIcons.appendChild(gridIcon);
            decoIcons.appendChild(sortIcon);
            decoIcons.appendChild(filterIcon);
            decoIcons.appendChild(searchIcon);
            decoIcons.appendChild(plusIcon);
            
            folderToolbar.appendChild(titleInfo);
            folderToolbar.appendChild(decoIcons);
            container.appendChild(folderToolbar);
            
            // 검색 인풋창
            const searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.className = "canvas-folder-search-input";
            searchInput.value = node.searchQuery;
            searchInput.placeholder = "파일 이름 필터링...";
            searchInput.style.width = "calc(100% - 16px)";
            searchInput.style.margin = "4px 8px";
            searchInput.style.padding = "4px 8px";
            searchInput.style.background = "rgba(255,255,255,0.05)";
            searchInput.style.border = "1px solid rgba(255,255,255,0.1)";
            searchInput.style.borderRadius = "4px";
            searchInput.style.fontSize = "0.75em";
            searchInput.style.color = "#fff";
            searchInput.style.outline = "none";
            searchInput.style.display = node.showSearchInput ? "block" : "none";
            
            searchInput.oninput = (e) => {
                node.searchQuery = e.target.value;
                updateList();
            };
            searchInput.onmousedown = (e) => e.stopPropagation();
            searchInput.onclick = (e) => e.stopPropagation();
            
            container.appendChild(searchInput);
            
            // 파일 리스트 바디
            const listDiv = document.createElement("div");
            listDiv.className = "canvas-folder-list";
            listDiv.style.flex = "1";
            listDiv.style.overflowY = "auto";
            listDiv.style.padding = "6px";
            
            if (node.isGridView) {
                listDiv.style.display = "grid";
                listDiv.style.gridTemplateColumns = "repeat(auto-fill, minmax(80px, 1fr))";
                listDiv.style.gap = "8px";
                listDiv.style.alignContent = "start";
            } else {
                listDiv.style.display = "flex";
                listDiv.style.flexDirection = "column";
                listDiv.style.gap = "2px";
            }
            
            container.appendChild(listDiv);
            
            const updateList = () => {
                listDiv.innerHTML = "";
                
                // 1. 부모 디렉토리로 이동하는 '..' 추가
                const lastSlash = Math.max(node.file.lastIndexOf('/'), node.file.lastIndexOf('\\'));
                if (lastSlash !== -1) {
                    const parentPath = node.file.substring(0, lastSlash);
                    
                    const row = document.createElement("div");
                    this.styleFolderRow(row, node.isGridView);
                    
                    row.innerHTML = `<i data-lucide="corner-left-up" style="width: 14px; height: 14px;"></i> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">..</span>`;
                    row.title = "상위 폴더로 이동";
                    
                    row.onclick = async (e) => {
                        e.stopPropagation();
                        this.pushHistory();
                        node.file = parentPath;
                        this.saveCanvasDebounced();
                        
                        const resFiles = await pywebview.api.list_files();
                        const parentFolderItem = this.findFolderInTree(resFiles, parentPath);
                        if (parentFolderItem) {
                            this.renderFolderNodeContent(node, parentFolderItem, container);
                        } else {
                            this.loadNodeContent(node, container);
                        }
                    };
                    listDiv.appendChild(row);
                }
                
                let children = folderItem.children || [];
                
                // 필터링 (마크다운)
                if (node.filterType === "md") {
                    children = children.filter(child => {
                        if (child.type === "folder") return true;
                        const ext = child.name.split('.').pop().toLowerCase();
                        return ["md", "qmd", "markdown", "txt"].includes(ext);
                    });
                }
                
                // 검색어 필터링
                if (node.searchQuery) {
                    const query = node.searchQuery.toLowerCase();
                    children = children.filter(child => child.name.toLowerCase().includes(query));
                }
                
                // 정렬 (폴더 우선, 그 후 알파벳 순)
                children.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === "folder" ? -1 : 1;
                    }
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    if (node.sortOrder === "desc") {
                        return nameB.localeCompare(nameA);
                    } else {
                        return nameA.localeCompare(nameB);
                    }
                });
                
                if (children.length === 0) {
                    const empty = document.createElement("div");
                    empty.style.color = "var(--text-muted)";
                    empty.style.fontSize = "0.78em";
                    empty.style.textAlign = "center";
                    empty.style.padding = "20px";
                    empty.style.gridColumn = "1 / -1";
                    empty.innerText = node.searchQuery ? "검색 결과가 없습니다." : "빈 폴더";
                    listDiv.appendChild(empty);
                } else {
                    children.forEach(child => {
                        const row = document.createElement("div");
                        this.styleFolderRow(row, node.isGridView);
                        
                        const iconName = child.type === "folder" ? "folder" : "file-text";
                        
                        if (node.isGridView) {
                            row.style.flexDirection = "column";
                            row.style.justifyContent = "center";
                            row.style.textAlign = "center";
                            row.style.height = "74px";
                            row.style.padding = "8px 4px";
                            row.innerHTML = `<i data-lucide="${iconName}" style="width: 22px; height: 22px; margin-bottom: 4px;"></i> <span style="font-size: 0.72em; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${child.name}</span>`;
                        } else {
                            row.innerHTML = `<i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${child.name}</span>`;
                        }
                        row.title = child.path;
                        
                        row.onclick = async (e) => {
                            e.stopPropagation();
                            if (child.type === "file") {
                                const ext = child.name.split('.').pop().toLowerCase();
                                if (["md", "qmd", "markdown", "txt", "canvas"].includes(ext)) {
                                    this.closeCanvasView();
                                    if (typeof window.openFile === "function") {
                                        window.openFile(child.path);
                                    }
                                } else if (["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf"].includes(ext)) {
                                    this.pushHistory();
                                    const newX = node.x + node.width + 50;
                                    const newY = node.y;
                                    this.addFileNodeAt(child.path, newX, newY);
                                    this.showToast("캔버스에 카드 노드가 추가되었습니다.");
                                } else {
                                    this.showToast("에디터에서 열 수 없는 파일 포맷입니다.");
                                }
                            } else {
                                this.pushHistory();
                                node.file = child.path;
                                this.saveCanvasDebounced();
                                
                                const resFiles = await pywebview.api.list_files();
                                const subFolderItem = this.findFolderInTree(resFiles, child.path);
                                if (subFolderItem) {
                                    this.renderFolderNodeContent(node, subFolderItem, container);
                                } else {
                                    this.loadNodeContent(node, container);
                                }
                            }
                        };
                        listDiv.appendChild(row);
                    });
                }
                
                lucide.createIcons({ attrs: { style: node.isGridView ? "width: 22px; height: 22px;" : "width: 12px; height: 12px;" } });
            };
            
            updateList();
            lucide.createIcons({ attrs: { style: "width: 12px; height: 12px;" } });
        }
        
        styleFolderRow(row, isGridView) {
            row.className = "canvas-folder-row";
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.cursor = "pointer";
            row.style.transition = "background 0.2s, transform 0.1s";
            row.style.borderRadius = "6px";
            
            if (isGridView) {
                row.style.background = "rgba(255, 255, 255, 0.02)";
                row.style.border = "1px solid rgba(255, 255, 255, 0.05)";
                row.style.color = "var(--text-main)";
            } else {
                row.style.gap = "6px";
                row.style.padding = "6px 8px";
                row.style.fontSize = "0.85em";
                row.style.color = "var(--accent)";
                row.style.textDecoration = "underline";
            }
            
            row.onmouseover = () => {
                row.style.background = "rgba(69, 243, 255, 0.08)";
                if (isGridView) {
                    row.style.borderColor = "rgba(69, 243, 255, 0.3)";
                    row.style.transform = "translateY(-2px)";
                }
            };
            row.onmouseout = () => {
                row.style.background = isGridView ? "rgba(255, 255, 255, 0.02)" : "none";
                if (isGridView) {
                    row.style.borderColor = "rgba(255, 255, 255, 0.05)";
                    row.style.transform = "none";
                }
            };
        }
        
        editMarkdownNode(node, container) {
            if (this.activeCM6 && this.activeCM6.nodeId === node.id) return;
            this.closeActiveCM6();
            
            container.innerHTML = "";
            const editorDiv = document.createElement("div");
            editorDiv.className = "canvas-cm-container";
            editorDiv.style.width = "100%";
            editorDiv.style.height = "100%";
            container.appendChild(editorDiv);
            
            if (!window.cm6) {
                editorDiv.innerHTML = `<div style="padding: 10px; color: var(--text-muted);">에디터 로드 대기 중...</div>`;
                return;
            }
            
            const cm = window.cm6;
            const state = cm.EditorState.create({
                doc: node.text || "",
                extensions: [
                    cm.basicSetup,
                    cm.markdown(),
                    cm.keymap.of([
                        {
                            key: "Mod-b",
                            run: (view) => {
                                const { from, to } = view.state.selection.main;
                                const text = view.state.doc.sliceString(from, to);
                                view.dispatch({
                                    changes: { from, to, insert: `**${text}**` },
                                    selection: { anchor: from + 2, head: to + 2 }
                                });
                                return true;
                            }
                        },
                        {
                            key: "Mod-i",
                            run: (view) => {
                                const { from, to } = view.state.selection.main;
                                const text = view.state.doc.sliceString(from, to);
                                view.dispatch({
                                    changes: { from, to, insert: `*${text}*` },
                                    selection: { anchor: from + 1, head: to + 1 }
                                });
                                return true;
                            }
                        },
                        {
                            key: "Mod-k",
                            run: (view) => {
                                const { from, to } = view.state.selection.main;
                                const text = view.state.doc.sliceString(from, to);
                                view.dispatch({
                                    changes: { from, to, insert: `[${text}](url)` },
                                    selection: { anchor: from + text.length + 3, head: from + text.length + 6 }
                                });
                                return true;
                            }
                        }
                    ]),
                    cm.EditorView.theme({
                        "&": { height: "100%", fontSize: "13px" },
                        ".cm-scroller": { overflow: "auto" }
                    })
                ]
            });
            
            const view = new cm.EditorView({
                state,
                parent: editorDiv
            });
            
            this.activeCM6 = {
                nodeId: node.id,
                view: view
            };
            
            view.focus();
            
            // 노드 선택 방지용 캡쳐 차단
            d3.select(editorDiv).on("mousedown", (e) => e.stopPropagation());
            d3.select(editorDiv).on("dblclick", (e) => e.stopPropagation());
        }
        
        closeActiveCM6() {
            if (!this.activeCM6) return;
            const { nodeId, view } = this.activeCM6;
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                const textVal = view.state.doc.toString();
                if (node.text !== textVal) {
                    this.pushHistory();
                    node.text = textVal;
                    this.saveCanvasDebounced();
                }
                const contentEl = document.getElementById(`content-${nodeId}`);
                if (contentEl) {
                    this.loadNodeContent(node, contentEl);
                }
            }
            view.destroy();
            this.activeCM6 = null;
        }
        
        // --- 드래그 & 정렬 보조 안내선 구현 ---
        bindNodeDrag(nodeEl, node) {
            let startPositions = new Map();
            let startMouseWorldX = 0;
            let startMouseWorldY = 0;
            let isAltClone = false;
            let clonedNodesMap = new Map(); // 원본id -> 복제본 객체
            
            const dragHandler = d3.drag()
                .on("start", (event) => {
                    event.sourceEvent.stopPropagation();
                    d3.select(nodeEl).raise().style("cursor", "move");
                    
                    this.pushHistory(); // 히스토리 백업
                    
                    const boardEl = document.getElementById("canvas-board");
                    const rect = boardEl.getBoundingClientRect();
                    const clientX = event.sourceEvent.clientX;
                    const clientY = event.sourceEvent.clientY;
                    
                    startMouseWorldX = (clientX - rect.left - this.transform.x) / this.transform.k;
                    startMouseWorldY = (clientY - rect.top - this.transform.y) / this.transform.k;
                    
                    this.removeFloatingToolbar(); // 드래그 시작 시 플로팅 툴바 가림
                    
                    // Alt+Drag -> Clone
                    if (event.sourceEvent.altKey) {
                        isAltClone = true;
                        const newSelectedIds = new Set();
                        
                        this.selectedNodeIds.forEach(id => {
                            const origNode = this.nodes.find(n => n.id === id);
                            if (origNode) {
                                const cloneId = `${origNode.type}_${Math.random().toString(36).substring(2, 12)}`;
                                const cloneNode = JSON.parse(JSON.stringify(origNode));
                                cloneNode.id = cloneId;
                                this.nodes.push(cloneNode);
                                clonedNodesMap.set(origNode.id, cloneNode);
                                newSelectedIds.add(cloneId);
                                startPositions.set(cloneId, { x: cloneNode.x, y: cloneNode.y });
                            }
                        });
                        
                        // 엣지 복제 (선택된 노드들끼리 연결된 엣지만 복제)
                        const newEdges = [];
                        this.edges.forEach(e => {
                            if (this.selectedNodeIds.has(e.fromNode) && this.selectedNodeIds.has(e.toNode)) {
                                const cloneEdge = JSON.parse(JSON.stringify(e));
                                cloneEdge.id = `edge_${Math.random().toString(36).substring(2, 12)}`;
                                cloneEdge.fromNode = clonedNodesMap.get(e.fromNode).id;
                                cloneEdge.toNode = clonedNodesMap.get(e.toNode).id;
                                newEdges.push(cloneEdge);
                            }
                        });
                        this.edges.push(...newEdges);
                        
                        this.selectedNodeIds.clear();
                        newSelectedIds.forEach(id => this.selectedNodeIds.add(id));
                        
                        this.renderCanvas(); // DOM 생성
                    } else {
                        isAltClone = false;
                        this.selectedNodeIds.forEach(id => {
                            const n = this.nodes.find(no => no.id === id);
                            if (n) startPositions.set(id, { x: n.x, y: n.y });
                        });
                    }
                })
                .on("drag", (event) => {
                    const boardEl = document.getElementById("canvas-board");
                    const rect = boardEl.getBoundingClientRect();
                    const clientX = event.sourceEvent.clientX;
                    const clientY = event.sourceEvent.clientY;
                    
                    const currentMouseWorldX = (clientX - rect.left - this.transform.x) / this.transform.k;
                    const currentMouseWorldY = (clientY - rect.top - this.transform.y) / this.transform.k;
                    
                    const dx = currentMouseWorldX - startMouseWorldX;
                    const dy = currentMouseWorldY - startMouseWorldY;
                    
                    // 정렬 보조선 (단일 드래그일 때만 자석효과)
                    let alignX = null;
                    let alignY = null;
                    this.svgGroup.selectAll(".canvas-align-line").remove();
                    
                    let dxOffset = dx;
                    let dyOffset = dy;
                    
                    if (this.selectedNodeIds.size === 1) {
                        const dragNodeId = Array.from(this.selectedNodeIds)[0];
                        const dragNode = this.nodes.find(n => n.id === dragNodeId);
                        const startPos = startPositions.get(dragNodeId);
                        
                        let targetX = startPos.x + dx;
                        let targetY = startPos.y + dy;
                        
                        const snapDist = 6;
                        
                        for (const other of this.nodes) {
                            if (other.id === dragNode.id) continue;
                            const selfCenter = targetX + dragNode.width / 2;
                            const otherCenter = other.x + other.width / 2;
                            const selfMiddle = targetY + dragNode.height / 2;
                            const otherMiddle = other.y + other.height / 2;
                            
                            if (Math.abs(targetX - other.x) < snapDist) { targetX = other.x; alignX = other.x; }
                            else if (Math.abs(selfCenter - otherCenter) < snapDist) { targetX = otherCenter - dragNode.width/2; alignX = otherCenter; }
                            
                            if (Math.abs(targetY - other.y) < snapDist) { targetY = other.y; alignY = other.y; }
                            else if (Math.abs(selfMiddle - otherMiddle) < snapDist) { targetY = otherMiddle - dragNode.height/2; alignY = otherMiddle; }
                        }
                        
                        dxOffset = targetX - startPos.x;
                        dyOffset = targetY - startPos.y;
                        
                        const margin = 200;
                        if (alignX !== null) {
                            this.svgGroup.append("line").attr("class", "canvas-align-line")
                                .attr("x1", alignX).attr("y1", targetY - margin).attr("x2", alignX).attr("y2", targetY + dragNode.height + margin);
                        }
                        if (alignY !== null) {
                            this.svgGroup.append("line").attr("class", "canvas-align-line")
                                .attr("x1", targetX - margin).attr("y1", alignY).attr("x2", targetX + dragNode.width + margin).attr("y2", alignY);
                        }
                    }
                    
                    // 다중 선택된 모든 노드에 변위 적용
                    this.selectedNodeIds.forEach(id => {
                        const n = this.nodes.find(no => no.id === id);
                        const start = startPositions.get(id);
                        if (n && start) {
                            n.x = start.x + dxOffset;
                            n.y = start.y + dyOffset;
                            const el = document.getElementById(`node-${id}`);
                            if (el) {
                                el.style.left = `${n.x}px`;
                                el.style.top = `${n.y}px`;
                            }
                        }
                    });
                    
                    this.drawEdges();
                })
                .on("end", () => {
                    d3.select(nodeEl).style("cursor", "default");
                    this.svgGroup.selectAll(".canvas-align-line").remove();
                    
                    // 그리드 스냅 (마우스 놓을 때)
                    const snap = 4;
                    this.selectedNodeIds.forEach(id => {
                        const n = this.nodes.find(no => no.id === id);
                        if (n) {
                            n.x = Math.round(n.x / snap) * snap;
                            n.y = Math.round(n.y / snap) * snap;
                            const el = document.getElementById(`node-${id}`);
                            if (el) {
                                el.style.left = `${n.x}px`;
                                el.style.top = `${n.y}px`;
                            }
                        }
                    });
                    
                    this.drawEdges();
                    this.saveCanvasDebounced();
                    
                    if (this.selectedNodeIds.size === 1) {
                        const n = this.nodes.find(no => no.id === Array.from(this.selectedNodeIds)[0]);
                        if (n) this.showFloatingToolbarForNode(n);
                    }
                });
                
            // 헤더 영역을 잡고만 드래그 가능하도록 세팅 (텍스트 복사 및 스크롤 배제)
            d3.select(nodeEl).select(".canvas-node-header").call(dragHandler);
        }
        
        bindResizerDrag(resizerEl, node) {
            const dragHandler = d3.drag()
                .on("start", () => {
                    this.pushHistory();
                    this.removeFloatingToolbar();
                })
                .on("drag", (event) => {
                    // 격자 스냅 4px 및 최소 크기 제한
                    const snap = 4;
                    const newW = Math.max(150, Math.round(event.x / snap) * snap);
                    const newH = Math.max(100, Math.round(event.y / snap) * snap);
                    
                    node.width = newW;
                    node.height = newH;
                    
                    const nodeEl = document.getElementById(`node-${node.id}`);
                    if (nodeEl) {
                        nodeEl.style.width = `${newW}px`;
                        nodeEl.style.height = `${newH}px`;
                    }
                    
                    this.drawEdges();
                })
                .on("end", () => {
                    this.saveCanvasDebounced();
                    this.showFloatingToolbarForNode(node);
                });
                
            d3.select(resizerEl).call(dragHandler);
        }
        
        bindPortDrag(portEl, nodeId, side) {
            const dragHandler = d3.drag()
                .on("start", (event) => {
                    event.sourceEvent.stopPropagation();
                    this.isDrawingEdge = true;
                    this.edgeStartNodeId = nodeId;
                    this.edgeStartSide = side;
                    this.removeFloatingToolbar();
                })
                .on("drag", (event) => {
                    const boardEl = document.getElementById("canvas-board");
                    const rect = boardEl.getBoundingClientRect();
                    
                    // 마우스 좌표 구한 후 줌 역변환을 통해 캔버스 내 월드 좌표 도출
                    const mouseX = (event.sourceEvent.clientX - rect.left - this.transform.x) / this.transform.k;
                    const mouseY = (event.sourceEvent.clientY - rect.top - this.transform.y) / this.transform.k;
                    
                    // 임시 연결 엣지선 드로잉
                    const startNode = this.nodes.find(n => n.id === nodeId);
                    if (startNode) {
                        const startPt = this.getPortCoordinates(startNode, side);
                        this.drawTempEdge(startPt.x, startPt.y, mouseX, mouseY, side);
                    }
                })
                .on("end", (event) => {
                    this.isDrawingEdge = false;
                    this.removeTempEdge();
                    
                    const clientX = event.sourceEvent.clientX;
                    const clientY = event.sourceEvent.clientY;
                    
                    const targetEl = document.elementFromPoint(clientX, clientY);
                    if (!targetEl) return;
                    
                    // 직접 포트를 가리켰거나, 노드 카드를 가리켰는지 검사
                    const targetPort = targetEl.closest(".canvas-node-port");
                    const targetNodeEl = targetEl.closest(".canvas-node");
                    
                    if (targetNodeEl) {
                        const targetNodeId = targetNodeEl.id.replace("node-", "");
                        if (targetNodeId !== this.edgeStartNodeId) {
                            let targetSide = "left";
                            
                            if (targetPort) {
                                // 정확히 특정 포트 위에 마우스를 뗀 경우
                                if (targetPort.classList.contains("port-top")) targetSide = "top";
                                else if (targetPort.classList.contains("port-right")) targetSide = "right";
                                else if (targetPort.classList.contains("port-bottom")) targetSide = "bottom";
                            } else {
                                // 카드 노드 위에 마우스를 뗀 경우, 마우스 위치와 가장 가까운 포트 자동 판정
                                const targetNode = this.nodes.find(n => n.id === targetNodeId);
                                if (targetNode) {
                                    const boardEl = document.getElementById("canvas-board");
                                    const rect = boardEl.getBoundingClientRect();
                                    const worldDropX = (clientX - rect.left - this.transform.x) / this.transform.k;
                                    const worldDropY = (clientY - rect.top - this.transform.y) / this.transform.k;
                                    
                                    const ports = {
                                        top: this.getPortCoordinates(targetNode, "top"),
                                        bottom: this.getPortCoordinates(targetNode, "bottom"),
                                        left: this.getPortCoordinates(targetNode, "left"),
                                        right: this.getPortCoordinates(targetNode, "right")
                                    };
                                    
                                    let minDistance = Infinity;
                                    for (const [sideName, pt] of Object.entries(ports)) {
                                        const dist = Math.hypot(worldDropX - pt.x, worldDropY - pt.y);
                                        if (dist < minDistance) {
                                            minDistance = dist;
                                            targetSide = sideName;
                                        }
                                    }
                                }
                            }
                            
                            this.pushHistory(); // 연결선 히스토리
                            this.createEdge(this.edgeStartNodeId, this.edgeStartSide, targetNodeId, targetSide);
                        }
                    }
                });
                
            d3.select(portEl).call(dragHandler);
        }
        
        getPortCoordinates(node, side) {
            if (side === "left") {
                return { x: node.x, y: node.y + node.height / 2 };
            } else if (side === "right") {
                return { x: node.x + node.width, y: node.y + node.height / 2 };
            } else if (side === "top") {
                return { x: node.x + node.width / 2, y: node.y };
            } else if (side === "bottom") {
                return { x: node.x + node.width / 2, y: node.y + node.height };
            }
            return { x: node.x, y: node.y };
        }
        
        getBezierPath(x1, y1, side1, x2, y2, side2) {
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const offset = Math.min(180, Math.max(40, Math.max(dx, dy) * 0.45));
            
            let cx1 = x1, cy1 = y1;
            let cx2 = x2, cy2 = y2;
            
            if (side1 === "left") cx1 -= offset;
            else if (side1 === "right") cx1 += offset;
            else if (side1 === "top") cy1 -= offset;
            else if (side1 === "bottom") cy1 += offset;
            
            if (side2 === "left") cx2 -= offset;
            else if (side2 === "right") cx2 += offset;
            else if (side2 === "top") cy2 -= offset;
            else if (side2 === "bottom") cy2 += offset;
            
            return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
        }
        
        drawTempEdge(x1, y1, x2, y2, side) {
            let tempLine = this.svgGroup.select("#temp-edge-path");
            if (tempLine.empty()) {
                tempLine = this.svgGroup.append("path")
                    .attr("id", "temp-edge-path")
                    .attr("stroke", "var(--accent)")
                    .attr("stroke-width", 2.5)
                    .attr("stroke-dasharray", "5,5")
                    .attr("fill", "none")
                    .attr("style", "pointer-events: none;");
            }
            // 임시 베지어 커브
            const path = this.getBezierPath(x1, y1, side, x2, y2, this.getOppositeSide(side));
            tempLine.attr("d", path);
        }
        
        removeTempEdge() {
            this.svgGroup.select("#temp-edge-path").remove();
        }
        
        getOppositeSide(side) {
            if (side === "left") return "right";
            if (side === "right") return "left";
            if (side === "top") return "bottom";
            return "top";
        }
        
        createEdge(fromNodeId, fromSide, toNodeId, toSide) {
            // 중복 연결선 체크
            const duplicate = this.edges.find(e => 
                e.fromNode === fromNodeId && e.fromSide === fromSide &&
                e.toNode === toNodeId && e.toSide === toSide
            );
            if (duplicate) return;
            
            const newEdge = {
                id: `edge_${Math.random().toString(36).substring(2, 12)}`,
                fromNode: fromNodeId,
                fromSide: fromSide,
                toNode: toNodeId,
                toSide: toSide
            };
            
            this.edges.push(newEdge);
            this.drawEdges();
            this.saveCanvasDebounced();
        }
        
        drawEdges() {
            // 임시 패스 제외하고 모두 초기화
            this.svgGroup.selectAll(".canvas-edge").remove();
            
            this.edges.forEach(edge => {
                const sourceNode = this.nodes.find(n => n.id === edge.fromNode);
                const targetNode = this.nodes.find(n => n.id === edge.toNode);
                
                if (sourceNode && targetNode) {
                    const startPt = this.getPortCoordinates(sourceNode, edge.fromSide);
                    const endPt = this.getPortCoordinates(targetNode, edge.toSide);
                    
                    const pathString = this.getBezierPath(
                        startPt.x, startPt.y, edge.fromSide,
                        endPt.x, endPt.y, edge.toSide
                    );
                    
                    const isSelected = this.selectedEdgeIds.has(edge.id);
                    
                    // 연결선 색상 연산
                    let colorVal = "var(--accent)";
                    if (isSelected) {
                        colorVal = "#f43f5e";
                    } else if (edge.color) {
                        const colorMap = {
                            "1": "#ff5252",
                            "2": "#ff9800",
                            "3": "#ffeb3b",
                            "4": "#4caf50",
                            "5": "#2196f3",
                            "6": "#9c27b0"
                        };
                        colorVal = colorMap[edge.color] || "var(--accent)";
                    }
                    
                    const edgeGroup = this.svgGroup.append("g")
                        .attr("class", `canvas-edge ${isSelected ? 'selected' : ''}`)
                        .attr("id", `edge-${edge.id}`);
                    
                    // 두꺼운 보이지 않는 마우스 오버용 패스 (드래그/클릭 판정 확대)
                    edgeGroup.append("path")
                        .attr("d", pathString)
                        .attr("stroke", "rgba(255, 255, 255, 0.001)")
                        .attr("stroke-width", 28)
                        .attr("fill", "none")
                        .attr("style", "cursor: pointer; pointer-events: stroke;")
                        .on("mousedown", (event) => {
                            event.stopPropagation();
                            if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
                                this.deselectAll();
                            }
                            this.selectedEdgeIds.add(edge.id);
                            this.drawEdges(); // 선택 시 색상 즉시 업데이트
                            
                            // 엣지 플로팅 툴바 제공 (단일 선택 시)
                            if (this.selectedEdgeIds.size === 1 && this.selectedNodeIds.size === 0) {
                                const midX = (startPt.x + endPt.x) / 2;
                                const midY = (startPt.y + endPt.y) / 2;
                                this.showFloatingToolbarForEdge(edge, midX, midY);
                            } else {
                                this.removeFloatingToolbar();
                            }
                        })
                        .on("click", (event) => {
                            event.stopPropagation();
                        });
                        
                    // 실선 경로 (currentColor를 활용해 끝 화살표 마커 색상 동시 반영)
                    edgeGroup.append("path")
                        .attr("class", "real-path")
                        .attr("d", pathString)
                        .attr("stroke", colorVal)
                        .attr("stroke-width", isSelected ? 3.0 : 1.8)
                        .attr("fill", "none")
                        .attr("marker-end", "url(#canvas-arrowhead)")
                        .attr("style", `color: ${colorVal}; pointer-events: none;`);
                }
            });
        }
        
        deleteNode(nodeId) {
            this.nodes = this.nodes.filter(n => n.id !== nodeId);
            this.edges = this.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId);
            
            this.selectedNodeIds.delete(nodeId);
            if (this.activeCM6 && this.activeCM6.nodeId === nodeId) {
                this.activeCM6.view.destroy();
                this.activeCM6 = null;
            }
            
            this.renderCanvas();
            this.saveCanvasDebounced();
        }
        
        deleteEdge(edgeId) {
            this.edges = this.edges.filter(e => e.id !== edgeId);
            this.selectedEdgeIds.delete(edgeId);
            this.drawEdges();
            this.saveCanvasDebounced();
        }
        
        duplicateSelected() {
            this.pushHistory();
            const newSelectedIds = new Set();
            const clonedNodesMap = new Map();
            
            this.selectedNodeIds.forEach(id => {
                const origNode = this.nodes.find(n => n.id === id);
                if (origNode) {
                    const cloneId = `${origNode.type}_${Math.random().toString(36).substring(2, 12)}`;
                    const cloneNode = JSON.parse(JSON.stringify(origNode));
                    cloneNode.id = cloneId;
                    cloneNode.x += 20; // 오프셋 적용
                    cloneNode.y += 20;
                    this.nodes.push(cloneNode);
                    clonedNodesMap.set(origNode.id, cloneNode);
                    newSelectedIds.add(cloneId);
                }
            });
            
            const newEdges = [];
            this.edges.forEach(e => {
                if (this.selectedNodeIds.has(e.fromNode) && this.selectedNodeIds.has(e.toNode)) {
                    const cloneEdge = JSON.parse(JSON.stringify(e));
                    cloneEdge.id = `edge_${Math.random().toString(36).substring(2, 12)}`;
                    cloneEdge.fromNode = clonedNodesMap.get(e.fromNode).id;
                    cloneEdge.toNode = clonedNodesMap.get(e.toNode).id;
                    newEdges.push(cloneEdge);
                }
            });
            this.edges.push(...newEdges);
            
            this.selectedNodeIds.clear();
            newSelectedIds.forEach(id => this.selectedNodeIds.add(id));
            
            this.renderCanvas();
            this.saveCanvasDebounced();
        }
        
        groupSelected() {
            this.pushHistory();
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const groupChildren = [];
            
            this.selectedNodeIds.forEach(id => {
                const n = this.nodes.find(node => node.id === id);
                if (n) {
                    groupChildren.push(n.id);
                    minX = Math.min(minX, n.x);
                    minY = Math.min(minY, n.y);
                    maxX = Math.max(maxX, n.x + n.width);
                    maxY = Math.max(maxY, n.y + n.height);
                }
            });
            
            const padding = 20;
            const groupNode = {
                id: `group_${Math.random().toString(36).substring(2, 12)}`,
                type: "group",
                x: minX - padding,
                y: minY - padding - 30, // 헤더 공간 고려
                width: (maxX - minX) + padding * 2,
                height: (maxY - minY) + padding * 2 + 30,
                text: "",
                children: groupChildren // 내부적으로 자식 참조 저장
            };
            
            this.nodes.unshift(groupNode); // 먼저 렌더링되게 하여 뒤로 보냄
            this.selectedNodeIds.clear();
            this.selectedNodeIds.add(groupNode.id);
            
            this.renderCanvas();
            this.saveCanvasDebounced();
        }
        
        ungroupSelected() {
            let changed = false;
            this.pushHistory();
            const groupsToUngroup = [];
            
            this.selectedNodeIds.forEach(id => {
                const n = this.nodes.find(node => node.id === id);
                if (n && n.type === "group") {
                    groupsToUngroup.push(n);
                    changed = true;
                }
            });
            
            if (changed) {
                this.selectedNodeIds.clear();
                groupsToUngroup.forEach(g => {
                    this.nodes = this.nodes.filter(n => n.id !== g.id);
                    if (g.children) {
                        g.children.forEach(childId => this.selectedNodeIds.add(childId));
                    }
                });
                this.renderCanvas();
                this.saveCanvasDebounced();
            }
        }
        
        // --- 플로팅 컨텍스트 메뉴 (노드 & 엣지) ---
        showFloatingToolbarForNode(node) {
            this.removeFloatingToolbar();
            
            const toolbar = document.createElement("div");
            toolbar.className = "canvas-context-toolbar";
            toolbar.id = "canvas-floating-toolbar";
            
            // 1. 색상 파레트 구성
            const palette = document.createElement("div");
            palette.className = "canvas-color-palette";
            
            const colors = [
                { num: "", bg: "rgba(255,255,255,0.08)" }, // 기본
                { num: "1", bg: "#ff5252" },
                { num: "2", bg: "#ff9800" },
                { num: "3", bg: "#ffeb3b" },
                { num: "4", bg: "#4caf50" },
                { num: "5", bg: "#2196f3" },
                { num: "6", bg: "#9c27b0" }
            ];
            
            colors.forEach(c => {
                const dot = document.createElement("div");
                dot.className = "canvas-color-dot";
                dot.style.background = c.bg;
                dot.title = c.num ? `색상 ${c.num}` : "기본색";
                dot.onclick = (e) => {
                    e.stopPropagation();
                    this.pushHistory();
                    this.changeNodeColor(node.id, c.num);
                };
                palette.appendChild(dot);
            });
            toolbar.appendChild(palette);
            
            // 2. 크기 자동 맞춤 버튼
            const fitBtn = document.createElement("button");
            fitBtn.className = "canvas-context-btn";
            fitBtn.innerHTML = `<i data-lucide="minimize-2" style="width: 14px; height: 14px;"></i>`;
            fitBtn.title = "내용 크기에 맞춤";
            fitBtn.onclick = (e) => {
                e.stopPropagation();
                this.pushHistory();
                this.fitNodeSizeToContent(node);
            };
            toolbar.appendChild(fitBtn);
            
            // 3. 텍스트 수정 버튼 (Text Node 전용)
            if (node.type === "text") {
                const editBtn = document.createElement("button");
                editBtn.className = "canvas-context-btn";
                editBtn.innerHTML = `<i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>`;
                editBtn.title = "카드 편집";
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    const container = document.getElementById(`content-${node.id}`);
                    if (container) this.editMarkdownNode(node, container);
                };
                toolbar.appendChild(editBtn);
            }
            
            // 4. 삭제 버튼
            const delBtn = document.createElement("button");
            delBtn.className = "canvas-context-btn";
            delBtn.style.color = "#ff5858";
            delBtn.innerHTML = `<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>`;
            delBtn.title = "삭제 (Del)";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.pushHistory();
                this.deleteNode(node.id);
            };
            toolbar.appendChild(delBtn);
            
            // 노드 엘리먼트 내부 대신 nodes layer에 추가하여 overflow: hidden 클리핑 회피
            const nodesContainer = document.getElementById("canvas-nodes-layer");
            if (nodesContainer) {
                // 상단 중앙 정렬 좌표 설정 (노드 월드 좌표 기준)
                toolbar.style.left = `${node.x + node.width / 2}px`;
                toolbar.style.top = `${node.y}px`;
                nodesContainer.appendChild(toolbar);
                lucide.createIcons({ attrs: { style: "width: 14px; height: 14px;" } });
            }
        }
        
        showFloatingToolbarForEdge(edge, worldX, worldY) {
            this.removeFloatingToolbar();
            
            const toolbar = document.createElement("div");
            toolbar.className = "canvas-context-toolbar";
            toolbar.id = "canvas-floating-toolbar";
            
            // 1. 색상 파레트 구성
            const palette = document.createElement("div");
            palette.className = "canvas-color-palette";
            
            const colors = [
                { num: "", bg: "rgba(255,255,255,0.08)" }, // 기본
                { num: "1", bg: "#ff5252" },
                { num: "2", bg: "#ff9800" },
                { num: "3", bg: "#ffeb3b" },
                { num: "4", bg: "#4caf50" },
                { num: "5", bg: "#2196f3" },
                { num: "6", bg: "#9c27b0" }
            ];
            
            colors.forEach(c => {
                const dot = document.createElement("div");
                dot.className = "canvas-color-dot";
                dot.style.background = c.bg;
                dot.title = c.num ? `색상 ${c.num}` : "기본색";
                dot.onclick = (e) => {
                    e.stopPropagation();
                    this.pushHistory();
                    this.changeEdgeColor(edge.id, c.num);
                };
                palette.appendChild(dot);
            });
            toolbar.appendChild(palette);
            
            // 2. 삭제 버튼
            const delBtn = document.createElement("button");
            delBtn.className = "canvas-context-btn";
            delBtn.style.color = "#ff5858";
            delBtn.innerHTML = `<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>`;
            delBtn.title = "연결선 삭제";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.pushHistory();
                this.deleteEdge(edge.id);
            };
            toolbar.appendChild(delBtn);
            
            // SVG 위에 절대 좌표 노출을 위해 HTML 노드 레이어에 오버레이
            const nodesContainer = document.getElementById("canvas-nodes-layer");
            if (nodesContainer) {
                toolbar.style.left = `${worldX}px`;
                toolbar.style.top = `${worldY}px`;
                nodesContainer.appendChild(toolbar);
                lucide.createIcons({ attrs: { style: "width: 14px; height: 14px;" } });
            }
        }
        
        changeEdgeColor(edgeId, colorNum) {
            const edge = this.edges.find(e => e.id === edgeId);
            if (edge) {
                edge.color = colorNum;
                this.drawEdges();
                this.saveCanvasDebounced();
            }
        }
        
        removeFloatingToolbar() {
            const tb = document.getElementById("canvas-floating-toolbar");
            if (tb) tb.remove();
        }
        
        updateFloatingToolbarPosition() {
            // 노드 내부에 삽입되어 있으므로 줌/팬에 따른 별도 수동 연산 불필요
        }
        
        changeNodeColor(nodeId, colorNum) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                node.color = colorNum;
                const nodeEl = document.getElementById(`node-${nodeId}`);
                if (nodeEl) {
                    if (colorNum) {
                        nodeEl.setAttribute("data-color", colorNum);
                    } else {
                        nodeEl.removeAttribute("data-color");
                    }
                }
                this.saveCanvasDebounced();
            }
        }
        
        fitNodeSizeToContent(node) {
            const contentEl = document.getElementById(`content-${node.id}`);
            if (contentEl) {
                // 가상 엘리먼트를 활용해 정확한 마크다운 문서 너비/높이 계산
                const clone = contentEl.cloneNode(true);
                clone.style.position = "absolute";
                clone.style.visibility = "hidden";
                clone.style.width = "auto";
                clone.style.height = "auto";
                clone.style.maxHeight = "none";
                document.body.appendChild(clone);
                
                const w = Math.max(200, Math.min(500, clone.scrollWidth + 24));
                const h = Math.max(120, Math.min(450, clone.scrollHeight + 50));
                document.body.removeChild(clone);
                
                node.width = Math.round(w / 4) * 4;
                node.height = Math.round(h / 4) * 4;
                
                const nodeEl = document.getElementById(`node-${node.id}`);
                if (nodeEl) {
                    nodeEl.style.width = `${node.width}px`;
                    nodeEl.style.height = `${node.height}px`;
                }
                this.drawEdges();
                this.saveCanvasDebounced();
                
                // 툴바 좌표 보정
                this.showFloatingToolbarForNode(node);
            }
        }
        
        // 텍스트 카드 노드 추가
        addTextNode() {
            this.pushHistory();
            
            const { x, y } = this.getViewportCenterWorld();
            const nodeId = `text_${Math.random().toString(36).substring(2, 12)}`;
            const newNode = {
                id: nodeId,
                type: "text",
                text: "### 제목\n내용을 입력하세요.",
                x: Math.round(x / 4) * 4,
                y: Math.round(y / 4) * 4,
                width: 250,
                height: 200,
                color: ""
            };
            
            this.nodes.push(newNode);
            this.renderCanvas();
            this.saveCanvasDebounced();
            
            // 생성 후 즉시 편집 모드 진입
            setTimeout(() => {
                const container = document.getElementById(`content-${nodeId}`);
                if (container) {
                    this.editMarkdownNode(newNode, container);
                }
            }, 100);
        }
        
        // 파일 카드 추가 모달
        async addFileNodeModal() {
            const res = await pywebview.api.list_files();
            const flatFiles = this.flattenTreeFiles(res);
            
            if (flatFiles.length === 0) {
                alert("서재 내에 카드에 추가할 파일이 없습니다.");
                return;
            }
            
            this.showSearchModal("서재 문서 임베드 추가", flatFiles, (filePath) => {
                this.pushHistory();
                const { x, y } = this.getViewportCenterWorld();
                this.addFileNodeAt(filePath, x, y);
            });
        }
        
        // 미디어(이미지) 카드 추가 모달
        async addMediaNodeModal() {
            const res = await pywebview.api.list_files();
            const flatFiles = this.flattenTreeFiles(res);
            
            // 이미지 계열 파일만 필터링
            const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "pdf"];
            const mediaFiles = flatFiles.filter(f => {
                const ext = f.split('.').pop().toLowerCase();
                return imageExts.includes(ext);
            });
            
            if (mediaFiles.length === 0) {
                alert("서재 내에 임베드 가능한 이미지나 PDF 파일이 없습니다.");
                return;
            }
            
            this.showSearchModal("이미지/미디어 임베드 추가", mediaFiles, (filePath) => {
                this.pushHistory();
                const { x, y } = this.getViewportCenterWorld();
                this.addFileNodeAt(filePath, x, y);
            });
        }
        
        // 폴더 카드 추가 모달
        async addFolderNodeModal() {
            const res = await pywebview.api.list_files();
            const folders = this.collectFoldersFromTree(res);
            
            // 중복 제거 및 정렬
            const uniqueFolders = [...new Set(folders)].sort();
            
            if (uniqueFolders.length === 0) {
                alert("서재 내에 카드에 추가할 폴더가 없습니다.");
                return;
            }
            
            this.showSearchModal("서재 폴더 임베드 추가", uniqueFolders, (folderPath) => {
                this.pushHistory();
                const { x, y } = this.getViewportCenterWorld();
                this.addFileNodeAt(folderPath, x, y);
            });
        }
        
        collectFoldersFromTree(items) {
            let res = [];
            if (!items) return res;
            items.forEach(item => {
                if (item.type === "folder") {
                    res.push(item.path);
                }
                if (item.children) {
                    res = res.concat(this.collectFoldersFromTree(item.children));
                }
            });
            return res;
        }
        
        showSearchModal(titleText, itemsList, onSelect) {
            const backdrop = document.createElement("div");
            backdrop.style.position = "fixed";
            backdrop.style.top = "0";
            backdrop.style.left = "0";
            backdrop.style.width = "100vw";
            backdrop.style.height = "100vh";
            backdrop.style.background = "rgba(0,0,0,0.6)";
            backdrop.style.backdropFilter = "blur(8px)";
            backdrop.style.display = "flex";
            backdrop.style.alignItems = "center";
            backdrop.style.justifyContent = "center";
            backdrop.style.zIndex = "200000";
            backdrop.onclick = () => backdrop.remove();
            
            const modal = document.createElement("div");
            modal.style.background = "rgba(20, 22, 30, 0.95)";
            modal.style.border = "1px solid rgba(255,255,255,0.15)";
            modal.style.borderRadius = "16px";
            modal.style.padding = "20px";
            modal.style.width = "400px";
            modal.style.maxHeight = "500px";
            modal.style.display = "flex";
            modal.style.flexDirection = "column";
            modal.style.boxShadow = "0 20px 40px rgba(0,0,0,0.5)";
            modal.onclick = (e) => e.stopPropagation();
            
            const title = document.createElement("h3");
            title.innerText = titleText;
            title.style.margin = "0 0 15px 0";
            title.style.color = "var(--accent)";
            title.style.fontFamily = "Outfit, sans-serif";
            
            const searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.placeholder = "파일 이름 검색...";
            searchInput.style.background = "rgba(255,255,255,0.05)";
            searchInput.style.border = "1px solid rgba(255,255,255,0.1)";
            searchInput.style.borderRadius = "8px";
            searchInput.style.padding = "8px 12px";
            searchInput.style.color = "#fff";
            searchInput.style.marginBottom = "10px";
            searchInput.style.outline = "none";
            
            const listDiv = document.createElement("div");
            listDiv.style.flex = "1";
            listDiv.style.overflowY = "auto";
            listDiv.style.display = "flex";
            listDiv.style.flexDirection = "column";
            listDiv.style.gap = "6px";
            
            const renderList = (filter = "") => {
                listDiv.innerHTML = "";
                const filtered = itemsList.filter(f => f.toLowerCase().includes(filter.toLowerCase()));
                if (filtered.length === 0) {
                    listDiv.innerHTML = `<div style="color: var(--text-muted); text-align: center; font-size: 0.85em; padding: 15px;">검색된 파일이 없습니다.</div>`;
                    return;
                }
                filtered.forEach(f => {
                    const row = document.createElement("div");
                    row.className = "file-modal-row";
                    row.style.padding = "8px 12px";
                    row.style.borderRadius = "8px";
                    row.style.cursor = "pointer";
                    row.style.background = "rgba(255,255,255,0.02)";
                    row.style.border = "1px solid transparent";
                    row.style.transition = "all 0.2s";
                    row.style.fontSize = "0.9em";
                    row.style.color = "#e2e8f0";
                    row.style.overflow = "hidden";
                    row.style.textOverflow = "ellipsis";
                    row.style.whiteSpace = "nowrap";
                    row.innerText = f;
                    
                    row.onmouseover = () => {
                        row.style.background = "rgba(69, 243, 255, 0.08)";
                        row.style.borderColor = "rgba(69, 243, 255, 0.3)";
                        row.style.color = "var(--accent)";
                    };
                    row.onmouseout = () => {
                        row.style.background = "rgba(255,255,255,0.02)";
                        row.style.borderColor = "transparent";
                        row.style.color = "#e2e8f0";
                    };
                    
                    row.onclick = () => {
                        onSelect(f);
                        backdrop.remove();
                    };
                    listDiv.appendChild(row);
                });
            };
            
            searchInput.oninput = (e) => renderList(e.target.value);
            
            modal.appendChild(title);
            modal.appendChild(searchInput);
            modal.appendChild(listDiv);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);
            
            renderList();
            searchInput.focus();
        }
        
        flattenTreeFiles(items) {
            let res = [];
            if (!items) return res;
            items.forEach(item => {
                if (item.type === "file") {
                    res.push(item.path);
                } else if (item.children) {
                    res = res.concat(this.flattenTreeFiles(item.children));
                }
            });
            return res;
        }
        
        addFileNodeAt(filePath, x, y) {
            const nodeId = `file_${Math.random().toString(36).substring(2, 12)}`;
            const ext = filePath.split('.').pop().toLowerCase();
            
            // 확장자별 권장 기본 치수 지정
            let width = 300;
            let height = 300;
            if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
                width = 320;
                height = 240;
            } else if (ext === "pdf") {
                width = 450;
                height = 450;
            } else {
                width = 350;
                height = 300;
            }
            
            const newNode = {
                id: nodeId,
                type: "file",
                file: filePath,
                x: Math.round(x / 4) * 4,
                y: Math.round(y / 4) * 4,
                width: width,
                height: height
            };
            
            this.nodes.push(newNode);
            this.renderCanvas();
            this.saveCanvasDebounced();
        }
        
        getViewportCenterWorld() {
            const boardEl = document.getElementById("canvas-board");
            const w = boardEl.clientWidth;
            const h = boardEl.clientHeight;
            return {
                x: (w / 2 - this.transform.x) / this.transform.k,
                y: (h / 2 - this.transform.y) / this.transform.k
            };
        }
        
        // 캔버스 내의 모든 노드를 화면에 한눈에 맞추어 확대배율 및 초점 자동 맞춤
        fitToView() {
            if (this.nodes.length === 0) {
                // 노드가 없다면 리센터 0,0 줌 1
                this.board.transition().duration(500).call(
                    this.zoom.transform,
                    d3.zoomIdentity
                );
                return;
            }
            
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            this.nodes.forEach(n => {
                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.x + n.width > maxX) maxX = n.x + n.width;
                if (n.y + n.height > maxY) maxY = n.y + n.height;
            });
            
            const padding = 60;
            const boundsW = maxX - minX;
            const boundsH = maxY - minY;
            
            const boardW = this.board.node().clientWidth;
            const boardH = this.board.node().clientHeight;
            
            const scaleX = boardW / (boundsW + padding * 2);
            const scaleY = boardH / (boundsH + padding * 2);
            const nextScale = Math.min(2.0, Math.max(0.15, Math.min(scaleX, scaleY)));
            
            const nextX = boardW / 2 - (minX + boundsW / 2) * nextScale;
            const nextY = boardH / 2 - (minY + boundsH / 2) * nextScale;
            
            this.board.transition().duration(600).call(
                this.zoom.transform,
                d3.zoomIdentity.translate(nextX, nextY).scale(nextScale)
            );
        }
        
        // --- 보드 우클릭 콘텍스트 메뉴 ---
        showBoardContextMenu(event) {
            this.closeContextMenu();
            
            const clientX = event.sourceEvent ? event.sourceEvent.clientX : event.clientX;
            const clientY = event.sourceEvent ? event.sourceEvent.clientY : event.clientY;
            
            const menu = document.createElement("div");
            menu.className = "canvas-context-menu";
            menu.id = "canvas-context-menu";
            menu.style.left = `${clientX}px`;
            menu.style.top = `${clientY}px`;
            
            const items = [
                { text: "텍스트 카드 추가", icon: "sticky-note", action: () => this.addTextNode() },
                { text: "서재 문서 임베드", icon: "file-text", action: () => this.addFileNodeModal() },
                { text: "폴더 임베드 추가", icon: "folder", action: () => this.addFolderNodeModal() },
                { text: "이미지/미디어 임베드", icon: "image", action: () => this.addMediaNodeModal() },
                { text: "모두 화면에 맞춤", icon: "maximize", action: () => this.fitToView() },
                { text: "되돌리기 (Ctrl+Z)", icon: "undo-2", action: () => this.undo() },
                { text: "다른 이름으로 저장", icon: "save", action: () => this.saveCanvasAs() },
                { text: "캔버스 닫기", icon: "log-out", action: () => this.closeCanvasView() }
            ];
            
            items.forEach(item => {
                const menuItem = document.createElement("div");
                menuItem.className = "canvas-menu-item";
                menuItem.innerHTML = `<i data-lucide="${item.icon}" style="width: 14px; height: 14px;"></i> <span>${item.text}</span>`;
                menuItem.onclick = (e) => {
                    e.stopPropagation();
                    item.action();
                    this.closeContextMenu();
                };
                menu.appendChild(menuItem);
            });
            
            document.body.appendChild(menu);
            lucide.createIcons({ attrs: { style: "width: 14px; height: 14px;" } });
            
            // 메뉴 캡처 방지
            d3.select(menu).on("mousedown", (e) => e.stopPropagation());
            d3.select(menu).on("click", (e) => e.stopPropagation());
            d3.select(menu).on("contextmenu", (e) => e.preventDefault());
        }
        
        closeContextMenu() {
            const menu = document.getElementById("canvas-context-menu");
            if (menu) menu.remove();
        }
        
        async toggleCanvasView(show) {
            const container = document.getElementById("canvas-view-container");
            if (typeof show !== "boolean") {
                show = (container.style.display === "none");
            }
            if (show) {
                container.style.display = "block";
                this.deselectAll();
                this.applyTransform();
                
                // 파일 경로 미지정 시 폴백
                if (!this.filePath) {
                    if (window.currentFilePath && window.currentFilePath.endsWith('.canvas')) {
                        await this.loadCanvas(window.currentFilePath);
                    } else {
                        const res = await pywebview.api.list_files();
                        const flatFiles = this.flattenTreeFiles(res);
                        const canvasFiles = flatFiles.filter(f => f.toLowerCase().endsWith('.canvas'));
                        
                        if (canvasFiles.length > 0) {
                            await this.loadCanvas(canvasFiles[0]);
                        } else {
                            const newCanvasPath = "workspace.canvas";
                            const createRes = await pywebview.api.save_canvas(newCanvasPath, { nodes: [], edges: [] });
                            if (createRes.status === "success") {
                                if (typeof window.refreshWorkspace === "function") {
                                    await window.refreshWorkspace();
                                }
                                await this.loadCanvas(newCanvasPath);
                            }
                        }
                    }
                }
            } else {
                this.closeActiveCM6();
                container.style.display = "none";
            }
        }
        
        closeCanvasView() {
            this.toggleCanvasView(false);
            // 메인 윈도우 타이틀바 복구
            const titleEl = document.getElementById('active-file-title');
            if (titleEl && window.currentFilePath) {
                const norm = window.currentFilePath.replace(/\\/g, '/');
                titleEl.innerText = norm.substring(norm.lastIndexOf('/') + 1);
            }
        }
    }
    
    function initCanvasEditor() {
        if (window.canvasEditor) return;
        
        const editor = new CanvasEditor();
        window.canvasEditor = editor;
        
        // 전역 바인딩 브릿지
        window.toggleCanvasView = (show) => window.canvasEditor.toggleCanvasView(show);
        window.loadCanvas = (path) => window.canvasEditor.loadCanvas(path);
        window.addCanvasTextNode = () => window.canvasEditor.addTextNode();
        window.addCanvasFileNode = () => window.canvasEditor.addFileNodeModal();
        window.addCanvasFolderNode = () => window.canvasEditor.addFolderNodeModal();
        window.addCanvasMediaNode = () => window.canvasEditor.addMediaNodeModal();
        window.saveActiveCanvas = () => window.canvasEditor.saveCanvasImmediately();
        window.saveActiveCanvasAs = () => window.canvasEditor.saveCanvasAs();
        window.canvasUndo = () => window.canvasEditor.undo();
        window.canvasRedo = () => window.canvasEditor.redo();
        window.canvasFitToView = () => window.canvasEditor.fitToView();
        window.closeCanvasView = () => window.canvasEditor.closeCanvasView();
    }
    
    window.addEventListener("pywebviewready", initCanvasEditor);
    
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initCanvasEditor();
    } else {
        window.addEventListener("DOMContentLoaded", initCanvasEditor);
    }
})();
