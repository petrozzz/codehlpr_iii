// Визуализация интеллектуального ИИ-агента

class IntelligentAgent {
    constructor() {
        this.workspace = null;
        this.currentThoughts = [];
        this.isThinking = false;
        this.currentPhase = 'idle';
        this.thoughtCounter = 0;
        this.commandHistory = [];
        
        this.phases = {
            idle: { icon: '🤖', name: 'Ожидание', color: '#64748b' },
            understanding: { icon: '🤔', name: 'Понимание', color: '#3b82f6' },
            analyzing: { icon: '🔍', name: 'Анализ', color: '#8b5cf6' },
            searching: { icon: '🔎', name: 'Поиск', color: '#06b6d4' },
            reasoning: { icon: '💭', name: 'Рассуждение', color: '#10b981' },
            deciding: { icon: '⚖️', name: 'Решение', color: '#f59e0b' },
            completing: { icon: '✅', name: 'Завершение', color: '#10b981' }
        };
        
        this.init();
    }
    
    init() {
        this.workspace = document.getElementById('agent-workspace');
        if (this.workspace) {
            this.setupWorkspace();
        }
    }
    
    setupWorkspace() {
        this.workspace.innerHTML = `
            <div class="agent-idle-state">
                <div class="idle-animation">
                    <div class="brain-icon">🧠</div>
                    <div class="pulse-rings">
                        <div class="pulse-ring"></div>
                        <div class="pulse-ring"></div>
                        <div class="pulse-ring"></div>
                    </div>
                </div>
                <p class="idle-message">Готов к интеллектуальному анализу</p>
            </div>
        `;
        
        // Добавляем стили для анимации ожидания
        this.addIdleStyles();
    }
    
    addIdleStyles() {
        if (document.getElementById('agent-idle-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'agent-idle-styles';
        style.textContent = `
            .agent-idle-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                text-align: center;
            }
            
            .idle-animation {
                position: relative;
                margin-bottom: 2rem;
            }
            
            .brain-icon {
                font-size: 4rem;
                animation: float 3s ease-in-out infinite;
                position: relative;
                z-index: 2;
            }
            
            .pulse-rings {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1;
            }
            
            .pulse-ring {
                position: absolute;
                width: 80px;
                height: 80px;
                border: 2px solid var(--primary-color);
                border-radius: 50%;
                opacity: 0;
                animation: pulse-ring 2s ease-out infinite;
            }
            
            .pulse-ring:nth-child(2) {
                animation-delay: 0.7s;
            }
            
            .pulse-ring:nth-child(3) {
                animation-delay: 1.4s;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes pulse-ring {
                0% {
                    transform: translate(-50%, -50%) scale(0.5);
                    opacity: 1;
                }
                100% {
                    transform: translate(-50%, -50%) scale(1.5);
                    opacity: 0;
                }
            }
            
            .idle-message {
                color: var(--text-secondary);
                font-style: italic;
                font-size: 1.1rem;
            }
            
            .thinking-workspace {
                animation: fadeIn 0.5s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    startAnalysis(requirementText) {
        this.isThinking = true;
        this.currentPhase = 'understanding';
        this.thoughtCounter = 0;
        this.currentThoughts = [];
        this.commandHistory = [];
        
        // Очищаем рабочую область и создаем новую
        this.workspace.innerHTML = '';
        this.createThinkingWorkspace(requirementText);
        
        // Показываем первую мысль
        this.addThought({
            phase: 'understanding',
            text: 'Изучаю требование и планирую подход к анализу',
            action: `Анализирую: "${this.truncateText(requirementText, 80)}"`
        });
    }
    
    createThinkingWorkspace(requirementText) {
        const workspace = document.createElement('div');
        workspace.className = 'thinking-workspace';
        
        workspace.innerHTML = `
            <div class="requirement-context">
                <div class="context-header">
                    <i class="fas fa-clipboard-list"></i>
                    <h4>Анализируемое требование</h4>
                </div>
                <div class="requirement-text">${requirementText}</div>
            </div>
            
            <div class="thoughts-container" id="thoughts-container">
                <!-- Здесь будут отображаться мысли агента -->
            </div>
            
            <div class="commands-container" id="commands-container">
                <!-- Здесь будут отображаться выполняемые команды -->
            </div>
            
            <div class="rag-container" id="rag-container" style="display: none;">
                <!-- Здесь будут детали RAG поиска -->
            </div>
            
            <div class="decision-container" id="decision-container" style="display: none;">
                <!-- Здесь будет итоговое решение -->
            </div>
        `;
        
        this.workspace.appendChild(workspace);
        this.addWorkspaceStyles();
    }
    
    addWorkspaceStyles() {
        if (document.getElementById('agent-workspace-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'agent-workspace-styles';
        style.textContent = `
            .requirement-context {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border: 1px solid #bae6fd;
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .context-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
            }
            
            .context-header i {
                color: var(--info-color);
                font-size: 1.25rem;
            }
            
            .context-header h4 {
                margin: 0;
                color: var(--text-primary);
                font-size: 1.1rem;
            }
            
            .requirement-text {
                background: white;
                padding: 1rem;
                border-radius: var(--radius-md);
                border-left: 4px solid var(--info-color);
                font-style: italic;
                line-height: 1.6;
            }
            
            .thoughts-container {
                margin-bottom: 2rem;
            }
            
            .commands-container {
                margin-bottom: 2rem;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    addThought(thought) {
        const thoughtsContainer = document.getElementById('thoughts-container');
        if (!thoughtsContainer) return;
        
        this.thoughtCounter++;
        this.currentThoughts.push(thought);
        
        const thoughtElement = document.createElement('div');
        thoughtElement.className = 'agent-thought';
        thoughtElement.style.animationDelay = `${this.thoughtCounter * 0.1}s`;
        
        const phase = this.phases[thought.phase] || this.phases.analyzing;
        
        thoughtElement.innerHTML = `
            <div class="thought-icon" style="background: ${phase.color}">
                ${phase.icon}
            </div>
            <div class="thought-content">
                <div class="thought-phase">${phase.name}</div>
                <div class="thought-text">${thought.text}</div>
                ${thought.action ? `<div class="thought-action"><strong>Действие:</strong> ${thought.action}</div>` : ''}
                ${thought.result ? `<div class="thought-result"><strong>Результат:</strong> ${thought.result}</div>` : ''}
                ${thought.confidence ? `<div class="confidence-meter">
                    <span>Уверенность: ${Math.round(thought.confidence * 100)}%</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${thought.confidence * 100}%"></div>
                    </div>
                </div>` : ''}
            </div>
        `;
        
        thoughtsContainer.appendChild(thoughtElement);
        
        // Прокручиваем к новой мысли
        thoughtElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Обновляем статус агента
        this.updateAgentStatus(phase.name, thought.text);
    }
    
    showCommand(command) {
        const commandsContainer = document.getElementById('commands-container');
        if (!commandsContainer) return;
        
        this.commandHistory.push(command);
        
        const commandElement = document.createElement('div');
        commandElement.className = 'agent-command';
        
        commandElement.innerHTML = `
            <div class="command-header">
                <div class="command-icon">
                    <i class="${this.getCommandIcon(command.type)}"></i>
                </div>
                <div class="command-type">${this.getCommandName(command.type)}</div>
                <div class="command-description">${command.description || ''}</div>
                ${command.status ? `<div class="command-status ${command.status}">${this.getStatusIcon(command.status)}</div>` : ''}
            </div>
            <div class="command-code">${command.command}</div>
            ${command.result ? `<div class="command-result ${command.resultType || 'success'}">${command.result}</div>` : ''}
        `;
        
        commandsContainer.appendChild(commandElement);
        commandElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    showRAGDetails(ragData) {
        const ragContainer = document.getElementById('rag-container');
        if (!ragContainer) return;
        
        ragContainer.style.display = 'block';
        ragContainer.innerHTML = `
            <div class="rag-details">
                <div class="rag-header">
                    <div class="rag-icon">🔍</div>
                    <h3 class="rag-title">RAG Поиск</h3>
                </div>
                
                <div class="rag-metrics">
                    <div class="rag-metric">
                        <span class="rag-metric-value">${ragData.totalResults || 0}</span>
                        <span class="rag-metric-label">Найдено</span>
                    </div>
                    <div class="rag-metric">
                        <span class="rag-metric-value">${ragData.selectedResults || 0}</span>
                        <span class="rag-metric-label">Отобрано</span>
                    </div>
                    <div class="rag-metric">
                        <span class="rag-metric-value">${ragData.filesCount || 0}</span>
                        <span class="rag-metric-label">Файлов</span>
                    </div>
                </div>
                
                ${ragData.files && ragData.files.length > 0 ? `
                    <div class="rag-files">
                        <h4><i class="fas fa-file-code"></i> Релевантные файлы</h4>
                        <div class="file-list">
                            ${ragData.files.slice(0, 5).map(file => `
                                <div class="file-item">
                                    <i class="fas fa-file-code file-icon"></i>
                                    <span class="file-name">${file.name}</span>
                                    <span class="file-lines">${file.lines}</span>
                                </div>
                            `).join('')}
                            ${ragData.files.length > 5 ? `<div class="file-item"><i class="fas fa-ellipsis-h file-icon"></i><span>... и еще ${ragData.files.length - 5} файлов</span></div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        ragContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    showDecision(decision) {
        const decisionContainer = document.getElementById('decision-container');
        if (!decisionContainer) return;
        
        decisionContainer.style.display = 'block';
        
        const decisionClass = this.getDecisionClass(decision.status);
        const decisionIcon = this.getDecisionIcon(decision.status);
        
        decisionContainer.innerHTML = `
            <div class="agent-decision ${decisionClass}">
                <div class="decision-icon">${decisionIcon}</div>
                <div class="decision-text">${decision.text}</div>
                <div class="decision-reasoning">${decision.reasoning}</div>
            </div>
            
            ${decision.aiComment ? `
                <div class="completion-summary">
                    <div class="summary-header">
                        <div class="summary-icon">🧠</div>
                        <h3 class="summary-title">Заключение ИИ</h3>
                    </div>
                    
                    <div class="ai-comment ${decisionClass}">
                        <div class="comment-header">
                            <span>${this.getStatusText(decision.status)}</span>
                        </div>
                        <div class="comment-text">${decision.aiComment}</div>
                    </div>
                    
                    ${decision.findings && decision.findings.length > 0 ? `
                        <div class="findings-list">
                            <div class="findings-title">
                                <i class="fas fa-search"></i>
                                Ключевые находки
                            </div>
                            ${decision.findings.slice(0, 3).map(finding => `
                                <div class="finding-item">${finding}</div>
                            `).join('')}
                            ${decision.findings.length > 3 ? `<div class="finding-more">... и еще ${decision.findings.length - 3} находок</div>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="final-status">
                        <div class="status-badge ${decisionClass}">
                            ${decisionIcon} ${this.getStatusText(decision.status)}
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        decisionContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Завершаем анализ
        this.completeAnalysis(decision.status);
    }
    
    completeAnalysis(finalStatus) {
        this.isThinking = false;
        this.currentPhase = 'completing';
        
        // Обновляем статус агента
        const statusText = {
            '✅': 'Анализ завершен: требование выполнено',
            '❌': 'Анализ завершен: найдены нарушения',
            '❓': 'Анализ завершен: требуется проверка'
        }[finalStatus] || 'Анализ завершен';
        
        this.updateAgentStatus('Завершение', statusText);
        
        // Добавляем финальную мысль
        setTimeout(() => {
            this.addThought({
                phase: 'completing',
                text: statusText,
                result: `Итоговый статус: ${finalStatus}`
            });
        }, 1000);
    }
    
    updateAgentStatus(phase, text) {
        const agentStatus = document.getElementById('agent-status');
        if (agentStatus) {
            agentStatus.innerHTML = `
                <span class="status-phase">${phase}:</span>
                <span class="status-text">${this.truncateText(text, 60)}</span>
            `;
        }
    }
    
    // Вспомогательные методы
    getCommandIcon(type) {
        const icons = {
            grep: 'fas fa-search',
            find_symbol: 'fas fa-code',
            read_file: 'fas fa-file-alt',
            analyze: 'fas fa-brain',
            search: 'fas fa-search-plus'
        };
        return icons[type] || 'fas fa-terminal';
    }
    
    getCommandName(type) {
        const names = {
            grep: 'Поиск по паттерну',
            find_symbol: 'Поиск символа',
            read_file: 'Чтение файла',
            analyze: 'Анализ кода',
            search: 'Поиск'
        };
        return names[type] || 'Команда';
    }
    
    getStatusIcon(status) {
        const icons = {
            running: '<i class="fas fa-spinner fa-spin"></i>',
            success: '<i class="fas fa-check"></i>',
            error: '<i class="fas fa-times"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>'
        };
        return icons[status] || '';
    }
    
    getDecisionClass(status) {
        const classes = {
            '✅': 'success',
            '❌': 'error',
            '❓': 'warning'
        };
        return classes[status] || 'info';
    }
    
    getDecisionIcon(status) {
        return status || '❓';
    }
    
    getStatusText(status) {
        const texts = {
            '✅': 'Соответствует требованию',
            '❌': 'Не соответствует требованию',
            '❓': 'Неопределенный результат'
        };
        return texts[status] || 'Анализ завершен';
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Публичные методы для интеграции с основным интерфейсом
    reset() {
        this.isThinking = false;
        this.currentPhase = 'idle';
        this.thoughtCounter = 0;
        this.currentThoughts = [];
        this.commandHistory = [];
        this.setupWorkspace();
    }
    
    simulateThinking(requirementText) {
        this.startAnalysis(requirementText);
        
        // Симуляция процесса мышления для демонстрации
        const phases = [
            {
                phase: 'analyzing',
                text: 'Анализирую архитектуру проекта и ищу релевантные компоненты',
                action: 'Сканирую структуру файлов и зависимости'
            },
            {
                phase: 'searching',
                text: 'Выполняю поиск релевантного кода с помощью RAG',
                action: 'Ищу фрагменты кода, связанные с требованием'
            },
            {
                phase: 'reasoning',
                text: 'Анализирую найденные фрагменты и сопоставляю с требованием',
                action: 'Оцениваю соответствие кода требованиям'
            },
            {
                phase: 'deciding',
                text: 'Формирую итоговое заключение на основе анализа',
                action: 'Определяю статус соответствия'
            }
        ];
        
        phases.forEach((phase, index) => {
            setTimeout(() => {
                this.addThought(phase);
                
                if (index === 1) {
                    // Показываем команду поиска
                    this.showCommand({
                        type: 'grep',
                        command: 'grep -rn "authentication" . --include="*.py" --include="*.js"',
                        description: 'Поиск кода аутентификации',
                        status: 'success',
                        result: 'Найдено 15 совпадений в 8 файлах'
                    });
                }
                
                if (index === 2) {
                    // Показываем RAG детали
                    this.showRAGDetails({
                        totalResults: 150,
                        selectedResults: 25,
                        filesCount: 8,
                        files: [
                            { name: 'auth.py', lines: '15-45' },
                            { name: 'login.js', lines: '20-35' },
                            { name: 'security.py', lines: '100-120' }
                        ]
                    });
                }
                
                if (index === phases.length - 1) {
                    // Показываем итоговое решение
                    setTimeout(() => {
                        this.showDecision({
                            status: '✅',
                            text: 'Требование полностью выполнено в коде',
                            reasoning: 'На основе анализа кода и архитектурного контекста',
                            aiComment: 'Система содержит полноценную реализацию аутентификации с использованием современных методов безопасности. Найдены все необходимые компоненты: проверка учетных данных, управление сессиями, защита от атак.',
                            findings: [
                                'Найдена реализация многофакторной аутентификации',
                                'Используется безопасное хеширование паролей',
                                'Реализована защита от брутфорс атак'
                            ]
                        });
                    }, 2000);
                }
            }, (index + 1) * 2000);
        });
    }
}

// Глобальная инициализация агента
document.addEventListener('DOMContentLoaded', () => {
    window.intelligentAgent = new IntelligentAgent();
});