// API клиент для взаимодействия с backend

class APIClient {
    constructor() {
        this.baseURL = '';
        this.headers = {
            'Content-Type': 'application/json'
        };
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.headers,
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async postFormData(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData,
            headers: {} // Убираем Content-Type для FormData
        });
    }
    
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// WebSocket клиент для real-time обновлений
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.handlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Добавляем мгновенную обработку сообщений без debouncing
        this.messageQueue = [];
        this.debounceTimer = null;
        this.debounceDelay = 0; // Убираем задержку - мгновенная обработка
        this.lastProcessedTime = 0;
    }
    
    connect() {
        // Автоматически определяем протокол и учитываем прокси путь
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const basePath = window.location.pathname.replace(/\/$/, '');
        const wsUrl = `${protocol}//${window.location.host}${basePath}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.emit('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Обработка событий извлечения требований
                    if (data.type === 'extraction_progress' && window.requirementsEditor) {
                        window.requirementsEditor.updateExtractionProgress(data.data);
                    }
                    else if (data.type === 'extraction_complete') {
                        console.log('Извлечение требований завершено:', data.data);
                    }
                    else if (data.type === 'extraction_error') {
                        alert('Ошибка извлечения: ' + data.data.error);
                        if (window.requirementsEditor) {
                            window.requirementsEditor.resetExtraction();
                        }
                    }
                    
                    // Мгновенная обработка без очередей
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.emit('disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        } else {
            console.warn('WebSocket is not connected');
        }
    }
    
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.handlers.has(event)) {
            const handlers = this.handlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.handlers.has(event)) {
            this.handlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in WebSocket handler for ${event}:`, error);
                }
            });
        }
    }
    
    queueMessage(message) {
        this.messageQueue.push({
            ...message,
            timestamp: Date.now()
        });
        
        // Ограничиваем размер очереди
        if (this.messageQueue.length > 20) {
            this.messageQueue = this.messageQueue.slice(-10);
        }
        
        // Запускаем обработку с debouncing
        this.scheduleMessageProcessing();
    }
    
    scheduleMessageProcessing() {
        // Мгновенная обработка без debouncing
        this.processMessageQueue();
    }
    
    processMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        // Группируем сообщения по типу
        const messageGroups = this.messageQueue.reduce((groups, msg) => {
            if (!groups[msg.type]) groups[msg.type] = [];
            groups[msg.type].push(msg);
            return groups;
        }, {});
        
        // Обрабатываем каждую группу
        Object.entries(messageGroups).forEach(([type, messages]) => {
            const bestMessage = this.selectBestMessage(type, messages);
            if (bestMessage) {
                this.handleMessage(bestMessage);
            }
        });
        
        // Очищаем очередь
        this.messageQueue = [];
        this.lastProcessedTime = Date.now();
    }
    
    selectBestMessage(type, messages) {
        if (messages.length === 0) return null;
        if (messages.length === 1) return messages[0];
        
        // Для статусов агента выбираем самый важный
        if (type === 'agent_thought') {
            const priorities = {
                'completing': 6,
                'deciding': 5,
                'reasoning': 4,
                'analyzing': 3,
                'searching': 2,
                'understanding': 1
            };
            
            return messages.reduce((best, current) => {
                const bestPriority = priorities[best.data?.phase] || 0;
                const currentPriority = priorities[current.data?.phase] || 0;
                
                if (currentPriority > bestPriority) return current;
                if (currentPriority === bestPriority && current.timestamp > best.timestamp) return current;
                return best;
            });
        }
        
        // Для остальных типов берем самое свежее
        return messages.reduce((latest, current) => 
            current.timestamp > latest.timestamp ? current : latest
        );
    }

    handleMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'connected':
                this.emit('connected', data);
                break;
            case 'progress_update':
                this.emit('progress', data);
                break;
            case 'agent_thought':
                this.emit('agent_thought', data);
                break;
            case 'agent_command':
                this.emit('agent_command', data);
                break;
            case 'rag_details':
                this.emit('rag_details', data);
                break;
            case 'analysis_complete':
                this.emit('analysis_complete', data);
                break;
            case 'error':
                this.emit('error', data);
                break;
            default:
                console.log('Unknown WebSocket message type:', type);
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max WebSocket reconnection attempts reached');
            this.emit('reconnect_failed');
        }
    }
}

// Интеграция с интерфейсом
class IntegratedAPIClient {
    constructor() {
        this.api = new APIClient();
        this.ws = new WebSocketClient();
        this.setupWebSocketHandlers();
    }
    
    setupWebSocketHandlers() {
        // Обновления прогресса
        this.ws.on('progress', (data) => {
            if (window.auditInterface) {
                window.auditInterface.updateProgress(data.percentage);
                window.auditInterface.updateCurrentRequirement(data.current_requirement);
                
                if (data.agent_status) {
                    window.auditInterface.updateAgentStatus(data.agent_status);
                }
            }
        });
        
        // Мысли агента - только важные сообщения в терминал
        this.ws.on('agent_thought', (data) => {
            console.log('📨 Получена мысль агента:', data);
            
            // Отправляем в НОВЫЙ реальный терминал (только важные статусы)
            if (window.realTerminal) {
                window.realTerminal.showStatus(data);
            }
            
            // Обновляем UI статус для прогресса
            if (window.auditInterface && data.text) {
                window.auditInterface.updateAgentStatus(data.text);
            }
        });
        
        // Команды агента - отправляем в РЕАЛЬНЫЙ терминал БЕЗ ДУБЛЕЙ
        this.ws.on('agent_command', (data) => {
            console.log('📨 Получена команда агента:', data);
            
            if (window.realTerminal) {
                // Полная команда с результатом
                if (data.output !== undefined || data.success !== undefined) {
                    window.realTerminal.showFullCommand(data);
                } 
                // Только команда (без результата)
                else if (data.command) {
                    window.realTerminal.showCommand(data.command, data.comment);
                }
                console.log('✅ Команда отображена в терминале');
            } else {
                console.log('❌ RealTerminal не инициализирован!');
            }
        });
        
        // Детали RAG поиска
        this.ws.on('rag_details', (data) => {
            // Используем умный менеджер для отображения результатов анализа
            if (window.smartStatusManager) {
                window.smartStatusManager.showAnalysisResults(data);
            }
            // Старая система отключена, используем только smartStatusManager
        });
        
        // Результат выполнения команды
        this.ws.on('command_result', (data) => {
            console.log('📨 Получен результат команды:', data);
            
            if (window.realTerminal) {
                window.realTerminal.showCommandOutput(
                    data.output || '',
                    data.success !== false
                );
                console.log('✅ Результат отображен в терминале');
            }
        });
        
        // Завершение анализа
        this.ws.on('analysis_complete', (data) => {
            // Отправляем сообщение в терминал
            if (window.realTerminal) {
                window.realTerminal.showStatus({
                    phase: 'completing',
                    text: data.text || 'Анализ завершен',
                    emotion: data.status || '✅'
                });
                window.realTerminal.addSeparator();
            }
            
            if (window.auditInterface) {
                window.auditInterface.analysisState.isRunning = false;
                window.auditInterface.updateSystemStatus('completed');
                window.auditInterface.showResultsButton();
            }
        });
        
        // Ошибки
        this.ws.on('error', (error) => {
            if (window.auditInterface) {
                window.auditInterface.showNotification(`WebSocket ошибка: ${error.message || error}`, 'error');
            }
        });
        
        // Подключение/отключение
        this.ws.on('connected', () => {
            if (window.auditInterface) {
                window.auditInterface.showNotification('Соединение с сервером установлено', 'success');
            }

            // Переинициализируем SmartStatusManager после подключения
            setTimeout(() => {
                if (window.smartStatusManager && typeof window.smartStatusManager.setupElements === 'function') {
                    console.log('🔄 Переинициализируем SmartStatusManager после подключения');
                    window.smartStatusManager.setupElements();
                    window.smartStatusManager.setIdle();
                } else if (window.SmartStatusManager) {
                    console.log('🔄 Создаем новый экземпляр SmartStatusManager');
                    window.smartStatusManager = new window.SmartStatusManager();
                }
            }, 500); // Увеличиваем задержку для надежности
        });
        
        this.ws.on('disconnected', () => {
            if (window.auditInterface) {
                window.auditInterface.showNotification('Соединение с сервером потеряно', 'warning');
            }
        });
        
        this.ws.on('reconnect_failed', () => {
            if (window.auditInterface) {
                window.auditInterface.showNotification('Не удалось восстановить соединение с сервером', 'error');
            }
        });
    }
    
    connect() {
        this.ws.connect();
    }
    
    disconnect() {
        this.ws.disconnect();
    }
    
    // API методы
    async extractRequirements(formData) {
        return this.api.postFormData('/api/extract-requirements', formData);
    }
    
    async startAudit(data) {
        return this.api.post('/api/start-audit', data);
    }
    
    async getProgress() {
        return this.api.get('/api/progress');
    }
    
    async getResults() {
        return this.api.get('/api/results');
    }
    
    async stopAudit() {
        return this.api.post('/api/stop-audit', {});
    }
    
    async pauseAudit() {
        return this.api.post('/api/pause-audit', {});
    }
    
    async resumeAudit() {
        return this.api.post('/api/resume-audit', {});
    }
    
    async getSystemStatus() {
        return this.api.get('/api/status');
    }
    
    async getProjectInfo(projectId) {
        return this.api.get(`/api/projects/${projectId}`);
    }
    
    async getQualityMetrics(projectId) {
        return this.api.get(`/api/projects/${projectId}/quality-metrics`);
    }
    
    async getArchitectureAnalysis(projectId) {
        return this.api.get(`/api/projects/${projectId}/architecture`);
    }
    
    async downloadResults(projectId, format = 'csv') {
        const response = await fetch(`/api/projects/${projectId}/export?format=${format}`);
        
        if (!response.ok) {
            throw new Error(`Failed to download results: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_results_${projectId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

// Глобальная инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.apiClient = new IntegratedAPIClient();
    
    // Автоматически подключаемся к WebSocket
    window.apiClient.connect();
    
    // Интегрируем API клиент с основным интерфейсом
    if (window.auditInterface) {
        // Переопределяем методы для использования нового API клиента
        const originalExtractRequirements = window.auditInterface.extractRequirements.bind(window.auditInterface);
        const originalStartAudit = window.auditInterface.startAudit.bind(window.auditInterface);
        const originalShowResults = window.auditInterface.showResults.bind(window.auditInterface);
        
        window.auditInterface.extractRequirements = async function() {
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
                
                const result = await window.apiClient.extractRequirements(formData);
                
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
        };
        
        window.auditInterface.startAudit = async function() {
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
            
            // Запускаем агента
            // Сообщаем умному менеджеру о начале анализа
            if (window.smartStatusManager) {
                window.smartStatusManager.setAnalyzing('Комплексный анализ требований');
            }
            // Старая система отключена, используем только smartStatusManager
            
            try {
                const settings = this.getAnalysisSettings();
                
                const result = await window.apiClient.startAudit({
                    project_name: this.projectName,
                    settings: settings
                });
                
                if (result.success) {
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
        };
        
        window.auditInterface.showResults = async function() {
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.style.display = 'block';
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            try {
                const results = await window.apiClient.getResults();
                
                if (results.success) {
                    this.displayResults(results.data);
                } else {
                    throw new Error(results.error || 'Ошибка получения результатов');
                }
            } catch (error) {
                console.error('Ошибка получения результатов:', error);
                this.showNotification(`Ошибка: ${error.message}`, 'error');
            }
        };
        
        // Добавляем методы для скачивания результатов
        window.auditInterface.downloadResults = async function(format = 'csv') {
            try {
                await window.apiClient.downloadResults(this.session_state?.project_id, format);
                this.showNotification(`Результаты скачаны в формате ${format.toUpperCase()}`, 'success');
            } catch (error) {
                console.error('Ошибка скачивания результатов:', error);
                this.showNotification(`Ошибка скачивания: ${error.message}`, 'error');
            }
        };
    }
    
    // Обработчик закрытия страницы
    window.addEventListener('beforeunload', () => {
        if (window.apiClient) {
            window.apiClient.disconnect();
        }
    });
});