// Основная логика интерфейса интеллектуального аудитора

class AuditInterface {
    constructor() {
        this.projectFile = null;
        this.requirementsFile = null;
        this.projectName = '';
        this.currentStep = 'upload';
        this.analysisState = {
            isRunning: false,
            currentRequirement: 0,
            totalRequirements: 0,
            results: []
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFileUpload();
        this.setupSliders();
        this.updateSystemStatus('ready');
    }

    setupEventListeners() {
        // Кнопки основных действий
        document.getElementById('extract-requirements-btn')?.addEventListener('click', () => {
            this.extractRequirements();
        });

        document.getElementById('start-audit-btn')?.addEventListener('click', () => {
            this.startAudit();
        });

        document.getElementById('show-results-btn')?.addEventListener('click', () => {
            this.showResults();
        });

        // Поле названия проекта
        document.getElementById('project-name')?.addEventListener('input', (e) => {
            this.projectName = e.target.value;
            this.validateInputs();
        });

        // Контролы агента
        document.getElementById('pause-btn')?.addEventListener('click', () => {
            this.pauseAnalysis();
        });

        document.getElementById('stop-btn')?.addEventListener('click', () => {
            this.stopAnalysis();
        });

        // Настройки провайдера ИИ
        document.querySelectorAll('input[name="ai-provider"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateAIProvider(e.target.value);
            });
        });

        // Закрытие модального окна
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Escape для закрытия модального окна
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    setupFileUpload() {
        // Загрузка проекта
        const projectFileInput = document.getElementById('project-file');
        const projectUploadArea = document.querySelector('#project-upload .upload-area');

        if (projectFileInput && projectUploadArea) {
            // Drag & Drop
            projectUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                projectUploadArea.classList.add('drag-over');
            });

            projectUploadArea.addEventListener('dragleave', () => {
                projectUploadArea.classList.remove('drag-over');
            });

            projectUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                projectUploadArea.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleProjectFile(files[0]);
                }
            });

            projectFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleProjectFile(e.target.files[0]);
                }
            });
        }

        // Загрузка требований
        const requirementsFileInput = document.getElementById('requirements-file');
        const requirementsUploadArea = document.querySelector('#requirements-upload .upload-area');

        if (requirementsFileInput && requirementsUploadArea) {
            // Drag & Drop
            requirementsUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                requirementsUploadArea.classList.add('drag-over');
            });

            requirementsUploadArea.addEventListener('dragleave', () => {
                requirementsUploadArea.classList.remove('drag-over');
            });

            requirementsUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                requirementsUploadArea.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleRequirementsFile(files[0]);
                }
            });

            requirementsFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleRequirementsFile(e.target.files[0]);
                }
            });
        }
    }

    setupSliders() {
        // Слайдер размера файла
        const maxFileSizeSlider = document.getElementById('max-file-size');
        if (maxFileSizeSlider) {
            maxFileSizeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueDisplay = maxFileSizeSlider.parentElement.querySelector('.slider-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${value} МБ`;
                }
            });
        }

        // Слайдер параллелизма убран (многопоточность отключена)
        /*
        const maxWorkersSlider = document.getElementById('max-workers');
        if (maxWorkersSlider) {
            maxWorkersSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueDisplay = maxWorkersSlider.parentElement.querySelector('.slider-value');
                if (valueDisplay) {
                    const label = value === '1' ? 'поток' : value < 5 ? 'потока' : 'потоков';
                    valueDisplay.textContent = `${value} ${label}`;
                }
            });
        }
        */
    }

    handleProjectFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            this.showNotification('Поддерживаются только ZIP-архивы', 'error');
            return;
        }

        if (file.size > 500 * 1024 * 1024) { // 500 MB
            this.showNotification('Размер файла не должен превышать 500 МБ', 'error');
            return;
        }

        this.projectFile = file;
        this.showFileInfo('project', file);
        this.validateInputs();
        this.showNotification(`Загружен проект: ${file.name}`, 'success');
    }

    handleRequirementsFile(file) {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
            this.showNotification('Поддерживаются только файлы PDF, DOCX или TXT', 'error');
            return;
        }

        this.requirementsFile = file;
        this.showFileInfo('requirements', file);
        this.validateInputs();
        this.showNotification(`Загружены требования: ${file.name}`, 'success');
    }

    showFileInfo(type, file) {
        const uploadArea = document.querySelector(`#${type}-upload`);
        const fileInfo = document.querySelector(`#${type}-info`);
        const filename = fileInfo?.querySelector('.filename');

        if (uploadArea && fileInfo && filename) {
            uploadArea.style.display = 'none';
            fileInfo.style.display = 'flex';
            filename.textContent = file.name;
        }
    }

    removeFile(type) {
        if (type === 'project') {
            this.projectFile = null;
            document.getElementById('project-file').value = '';
        } else if (type === 'requirements') {
            this.requirementsFile = null;
            document.getElementById('requirements-file').value = '';
        }

        const uploadArea = document.querySelector(`#${type}-upload`);
        const fileInfo = document.querySelector(`#${type}-info`);

        if (uploadArea && fileInfo) {
            uploadArea.style.display = 'block';
            fileInfo.style.display = 'none';
        }

        this.validateInputs();
    }

    validateInputs() {
        const extractBtn = document.getElementById('extract-requirements-btn');
        const isValid = this.projectFile && this.requirementsFile && this.projectName.trim();

        if (extractBtn) {
            extractBtn.disabled = !isValid;
        }
    }

    async extractRequirements() {
        if (!this.projectFile || !this.requirementsFile || !this.projectName.trim()) {
            this.showNotification('Заполните все поля и загрузите файлы', 'error');
            return;
        }

        this.updateSystemStatus('processing');
        this.showNotification('Извлекаю требования из документа...', 'info');

        try {
            const formData = new FormData();
            formData.append('project_file', this.projectFile);
            formData.append('requirements_file', this.requirementsFile);
            formData.append('project_name', this.projectName.trim());

            // Добавляем API ключ и провайдер
            const apiKey = document.getElementById('api-key')?.value || '';
            const aiProvider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'gemini';

            formData.append('api_key', apiKey);
            formData.append('ai_provider', aiProvider);

            console.log(`🤖 Извлечение требований через ${aiProvider}`);

            const apiUrl = `${window.API_BASE_URL || ''}/api/extract-requirements`;
            console.log(`📡 API URL: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.analysisState.totalRequirements = result.requirements.length;
                this.showNotification(`Извлечено ${result.requirements.length} требований`, 'success');
                this.showStartAuditButton();
                this.updateSystemStatus('ready');
            } else {
                throw new Error(result.error || 'Ошибка извлечения требований');
            }
        } catch (error) {
            console.error('Ошибка извлечения требований:', error);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
            this.updateSystemStatus('error');
        }
    }

    showStartAuditButton() {
        const extractBtn = document.getElementById('extract-requirements-btn');
        const startBtn = document.getElementById('start-audit-btn');

        if (extractBtn && startBtn) {
            extractBtn.style.display = 'none';
            startBtn.style.display = 'inline-flex';
        }
    }

    async startAudit() {
        if (this.analysisState.isRunning) {
            this.showNotification('Анализ уже выполняется', 'warning');
            return;
        }

        this.analysisState.isRunning = true;
        this.analysisState.currentRequirement = 0;
        this.analysisState.results = [];

        this.showAnalysisSection();
        this.updateSystemStatus('analyzing');
        this.updateAgentStatus('Начинаю интеллектуальный анализ...');

        try {
            const settings = this.getAnalysisSettings();

            const response = await fetch(`${window.API_BASE_URL || ''}/api/start-audit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_name: this.projectName,
                    settings: settings
                })
            });

            const result = await response.json();

            if (result.success) {
                // WebSocket автоматически получит обновления прогресса - НЕ НУЖЕН monitorProgress
                this.showNotification('Анализ запущен успешно', 'success');
            } else {
                throw new Error(result.error || 'Ошибка запуска анализа');
            }
        } catch (error) {
            console.error('Ошибка запуска анализа:', error);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
            this.analysisState.isRunning = false;
            this.updateSystemStatus('error');
        }
    }

    getAnalysisSettings() {
        return {
            ai_provider: document.querySelector('input[name="ai-provider"]:checked')?.value || 'gemini',
            api_key: document.getElementById('api-key')?.value || '',
            max_file_size: parseInt(document.getElementById('max-file-size')?.value || '20'),
            max_workers: 1,  // Фиксированное значение, многопоточность отключена
            architecture_analysis: document.getElementById('architecture-analysis')?.checked || false,
            quality_metrics: document.getElementById('quality-metrics')?.checked || false,
            banking_commands: document.getElementById('banking-commands')?.checked || false
        };
    }

    showAnalysisSection() {
        const analysisSection = document.getElementById('analysis-section');
        if (analysisSection) {
            analysisSection.style.display = 'block';
            analysisSection.scrollIntoView({ behavior: 'smooth' });
        }

        // Скрываем кнопку запуска
        const startBtn = document.getElementById('start-audit-btn');
        if (startBtn) {
            startBtn.style.display = 'none';
        }
    }

    // УДАЛЕНО: async monitorProgress() - заменено на WebSocket в api.js
    // Старая система опроса /api/progress удалена для предотвращения конфликтов

    updateProgress(percentage) {
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
    }

    updateCurrentRequirement(requirement) {
        const currentRequirement = document.getElementById('current-requirement');
        if (currentRequirement) {
            currentRequirement.textContent = requirement;
        }
    }

    updateAgentStatus(status) {
        // Обновляем как старый элемент, так и SmartStatusManager
        const agentStatus = document.getElementById('agent-status');
        if (agentStatus) {
            agentStatus.textContent = status;
        }

        // Обновляем SmartStatusManager с правильным определением фазы
        if (this.smartStatusManager && typeof this.smartStatusManager.updateStatus === 'function') {
            // Определяем фазу анализа на основе текста статуса
            let phase = 'analyzing';
            let emotion = '🤔';

            if (status.includes('Готов к работе') || status.includes('готов')) {
                phase = 'idle';
                emotion = '🤖';
            } else if (status.includes('Начинаю') || status.includes('начинаю')) {
                phase = 'understanding';
                emotion = '🚀';
            } else if (status.includes('Анализирую') || status.includes('анализ')) {
                phase = 'analyzing';
                emotion = '🔍';
            } else if (status.includes('Ищу') || status.includes('поиск')) {
                phase = 'searching';
                emotion = '🔎';
            } else if (status.includes('Завершен') || status.includes('завершен')) {
                phase = 'completing';
                emotion = '✅';
            }

            this.smartStatusManager.updateStatus({
                phase: phase,
                text: status,
                emotion: emotion,
                source: 'main_interface'
            });
        }
    }

    updateSystemStatus(status) {
        const statusDot = document.getElementById('system-status');
        const statusText = document.getElementById('status-text');

        const statusConfig = {
            ready: { color: '#10b981', text: 'Система готова' },
            processing: { color: '#f59e0b', text: 'Обработка...' },
            analyzing: { color: '#6b7280', text: 'Анализ выполняется' },
            completed: { color: '#10b981', text: 'Анализ завершен' },
            error: { color: '#ef4444', text: 'Ошибка системы' }
        };

        const config = statusConfig[status] || statusConfig.ready;

        if (statusDot) {
            statusDot.style.backgroundColor = config.color;
        }

        if (statusText) {
            statusText.textContent = config.text;
        }
    }

    showResultsButton() {
        const showResultsBtn = document.getElementById('show-results-btn');
        if (showResultsBtn) {
            showResultsBtn.style.display = 'inline-flex';
        }
    }

    async showResults() {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }

        try {
            const response = await fetch(`${window.API_BASE_URL || ''}/api/results`);
            const results = await response.json();

            if (results.success) {
                this.displayResults(results.data);
            } else {
                throw new Error(results.error || 'Ошибка получения результатов');
            }
        } catch (error) {
            console.error('Ошибка получения результатов:', error);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    displayResults(results) {
        // Обновляем SmartStatusManager с реальными результатами
        if (this.smartStatusManager) {
            this.smartStatusManager.showAnalysisResults({
                results: results,
                totalResults: results ? results.length : 0,
                filesCount: this.getUniqueFilesCount(results)
            });
        }

        // Обновляем сводку
        const passed = results.filter(r => r.status === '✅').length;
        const failed = results.filter(r => r.status === '❌').length;
        const unclear = results.filter(r => r.status === '❓').length;

        document.getElementById('passed-count').textContent = passed;
        document.getElementById('failed-count').textContent = failed;
        document.getElementById('unclear-count').textContent = unclear;
        document.getElementById('total-count').textContent = results.length;

        // Заполняем таблицу результатов
        const tbody = document.getElementById('results-tbody');
        if (tbody) {
            tbody.innerHTML = '';

            results.forEach((result, index) => {
                const row = document.createElement('tr');
                row.className = this.getRowClass(result.status);

                row.innerHTML = `
                    <td>${result.requirement}</td>
                    <td><span class="status-badge ${this.getStatusClass(result.status)}">${result.status}</span></td>
                    <td>${this.truncateText(result.explanation || result.ai_analysis, 100)}</td>
                    <td>
                        <button class="btn btn-info" onclick="auditInterface.showDetails(${index})">
                            <i class="fas fa-eye"></i> Детали
                        </button>
                    </td>
                `;

                tbody.appendChild(row);
            });
        }

        // Сохраняем результаты для показа деталей
        this.analysisState.results = results;
    }

    getRowClass(status) {
        switch (status) {
            case '✅': return 'row-success';
            case '❌': return 'row-danger';
            case '❓': return 'row-warning';
            default: return '';
        }
    }

    getUniqueFilesCount(results) {
        if (!results) return 0;
        const files = new Set();
        results.forEach(result => {
            if (result.scanned_files) {
                const fileList = result.scanned_files.split(',');
                fileList.forEach(file => files.add(file.trim()));
            }
        });
        return files.size;
    }

    getStatusClass(status) {
        switch (status) {
            case '✅': return 'success';
            case '❌': return 'error';
            case '❓': return 'warning';
            default: return 'info';
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    showDetails(index) {
        const result = this.analysisState.results[index];
        if (!result) return;

        const modal = document.getElementById('details-modal');
        const title = document.getElementById('modal-title');
        const analysisContent = document.getElementById('modal-analysis-content');

        if (modal && title && analysisContent) {
            title.textContent = `Детали: ${result.requirement}`;

            // Пытаемся распарсить AI анализ
            let aiAnalysisFormatted = '';
            try {
                if (result.ai_analysis) {
                    let jsonData = null;
                    if (typeof result.ai_analysis === 'object') {
                        jsonData = result.ai_analysis;
                    } else if (typeof result.ai_analysis === 'string') {
                        // Очищаем от markdown блоков ```json ... ```
                        let cleanJson = result.ai_analysis;
                        // Ищем контент внутри ```...```
                        const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                        if (codeBlockMatch) {
                            cleanJson = codeBlockMatch[1];
                        }

                        // Пытаемся найти JSON внутри строки (если там просто текст с JSON)
                        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            jsonData = JSON.parse(jsonMatch[0]);
                        } else {
                            jsonData = JSON.parse(cleanJson);
                        }
                    }

                    if (jsonData) {
                        // Красиво форматируем
                        aiAnalysisFormatted = '<div style="line-height: 1.8;">';
                        if (jsonData.status) {
                            aiAnalysisFormatted += `<div>
                                <strong>Статус:</strong> <span class="status-badge ${this.getStatusClass(jsonData.status)}">${jsonData.status}</span>
                                <span style="margin-left: 10px; font-size: 0.9em; color: #666;">
                                    (Уверенность: <strong>${Math.round((jsonData.confidence || result.confidence || 0) * 100)}%</strong>)
                                </span>
                            </div>`;
                        }
                        if (jsonData.findings && Array.isArray(jsonData.findings)) {
                            aiAnalysisFormatted += '<div style="margin-top: 1rem;"><strong>Обнаружено:</strong><ul style="margin-top: 0.5rem; padding-left: 1.5rem;">';
                            jsonData.findings.forEach(finding => {
                                aiAnalysisFormatted += `<li style="margin-bottom: 0.5rem;">${finding}</li>`;
                            });
                            aiAnalysisFormatted += '</ul></div>';
                        }
                        if (jsonData.recommendations && Array.isArray(jsonData.recommendations)) {
                            aiAnalysisFormatted += '<div style="margin-top: 1rem;"><strong>Рекомендации:</strong><ul style="margin-top: 0.5rem; padding-left: 1.5rem;">';
                            jsonData.recommendations.forEach(rec => {
                                aiAnalysisFormatted += `<li style="margin-bottom: 0.5rem;">${rec}</li>`;
                            });
                            aiAnalysisFormatted += '</ul></div>';
                        }
                        aiAnalysisFormatted += '</div>';
                    }
                }
            } catch (e) {
                // Если не JSON, оставляем как есть
            }

            analysisContent.innerHTML = `
                <div class="detail-block">
                    <h4>Вердикт ИИ</h4>
                    <div class="ai-analysis">${aiAnalysisFormatted}</div>
                </div>
                <div class="detail-block">
                    <h4>Обоснование</h4>
                    <div class="markdown-content">${marked.parse(result.reasoning || result.details || result.explanation || 'Нет данных')}</div>
                </div>
                ${result.observations && result.observations.length > 0 ? `
                <div class="detail-block">
                    <h4>Находки агента</h4>
                    <ul class="observations-list">
                        ${result.observations.map(obs => `
                            <li>
                                <strong>${obs.observation}</strong>
                                <br>
                                <small class="code-location">📍 ${obs.location.file}:${obs.location.line}</small>
                                <pre class="code-snippet"><code>${this.escapeHtml(obs.location.snippet)}</code></pre>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
            `;

            // Инициализация чата
            this.currentChatRequirement = result;
            this.currentChatHistory = [];

            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
                chatContainer.innerHTML = '<div class="chat-message system">Задайте вопрос по этому требованию. Агент может изучить код дополнительно.</div>';
            }

            const contextInfo = document.getElementById('chat-context-info');
            if (contextInfo) {
                const filesCount = result.checked_files ? result.checked_files.length : 0;
                contextInfo.textContent = `Контекст: Агент уже проверил ${filesCount} файлов/фрагментов`;
            }

            modal.style.display = 'block';
        }
    }

    closeModal() {
        const modal = document.getElementById('details-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    pauseAnalysis() {
        if (!this.analysisState.isRunning) return;

        // Здесь можно добавить логику паузы
        this.showNotification('Функция паузы будет добавлена в следующей версии', 'info');
    }

    stopAnalysis() {
        if (!this.analysisState.isRunning) {
            this.showNotification('Анализ не выполняется', 'warning');
            return;
        }

        if (confirm('Вы уверены, что хотите остановить анализ?')) {
            this.analysisState.isRunning = false;
            this.updateSystemStatus('ready');
            this.updateAgentStatus('Анализ остановлен пользователем');
            this.showNotification('Анализ остановлен', 'warning');

            // Отправляем запрос на остановку на сервер
            fetch(`${window.API_BASE_URL || ''}/api/stop-audit`, { method: 'POST' }).catch(console.error);
        }
    }

    updateAIProvider(provider) {
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.placeholder = provider === 'gemini'
                ? 'Введите Gemini API ключ'
                : 'Введите GigaChat токен';
        }

        this.showNotification(`Выбран провайдер: ${provider === 'gemini' ? 'Google Gemini' : 'GigaChat'}`, 'info');
    }
    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || !this.currentChatRequirement) return;

        // Очищаем ввод
        input.value = '';

        // Добавляем сообщение пользователя
        this.appendChatMessage('user', message);
        this.currentChatHistory.push({ role: 'user', content: message });

        // Показываем индикатор загрузки
        const loadingId = 'chat-loading-' + Date.now();
        const chatContainer = document.getElementById('chat-container');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message agent';
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Думаю...';
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const apiKey = document.getElementById('api-key')?.value;
            const aiProvider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'gemini';

            const response = await fetch(`${window.API_BASE_URL || ''}/api/chat-requirement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_name: this.projectName,
                    requirement_text: this.currentChatRequirement.requirement,
                    user_message: message,
                    history: this.currentChatHistory,
                    context_files: this.currentChatRequirement.checked_files || [],
                    api_key: apiKey,
                    ai_provider: aiProvider
                })
            });

            // Удаляем индикатор загрузки
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.remove();

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' || data.success === true) {
                this.appendChatMessage('agent', data.answer);
                this.currentChatHistory.push({ role: 'assistant', content: data.answer });
            } else {
                this.appendChatMessage('error', `Ошибка: ${data.message}`);
            }

        } catch (error) {
            console.error('Chat error:', error);
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.remove();
            this.appendChatMessage('error', 'Не удалось получить ответ от сервера');
        }
    }

    appendChatMessage(role, text) {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        // Обработка markdown для кода
        // Используем marked для рендеринга Markdown
        if (typeof marked !== 'undefined') {
            messageDiv.innerHTML = marked.parse(text);
        } else {
            // Fallback если marked не загрузился
            messageDiv.textContent = text;
        }
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }


    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icon = this.getNotificationIcon(type);

        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;

        notifications.appendChild(notification);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Клик для закрытия
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

// Глобальные функции для доступа из HTML
function removeFile(type) {
    if (window.auditInterface) {
        window.auditInterface.removeFile(type);
    }
}

function closeModal() {
    if (window.auditInterface) {
        window.auditInterface.closeModal();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.auditInterface = new AuditInterface();

    // Интегрируем SmartStatusManager сразу после создания интерфейса
    if (window.smartStatusManager) {
        console.log('✅ Интегрирую SmartStatusManager с AuditInterface');
        window.auditInterface.smartStatusManager = window.smartStatusManager;
    } else {
        console.log('⚠️ SmartStatusManager не найден, будет интегрирован позже');
        // Ждем загрузки SmartStatusManager
        const checkForSmartStatusManager = setInterval(() => {
            if (window.smartStatusManager) {
                console.log('✅ SmartStatusManager найден, интегрирую');
                window.auditInterface.smartStatusManager = window.smartStatusManager;
                clearInterval(checkForSmartStatusManager);
            }
        }, 100);

        // Очищаем проверку через 5 секунд
        setTimeout(() => clearInterval(checkForSmartStatusManager), 5000);
    }

    // Добавляем стили для drag & drop
    const style = document.createElement('style');
    style.textContent = `
        .upload-area.drag-over {
            border-color: var(--primary-color) !important;
            background: rgba(37, 99, 235, 0.1) !important;
            transform: scale(1.02);
        }
        
        .detail-section {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-color);
        }
        
        .detail-section:last-child {
            border-bottom: none;
        }
        
        .detail-section h4 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
            color: var(--text-primary);
            font-size: 1rem;
        }
        
        .detail-section pre {
            background: var(--bg-tertiary);
            padding: 1rem;
            border-radius: var(--radius-md);
            /* УБРАЛИ overflow-x: auto - теперь текст будет переноситься */
            white-space: pre-wrap;  /* Перенос текста */
            word-wrap: break-word;  /* Разрыв длинных слов */
            overflow-wrap: break-word;
            font-size: 0.85rem;
            line-height: 1.6;
            max-width: 100%;
        }
        
        /* Улучшенное форматирование для вердикта ИИ */
        .detail-section p {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            line-height: 1.6;
            max-width: 100%;
        }
        
        .row-success {
            background: rgba(16, 185, 129, 0.05) !important;
        }
        
        .row-danger {
            background: rgba(239, 68, 68, 0.05) !important;
        }
        
        .row-warning {
            background: rgba(245, 158, 11, 0.05) !important;
        }
        
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .status-badge.success {
            background: var(--success-color);
            color: white;
        }
        
        .status-badge.error {
            background: var(--danger-color);
            color: white;
        }
        
        .status-badge.warning {
            background: var(--warning-color);
            color: white;
        }
        
        .status-badge.info {
            background: var(--info-color);
            color: white;
        }
    `;
    document.head.appendChild(style);
});