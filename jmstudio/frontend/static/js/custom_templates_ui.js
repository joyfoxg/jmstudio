// Joy Markdown Studio - 사용자 지정 템플릿 & 원격 구독 UI 플러그인 (custom_templates_ui.js)

(function () {
    let initialized = false;
    let selectedIcon = "file-text";
    let selectedColor = "#3b82f6";

    function init() {
        if (initialized) return;
        initialized = true;
        injectTriggersAndModals();
        hijackRenderTemplates();
        injectQuartoToolbarAndConsole();
    }

    // 1. DOM 로드 후 아이콘 버튼 및 모달 동적 강제 주입
    document.addEventListener("DOMContentLoaded", init);

    // 만약 이미 DOM이 로드된 상태인 경우 즉각 주입
    if (document.readyState === "interactive" || document.readyState === "complete") {
        init();
    }

    function injectTriggersAndModals() {
        // A-0. CSS 스핀 애니메이션 및 스타일 주입
        if (!document.getElementById('custom-templates-style')) {
            const style = document.createElement('style');
            style.id = 'custom-templates-style';
            style.innerHTML = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .icon-selector-item:hover {
                    border-color: rgba(69, 243, 255, 0.4) !important;
                    background: rgba(69, 243, 255, 0.03) !important;
                }
                .color-selector-item:hover {
                    transform: scale(1.18) !important;
                }
            `;
            document.head.appendChild(style);
        }

        // A. 사이드바 헤더 영역 버튼 주입
        const closeBtn = document.querySelector('#sidebar-template-selector button[onclick*="toggleTemplateSelector(false)"]');
        if (closeBtn && !document.getElementById('save-template-trigger-btn')) {
            const plusBtn = document.createElement('button');
            plusBtn.id = 'save-template-trigger-btn';
            plusBtn.className = 'icon-btn';
            plusBtn.style.padding = '2px';
            plusBtn.style.marginRight = '4px';
            plusBtn.title = '현재 문서를 사용자 지정 템플릿으로 추가';
            plusBtn.innerHTML = '<i data-lucide="plus" style="width: 14px; height: 14px; color: var(--accent);"></i>';
            plusBtn.onclick = () => {
                if (typeof window.openSaveTemplateModal === 'function') {
                    window.openSaveTemplateModal();
                }
            };
            
            const rssBtn = document.createElement('button');
            rssBtn.id = 'subscription-trigger-btn';
            rssBtn.className = 'icon-btn';
            rssBtn.style.padding = '2px';
            rssBtn.style.marginRight = '8px';
            rssBtn.title = '템플릿 원격 저장소 구독 및 동기화 설정';
            rssBtn.innerHTML = '<i data-lucide="rss" style="width: 14px; height: 14px; color: var(--accent);"></i>';
            rssBtn.onclick = () => {
                if (typeof window.openSubscriptionModal === 'function') {
                    window.openSubscriptionModal();
                }
            };
            
            closeBtn.parentNode.insertBefore(rssBtn, closeBtn);
            closeBtn.parentNode.insertBefore(plusBtn, rssBtn);
            
            if (window.lucide) {
                lucide.createIcons();
            }
        }

        // B. 템플릿 저장 모달 주입
        if (!document.getElementById('save-template-modal')) {
            const saveModalHtml = `
                <div id="save-template-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="width: 480px; max-width: 90%; background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); color: var(--text-main); font-family: 'Inter', sans-serif; display: flex; flex-direction: column; gap: 16px; position: relative;">
                        <h3 style="font-size: 1.1em; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin: 0;">
                            <i data-lucide="layout-template" style="width: 18px; height: 18px;"></i>
                            <span>현재 문서를 템플릿으로 저장</span>
                        </h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">템플릿 제목 *</label>
                            <input type="text" id="save-template-title" placeholder="예: 주간 업무 보고서" style="width: 100%; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.9em; outline: none;" />
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">설명</label>
                            <input type="text" id="save-template-desc" placeholder="예: 팀내 주간 R&R 점검 및 보고용" style="width: 100%; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.9em; outline: none;" />
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">대표 아이콘 선택</label>
                            <div id="save-template-icons-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
                                <!-- Icons injected via JS -->
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">카드 포인트 색상</label>
                            <div id="save-template-colors-grid" style="display: flex; gap: 8px; justify-content: space-between;">
                                <!-- Colors injected via JS -->
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                            <button onclick="closeSaveTemplateModal()" style="padding: 10px 16px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-main); font-weight: 500; font-size: 0.9em; cursor: pointer;">취소</button>
                            <button onclick="saveCustomTemplate()" style="padding: 10px 16px; border-radius: 6px; background: var(--accent); border: none; color: #000; font-weight: 600; font-size: 0.9em; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                                <span>양식 저장</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', saveModalHtml);
            setupSaveTemplateOptions();
        }

        // C. 템플릿 구독 설정 모달 주입 (원격 템플릿 스토어 탭 연동 및 동기화 피드백 탑재)
        if (!document.getElementById('template-subscription-modal')) {
            const subModalHtml = `
                <div id="template-subscription-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="width: 560px; max-width: 95%; background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); color: var(--text-main); font-family: 'Inter', sans-serif; display: flex; flex-direction: column; gap: 16px; position: relative;">
                        <!-- 헤더 -->
                        <h3 style="font-size: 1.1em; font-weight: 600; color: var(--accent); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin: 0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="layout-template" style="width: 18px; height: 18px;"></i>
                                <span>원격 템플릿 스토어 및 구독</span>
                            </div>
                            <button onclick="closeSubscriptionModal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2em; display:flex; align-items:center; justify-content:center; padding: 4px;">&times;</button>
                        </h3>
                        
                        <!-- 탭 버튼 영역 -->
                        <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                            <button id="tab-btn-sub-store" onclick="switchSubModalTab('store')" style="flex: 1; padding: 8px; background: transparent; border: none; border-bottom: 2px solid var(--accent); color: var(--text-main); font-weight: 600; font-size: 0.85em; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <i data-lucide="shopping-bag" style="width: 14px; height: 14px;"></i>
                                <span>템플릿 추가하기 (스토어)</span>
                            </button>
                            <button id="tab-btn-sub-manage" onclick="switchSubModalTab('manage')" style="flex: 1; padding: 8px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 500; font-size: 0.85em; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <i data-lucide="settings" style="width: 14px; height: 14px;"></i>
                                <span>구독 저장소 관리</span>
                            </button>
                        </div>
                        
                        <!-- 자동 동기화 상태 피드백 영역 -->
                        <div id="sub-sync-status-container" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(69, 243, 255, 0.05); border: 1px solid rgba(69, 243, 255, 0.15); border-radius: 8px; font-size: 0.78em; color: var(--accent); transition: all 0.3s ease;">
                            <i id="sub-sync-status-icon" data-lucide="refresh-cw" style="width: 13px; height: 13px; display: inline-block; flex-shrink: 0;"></i>
                            <span id="sub-sync-status-text" style="font-weight: 500;">동기화 상태 대기 중...</span>
                        </div>
                        
                        <!-- 탭 1: 템플릿 추가하기 (스토어) -->
                        <div id="sub-tab-content-store" style="display: flex; flex-direction: column; gap: 12px; min-height: 280px;">
                            <!-- 검색바 -->
                            <div style="display: flex; position: relative; width: 100%;">
                                <input type="text" id="store-search-input" placeholder="원격 템플릿 이름 또는 #해시태그 검색..." oninput="searchStoreTemplates()" style="width: 100%; padding: 10px 12px 10px 36px; background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.88em; outline: none; transition: border-color 0.2s;" />
                                <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--text-muted);"></i>
                            </div>
                            
                            <!-- 스토어 원격 템플릿 검색 결과 리스트 -->
                            <div id="store-templates-list" style="flex: 1; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); scrollbar-width: thin;">
                                <!-- 검색 매칭된 원격 템플릿들이 동적 카드로 생성됨 -->
                            </div>
                        </div>
                        
                        <!-- 탭 2: 구독 저장소 관리 -->
                        <div id="sub-tab-content-manage" style="display: none; flex-direction: column; gap: 12px;">
                            <div style="display: flex; gap: 8px; align-items: flex-end;">
                                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                                    <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">GitHub 리포지토리 주소</label>
                                    <input type="text" id="template-sub-url" placeholder="예: https://github.com/user/templates.git" style="width: 100%; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.9em; outline: none;" />
                                </div>
                                <button onclick="addTemplateSubscription()" style="padding: 10px 16px; border-radius: 6px; background: var(--accent); border: none; color: #000; font-weight: 600; font-size: 0.9em; cursor: pointer; height: 38px; display: flex; align-items: center; gap: 4px;">
                                    <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                                    <span>추가</span>
                                </button>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                                <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">현재 구독 목록</label>
                                <div id="template-subs-list" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
                                    <!-- Subscriptions listed via JS -->
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 8px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
                                <button onclick="syncTemplateSubscriptions()" style="padding: 10px 14px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text-main); font-weight: 500; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; gap: 6px;" id="sync-subs-btn">
                                    <i data-lucide="refresh-cw" style="width: 13px; height: 13px;"></i>
                                    <span>동기화</span>
                                </button>
                                <button onclick="restoreDefaultTemplateSubscription()" style="padding: 10px 14px; border-radius: 6px; background: rgba(69, 243, 255, 0.05); border: 1px solid rgba(69, 243, 255, 0.2); color: var(--accent); font-weight: 500; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; gap: 6px;" id="restore-default-subs-btn">
                                    <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i>
                                    <span>기본값 복원</span>
                                </button>
                            </div>
                        </div>
                        
                        <!-- 푸터 -->
                        <div style="display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-top: 4px;">
                            <button onclick="closeSubscriptionModal()" style="padding: 10px 20px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-main); font-weight: 500; font-size: 0.9em; cursor: pointer;">닫기</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', subModalHtml);
        }
    }

    // D. 아이콘 및 색상칩 동적 채우기

    function setupSaveTemplateOptions() {
        const icons = [
            "file-text", "layout-template", "book", "check", "trending-up",
            "line-chart", "heart", "travel", "sticky-note", "shopping-cart",
            "graduation-cap", "code"
        ];
        
        const colors = [
            "#ec4899", "#3b82f6", "#10b981", "#f59e0b", 
            "#6366f1", "#ef4444", "#0ea5e9", "#8b5cf6", "#14b8a6"
        ];
        
        const iconsGrid = document.getElementById('save-template-icons-grid');
        if (iconsGrid) {
            iconsGrid.innerHTML = icons.map(ico => `
                <div class="icon-selector-item" data-icon="${ico}" onclick="selectTemplateIcon('${ico}')" style="aspect-ratio: 1; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: var(--text-muted);">
                    <i data-lucide="${ico}" style="width: 16px; height: 16px;"></i>
                </div>
            `).join('');
            selectTemplateIcon("file-text");
        }
        
        const colorsGrid = document.getElementById('save-template-colors-grid');
        if (colorsGrid) {
            colorsGrid.innerHTML = colors.map(col => `
                <div class="color-selector-item" data-color="${col}" onclick="selectTemplateColor('${col}')" style="width: 24px; height: 24px; border-radius: 50%; background: ${col}; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; box-sizing: border-box;"></div>
            `).join('');
            selectTemplateColor("#3b82f6");
        }
        
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // E. 템플릿 리스트 렌더링 하이재킹
    function hijackRenderTemplates() {
        if (typeof window.renderTemplates === 'function' && !window.renderTemplates.__hijacked) {
            const originalRender = window.renderTemplates;
            window.renderTemplates = function () {
                originalRender();
                renderCustomTemplates();
            };
            window.renderTemplates.__hijacked = true;
            
            // 최초 한 번 렌더링
            renderCustomTemplates();
        }
    }

    // F. 커스텀 템플릿 비동기 로드 및 드로잉
    async function renderCustomTemplates() {
        const container = document.getElementById('sidebar-templates-list');
        if (!container) return;
        
        try {
            if (window.pywebview && window.pywebview.api && window.pywebview.api.get_custom_templates) {
                const res = await window.pywebview.api.get_custom_templates();
                if (!res) return;
                
                const local = res.local || [];
                const subscribed = res.subscribed || [];
                
                // 1. 기존의 커스텀 카드 엘리먼트들만 싹 비우기
                const customCards = container.querySelectorAll('.custom-card-item');
                customCards.forEach(c => c.remove());
                
                // 2. 로컬 템플릿 추가
                local.forEach(c => {
                    // 전역 템플릿 맵에 매핑
                    window.DOCUMENT_TEMPLATES[c.id] = c.content;
                    
                    const cardHtml = `
                        <div class="template-card custom-card-item" id="card-${c.id}" onclick="insertTemplate('${c.id}')" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-left: 3px solid ${c.color}; border-radius: 6px; cursor: pointer; transition: all 0.2s ease-in-out; backdrop-filter: blur(8px); position: relative;">
                            <div class="template-card-icon" style="width: 30px; height: 30px; border-radius: 50%; background: ${c.color}20; border: 1px solid ${c.color}40; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${c.color};">
                                <i data-lucide="${c.icon}" style="width: 14px; height: 14px;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; overflow: hidden; flex: 1; padding-right: 20px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 0.78em; font-weight: 600; color: var(--text-main); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${c.title}</span>
                                    <span style="font-size: 0.6em; font-weight: 700; color: #10b981; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 0.5px 4px; border-radius: 3px; font-family: Outfit;">User</span>
                                </div>
                                <span style="font-size: 0.66em; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${c.desc}</span>
                            </div>
                            <!-- Delete Button -->
                            <button onclick="event.stopPropagation(); deleteCustomTemplate('${c.id}')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; transition: color 0.2s;" title="템플릿 삭제" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'">
                                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                            </button>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', cardHtml);
                });
                
                // 3. 원격 구독 템플릿 전체 렌더링 제거 (사용자 선택 추가 기능을 위해 사이드바 강제 노출 생략)
                // 구독 템플릿은 모달 검색창에서 골라서 '추가'한 후 User 뱃지로 사이드바에 렌더링되게 변경되었습니다.
                
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
        } catch (err) {
            console.error("Error drawing custom templates:", err);
        }
    }

    // G. 창 제어 함수 바인딩 (호이스팅을 위한 함수 선언문 구조 채택)
    function selectTemplateIcon(ico) {
        selectedIcon = ico;
        document.querySelectorAll('.icon-selector-item').forEach(item => {
            if (item.getAttribute('data-icon') === ico) {
                item.style.borderColor = 'var(--accent)';
                item.style.color = 'var(--accent)';
                item.style.background = 'rgba(69, 243, 255, 0.05)';
            } else {
                item.style.borderColor = 'rgba(255,255,255,0.08)';
                item.style.color = 'var(--text-muted)';
                item.style.background = 'transparent';
            }
        });
    }
    window.selectTemplateIcon = selectTemplateIcon;

    function selectTemplateColor(col) {
        selectedColor = col;
        document.querySelectorAll('.color-selector-item').forEach(item => {
            if (item.getAttribute('data-color') === col) {
                item.style.borderColor = 'var(--text-main)';
                item.style.transform = 'scale(1.15)';
            } else {
                item.style.borderColor = 'transparent';
                item.style.transform = 'scale(1)';
            }
        });
    }
    window.selectTemplateColor = selectTemplateColor;

    window.openSaveTemplateModal = function () {
        const view = window.cmEditor;
        const textarea = document.getElementById('editor');
        let hasContent = false;
        
        if (view && view.state.doc.toString().trim().length > 0) {
            hasContent = true;
        } else if (textarea && textarea.value.trim().length > 0) {
            hasContent = true;
        }
        
        if (!hasContent) {
            if (typeof window.showToast === 'function') {
                window.showToast("작성된 본문 내용이 없습니다. 먼저 양식을 작성해 주세요.");
            } else {
                alert("작성된 본문 내용이 없습니다. 먼저 양식을 작성해 주세요.");
            }
            return;
        }
        
        document.getElementById('save-template-title').value = '';
        document.getElementById('save-template-desc').value = '';
        selectTemplateIcon("file-text");
        selectTemplateColor("#3b82f6");
        
        document.getElementById('save-template-modal').style.display = 'flex';
    };

    window.closeSaveTemplateModal = function () {
        document.getElementById('save-template-modal').style.display = 'none';
    };

    window.saveCustomTemplate = async function () {
        const title = document.getElementById('save-template-title').value.trim();
        const desc = document.getElementById('save-template-desc').value.trim();
        
        if (!title) {
            alert("템플릿 제목을 입력해 주세요.");
            return;
        }
        
        let content = "";
        const view = window.cmEditor;
        const textarea = document.getElementById('editor');
        if (view) {
            content = view.state.doc.toString();
        } else if (textarea) {
            content = textarea.value;
        }
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.save_custom_template) {
            const res = await window.pywebview.api.save_custom_template(title, desc, selectedIcon, selectedColor, content);
            if (res.status === 'success') {
                closeSaveTemplateModal();
                if (typeof window.showToast === 'function') {
                    window.showToast("사용자 지정 템플릿이 라이브러리에 저장되었습니다!");
                }
                renderCustomTemplates();
            } else {
                alert("템플릿 저장 실패: " + res.message);
            }
        }
    };

    window.deleteCustomTemplate = async function (templateId) {
        if (!confirm("정말로 이 사용자 지정 템플릿을 삭제하시겠습니까?")) return;
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.delete_custom_template) {
            const res = await window.pywebview.api.delete_custom_template(templateId);
            if (res.status === 'success') {
                if (typeof window.showToast === 'function') {
                    window.showToast("템플릿이 삭제되었습니다.");
                }
                renderCustomTemplates();
            } else {
                alert("삭제 실패: " + res.message);
            }
        }
    };

    window.openSubscriptionModal = function () {
        document.getElementById('template-sub-url').value = '';
        switchSubModalTab('store'); // 모달 열었을 때 기본적으로 스토어 검색 탭 로드
        
        // 1. 창을 먼저 화면에 완전 렌더링하여 활성화시킵니다.
        document.getElementById('template-subscription-modal').style.display = 'flex';
        
        // 2. 창이 활성화되어 뜬 후 (250ms 딜레이) 동기화 처리를 개시합니다.
        setTimeout(() => {
            triggerAutoSync();
        }, 250);
    };

    window.closeSubscriptionModal = function () {
        document.getElementById('template-subscription-modal').style.display = 'none';
        renderCustomTemplates(); // 모달 닫을 때 최신화
    };

    async function renderSubscriptionsList() {
        const container = document.getElementById('template-subs-list');
        if (!container) return;
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_subscriptions) {
            const subs = await window.pywebview.api.get_subscriptions();
            if (!subs || subs.length === 0) {
                container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8em; text-align: center; padding: 12px; display: block;">구독 중인 저장소가 없습니다.</span>`;
                return;
            }
            
            container.innerHTML = subs.map(url => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; font-size: 0.82em; gap: 8px;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-main); flex: 1; text-align: left;">${url}</span>
                    <button onclick="deleteTemplateSubscription('${url}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;" title="구독 해제">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
            `).join('');
            
            if (window.lucide) {
                lucide.createIcons();
            }
        }
    }

    window.addTemplateSubscription = async function () {
        const url = document.getElementById('template-sub-url').value.trim();
        if (!url) {
            alert("저장소 주소를 입력해 주세요.");
            return;
        }
        
        const btn = document.querySelector('#template-subscription-modal button[onclick*="addTemplateSubscription"]');
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>구독중...</span>';
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.add_subscription) {
            const res = await window.pywebview.api.add_subscription(url);
            btn.disabled = false;
            btn.innerHTML = origHtml;
            
            if (res.status === 'success') {
                document.getElementById('template-sub-url').value = '';
                if (typeof window.showToast === 'function') {
                    window.showToast("저장소 구독이 성공적으로 완료되었습니다!");
                }
                renderSubscriptionsList();
            } else {
                alert("구독 추가 실패: " + res.message);
            }
        }
    };

    window.deleteTemplateSubscription = async function (url) {
        if (!confirm("정말로 이 저장소의 구독을 해제하시겠습니까? 캐싱된 템플릿도 모두 삭제됩니다.")) return;
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.delete_subscription) {
            const res = await window.pywebview.api.delete_subscription(url);
            if (res.status === 'success') {
                if (typeof window.showToast === 'function') {
                    window.showToast("구독이 해제되었습니다.");
                }
                renderSubscriptionsList();
            } else {
                alert("구독 해제 실패: " + res.message);
            }
        }
    };

    window.syncTemplateSubscriptions = async function () {
        const btn = document.getElementById('sync-subs-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>동기화중...</span>';
        }
        
        await triggerAutoSync();
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
        renderSubscriptionsList();
    };

    window.restoreDefaultTemplateSubscription = async function () {
        const btn = document.getElementById('restore-default-subs-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>복원중...</span>';
        }
        
        const statusContainer = document.getElementById('sub-sync-status-container');
        const statusIcon = document.getElementById('sub-sync-status-icon');
        const statusText = document.getElementById('sub-sync-status-text');
        
        if (statusContainer && statusText && statusIcon) {
            statusContainer.style.background = 'rgba(69, 243, 255, 0.06)';
            statusContainer.style.borderColor = 'rgba(69, 243, 255, 0.2)';
            statusContainer.style.color = 'var(--accent)';
            statusText.innerText = '기본 저장소 복원 및 전체 템플릿 동기화 진행 중...';
            statusIcon.style.animation = 'spin 1.2s linear infinite';
            statusIcon.style.display = 'inline-block';
        }
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.restore_default_subscription) {
            try {
                const res = await window.pywebview.api.restore_default_subscription();
                if (statusIcon) statusIcon.style.animation = 'none';
                
                if (res.status === 'success') {
                    let totalCount = 0;
                    try {
                        const templatesRes = await window.pywebview.api.get_custom_templates();
                        if (templatesRes && templatesRes.subscribed) {
                            totalCount = templatesRes.subscribed.length;
                        }
                    } catch (e) {
                        console.error("Failed to load custom templates on restore:", e);
                    }

                    if (statusContainer && statusText) {
                        statusContainer.style.background = 'rgba(16, 185, 129, 0.06)';
                        statusContainer.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                        statusContainer.style.color = '#34d399';
                        statusText.innerText = `복원 성공: 기본 저장소 복원 및 총 ${totalCount}개 원격 템플릿 동기화 완료!`;
                    }
                    if (typeof window.showToast === 'function') {
                        window.showToast(`기본 저장소가 복원되었습니다! (총 ${totalCount}개 원격 템플릿 로드 완료)`);
                    }
                    searchStoreTemplates();
                    renderSubscriptionsList();
                } else {
                    if (statusContainer && statusText) {
                        statusContainer.style.background = 'rgba(239, 68, 68, 0.06)';
                        statusContainer.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                        statusContainer.style.color = '#f87171';
                        statusText.innerText = '복원 실패: ' + res.message;
                    }
                    alert("복원 실패: " + res.message);
                }
            } catch (err) {
                if (statusIcon) statusIcon.style.animation = 'none';
                if (statusContainer && statusText) {
                    statusContainer.style.background = 'rgba(239, 68, 68, 0.06)';
                    statusContainer.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    statusContainer.style.color = '#f87171';
                    statusText.innerText = '복원 처리 중 예외 발생';
                }
            }
        }
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
        if (window.lucide) {
            lucide.createIcons();
        }
    };
    
    // H. 원격 템플릿 스토어 탭 제어 & 검색 & 개별 추가 핸들러
    window.SUBSCRIBED_TEMPLATES_POOL = {}; // 대용량 마크다운/LaTeX 이스케이프 파싱 에러 방지를 위한 전역 메모리 스토어

    async function triggerAutoSync() {
        const statusContainer = document.getElementById('sub-sync-status-container');
        const statusIcon = document.getElementById('sub-sync-status-icon');
        const statusText = document.getElementById('sub-sync-status-text');
        
        if (!statusContainer || !statusIcon || !statusText) return;
        
        // 1. 진행 중 UI 점등 및 spin 개시
        statusContainer.style.background = 'rgba(69, 243, 255, 0.06)';
        statusContainer.style.borderColor = 'rgba(69, 243, 255, 0.2)';
        statusContainer.style.color = 'var(--accent)';
        statusText.innerText = '원격 저장소와 템플릿 동기화 진행 중...';
        statusIcon.style.animation = 'spin 1.2s linear infinite';
        statusIcon.style.display = 'inline-block';
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.sync_subscriptions) {
            try {
                const res = await window.pywebview.api.sync_subscriptions();
                statusIcon.style.animation = 'none';
                
                // 2. 동기화 성공/실패 결과 적용
                if (res.status === 'success') {
                    let totalCount = 0;
                    try {
                        const templatesRes = await window.pywebview.api.get_custom_templates();
                        if (templatesRes && templatesRes.subscribed) {
                            totalCount = templatesRes.subscribed.length;
                        }
                    } catch (e) {
                        console.error("Failed to load custom templates on sync:", e);
                    }

                    statusContainer.style.background = 'rgba(16, 185, 129, 0.06)';
                    statusContainer.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                    statusContainer.style.color = '#34d399';
                    statusText.innerText = `동기화 완료: 최신 원격 템플릿 총 ${totalCount}개 동기화 성공!`;
                    
                    if (typeof window.showToast === 'function') {
                        window.showToast(`원격 템플릿 동기화 완료! (총 ${totalCount}개 템플릿 사용 가능)`);
                    }
                    
                    searchStoreTemplates();
                } else {
                    statusContainer.style.background = 'rgba(239, 68, 68, 0.06)';
                    statusContainer.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    statusContainer.style.color = '#f87171';
                    statusText.innerText = '동기화 실패: ' + res.message;
                    
                    if (typeof window.showToast === 'function') {
                        window.showToast(`원격 템플릿 동기화 실패: ${res.message}`);
                    }
                }
            } catch (err) {
                statusIcon.style.animation = 'none';
                statusContainer.style.background = 'rgba(239, 68, 68, 0.06)';
                statusContainer.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                statusContainer.style.color = '#f87171';
                statusText.innerText = '동기화 중 오류 발생: ' + err.message;
                
                if (typeof window.showToast === 'function') {
                    window.showToast(`동기화 오류 발생: ${err.message}`);
                }
            }
        } else {
            statusIcon.style.animation = 'none';
            statusText.innerText = 'API 연결 대기 중...';
        }
        
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    window.switchSubModalTab = function (tab) {
        const storeTabBtn = document.getElementById('tab-btn-sub-store');
        const manageTabBtn = document.getElementById('tab-btn-sub-manage');
        const storeContent = document.getElementById('sub-tab-content-store');
        const manageContent = document.getElementById('sub-tab-content-manage');
        
        if (!storeTabBtn || !manageTabBtn) return;
        
        if (tab === 'store') {
            storeTabBtn.style.borderBottomColor = 'var(--accent)';
            storeTabBtn.style.color = 'var(--text-main)';
            storeTabBtn.style.fontWeight = '600';
            
            manageTabBtn.style.borderBottomColor = 'transparent';
            manageTabBtn.style.color = 'var(--text-muted)';
            manageTabBtn.style.fontWeight = '500';
            
            storeContent.style.display = 'flex';
            manageContent.style.display = 'none';
            
            searchStoreTemplates();
        } else {
            manageTabBtn.style.borderBottomColor = 'var(--accent)';
            manageTabBtn.style.color = 'var(--text-main)';
            manageTabBtn.style.fontWeight = '600';
            
            storeTabBtn.style.borderBottomColor = 'transparent';
            storeTabBtn.style.color = 'var(--text-muted)';
            storeTabBtn.style.fontWeight = '500';
            
            manageContent.style.display = 'flex';
            storeContent.style.display = 'none';
            
            renderSubscriptionsList();
        }
    };

    window.searchStoreTemplates = async function () {
        const container = document.getElementById('store-templates-list');
        if (!container) return;
        
        const searchInput = document.getElementById('store-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.get_custom_templates) {
            container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.82em; text-align: center; padding: 16px; display: block;">API 로딩 대기 중...</span>`;
            return;
        }
        
        try {
            const res = await window.pywebview.api.get_custom_templates();
            if (!res) return;
            
            const subscribed = res.subscribed || [];
            
            // 메모리 스토어 캐시 갱신
            subscribed.forEach(t => {
                window.SUBSCRIBED_TEMPLATES_POOL[t.id] = t;
            });
            
            // 검색 필터링 (제목, 설명, #해시태그 매칭)
            let filtered = subscribed;
            if (query) {
                const isTagQuery = query.startsWith('#');
                const cleanQuery = isTagQuery ? query.substring(1) : query;
                
                filtered = subscribed.filter(t => {
                    const titleMatch = t.title.toLowerCase().includes(cleanQuery);
                    const descMatch = t.desc.toLowerCase().includes(cleanQuery);
                    
                    let tagMatch = false;
                    if (t.tags && Array.isArray(t.tags)) {
                        tagMatch = t.tags.some(tag => tag.toLowerCase().includes(cleanQuery));
                    }
                    
                    if (isTagQuery) {
                        return tagMatch;
                    }
                    return titleMatch || descMatch || tagMatch;
                });
            }
            
            if (filtered.length === 0) {
                container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.82em; text-align: center; padding: 24px; display: block;">검색어와 일치하는 원격 템플릿이 없습니다.</span>`;
                return;
            }
            
            container.innerHTML = filtered.map(t => {
                const tagsHtml = (t.tags || []).map(tag => `
                    <span style="font-size: 0.62em; padding: 1px 5px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 4px; color: #60a5fa; font-family: 'Outfit';">#${tag}</span>
                `).join(' ');
                
                return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid ${t.color}; border-radius: 6px; text-align: left;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${t.color}20; border: 1px solid ${t.color}40; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${t.color};">
                            <i data-lucide="${t.icon}" style="width: 14px; height: 14px;"></i>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 3px; flex: 1; overflow: hidden; padding-right: 8px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-size: 0.82em; font-weight: 600; color: var(--text-main); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${t.title}</span>
                                ${tagsHtml}
                            </div>
                            <span style="font-size: 0.68em; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${t.desc}</span>
                        </div>
                        <button onclick="importSubscribedTemplate('${t.id}')" style="padding: 6px 12px; border-radius: 4px; background: var(--accent); border: none; color: #000; font-weight: 600; font-size: 0.76em; cursor: pointer; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <i data-lucide="download" style="width: 11px; height: 11px;"></i>
                            <span>추가</span>
                        </button>
                    </div>
                `;
            }).join('');
            
            if (window.lucide) {
                lucide.createIcons();
            }
        } catch (err) {
            console.error("Error drawing store templates:", err);
            container.innerHTML = `<span style="color: #ef4444; font-size: 0.82em; text-align: center; padding: 16px; display: block;">오류 발생: ${err.message}</span>`;
        }
    };

    window.importSubscribedTemplate = async function (templateId) {
        try {
            const template = window.SUBSCRIBED_TEMPLATES_POOL[templateId];
            if (!template) {
                alert("템플릿 데이터를 찾을 수 없습니다. 다시 동기화해 주세요.");
                return;
            }
            
            if (window.pywebview && window.pywebview.api && window.pywebview.api.import_subscribed_template) {
                const res = await window.pywebview.api.import_subscribed_template(
                    template.title,
                    template.desc,
                    template.icon,
                    template.color,
                    template.content,
                    template.tags
                );
                
                if (res.status === 'success') {
                    if (typeof window.showToast === 'function') {
                        window.showToast(`'${template.title}' 템플릿이 서재 라이브러리에 성공적으로 추가되었습니다!`);
                    } else {
                        alert(`'${template.title}' 템플릿이 성공적으로 추가되었습니다.`);
                    }
                    renderCustomTemplates();
                } else {
                    alert("템플릿 추가 실패: " + res.message);
                }
            }
        } catch (err) {
            console.error("Failed to import template:", err);
            alert("템플릿 로딩 및 추가 중 오류가 발생했습니다.");
        }
    };

    // I. Quarto 컴파일러 연동 툴바 및 콘솔 동적 주입
    function injectQuartoToolbarAndConsole() {
        const toolbar = document.querySelector('.editor-toolbar');
        const hashtagBtn = document.querySelector('.editor-toolbar button[onclick*="openHashtagModal"]');
        
        if (toolbar && hashtagBtn && !document.getElementById('toolbar-quarto-dropdown')) {
            const divider = document.createElement('div');
            divider.className = 'toolbar-divider';
            
            const dropdown = document.createElement('div');
            dropdown.className = 'toolbar-dropdown';
            dropdown.id = 'toolbar-quarto-dropdown';
            dropdown.innerHTML = `
                <button class="toolbar-btn" id="toolbar-quarto-btn" title="Quarto 컴파일 빌드 (PDF/HTML)" style="color: #60a5fa;">
                    <i data-lucide="book-open" style="width: 16px; height: 16px;"></i>
                </button>
                <div class="toolbar-dropdown-menu" id="toolbar-quarto-menu" style="min-width: 160px; top: 100%; left: 0;">
                    <div class="dropdown-item" onclick="triggerQuartoCompile('pdf')" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85em;">
                        <i data-lucide="file-text" style="width: 14px; height: 14px; color: #f87171;"></i>
                        <span>PDF 논문 빌드</span>
                    </div>
                    <div class="dropdown-item" onclick="triggerQuartoCompile('html')" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85em;">
                        <i data-lucide="chrome" style="width: 14px; height: 14px; color: #60a5fa;"></i>
                        <span>HTML 리포트 빌드</span>
                    </div>
                </div>
            `;
            
            hashtagBtn.parentNode.insertBefore(divider, hashtagBtn.nextSibling);
            divider.parentNode.insertBefore(dropdown, divider.nextSibling);
            
            const btn = document.getElementById('toolbar-quarto-btn');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.toolbar-dropdown').forEach(dd => {
                        if (dd.id !== 'toolbar-quarto-dropdown') {
                            dd.classList.remove('show');
                        }
                    });
                    dropdown.classList.toggle('show');
                };
            }
        }
        
        if (!document.getElementById('quarto-build-console')) {
            const consoleHtml = `
                <div id="quarto-build-console" style="position: fixed; bottom: -320px; left: 0; width: 100%; height: 300px; background: rgba(10, 10, 15, 0.96); border-top: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.6); z-index: 9999; transition: bottom 0.28s cubic-bezier(0.4, 0, 0.2, 1); color: #cbd5e1; font-family: 'Fira Code', 'Consolas', monospace; display: flex; flex-direction: column; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: rgba(20, 20, 25, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.05); user-select: none;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.82em; font-weight: 600; color: #60a5fa;">
                            <i data-lucide="terminal" style="width: 14px; height: 14px;"></i>
                            <span>Quarto Compilation Console</span>
                        </div>
                        <button onclick="closeQuartoConsole()" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2em; display: flex; align-items: center; padding: 4px;">&times;</button>
                    </div>
                    <div id="quarto-console-log" style="flex: 1; padding: 14px 18px; overflow-y: auto; font-size: 0.78em; line-height: 1.6; white-space: pre-wrap; word-break: break-all; scrollbar-width: thin; color: #a7f3d0;">
                        Ready to compile...
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', consoleHtml);
        }
        
        if (!document.getElementById('quarto-viewer-modal')) {
            const viewerHtml = `
                <div id="quarto-viewer-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="width: 90%; height: 92%; background: rgba(20, 20, 25, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75); position: relative; font-family: 'Inter', sans-serif;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: rgba(25, 25, 30, 0.96); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                            <h3 id="quarto-viewer-title" style="font-size: 1em; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 8px; margin: 0;">
                                <i data-lucide="file-text" style="width: 18px; height: 18px;"></i>
                                <span>학술 컴파일 결과 미리보기</span>
                            </h3>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <a id="quarto-viewer-download" href="#" download style="padding: 7px 14px; background: var(--accent); color: #000; font-weight: 600; font-size: 0.8em; border-radius: 4px; border: none; cursor: pointer; text-decoration: none; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                                    <i data-lucide="download" style="width: 13px; height: 13px;"></i>
                                    <span>로컬 파일 다운로드</span>
                                </a>
                                <button onclick="closeQuartoViewer()" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.5em; display: flex; align-items: center; padding: 4px;">&times;</button>
                            </div>
                        </div>
                        <div style="flex: 1; background: #1e1e28; position: relative;">
                            <iframe id="quarto-viewer-frame" src="" style="width: 100%; height: 100%; border: none; background: #ffffff;"></iframe>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', viewerHtml);
        }
        
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    window.closeQuartoConsole = function() {
        const consoleEl = document.getElementById('quarto-build-console');
        if (consoleEl) {
            consoleEl.style.bottom = '-320px';
        }
    };
    
    window.closeQuartoViewer = function() {
        const modal = document.getElementById('quarto-viewer-modal');
        const frame = document.getElementById('quarto-viewer-frame');
        if (modal) modal.style.display = 'none';
        if (frame) frame.src = '';
    };

    window.triggerQuartoCompile = async function(format) {
        const dd = document.getElementById('toolbar-quarto-dropdown');
        if (dd) dd.classList.remove('show');
        
        if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.check_quarto_installation) {
            alert("API 연결 대기 중입니다. 잠시 후 다시 시도해 주세요.");
            return;
        }
        
        const consoleEl = document.getElementById('quarto-build-console');
        const logEl = document.getElementById('quarto-console-log');
        
        if (consoleEl && logEl) {
            consoleEl.style.bottom = '0px';
            logEl.innerText = ">> 시스템 환경변수에서 Quarto CLI 탐색 중...\n";
            logEl.style.color = '#cbd5e1';
        }
        
        try {
            const check = await window.pywebview.api.check_quarto_installation();
            if (check.status !== 'available') {
                if (logEl) {
                    logEl.innerText += `\n[오류] ${check.message}\n`;
                    logEl.style.color = '#f87171';
                }
                if (typeof window.showToast === 'function') {
                    window.showToast("Quarto CLI 탐색 실패! 설치 가이드를 참조해 주세요.");
                }
                return;
            }
            
            if (logEl) {
                logEl.innerText += `>> 발견된 Quarto 버전: v${check.version}\n`;
                logEl.innerText += `>> 컴파일 가동: format = ${format.toUpperCase()} (임시 텍스트 버퍼 전송 중...)\n`;
            }
            
            const activePath = window.activeFilePath || "";
            
            let content = "";
            const view = window.cmEditor;
            const textarea = document.getElementById('editor');
            if (view) {
                content = view.state.doc.toString();
            } else if (textarea) {
                content = textarea.value;
            }
            
            if (!content.trim()) {
                if (logEl) {
                    logEl.innerText += `\n[오류] 컴파일할 문서 내용이 비어 있습니다.\n`;
                    logEl.style.color = '#f87171';
                }
                return;
            }
            
            if (logEl) {
                logEl.innerText += `>> 컴파일러 프로세스 백시트 백그라운드 호출 개시...\n`;
                logEl.innerText += `>> (LaTeX 수식 파싱 및 인쇄 렌더링에 5~15초 소요될 수 있습니다. 대기해 주세요...)\n`;
            }
            
            const compileRes = await window.pywebview.api.compile_quarto_document(activePath, content, format);
            
            if (compileRes.status === 'success') {
                if (logEl) {
                    logEl.innerText += `\n>> [성공] 컴파일 빌드 프로세스 정상 종료!\n`;
                    logEl.innerText += `>> 생성된 결과 파일: ${compileRes.filename}\n`;
                    logEl.innerText += `\n[빌드 로그 출력]:\n${compileRes.log}\n`;
                    logEl.style.color = '#34d399';
                }
                
                if (typeof window.showToast === 'function') {
                    window.showToast(`'${compileRes.filename}' 컴파일 성공!`);
                }
                
                setTimeout(() => {
                    const modal = document.getElementById('quarto-viewer-modal');
                    const frame = document.getElementById('quarto-viewer-frame');
                    const titleEl = document.getElementById('quarto-viewer-title');
                    const downloadBtn = document.getElementById('quarto-viewer-download');
                    
                    if (modal && frame) {
                        const webUrl = `/workspace/${compileRes.output_path}?t=${new Date().getTime()}`;
                        frame.src = webUrl;
                        
                        if (titleEl) {
                            titleEl.innerHTML = `<i data-lucide="file-text" style="width: 18px; height: 18px;"></i> <span>${compileRes.filename} 미리보기</span>`;
                        }
                        if (downloadBtn) {
                            downloadBtn.onclick = async function(e) {
                                e.preventDefault();
                                if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.download_compiled_file) {
                                    alert("API 연결 대기 중입니다. 잠시 후 다시 시도해 주세요.");
                                    return;
                                }
                                try {
                                    const dlRes = await window.pywebview.api.download_compiled_file(compileRes.output_path, compileRes.filename);
                                    if (dlRes.status === 'success') {
                                        if (typeof window.showToast === 'function') {
                                            window.showToast("파일이 로컬에 저장되었습니다.");
                                        }
                                    } else if (dlRes.status === 'error') {
                                        alert("파일 저장 실패: " + dlRes.message);
                                    }
                                } catch (err) {
                                    alert("다운로드 중 예외 발생: " + err.message);
                                }
                            };
                        }
                        
                        modal.style.display = 'flex';
                        if (window.lucide) {
                            lucide.createIcons();
                        }
                    }
                }, 800);
                
            } else {
                if (logEl) {
                    logEl.innerText += `\n[실패] ${compileRes.message}\n`;
                    if (compileRes.log) {
                        logEl.innerText += `\n[오류 로그 출력]:\n${compileRes.log}\n`;
                    }
                    logEl.style.color = '#f87171';
                }
                if (typeof window.showToast === 'function') {
                    window.showToast("컴파일 실패! 콘솔 로그 오류를 참조하세요.");
                }
            }
        } catch (err) {
            if (logEl) {
                logEl.innerText += `\n[오류] 비동기 통신 처리 중 치명적 예외 발생: ${err.message}\n`;
                logEl.style.color = '#f87171';
            }
        }
    };

    // J. 초기화 구문 바인딩 완료

})();
