// Joy Markdown Studio - 사용자 지정 템플릿 & 원격 구독 UI 플러그인 (custom_templates_ui.js)

(function () {
    // 1. DOM 로드 후 아이콘 버튼 및 모달 동적 강제 주입
    document.addEventListener("DOMContentLoaded", () => {
        injectTriggersAndModals();
        hijackRenderTemplates();
    });

    // 만약 이미 DOM이 로드된 상태인 경우 즉각 주입
    if (document.readyState === "interactive" || document.readyState === "complete") {
        injectTriggersAndModals();
        hijackRenderTemplates();
    }

    function injectTriggersAndModals() {
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
            plusBtn.onclick = openSaveTemplateModal;
            
            const rssBtn = document.createElement('button');
            rssBtn.id = 'subscription-trigger-btn';
            rssBtn.className = 'icon-btn';
            rssBtn.style.padding = '2px';
            rssBtn.style.marginRight = '8px';
            rssBtn.title = '템플릿 원격 저장소 구독 및 동기화 설정';
            rssBtn.innerHTML = '<i data-lucide="rss" style="width: 14px; height: 14px; color: var(--accent);"></i>';
            rssBtn.onclick = openSubscriptionModal;
            
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

        // C. 템플릿 구독 설정 모달 주입
        if (!document.getElementById('template-subscription-modal')) {
            const subModalHtml = `
                <div id="template-subscription-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="width: 520px; max-width: 90%; background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); color: var(--text-main); font-family: 'Inter', sans-serif; display: flex; flex-direction: column; gap: 16px; position: relative;">
                        <h3 style="font-size: 1.1em; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin: 0;">
                            <i data-lucide="rss" style="width: 18px; height: 18px;"></i>
                            <span>템플릿 원격 구독 설정 및 동기화</span>
                        </h3>
                        
                        <div style="display: flex; gap: 8px; align-items: flex-end;">
                            <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                                <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">GitHub 리포지토리 주소</label>
                                <input type="text" id="template-sub-url" placeholder="예: https://github.com/user/templates" style="width: 100%; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.9em; outline: none;" />
                            </div>
                            <button onclick="addTemplateSubscription()" style="padding: 10px 16px; border-radius: 6px; background: var(--accent); border: none; color: #000; font-weight: 600; font-size: 0.9em; cursor: pointer; height: 38px; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                                <span>추가</span>
                            </button>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            <label style="font-size: 0.8em; font-weight: 500; color: var(--text-muted);">현재 구독 목록</label>
                            <div id="template-subs-list" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
                                <!-- Subscriptions listed via JS -->
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                            <button onclick="syncTemplateSubscriptions()" style="padding: 10px 16px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text-main); font-weight: 500; font-size: 0.9em; cursor: pointer; display: flex; align-items: center; gap: 6px;" id="sync-subs-btn">
                                <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
                                <span>모두 동기화</span>
                            </button>
                            <button onclick="closeSubscriptionModal()" style="padding: 10px 16px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-main); font-weight: 500; font-size: 0.9em; cursor: pointer;">닫기</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', subModalHtml);
        }
    }

    // D. 아이콘 및 색상칩 동적 채우기
    let selectedIcon = "file-text";
    let selectedColor = "#3b82f6";

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
                
                // 3. 원격 구독 템플릿 추가
                subscribed.forEach(c => {
                    window.DOCUMENT_TEMPLATES[c.id] = c.content;
                    
                    const cardHtml = `
                        <div class="template-card custom-card-item" id="card-${c.id}" onclick="insertTemplate('${c.id}')" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-left: 3px solid ${c.color}; border-radius: 6px; cursor: pointer; transition: all 0.2s ease-in-out; backdrop-filter: blur(8px); position: relative;">
                            <div class="template-card-icon" style="width: 30px; height: 30px; border-radius: 50%; background: ${c.color}20; border: 1px solid ${c.color}40; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${c.color};">
                                <i data-lucide="${c.icon}" style="width: 14px; height: 14px;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; overflow: hidden; flex: 1;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 0.78em; font-weight: 600; color: var(--text-main); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${c.title}</span>
                                    <span style="font-size: 0.6em; font-weight: 700; color: #3b82f6; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 0.5px 4px; border-radius: 3px; font-family: Outfit;">RSS</span>
                                </div>
                                <span style="font-size: 0.66em; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${c.desc}</span>
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', cardHtml);
                });
                
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
        } catch (err) {
            console.error("Error drawing custom templates:", err);
        }
    }

    // G. 창 제어 함수 바인딩
    window.selectTemplateIcon = function (ico) {
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
    };

    window.selectTemplateColor = function (col) {
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
    };

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
        renderSubscriptionsList();
        document.getElementById('template-subscription-modal').style.display = 'flex';
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
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>동기화중...</span>';
        
        if (window.pywebview && window.pywebview.api && window.pywebview.api.sync_subscriptions) {
            const res = await window.pywebview.api.sync_subscriptions();
            btn.disabled = false;
            btn.innerHTML = origHtml;
            
            if (res.status === 'success') {
                if (typeof window.showToast === 'function') {
                    window.showToast("모든 템플릿 저장소 동기화 완료!");
                }
            } else {
                alert("동기화 실패: " + res.message);
            }
            renderSubscriptionsList();
        }
    };

})();
