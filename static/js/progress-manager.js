/**
 * Простой и надежный менеджер прогресса
 * Обновляет UI напрямую без сложных событий
 */

class ProgressManager {
    constructor() {
        this.elements = {
            progressFill: null,
            progressText: null,
            currentRequirement: null,
            agentStatus: null
        };
        
        this.currentProgress = 0;
        this.pollingInterval = null;
        this.wsConnected = false;
        
        this.init();
    }
    
    init() {
        // Ждем загрузку DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
        
        // Запускаем polling как запасной вариант
        this.startPolling();
        
        // Подключаемся к WebSocket
        this.connectWebSocket();
        
        console.log('✅ ProgressManager initialized');
    }
    
    setupElements() {
        this.elements.progressFill = document.getElementById('progress-fill');
        this.elements.progressText = document.querySelector('.progress-percentage');
        this.elements.currentRequirement = document.getElementById('current-requirement');
        this.elements.agentStatus = document.getElementById('agent-status');
        
        // Проверяем наличие элементов
        const missing = [];
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) missing.push(key);
        }
        
        if (missing.length > 0) {
            console.warn('⚠️ Missing elements:', missing);
        } else {
            console.log('✅ All progress elements found');
        }
    }
    
    // Главная функция обновления прогресса
    updateProgress(data) {
        console.log('📊 Updating progress:', data);
        
        // Обновляем процент
        if (data.percentage !== undefined) {
            this.currentProgress = data.percentage;
            
            if (this.elements.progressFill) {
                this.elements.progressFill.style.width = `${data.percentage}%`;
                this.elements.progressFill.style.transition = 'width 0.5s ease';
            }
            
            if (this.elements.progressText) {
                this.elements.progressText.textContent = `${Math.round(data.percentage)}%`;
            }
        }
        
        // Обновляем текущее требование
        if (data.current_requirement && this.elements.currentRequirement) {
            this.elements.currentRequirement.textContent = data.current_requirement;
        }
        
        // Обновляем статус агента
        if (data.agent_status && this.elements.agentStatus) {
            this.elements.agentStatus.textContent = data.agent_status;
        }
        
        // Визуальная индикация
        this.showProgressAnimation();
        
        // Проверяем завершение
        if (data.completed) {
            this.handleCompletion();
        }
    }
    
    showProgressAnimation() {
        if (this.elements.progressFill) {
            this.elements.progressFill.classList.add('animating');
            setTimeout(() => {
                this.elements.progressFill?.classList.remove('animating');
            }, 500);
        }
    }
    
    handleCompletion() {
        console.log('✅ Analysis completed!');
        this.stopPolling();
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        }
        
        if (this.elements.currentRequirement) {
            this.elements.currentRequirement.textContent = 'Анализ завершен!';
        }
    }
    
    // WebSocket подключение
    connectWebSocket() {
        // Автоматически определяем протокол (ws или wss) и учитываем прокси путь
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}${window.location.pathname.replace(/\/$/, '')}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected for progress');
                this.wsConnected = true;
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'progress_update') {
                        console.log('📨 Progress via WebSocket:', message.data);
                        this.updateProgress(message.data);
                    }
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.wsConnected = false;
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.wsConnected = false;
                
                // Переподключение через 3 секунды
                setTimeout(() => {
                    if (!this.wsConnected) {
                        console.log('Attempting to reconnect WebSocket...');
                        this.connectWebSocket();
                    }
                }, 3000);
            };
            
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
        }
    }
    
    // Polling как запасной вариант
    async startPolling() {
        // Проверяем прогресс каждые 2 секунды
        this.pollingInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/progress');
                const data = await response.json();
                
                // Обновляем только если есть активный анализ
                if (!data.completed || data.percentage < 100) {
                    console.log('📊 Progress via polling:', data);
                    this.updateProgress(data);
                } else if (data.percentage === 100 && data.completed) {
                    this.handleCompletion();
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        }, 2000);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('Polling stopped');
        }
    }
    
    // Ручные методы для тестирования
    testProgress(percentage) {
        console.log(`🧪 Testing progress: ${percentage}%`);
        this.updateProgress({
            percentage: percentage,
            current_requirement: `Тестовое требование (${percentage}%)`,
            agent_status: `Тест ${percentage}%`
        });
    }
    
    reset() {
        this.updateProgress({
            percentage: 0,
            current_requirement: 'Ожидание запуска...',
            agent_status: 'Готов к работе'
        });
        this.startPolling();
    }
}

// Создаем глобальный экземпляр
window.progressManager = new ProgressManager();

// Добавляем стили для анимации
const style = document.createElement('style');
style.textContent = `
    #progress-fill {
        transition: width 0.5s ease;
        position: relative;
        overflow: hidden;
    }
    
    #progress-fill.animating::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
        );
        animation: shimmer 1s ease;
    }
    
    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

console.log(`
╔════════════════════════════════════════════╗
║     PROGRESS MANAGER LOADED                ║
╠════════════════════════════════════════════╣
║ Команды для тестирования:                  ║
║                                            ║
║ progressManager.testProgress(25)          ║
║ progressManager.testProgress(50)          ║
║ progressManager.testProgress(75)          ║
║ progressManager.testProgress(100)         ║
║ progressManager.reset()                   ║
╚════════════════════════════════════════════╝
`);