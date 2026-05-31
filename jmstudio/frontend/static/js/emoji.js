// 이모지 피커 한국어 번역 팩 데이터셋 (Emoji Mart v5 표준 스펙 준수)
const emojiI18nKo = {
    search: '검색',
    search_no_results_1: '어머나!',
    search_no_results_2: '결과를 찾을 수 없어요',
    pick: '이모지 선택하기',
    add_custom: '이모지 추가하기',
    categories: {
        activity: '활동',
        custom: '사용자 정의',
        flags: '깃발',
        foods: '음식 및 음료',
        frequent: '자주 사용하는 항목',
        nature: '동물 및 자연',
        objects: '사물',
        people: '사람 및 신체',
        places: '여행 및 장소',
        symbols: '기호',
        recent: '최근 사용함',
        smileys: '이모티콘 및 감정'
    },
    skins: {
        choose: '기본 피부톤 선택',
        1: '기본 피부톤',
        2: '밝은 피부톤',
        3: '약간 밝은 피부톤',
        4: '중간 피부톤',
        5: '약간 어두운 피부톤',
        6: '어두운 피부톤'
    }
};

// 에디터 커서 위치에 이모지 삽입 함수
function insertEmoji(emoji) {
    const view = window.cmEditor;
    if (!view) return;
    
    // 1. 에디터 강제 포커싱
    view.focus();
    
    const state = view.state;
    const range = state.selection ? state.selection.main : null;
    
    // 커서 위치 획득 (유실 시 문서 맨 끝으로 대체)
    const from = range ? range.from : state.doc.length;
    const to = range ? range.to : state.doc.length;
    
    view.dispatch({
        changes: { from: from, to: to, insert: emoji },
        selection: { anchor: from + emoji.length }
    });
    
    // 포커스 유지
    view.focus();
    
    const dropdown = document.getElementById('toolbar-emoji-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// 이모지 피커 동적 마운트 및 렌더링 (EmojiMart.Picker 자바스크립트 인스턴스 방식 사용)
function renderEmojiPicker(force = false, theme = null, lang = null) {
    const container = document.getElementById('toolbar-emoji-menu');
    if (!container) return;
    
    // 만약 force가 아니고 이미 생성되어 있다면 추가 렌더링 생략 (중복 생성 방지)
    if (!force && container.children.length > 0) {
        return;
    }
    
    // 1. 기존 피커 제거
    container.innerHTML = "";
    
    // 주입된 상태 우선 적용 (폴백: 전역 window 상태 혹은 기본값)
    const activeTheme = theme || window.currentTheme || 'dark';
    const activeLang = lang || window.currentLang || 'ko';
    
    // 2. EmojiMart.Picker를 생성자를 통해 완벽한 셋팅으로 인스턴스화
    const picker = new EmojiMart.Picker({
        theme: activeTheme,
        set: 'native',
        perLine: 10,
        maxFrequentRows: 3,
        emojiSize: 22,
        emojiButtonSize: 34,
        categories: ['frequent', 'smileys', 'people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags'],
        data: async () => {
            const response = await fetch('/static/js/emoji-data.json');
            return await response.json();
        },
        i18n: activeLang === 'ko' ? emojiI18nKo : undefined,
        onEmojiSelect: (emojiData) => {
            const data = emojiData.detail ? emojiData.detail : emojiData;
            const emoji = data?.native || data?.emoji?.native || data?.unicode;
            if (emoji) {
                insertEmoji(emoji);
            }
        }
    });

    
    // 3. 인스턴스의 크기 및 테두리 스타일 커스터마이징
    picker.style.display = 'block';
    picker.style.border = 'none';
    picker.style.width = '100%';
    picker.style.height = '400px';
    picker.style.setProperty('--shadow', 'none');
    picker.style.setProperty('--border-radius', '12px');


    
    // 4. 컨테이너에 안전하게 삽입
    container.appendChild(picker);
}

// 이모지 선택 이벤트 초기화 (사용자 첫 클릭 시 렉을 없애기 위해 백그라운드 선행 렌더링 적용)
function initEmojiPicker() {
    if (typeof EmojiMart === 'undefined') {
        setTimeout(initEmojiPicker, 200);
        return;
    }
    // 페이지 로드 후 600ms 뒤에 백그라운드에서 조용히 선행 렌더링을 마쳐놓습니다.
    setTimeout(() => {
        const activeTheme = window.currentTheme || 'dark';
        const activeLang = window.currentLang || 'ko';
        renderEmojiPicker(false, activeTheme, activeLang);
    }, 600);
}


// 윈도우 스코프 바인딩
window.insertEmoji = insertEmoji;
window.renderEmojiPicker = renderEmojiPicker;

// 스크립트 실행 즉시 초기화 기동
initEmojiPicker();
