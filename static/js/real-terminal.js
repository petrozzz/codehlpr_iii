/**
 * Real Linux Terminal v6.1 - Реалистичная человеческая печать
 * - Вариативная скорость печати (35-55ms)
 * - Случайные "всплески" быстрой печати (12% вероятность)
 * - Контекстные паузы на знаках препинания (80-120ms)
 * - ЖИВОЙ КУРСОР при печати (движется за текстом)
 * - Чистый эффект печати БЕЗ fade-in
 * - Увеличенные задержки для видимого эффекта
 */

class RealLinuxTerminal {
    constructor(containerId = 'terminal-container') {
        this.container = document.getElementById(containerId);
        this.commandHistory = [];
        this.maxHistorySize = 50;
        this.isTyping = false;
        this.currentCursorLine = null;
        this.lastCommandKey = null; // Для отслеживания дублей
        
        if (!this.container) {
            console.error(`Terminal container #${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.container.innerHTML = this.getTerminalHTML();
        this.terminalBody = this.container.querySelector('.real-terminal-body');
        this.setupStyles();
        
        console.log('✅ RealLinuxTerminal v6.1 initialized - Live typing cursor enabled');
    }
    
    getTerminalHTML() {
        const hostname = 'ai-agent';
        const user = 'auditor';
        
        return `
            <div class="real-linux-terminal">
                <div class="real-terminal-header">
                    <div class="terminal-dots">
                        <span class="dot red"></span>
                        <span class="dot yellow"></span>
                        <span class="dot green"></span>
                    </div>
                    <div class="terminal-title">${user}@${hostname}: ~/project</div>
                    <div class="terminal-menu">
                        <button onclick="realTerminal.clear()" title="Clear">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="real-terminal-body" id="real-terminal-body"></div>
            </div>
        `;
    }
    
    setupStyles() {
        if (document.getElementById('real-linux-terminal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'real-linux-terminal-styles';
        style.textContent = `
            .real-linux-terminal {
                background: #1e1e1e;
                border-radius: 6px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                height: 600px;
                display: flex;
                flex-direction: column;
            }
            
            .real-terminal-header {
                background: #2d2d2d;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #3d3d3d;
            }
            
            .terminal-dots {
                display: flex;
                gap: 6px;
            }
            
            .dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }
            
            .dot.red { background: #ff5f56; }
            .dot.yellow { background: #ffbd2e; }
            .dot.green { background: #27c93f; }
            
            .terminal-title {
                color: #d4d4d4;
                font-size: 12px;
                font-weight: 500;
            }
            
            .terminal-menu button {
                background: transparent;
                border: none;
                color: #999;
                cursor: pointer;
                padding: 4px 8px;
                transition: color 0.2s;
            }
            
            .terminal-menu button:hover {
                color: #fff;
            }
            
            .real-terminal-body {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                background: #1e1e1e;
                color: #d4d4d4;
                line-height: 1.6;
            }
            
            .real-terminal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .real-terminal-body::-webkit-scrollbar-track {
                background: #1e1e1e;
            }
            
            .real-terminal-body::-webkit-scrollbar-thumb {
                background: #3d3d3d;
                border-radius: 4px;
            }
            
            .real-terminal-body::-webkit-scrollbar-thumb:hover {
                background: #4d4d4d;
            }
            
            .terminal-block {
                margin-bottom: 12px;
            }
            
            .terminal-comment {
                color: #6a9955;
                font-style: italic;
                margin-bottom: 4px;
                font-size: 12px;
            }
            
            .terminal-comment::before {
                content: '# ';
            }
            
            .terminal-prompt {
                color: #4ec9b0;
                font-weight: 600;
            }
            
            .terminal-command {
                color: #d4d4d4;
                display: inline;
                white-space: pre-wrap;
                word-break: break-word;
            }
            
            .terminal-command-line {
                margin-bottom: 6px;
                display: flex;
                align-items: flex-start;
            }
            
            .terminal-output {
                margin-left: 0;
                color: #cccccc;
                font-size: 12px;
                margin-top: 4px;
            }
            
            .output-line {
                margin-left: 20px;
                padding-left: 4px;
                border-left: 2px solid #3d3d3d;
                margin-bottom: 2px;
                color: #b0b0b0;
            }
            
            .output-line::before {
                content: '|__ ';
                color: #6a9955;
                margin-left: -20px;
                margin-right: 4px;
            }
            
            .terminal-success {
                color: #4ec9b0;
                margin-top: 8px;
                font-size: 12px;
            }
            
            .terminal-success::before {
                content: '✓ ';
            }
            
            .terminal-error {
                color: #f48771;
                margin-top: 8px;
            }
            
            .terminal-error::before {
                content: '✗ ';
            }
            
            .terminal-separator {
                height: 1px;
                background: #3d3d3d;
                margin: 16px 0;
            }
            
            .terminal-status {
                color: #858585;
                font-size: 11px;
                margin-bottom: 12px;
                padding: 6px 0;
            }
            
            .terminal-status-icon {
                margin-right: 6px;
            }
            
            /* Мигающий курсор */
            .cursor {
                display: inline-block;
                width: 8px;
                height: 15px;
                background: #4ec9b0;
                margin-left: 2px;
                animation: blink 1s infinite;
                vertical-align: middle;
            }

            /* Курсор при печати - НЕ мигает, всегда видимый */
            .cursor.typing-cursor {
                animation: none;
                opacity: 1;
                background: #4ec9b0;
            }

            @keyframes blink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }
            
            .typing {
                animation: fadeIn 0.05s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* Новая строка с курсором */
            .cursor-line {
                display: flex;
                align-items: center;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Проверка на дубликат команды
     */
    isDuplicate(command, comment) {
        const key = `${command}:${comment}`;
        const isDupe = this.lastCommandKey === key;
        if (!isDupe) {
            this.lastCommandKey = key;
        }
        return isDupe;
    }
    
    /**
     * Показать команду с эффектом печати
     */
    async showCommand(command, comment = null, skipDuplicateCheck = false) {
        // Проверяем дубликат ТОЛЬКО если не пропущена проверка
        if (!skipDuplicateCheck && this.isDuplicate(command, comment)) {
            console.log('🔄 Дубликат команды пропущен:', command);
            return;
        }
        
        const block = document.createElement('div');
        block.className = 'terminal-block';
        
        // Комментарий (если есть)
        if (comment) {
            const commentEl = document.createElement('div');
            commentEl.className = 'terminal-comment';
            commentEl.textContent = comment;
            block.appendChild(commentEl);
        }
        
        // Строка команды
        const commandLine = document.createElement('div');
        commandLine.className = 'terminal-command-line';
        
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = 'auditor@ai-agent$ ';
        
        const commandText = document.createElement('span');
        commandText.className = 'terminal-command';
        
        commandLine.appendChild(prompt);
        commandLine.appendChild(commandText);
        
        block.appendChild(commandLine);
        this.terminalBody.appendChild(block);
        
        // Убираем старый курсор если есть
        this.removeCursor();
        
        // Эффект печати команды с РЕАЛИСТИЧНОЙ скоростью
        await this.typeText(commandText, command, true);
        
        this.scrollToBottom();
        
        return block;
    }
    
    /**
     * Показать результат выполнения команды
     */
    showCommandOutput(output, success = true) {
        const outputDiv = document.createElement('div');
        outputDiv.className = 'terminal-output';
        
        if (output && output.trim()) {
            const lines = output.split('\n');
            
            // Ограничиваем количество строк
            const maxLines = 25;
            const displayLines = lines.slice(0, maxLines);
            
            displayLines.forEach((line) => {
                if (line.trim()) {
                    const lineEl = document.createElement('div');
                    lineEl.className = 'output-line';
                    lineEl.textContent = line;
                    outputDiv.appendChild(lineEl);
                }
            });
            
            if (lines.length > maxLines) {
                const moreEl = document.createElement('div');
                moreEl.className = 'output-line';
                moreEl.style.color = '#858585';
                moreEl.style.fontStyle = 'italic';
                moreEl.textContent = `(еще ${lines.length - maxLines} строк...)`;
                outputDiv.appendChild(moreEl);
            }
        } else {
            const emptyEl = document.createElement('div');
            emptyEl.style.color = '#858585';
            emptyEl.style.marginLeft = '20px';
            emptyEl.style.fontSize = '11px';
            emptyEl.textContent = '(нет результатов)';
            outputDiv.appendChild(emptyEl);
        }
        
        // Статус выполнения
        const statusEl = document.createElement('div');
        statusEl.className = success ? 'terminal-success' : 'terminal-error';
        statusEl.textContent = success ? 'Выполнено' : 'Ошибка';
        outputDiv.appendChild(statusEl);
        
        this.terminalBody.appendChild(outputDiv);
        
        // Добавляем курсор на новую строку
        this.addCursor();
        
        this.scrollToBottom();
    }
    
    /**
     * Показать команду и результат вместе
     */
    async showFullCommand(data) {
        // Проверяем дубликат
        if (this.isDuplicate(data.command, data.comment)) {
            console.log('🔄 Дубликат полной команды пропущен');
            return;
        }
        
        // Показываем команду (БЕЗ повторной проверки дубликата)
        await this.showCommand(data.command, data.comment, true);
        
        // Небольшая задержка перед выводом результата
        await this.sleep(150);
        
        // Показываем результат
        if (data.output !== undefined) {
            this.showCommandOutput(
                data.output,
                data.success !== false
            );
        }
        
        // Разделитель
        this.addSeparator();
    }
    
    /**
     * Показать только статус (для фазовых сообщений)
     */
    showStatus(status) {
        // Показываем только важные статусы
        const importantPhases = ['searching', 'analyzing', 'completing'];
        
        if (!importantPhases.includes(status.phase)) {
            return; // Пропускаем незначительные статусы
        }
        
        const statusEl = document.createElement('div');
        statusEl.className = 'terminal-status';
        
        const emoji = status.emotion || '⚙️';
        const text = status.text || status.action || '';
        
        statusEl.innerHTML = `<span class="terminal-status-icon">${emoji}</span>${text}`;
        
        this.terminalBody.appendChild(statusEl);
        this.scrollToBottom();
    }
    
    /**
     * РЕАЛИСТИЧНЫЙ эффект печати с человеческой вариативностью
     * + живой курсор при печати
     */
    async typeText(element, text, isCommand = false) {
        this.isTyping = true;

        // Конфигурация человеческой печати
        const TYPING = {
            base: { min: 35, max: 55 },  // Увеличены для более заметного эффекта
            fast_burst: { probability: 0.12, speed: 20 },  // Менее частые, но не слишком быстрые
            pause_chars: [',', '.', ')', ']', '}', '|', ':', ';'],
            pause_duration: { min: 80, max: 120 }  // Увеличены паузы
        };

        let inFastBurst = false;
        let fastBurstLength = 0;

        // Создаем временный курсор для печати
        const typingCursor = document.createElement('span');
        typingCursor.className = 'cursor typing-cursor';
        typingCursor.style.marginLeft = '0px';
        element.appendChild(typingCursor);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Добавляем символ БЕЗ анимации (чистая печать)
            element.insertBefore(document.createTextNode(char), typingCursor);

            this.scrollToBottom();

            let delay;

            // Инициализация быстрого всплеска
            if (!inFastBurst && Math.random() < TYPING.fast_burst.probability) {
                inFastBurst = true;
                fastBurstLength = 2 + Math.floor(Math.random() * 2); // 2-3 символа
            }

            // Быстрый всплеск (имитация уверенной печати)
            if (inFastBurst && fastBurstLength > 0) {
                delay = TYPING.fast_burst.speed + Math.random() * 5;
                fastBurstLength--;
                if (fastBurstLength === 0) {
                    inFastBurst = false;
                }
            }
            // Пауза на знаках препинания и спецсимволах
            else if (TYPING.pause_chars.includes(char)) {
                delay = TYPING.pause_duration.min +
                       Math.random() * (TYPING.pause_duration.max - TYPING.pause_duration.min);
            }
            // Контекстная скорость для команд
            else if (isCommand) {
                if (char === ' ') {
                    delay = 40 + Math.random() * 20; // Пауза на пробелах
                } else if (char === '/' || char === '-') {
                    delay = 30 + Math.random() * 15; // Флаги и пути
                } else if (/[a-zA-Z]/.test(char)) {
                    delay = TYPING.base.min + Math.random() * (TYPING.base.max - TYPING.base.min);
                } else if (/[0-9]/.test(char)) {
                    delay = 32 + Math.random() * 18; // Цифры
                } else {
                    delay = 38 + Math.random() * 17;
                }
            }
            // Обычный текст
            else {
                delay = TYPING.base.min + Math.random() * (TYPING.base.max - TYPING.base.min);
            }

            await this.sleep(delay);
        }

        // Убираем курсор печати
        typingCursor.remove();

        this.isTyping = false;
        this.scrollToBottom();
    }
    
    /**
     * Добавить мигающий курсор на новую строку
     */
    addCursor() {
        this.removeCursor(); // Убираем старый
        
        const cursorLine = document.createElement('div');
        cursorLine.className = 'cursor-line';
        
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = 'auditor@ai-agent$ ';
        
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        
        cursorLine.appendChild(prompt);
        cursorLine.appendChild(cursor);
        
        this.terminalBody.appendChild(cursorLine);
        this.currentCursorLine = cursorLine;
        
        this.scrollToBottom();
    }
    
    /**
     * Убрать курсор
     */
    removeCursor() {
        if (this.currentCursorLine) {
            this.currentCursorLine.remove();
            this.currentCursorLine = null;
        }
    }
    
    /**
     * Добавить разделитель
     */
    addSeparator() {
        const sep = document.createElement('div');
        sep.className = 'terminal-separator';
        this.terminalBody.appendChild(sep);
    }
    
    /**
     * Очистить терминал
     */
    clear() {
        this.terminalBody.innerHTML = '';
        this.commandHistory = [];
        this.currentCursorLine = null;
        this.lastCommandKey = null;
        this.addCursor(); // Добавляем курсор после очистки
    }
    
    /**
     * Прокрутка вниз
     */
    scrollToBottom() {
        this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
    }
    
    /**
     * Задержка
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Глобальная инициализация
window.RealLinuxTerminal = RealLinuxTerminal;

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    const terminalContainer = document.getElementById('terminal-container');
    
    if (terminalContainer) {
        window.realTerminal = new RealLinuxTerminal('terminal-container');
        console.log('✅ RealLinuxTerminal готов к работе');
        
        // Добавляем начальный курсор
        if (window.realTerminal) {
            window.realTerminal.addCursor();
        }
    } else {
        console.warn('⚠️ Контейнер для терминала не найден');
    }
});