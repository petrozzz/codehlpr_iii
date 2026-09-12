// Утилиты для отладки системы прогресса

window.debugProgress = {
    // Проверка состояния прогресса
    checkStatus: function() {
        console.log('=== ДИАГНОСТИКА ПРОГРЕССА ===');
        
        // 1. Проверяем интерфейс аудитора
        if (window.auditInterface) {
            console.log('✅ AuditInterface загружен');
            console.log('   - Анализ запущен:', window.auditInterface.analysisState.isRunning);
            console.log('   - Текущее требование:', window.auditInterface.analysisState.currentRequirement);
            console.log('   - Всего требований:', window.auditInterface.analysisState.totalRequirements);
        } else {
            console.log('❌ AuditInterface не найден');
        }
        
        // 2. Проверяем интеллектуального агента
        if (window.intelligentAgent) {
            console.log('✅ IntelligentAgent загружен');
            console.log('   - Фаза:', window.intelligentAgent.currentPhase);
            console.log('   - Активен:', window.intelligentAgent.isThinking);
        } else {
            console.log('❌ IntelligentAgent не найден');
        }
        
        // 3. Проверяем WebSocket
        if (window.apiClient && window.apiClient.ws) {
            console.log('✅ WebSocket подключен');
            console.log('   - Состояние:', window.apiClient.ws.readyState);
        } else {
            console.log('❌ WebSocket не подключен');
        }
        
        // 4. Проверяем элементы UI
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        const currentRequirement = document.getElementById('current-requirement');
        const agentStatus = document.getElementById('agent-status');
        
        console.log('=== UI ЭЛЕМЕНТЫ ===');
        console.log('Progress bar:', progressFill ? progressFill.style.width : 'не найден');
        console.log('Percentage text:', progressPercentage ? progressPercentage.textContent : 'не найден');
        console.log('Current requirement:', currentRequirement ? currentRequirement.textContent : 'не найден');
        console.log('Agent status:', agentStatus ? agentStatus.textContent : 'не найден');
    },
    
    // Тест обновления прогресса
    testUpdate: function(percentage = 50) {
        console.log(`Тестируем обновление прогресса на ${percentage}%...`);
        
        if (window.auditInterface) {
            window.auditInterface.updateProgress(percentage);
            window.auditInterface.updateCurrentRequirement(`Тестовое требование (${percentage}%)`);
            window.auditInterface.updateAgentStatus(`Тестовый статус агента ${percentage}%`);
            console.log('✅ Обновления отправлены');
        } else {
            console.log('❌ auditInterface не доступен');
        }
    },
    
    // Симуляция WebSocket сообщения
    simulateWebSocketMessage: function() {
        console.log('Симулируем WebSocket сообщение progress_update...');
        
        const testMessage = {
            type: 'progress_update',
            data: {
                current: 5,
                total: 10,
                percentage: 50,
                current_requirement: 'Тестовое требование из WebSocket',
                agent_status: 'Тестовый статус из WebSocket',
                completed: false
            }
        };
        
        if (window.apiClient && window.apiClient.ws) {
            window.apiClient.ws.handleMessage(testMessage);
            console.log('✅ Сообщение обработано');
        } else {
            console.log('❌ WebSocket не доступен');
        }
    },
    
    // Проверка API endpoint
    checkAPI: async function() {
        console.log('Проверяем /api/progress endpoint...');
        
        try {
            const response = await fetch('/api/progress');
            const data = await response.json();
            console.log('✅ API ответ:', data);
            return data;
        } catch (error) {
            console.log('❌ Ошибка API:', error);
            return null;
        }
    },
    
    // Полная диагностика
    fullDiagnostics: async function() {
        console.log('🔍 ПОЛНАЯ ДИАГНОСТИКА СИСТЕМЫ ПРОГРЕССА');
        console.log('=' * 50);
        
        this.checkStatus();
        
        console.log('\n📡 Проверка API...');
        await this.checkAPI();
        
        console.log('\n🧪 Тест обновлений...');
        this.testUpdate(25);
        
        setTimeout(() => {
            console.log('\n📊 Финальная проверка:');
            this.checkStatus();
        }, 1000);
    }
};

// Автоматически добавляем в консоль
console.log('🛠️ Утилиты отладки прогресса загружены!');
console.log('Доступные команды:');
console.log('  debugProgress.checkStatus() - проверить текущее состояние');
console.log('  debugProgress.testUpdate(50) - тестовое обновление на 50%');
console.log('  debugProgress.simulateWebSocketMessage() - симуляция WebSocket');
console.log('  debugProgress.checkAPI() - проверить API endpoint');
console.log('  debugProgress.fullDiagnostics() - полная диагностика');