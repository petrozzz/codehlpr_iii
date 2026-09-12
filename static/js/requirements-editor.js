/**
 * Редактор требований с умным извлечением через LLM
 */

class RequirementsEditor {
    constructor() {
        this.requirements = [];
        this.projectId = null;
        this.projectData = null;
        
        this.init();
    }
    
    init() {
        // Кнопка извлечения
        document.getElementById('extract-requirements-btn')?.addEventListener('click', () => {
            this.extractRequirements();
        });
        
        // Кнопка добавления требования
        document.getElementById('add-requirement-btn')?.addEventListener('click', () => {
            this.addRequirement('');
        });
        
        // Кнопка удаления выбранных
        document.getElementById('remove-selected-btn')?.addEventListener('click', () => {
            this.removeSelected();
        });
        
        // Кнопка сохранения и начала аудита
        document.getElementById('save-requirements-btn')?.addEventListener('click', () => {
            this.saveAndStartAudit();
        });
        
        // Отслеживаем загрузку файлов
        this.watchFileInputs();
    }
    
    watchFileInputs() {
        const projectFile = document.getElementById('project-file');
        const requirementsFile = document.getElementById('requirements-file');
        const projectName = document.getElementById('project-name');
        const extractBtn = document.getElementById('extract-requirements-btn');
        
        const checkReadiness = () => {
            const ready = projectFile?.files?.length > 0 && 
                         requirementsFile?.files?.length > 0 && 
                         projectName?.value?.trim();
            
            if (extractBtn) {
                extractBtn.style.display = ready ? 'inline-flex' : 'none';
            }
        };
        
        projectFile?.addEventListener('change', checkReadiness);
        requirementsFile?.addEventListener('change', checkReadiness);
        projectName?.addEventListener('input', checkReadiness);
    }
    
    async extractRequirements() {
        const projectFile = document.getElementById('project-file').files[0];
        const requirementsFile = document.getElementById('requirements-file').files[0];
        const projectName = document.getElementById('project-name').value.trim();
        const apiKey = document.getElementById('api-key').value.trim();
        
        // Определяем выбранный AI провайдер
        const selectedProvider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'gemini';
        
        // Для Gemini требуется API ключ, для GigaChat - нет (берется из переменных окружения)
        if (!projectFile || !requirementsFile || !projectName) {
            alert('Пожалуйста, заполните все поля');
            return;
        }
        
        if (selectedProvider === 'gemini' && !apiKey) {
            alert('Пожалуйста, введите API ключ для Gemini');
            return;
        }
        
        // Показываем секцию и прогресс
        document.getElementById('requirements-section').style.display = 'block';
        document.getElementById('extraction-progress').style.display = 'block';
        document.getElementById('requirements-editor').style.display = 'none';
        document.getElementById('extract-requirements-btn').disabled = true;
        
        // Подготавливаем FormData
        const formData = new FormData();
        formData.append('project_file', projectFile);
        formData.append('requirements_file', requirementsFile);
        formData.append('project_name', projectName);
        formData.append('api_key', apiKey || '');
        formData.append('ai_provider', selectedProvider);  // Передаем выбранный провайдер
        
        try {
            const response = await fetch(`${window.API_BASE_URL || ''}/api/extract-requirements`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.projectId = data.project_id;
                this.requirements = data.requirements || [];
                this.projectData = { projectName, projectFile, requirementsFile };
                
                // Показываем редактор
                this.showEditor();
            } else {
                alert('Ошибка извлечения требований: ' + (data.message || 'Неизвестная ошибка'));
                this.resetExtraction();
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка извлечения требований: ' + error.message);
            this.resetExtraction();
        }
    }
    
    updateExtractionProgress(data) {
        const progressBar = document.getElementById('extraction-fill');
        const progressPercentage = document.getElementById('extraction-percentage');
        const progressStatus = document.getElementById('extraction-status');
        
        if (progressBar) {
            progressBar.style.width = (data.percentage || 0) + '%';
        }
        if (progressPercentage) {
            progressPercentage.textContent = (data.percentage || 0).toFixed(1) + '%';
        }
        if (progressStatus) {
            progressStatus.textContent = data.status || 'Обработка...';
        }
    }
    
    showEditor() {
        console.log('📝 Показываем редактор с', this.requirements.length, 'требованиями');
        
        document.getElementById('extraction-progress').style.display = 'none';
        document.getElementById('requirements-editor').style.display = 'block';
        
        // Отрисовываем требования
        this.renderRequirements();
        
        console.log('✅ Требования отрисованы');
        
        // Скроллим к редактору
        document.getElementById('requirements-section').scrollIntoView({ behavior: 'smooth' });
    }
    
    renderRequirements() {
        const container = document.getElementById('requirements-list');
        if (!container) {
            console.error('❌ Контейнер requirements-list не найден!');
            return;
        }
        
        console.log('🔄 Рендерим', this.requirements.length, 'требований');
        
        container.innerHTML = '';
        
        this.requirements.forEach((req, index) => {
            const item = this.createRequirementItem(req, index);
            container.appendChild(item);
        });
        
        console.log('✅ Рендер завершён, элементов:', container.children.length);
    }
    
    createRequirementItem(text, index) {
        const div = document.createElement('div');
        div.className = 'requirement-item';
        div.dataset.index = index;
        
        div.innerHTML = `
            <input type="checkbox" class="requirement-checkbox" data-index="${index}">
            <div class="requirement-number">${index + 1}</div>
            <div class="requirement-content">
                <textarea class="requirement-textarea" data-index="${index}" rows="3">${text}</textarea>
            </div>
            <div class="requirement-actions">
                <button class="btn-icon btn-delete-req" data-index="${index}" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Обновляем текст при изменении
        const textarea = div.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            this.requirements[index] = e.target.value;
            console.log(`📝 Требование ${index + 1} обновлено`);
        });
        
        // Обработчик удаления
        const deleteBtn = div.querySelector('.btn-delete-req');
        deleteBtn.addEventListener('click', () => {
            console.log(`🗑️ Удаление требования ${index + 1}`);
            this.removeRequirement(index);
        });
        
        // Обработчик чекбокса (для отладки)
        const checkbox = div.querySelector('.requirement-checkbox');
        checkbox.addEventListener('change', (e) => {
            console.log(`✅ Чекбокс ${index + 1}:`, e.target.checked);
        });
        
        return div;
    }
    
    addRequirement(text = 'Новое требование...') {
        this.requirements.push(text);
        this.renderRequirements();
        
        // Скроллим к последнему элементу
        const container = document.getElementById('requirements-list');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    removeRequirement(index) {
        if (confirm('Удалить это требование?')) {
            this.requirements.splice(index, 1);
            this.renderRequirements();
        }
    }
    
    removeSelected() {
        const checkboxes = document.querySelectorAll('.requirement-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Не выбрано ни одного требования');
            return;
        }
        
        if (confirm(`Удалить ${checkboxes.length} требований?`)) {
            const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
            // Удаляем с конца чтобы индексы не сбивались
            indices.sort((a, b) => b - a).forEach(index => {
                this.requirements.splice(index, 1);
            });
            this.renderRequirements();
        }
    }
    
    async saveAndStartAudit() {
        // Собираем текущие значения из textarea
        const textareas = document.querySelectorAll('.requirement-textarea');
        this.requirements = Array.from(textareas).map(ta => ta.value.trim()).filter(t => t);
        
        if (this.requirements.length === 0) {
            alert('Добавьте хотя бы одно требование');
            return;
        }
        
        const saveBtn = document.getElementById('save-requirements-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        
        try {
            // Обновляем требования на сервере
            const formData = new FormData();
            formData.append('project_id', this.projectId);
            formData.append('requirements', JSON.stringify(this.requirements));
            
            const response = await fetch(`${window.API_BASE_URL || ''}/api/update-requirements`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Скрываем редактор
                document.getElementById('requirements-section').style.display = 'none';
                
                // Запускаем аудит
                this.startAudit();
            } else {
                throw new Error(data.message || 'Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка сохранения требований: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить и начать аудит';
        }
    }
    
    startAudit() {
        // Показываем секцию анализа
        document.getElementById('analysis-section').style.display = 'block';
        document.getElementById('analysis-section').scrollIntoView({ behavior: 'smooth' });
        
        // Получаем настройки
        const apiKey = document.getElementById('api-key').value.trim();
        const maxFileSize = parseInt(document.getElementById('max-file-size').value);
        
        // Проверяем какой endpoint использовать
        // Если есть project_id - используем его, иначе используем project_name
        let requestData;
        
        // Получаем выбранный провайдер ИИ
        const aiProvider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'gemini';

        if (this.projectId) {
            // Новый flow - проект уже создан при извлечении требований
            requestData = {
                project_name: this.projectData.projectName,
                settings: {
                    ai_provider: aiProvider,
                    api_key: apiKey,
                    max_file_size: maxFileSize,
                    rate_limit_seconds: 8
                }
            };
        } else {
            // Старый flow - проект создаётся при старте анализа
            requestData = {
                project_name: this.projectData?.projectName || document.getElementById('project-name').value,
                settings: {
                    ai_provider: aiProvider,
                    api_key: apiKey,
                    max_file_size: maxFileSize,
                    rate_limit_seconds: 8
                }
            };
        }
        
        fetch(`${window.API_BASE_URL || ''}/api/start-audit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Анализ запущен:', data);
            } else {
                alert('Ошибка запуска анализа: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка запуска анализа:', error);
            alert('Ошибка запуска анализа: ' + error.message);
        });
    }
    
    resetExtraction() {
        document.getElementById('extract-requirements-btn').disabled = false;
        document.getElementById('extraction-progress').style.display = 'none';
    }
}

// Инициализация и экспорт в глобальную область
let requirementsEditor = null;

document.addEventListener('DOMContentLoaded', () => {
    requirementsEditor = new RequirementsEditor();
    window.requirementsEditor = requirementsEditor;  // Экспортируем в window
    console.log('✅ Редактор требований загружен');
});