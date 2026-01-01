const API_BASE_URL = window.location.origin;

// 페이지 전환
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        switchPage(page);
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
}

// 벡터 임베딩 폼
document.getElementById('embedding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('youtube-url').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const autoIndex = document.getElementById('auto-index').checked;
    
    const submitBtn = document.getElementById('submit-btn');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const result = document.getElementById('result');
    
    submitBtn.disabled = true;
    progress.classList.remove('hidden');
    result.classList.add('hidden');
    
    const steps = [
        '자막 추출 중...',
        'AI 보정 중...',
        '텍스트 정리 중...',
        '문단 생성 중...',
        '메타데이터 추출 중...',
        '청킹 중...',
        '메타데이터 추출 중...',
        '벡터 임베딩 생성 중...',
        'PostgreSQL 저장 중...',
        '인덱스 동기화 중...',
        'Azure AI Search 인덱싱 중...'
    ];
    
    let currentStep = 0;
    const updateProgress = () => {
        const percent = (currentStep / steps.length) * 100;
        progressFill.style.width = `${percent}%`;
        progressText.textContent = steps[currentStep] || '완료 중...';
    };
    
    updateProgress();
    const progressInterval = setInterval(() => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            updateProgress();
        }
    }, 3000);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                startTime: startTime || null,
                endTime: endTime || null,
                autoIndex
            })
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = '완료!';
        
        const data = await response.json();
        
        if (response.ok) {
            result.classList.remove('hidden');
            result.className = 'result success';
            result.innerHTML = `
                <h3>✅ 벡터 임베딩 생성 완료</h3>
                <p><strong>비디오 ID:</strong> ${data.videoId}</p>
                <p><strong>처리 방법:</strong> ${data.method}</p>
                <p><strong>총 청크 수:</strong> ${data.stats.totalChunks}개</p>
                <p><strong>임베딩 모델:</strong> ${data.stats.embeddingModel}</p>
                <p><strong>임베딩 차원:</strong> ${data.stats.embeddingDimensions}</p>
                <p><strong>PostgreSQL 저장:</strong> ${data.chunks[0]?.savedToPostgreSQL ? '완료' : '실패'}</p>
                <p><strong>Azure AI Search 인덱싱:</strong> ${data.chunks[0]?.indexed ? '완료' : '스킵'}</p>
                ${data.indexStatus ? `
                    <h4>인덱스 상태:</h4>
                    <pre>${JSON.stringify(data.indexStatus, null, 2)}</pre>
                ` : ''}
                <details>
                    <summary>청크 상세 정보 (${data.chunks.length}개)</summary>
                    <pre>${JSON.stringify(data.chunks.slice(0, 3), null, 2)}</pre>
                </details>
            `;
        } else {
            throw new Error(data.error || '요청 실패');
        }
    } catch (error) {
        clearInterval(progressInterval);
        result.classList.remove('hidden');
        result.className = 'result error';
        result.innerHTML = `
            <h3>❌ 오류 발생</h3>
            <p>${error.message}</p>
        `;
    } finally {
        submitBtn.disabled = false;
        setTimeout(() => {
            progress.classList.add('hidden');
        }, 2000);
    }
});

// API 키 관리
let apiKeys = [];

async function loadApiKeys() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai-keys`);
        const data = await response.json();
        apiKeys = data.keys || [];
        renderApiKeys();
    } catch (error) {
        console.error('API 키 로드 실패:', error);
    }
}

function renderApiKeys() {
    const container = document.getElementById('api-keys-list');
    
    if (apiKeys.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d;">등록된 API 키가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = apiKeys.map(key => `
        <div class="api-key-item">
            <div class="api-key-info">
                <strong>${key.provider.toUpperCase()}</strong>
                ${key.name ? `<small>이름: ${key.name}</small>` : ''}
                <small>상태: ${key.is_active ? '활성' : '비활성'} | 생성일: ${new Date(key.created_at).toLocaleDateString('ko-KR')}</small>
            </div>
            <div class="api-key-actions">
                <button class="btn btn-secondary" onclick="toggleApiKey(${key.id}, ${!key.is_active})">
                    ${key.is_active ? '비활성화' : '활성화'}
                </button>
                <button class="btn btn-danger" onclick="deleteApiKey(${key.id})">삭제</button>
            </div>
        </div>
    `).join('');
}

async function toggleApiKey(id, isActive) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai-keys/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });
        
        if (response.ok) {
            await loadApiKeys();
        } else {
            alert('상태 변경 실패');
        }
    } catch (error) {
        alert('오류: ' + error.message);
    }
}

async function deleteApiKey(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai-keys/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadApiKeys();
        } else {
            alert('삭제 실패');
        }
    } catch (error) {
        alert('오류: ' + error.message);
    }
}

// API 키 추가 모달
document.getElementById('add-key-btn').addEventListener('click', () => {
    document.getElementById('add-key-modal').classList.remove('hidden');
});

document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('add-key-modal').classList.add('hidden');
    document.getElementById('add-key-form').reset();
});

document.getElementById('cancel-add-key').addEventListener('click', () => {
    document.getElementById('add-key-modal').classList.add('hidden');
    document.getElementById('add-key-form').reset();
});

document.getElementById('add-key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const provider = document.getElementById('key-provider').value;
    const name = document.getElementById('key-name').value;
    const apiKey = document.getElementById('key-value').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey, name: name || null })
        });
        
        if (response.ok) {
            document.getElementById('add-key-modal').classList.add('hidden');
            document.getElementById('add-key-form').reset();
            await loadApiKeys();
        } else {
            const data = await response.json();
            alert('저장 실패: ' + (data.error || '알 수 없는 오류'));
        }
    } catch (error) {
        alert('오류: ' + error.message);
    }
});

// 상태 확인
document.getElementById('check-status-btn').addEventListener('click', async () => {
    const result = document.getElementById('status-result');
    result.classList.remove('hidden');
    result.className = 'result';
    result.innerHTML = '<p>확인 중...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/sync/status`);
        const data = await response.json();
        
        if (response.ok) {
            result.className = 'result success';
            result.innerHTML = `
                <h3>시스템 상태</h3>
                <div class="status-item ${data.status.postgreSQL.connected ? 'success' : 'error'}">
                    <strong>PostgreSQL:</strong> ${data.status.postgreSQL.connected ? '연결됨' : '연결 실패'}
                    <br><small>인덱스: ${data.status.postgreSQL.indexes.join(', ')}</small>
                </div>
                ${data.status.azureSearch ? `
                    <div class="status-item ${data.status.azureSearch.error ? 'error' : 'success'}">
                        <strong>Azure AI Search:</strong> ${data.status.azureSearch.error ? '오류' : '정상'}
                        ${!data.status.azureSearch.error ? `
                            <br><small>인덱스: ${data.status.azureSearch.name}</small>
                            <br><small>문서 수: ${data.status.azureSearch.documentCount || 0}</small>
                            <br><small>필드 수: ${data.status.azureSearch.fields || 0}</small>
                        ` : `<br><small>${data.status.azureSearch.error}</small>`}
                    </div>
                ` : ''}
                <pre>${JSON.stringify(data, null, 2)}</pre>
            `;
        } else {
            throw new Error(data.error || '상태 확인 실패');
        }
    } catch (error) {
        result.className = 'result error';
        result.innerHTML = `<h3>오류</h3><p>${error.message}</p>`;
    }
});

// 인덱스 동기화
document.getElementById('sync-btn').addEventListener('click', async () => {
    const target = document.querySelector('input[name="sync-target"]:checked').value;
    const result = document.getElementById('sync-result');
    
    result.classList.remove('hidden');
    result.className = 'result';
    result.innerHTML = '<p>동기화 중...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            result.className = 'result success';
            result.innerHTML = `
                <h3>동기화 완료</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            `;
        } else {
            throw new Error(data.error || '동기화 실패');
        }
    } catch (error) {
        result.className = 'result error';
        result.innerHTML = `<h3>오류</h3><p>${error.message}</p>`;
    }
});

// 설정 페이지 진입 시 API 키 로드
document.querySelector('[data-page="settings"]').addEventListener('click', loadApiKeys);

// 전역 함수로 노출
window.toggleApiKey = toggleApiKey;
window.deleteApiKey = deleteApiKey;
