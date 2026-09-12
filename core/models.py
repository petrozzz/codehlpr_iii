"""
Pydantic модели для системы аудита кода
БЕЗ захардкоженных паттернов - только чистые структуры данных
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict
from datetime import datetime


# ============================================================================
# МОДЕЛИ ДЛЯ АГЕНТА
# ============================================================================

class CodeLocation(BaseModel):
    """Локация в коде (файл + строка + сниппет)"""
    file: str = Field(..., description="Путь к файлу")
    line: int = Field(..., description="Номер строки")
    snippet: str = Field(..., description="Фрагмент кода")


class AgentObservation(BaseModel):
    """Наблюдение агента во время анализа"""
    observation: str = Field(..., description="Что нашел агент")
    location: CodeLocation = Field(..., description="Где нашел")
    relevance: float = Field(ge=0.0, le=1.0, description="Релевантность находки")


class AgentAction(BaseModel):
    """Действие которое хочет выполнить агент"""
    action_type: Literal[
        "explore_structure", # Изучить структуру проекта (README, файлы)
        "find_files",        # Найти файлы по имени/паттерну
        "read_file",         # Прочитать файл целиком
        "read_file_lines",   # Прочитать конкретные строки файла (формат: path:start-end)
        "count_lines",       # Подсчитать количество строк в файлах
        "list_functions",    # Показать список функций и классов с диапазонами строк
        "grep_pattern",      # Выполнить grep поиск
        "analyze_function",  # Детально изучить функцию
        "trace_calls",       # Отследить где вызывается
        "check_imports",     # Проверить импорты
        "semantic_search",   # Умный поиск по смыслу (RAG)
        "final_decision"     # Достаточно информации - вынести вердикт
    ] = Field(..., description="Тип действия")

    target: str = Field(..., description="Цель действия (путь/паттерн/имя)")
    reasoning: str = Field(..., description="Почему агент хочет это сделать")


class AnalysisResult(BaseModel):
    """Финальный результат анализа требования"""
    status: Literal["✅", "❌", "❓"] = Field(..., description="Статус выполнения")
    confidence: float = Field(ge=0.0, le=1.0, description="Уверенность в оценке")
    summary: str = Field(..., description="Краткое резюме")
    observations: List[AgentObservation] = Field(default_factory=list, description="Конкретные находки")
    reasoning: str = Field(..., description="Детальное обоснование решения")
    agent_steps: int = Field(default=0, description="Количество шагов агента")
    checked_files: List[str] = Field(default_factory=list, description="Проверенные файлы с строками (file:line-line)")
    ai_analysis: str = Field(default="", description="Сырой JSON вердикт от LLM")


# ============================================================================
# МОДЕЛИ ДЛЯ RAG
# ============================================================================

class CodeChunk(BaseModel):
    """Фрагмент кода для RAG индекса"""
    file_path: str = Field(..., description="Путь к файлу")
    start_line: int = Field(..., description="Начальная строка")
    end_line: int = Field(..., description="Конечная строка")
    text: str = Field(..., description="Текст фрагмента")
    
    class Config:
        frozen = False  # Разрешаем изменение для работы с legacy кодом


class RAGSearchResult(BaseModel):
    """Результат поиска в RAG"""
    chunk: CodeChunk = Field(..., description="Найденный фрагмент")
    score: float = Field(ge=0.0, description="Оценка релевантности")


# ============================================================================
# МОДЕЛИ ДЛЯ КОНТЕКСТА
# ============================================================================

class ContextSection(BaseModel):
    """Секция контекста с приоритетом"""
    content: str = Field(..., description="Содержимое")
    priority: int = Field(ge=1, le=10, description="Приоритет (1-10)")
    source: str = Field(..., description="Источник (RAG, grep, read_file)")
    timestamp: datetime = Field(default_factory=datetime.now, description="Когда добавлено")


class ContextStats(BaseModel):
    """Статистика контекста"""
    total_sections: int = Field(ge=0, description="Всего секций")
    total_characters: int = Field(ge=0, description="Всего символов")
    compressed_times: int = Field(default=0, description="Сколько раз сжимался")


# ============================================================================
# МОДЕЛИ ДЛЯ LLM
# ============================================================================

class LLMRequest(BaseModel):
    """Запрос к LLM"""
    system_prompt: str = Field(..., description="Системный промпт")
    user_prompt: str = Field(..., description="Пользовательский промпт")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0, description="Температура")
    max_tokens: int = Field(default=8192, ge=1, description="Максимум токенов")


class LLMResponse(BaseModel):
    """Ответ от LLM"""
    text: str = Field(..., description="Текст ответа")
    tokens_used: Optional[int] = Field(None, description="Использовано токенов")
    finish_reason: Optional[str] = Field(None, description="Причина завершения")


class LLMStats(BaseModel):
    """Статистика использования LLM"""
    total_requests: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    average_latency_ms: float = Field(default=0.0, ge=0.0)
    rate_limit_hits: int = Field(default=0, ge=0)


# ============================================================================
# МОДЕЛИ ДЛЯ БАЗЫ ДАННЫХ
# ============================================================================

class Project(BaseModel):
    """Проект для аудита"""
    project_id: Optional[int] = Field(None, description="ID проекта")
    project_name: str = Field(..., description="Название проекта")
    status: str = Field(default="created", description="Статус")
    created_at: datetime = Field(default_factory=datetime.now)


class Requirement(BaseModel):
    """Требование для проверки"""
    rule_id: Optional[int] = Field(None, description="ID требования")
    project_id: int = Field(..., description="ID проекта")
    rule_text: str = Field(..., description="Текст требования")


class ComplianceResult(BaseModel):
    """Результат проверки требования"""
    result_id: Optional[int] = Field(None, description="ID результата")
    rule_id: int = Field(..., description="ID требования")
    status: str = Field(..., description="Статус (✅/❌/❓)")
    explanation: str = Field(..., description="Объяснение")
    details: str = Field(default="", description="Детали")
    scanned_files: str = Field(default="", description="Проверенные файлы")
    ai_analysis: str = Field(default="", description="Анализ ИИ")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=datetime.now)


# ============================================================================
# МОДЕЛИ ДЛЯ WEB API
# ============================================================================

class AnalysisSettings(BaseModel):
    """Настройки анализа"""
    ai_provider: str = Field(default="gemini", description="Провайдер ИИ")
    api_key: str = Field(..., description="API ключ")
    max_file_size: int = Field(default=20, description="Макс размер файла MB")
    max_workers: int = Field(default=1, description="Кол-во воркеров")
    rate_limit_seconds: float = Field(default=15.0, description="Rate limit в секундах")


class AnalysisRequest(BaseModel):
    """Запрос на анализ"""
    project_name: str = Field(..., description="Название проекта")
    settings: AnalysisSettings = Field(..., description="Настройки")


class ProgressUpdate(BaseModel):
    """Обновление прогресса"""
    current: int = Field(ge=0, description="Текущее требование")
    total: int = Field(ge=0, description="Всего требований")
    percentage: float = Field(ge=0.0, le=100.0, description="Процент выполнения")
    current_requirement: str = Field(..., description="Текущее требование")
    agent_status: str = Field(..., description="Статус агента")
    completed: bool = Field(default=False, description="Завершено ли")


class AgentThought(BaseModel):
    """Мысль агента для отображения в UI"""
    phase: Literal[
        "understanding",  # Понимание требования
        "searching",      # Поиск в коде
        "analyzing",      # Анализ найденного
        "reasoning",      # Размышление
        "deciding",       # Принятие решения
        "completing"      # Завершение
    ] = Field(..., description="Фаза работы агента")
    
    text: str = Field(..., description="Основной текст мысли")
    action: Optional[str] = Field(None, description="Что делает агент")
    result: Optional[str] = Field(None, description="Результат действия")
    emotion: str = Field(default="🤔", description="Эмодзи для UI")


class AgentCommand(BaseModel):
    """Команда которую выполняет агент (для показа в терминале)"""
    command: str = Field(..., description="Команда (grep, find, cat)")
    comment: str = Field(..., description="Что ищет агент")
    output: Optional[str] = Field(None, description="Вывод команды")
    success: bool = Field(default=True, description="Успешно ли")


# ============================================================================
# МОДЕЛИ ДЛЯ STRUCTURED OUTPUTS
# ============================================================================

class AgentDecision(BaseModel):
    """Структурированное решение агента через LLM"""
    action: Literal[
        "grep_pattern",
        "read_file", 
        "find_symbol",
        "trace_usage",
        "analyze_imports",
        "semantic_search",
        "final_decision"
    ] = Field(..., description="Какое действие выполнить")
    
    target: str = Field(..., description="Цель (паттерн/файл/символ)")
    reasoning: str = Field(..., description="Почему это нужно")


class FinalVerdict(BaseModel):
    """Финальный вердикт агента"""
    final: bool = Field(True, description="Это финальный ответ")
    status: Literal["✅", "❌", "❓"] = Field(..., description="Статус")
    findings: List[str] = Field(..., description="Конкретные находки")
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)


# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ МОДЕЛИ
# ============================================================================

class ErrorResponse(BaseModel):
    """Ошибка API"""
    success: bool = Field(False, description="Успех")
    error: str = Field(..., description="Сообщение об ошибке")


class SuccessResponse(BaseModel):
    """Успешный ответ API"""
    success: bool = Field(True, description="Успех")
    message: str = Field(..., description="Сообщение")
    data: Optional[dict] = Field(None, description="Данные")

class ChatRequest(BaseModel):
    """Запрос на чат с агентом по требованию"""
    project_name: str = Field(..., description="Имя проекта")
    requirement_text: str = Field(..., description="Текст требования")
    user_message: str = Field(..., description="Сообщение пользователя")
    history: List[Dict[str, str]] = Field(default_factory=list, description="История сообщений")
    context_files: List[str] = Field(default_factory=list, description="Список уже проверенных файлов")
    api_key: Optional[str] = Field(None, description="API ключ")
    ai_provider: str = Field(default="gemini", description="Провайдер ИИ")