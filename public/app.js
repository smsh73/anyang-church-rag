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
        
        // 응답이 성공인지 먼저 확인
        if (!response.ok) {
            // 에러 응답 처리
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패 시 텍스트로 읽기 시도
                try {
                    const text = await response.text();
                    if (text) errorMessage = text;
                } catch (e2) {
                    // 텍스트도 읽을 수 없으면 기본 메시지 사용
                }
            }
            throw new Error(errorMessage);
        }
        
        // 성공 응답만 JSON 파싱
        const data = await response.json();
        
        progressFill.style.width = '100%';
        progressText.textContent = '완료!';
        
        if (data.success) {
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
            throw new Error(data.error || '처리 실패');
        }
    } catch (error) {
        clearInterval(progressInterval);
        progressFill.style.width = '0%';
        progressText.textContent = '오류 발생';
        result.classList.remove('hidden');
        result.className = 'result error';
        
        // 에러 메시지 파싱 (개행 문자 처리)
        let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
        const errorLines = errorMessage.split('\n');
        const mainError = errorLines[0];
        const suggestions = errorLines.slice(1).filter(line => line.trim().startsWith('해결 방법:') || line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.'));
        
        let errorHTML = `
            <h3>❌ 오류 발생</h3>
            <p><strong>오류 메시지:</strong> ${mainError}</p>
        `;
        
        // 해결 방법이 있으면 표시
        if (suggestions.length > 0) {
            errorHTML += `
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
                    <strong>💡 해결 방법:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${suggestions.map(s => `<li>${s.replace(/^\d+\.\s*/, '')}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // YouTube Data API 키 관련 안내
        if (errorMessage.includes('다운로드') || errorMessage.includes('410') || errorMessage.includes('403')) {
            errorHTML += `
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                    <strong>📌 YouTube Data API 키 설정 (권장):</strong>
                    <p style="margin: 5px 0;">YouTube Data API 키를 설정하면 더 안정적으로 자막을 가져올 수 있습니다.</p>
                    <ol style="margin: 5px 0; padding-left: 20px;">
                        <li>Google Cloud Console에서 API 키 생성</li>
                        <li>YouTube Data API v3 활성화</li>
                        <li>Azure App Service에 YOUTUBE_API_KEY 환경 변수 설정</li>
                    </ol>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #666;">
                        자세한 내용은 <a href="YOUTUBE_API_SETUP.md" target="_blank">YOUTUBE_API_SETUP.md</a>를 참고하세요.
                    </p>
                </div>
            `;
        }
        
        errorHTML += `
            <p style="margin-top: 15px;"><small>자세한 내용은 브라우저 콘솔 또는 서버 로그를 확인하세요.</small></p>
        `;
        
        result.innerHTML = errorHTML;
        console.error('벡터 임베딩 오류:', error);
        console.error('에러 상세:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
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
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        apiKeys = data.keys || [];
        renderApiKeys();
    } catch (error) {
        console.error('API 키 로드 실패:', error);
        const container = document.getElementById('api-keys-list');
        if (container) {
            container.innerHTML = `<p style="color: #e74c3c;">API 키를 불러올 수 없습니다: ${error.message}</p>`;
        }
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
    const modal = document.getElementById('add-key-modal');
    if (modal) {
        modal.classList.remove('hidden');
        console.log('모달 열림:', modal);
    } else {
        console.error('모달 요소를 찾을 수 없습니다');
    }
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
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                errorMessage = data.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패
            }
            alert('저장 실패: ' + errorMessage);
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
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
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
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                errorMessage = data.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (data.success) {
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

// 배치 처리 - 채널
document.getElementById('batch-channel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const channelUrl = document.getElementById('channel-url').value;
    const keyword = document.getElementById('channel-keyword').value.trim() || null;
    const maxVideos = document.getElementById('channel-max-videos').value ? parseInt(document.getElementById('channel-max-videos').value) : null;
    const autoIndex = document.getElementById('channel-auto-index').checked;
    
    const submitBtn = document.getElementById('batch-channel-btn');
    const progress = document.getElementById('batch-channel-progress');
    const progressFill = document.getElementById('batch-channel-progress-fill');
    const progressText = document.getElementById('batch-channel-progress-text');
    const result = document.getElementById('batch-channel-result');
    
    submitBtn.disabled = true;
    progress.classList.remove('hidden');
    result.classList.add('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = '채널 동영상 목록 가져오는 중...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/batch/channel/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelUrl,
                keyword,
                maxVideos,
                autoIndex,
                delayBetweenVideos: 5000
            })
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                errorMessage = data.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        progressFill.style.width = '100%';
        progressText.textContent = '완료!';
        
        if (data.success) {
            result.classList.remove('hidden');
            result.className = 'result success';
            result.innerHTML = `
                <h3>✅ 채널 배치 처리 완료</h3>
                <p><strong>총 동영상:</strong> ${data.total}개</p>
                <p><strong>성공:</strong> ${data.processed}개</p>
                <p><strong>실패:</strong> ${data.failed}개</p>
                ${data.results && data.results.length > 0 ? `
                    <details>
                        <summary>처리 결과 상세 (${data.results.length}개)</summary>
                        <div style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
                            ${data.results.map((r, i) => `
                                <div style="padding: 10px; margin: 5px 0; border-left: 3px solid ${r.success ? '#27ae60' : '#e74c3c'}; background: #f8f9fa;">
                                    <strong>${i + 1}. ${r.title || r.videoId}</strong>
                                    ${r.success ? `
                                        <p style="margin: 5px 0; color: #27ae60;">✅ 성공</p>
                                        <small>청크: ${r.stats?.totalChunks || 0}개, 문단: ${r.stats?.totalParagraphs || 0}개</small>
                                    ` : `
                                        <p style="margin: 5px 0; color: #e74c3c;">❌ 실패: ${r.error || '알 수 없는 오류'}</p>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}
            `;
        } else {
            throw new Error(data.error || '처리 실패');
        }
    } catch (error) {
        progressFill.style.width = '0%';
        progressText.textContent = '오류 발생';
        result.classList.remove('hidden');
        result.className = 'result error';
        result.innerHTML = `
            <h3>❌ 오류 발생</h3>
            <p><strong>오류 메시지:</strong> ${error.message}</p>
            <p style="margin-top: 15px;"><small>자세한 내용은 브라우저 콘솔 또는 서버 로그를 확인하세요.</small></p>
        `;
        console.error('채널 배치 처리 오류:', error);
    } finally {
        submitBtn.disabled = false;
        setTimeout(() => {
            progress.classList.add('hidden');
        }, 2000);
    }
});

// 배치 처리 - 재생목록
document.getElementById('batch-playlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const playlistUrl = document.getElementById('playlist-url').value;
    const keyword = document.getElementById('playlist-keyword').value.trim() || null;
    const maxVideos = document.getElementById('playlist-max-videos').value ? parseInt(document.getElementById('playlist-max-videos').value) : null;
    const autoIndex = document.getElementById('playlist-auto-index').checked;
    
    const submitBtn = document.getElementById('batch-playlist-btn');
    const progress = document.getElementById('batch-playlist-progress');
    const progressFill = document.getElementById('batch-playlist-progress-fill');
    const progressText = document.getElementById('batch-playlist-progress-text');
    const result = document.getElementById('batch-playlist-result');
    
    submitBtn.disabled = true;
    progress.classList.remove('hidden');
    result.classList.add('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = '재생목록 동영상 목록 가져오는 중...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/batch/playlist/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playlistUrl,
                keyword,
                maxVideos,
                autoIndex,
                delayBetweenVideos: 5000
            })
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const data = await response.json();
                errorMessage = data.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        progressFill.style.width = '100%';
        progressText.textContent = '완료!';
        
        if (data.success) {
            result.classList.remove('hidden');
            result.className = 'result success';
            result.innerHTML = `
                <h3>✅ 재생목록 배치 처리 완료</h3>
                <p><strong>총 동영상:</strong> ${data.total}개</p>
                <p><strong>성공:</strong> ${data.processed}개</p>
                <p><strong>실패:</strong> ${data.failed}개</p>
                ${data.results && data.results.length > 0 ? `
                    <details>
                        <summary>처리 결과 상세 (${data.results.length}개)</summary>
                        <div style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
                            ${data.results.map((r, i) => `
                                <div style="padding: 10px; margin: 5px 0; border-left: 3px solid ${r.success ? '#27ae60' : '#e74c3c'}; background: #f8f9fa;">
                                    <strong>${i + 1}. ${r.title || r.videoId}</strong>
                                    ${r.success ? `
                                        <p style="margin: 5px 0; color: #27ae60;">✅ 성공</p>
                                        <small>청크: ${r.stats?.totalChunks || 0}개, 문단: ${r.stats?.totalParagraphs || 0}개</small>
                                    ` : `
                                        <p style="margin: 5px 0; color: #e74c3c;">❌ 실패: ${r.error || '알 수 없는 오류'}</p>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}
            `;
        } else {
            throw new Error(data.error || '처리 실패');
        }
    } catch (error) {
        progressFill.style.width = '0%';
        progressText.textContent = '오류 발생';
        result.classList.remove('hidden');
        result.className = 'result error';
        result.innerHTML = `
            <h3>❌ 오류 발생</h3>
            <p><strong>오류 메시지:</strong> ${error.message}</p>
            <p style="margin-top: 15px;"><small>자세한 내용은 브라우저 콘솔 또는 서버 로그를 확인하세요.</small></p>
        `;
        console.error('재생목록 배치 처리 오류:', error);
    } finally {
        submitBtn.disabled = false;
        setTimeout(() => {
            progress.classList.add('hidden');
        }, 2000);
    }
});
