"""
FastAPI приложение - веб-сервер для системы аудита

Интегрирует:
- Автономного агента
- RAG систему
- Context Manager
- LLM клиент
- База данных
- WebSocket для real-time обновлений
"""

import os
# Suppress tokenizers warning
os.environ["TOKENIZERS_PARALLELISM"] = "false"
import asyncio
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import uvicorn

# Импорты нашей системы
from core.models import (
    AnalysisSettings, AnalysisRequest, ProgressUpdate,
    Project, Requirement, ComplianceResult, ChatRequest
)
from core.database import Database
from llm.client import LLMClient
from llm.gigachat_client import GigaChatClient
from rag.retriever import build_rag_index, select_chunks_for_context
from agent.autonomous import AutonomousAgent

# Импорты из старой системы (пока нужны для загрузки файлов)
from auditor.ingest import safe_extract_zip, build_manifest
from auditor.extract_requirements import extract_requirements_from_uploaded
from auditor.rules_engine import expand_code_paths

# ============================================================================
# НАСТРОЙКИ ПРИЛОЖЕНИЯ
# ============================================================================

PROJECTS_DIR = Path("./projects")
PROJECTS_DIR.mkdir(exist_ok=True)

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# База данных - можно переключать через переменную окружения
# Установите DB_MODE=file для файловой БД или DB_MODE=memory (по умолчанию)
DB_MODE = os.getenv("DB_MODE", "memory")

if DB_MODE == "memory":
    DB_PATH = ':memory:'
    print("🧠 Используется in-memory база данных (быстрый запуск, нет блокировок)")
else:
    DB_PATH = "local_database.db"
    print(f"💾 Используется файловая база данных: {DB_PATH}")

# ============================================================================
# ГЛОБАЛЬНОЕ СОСТОЯНИЕ
# ============================================================================

class ApplicationState:
    """Глобальное состояние приложения"""
    
    def __init__(self):
        self.database = Database(DB_PATH)
        self.websocket_connections = set()
        self.current_analysis = None
        self.analysis_tasks = {}  # project_id -> task_info
        self.llm_clients = {}  # project_id -> LLMClient
    
    def add_websocket(self, websocket: WebSocket):
        self.websocket_connections.add(websocket)
    
    def remove_websocket(self, websocket: WebSocket):
        self.websocket_connections.discard(websocket)
    
    async def broadcast_message(self, message_type: str, data: Dict[str, Any]):
        """Отправляет сообщение всем подключенным WebSocket клиентам"""
        if not self.websocket_connections:
            return
        
        message = {"type": message_type, "data": data}
        disconnected = []
        
        # ВАЖНО: Создаём копию set для итерации, чтобы избежать
        # "Set changed size during iteration" при конкурентном доступе
        connections_snapshot = list(self.websocket_connections)
        
        for websocket in connections_snapshot:
            try:
                import json
                await websocket.send_text(json.dumps(message))
                # Минимальная задержка для сброса буфера
                import asyncio
                await asyncio.sleep(0.001)
            except:
                disconnected.append(websocket)
        
        # Удаляем отключенные
        for ws in disconnected:
            self.websocket_connections.discard(ws)

app_state = ApplicationState()

# ============================================================================
# HELPER ФУНКЦИИ
# ============================================================================

def create_llm_client(provider: str, api_key: str = "", rate_limit_seconds: float = 8.0):
    """
    Создать LLM клиента в зависимости от провайдера

    Args:
        provider: "gemini" или "gigachat"
        api_key: API ключ (для Gemini)
        rate_limit_seconds: Задержка между запросами

    Returns:
        LLMClient или GigaChatClient
    """
    if provider.lower() == "gigachat":
        print(f"🤖 Создаю GigaChat клиента...")

        # Проверяем переменные окружения
        if not os.getenv('JPY_API_TOKEN'):
            raise ValueError("JPY_API_TOKEN не установлен. Настройте переменные окружения для GigaChat")

        if not os.getenv('GIGACHAT_API_URL'):
            raise ValueError("GIGACHAT_API_URL не установлен. Настройте переменные окружения для GigaChat")

        print(f"✅ JPY_API_TOKEN найден")
        print(f"✅ GIGACHAT_API_URL: {os.getenv('GIGACHAT_API_URL')}")

        return GigaChatClient(
            api_token=os.getenv('JPY_API_TOKEN'),
            base_url=os.getenv('GIGACHAT_API_URL')
        )

    elif provider.lower() == "gemini":
        print(f"🤖 Создаю Gemini клиента...")

        if not api_key:
            raise ValueError("API ключ не предоставлен для Gemini")

        return LLMClient(api_key=api_key, rate_limit_seconds=rate_limit_seconds)

    else:
        raise ValueError(f"Неизвестный провайдер: {provider}. Используйте 'gemini' или 'gigachat'")

# ============================================================================
# СОЗДАНИЕ FASTAPI ПРИЛОЖЕНИЯ
# ============================================================================

# Определяем root_path для работы через прокси Jupyter
# Можно задать через переменную окружения JUPYTER_PROXY_PATH
JUPYTER_PROXY_PATH = os.getenv("JUPYTER_PROXY_PATH", "")

# НЕ используем root_path в FastAPI - это ломает статику
# Вместо этого передаём его в шаблоны вручную
app = FastAPI(
    title="Интеллектуальный Аудитор ВНД",
    description="Система автоматического аудита кода на соответствие требованиям",
    version="3.0.0"
)

# Middleware для обработки прокси путей
class StripPrefixMiddleware(BaseHTTPMiddleware):
    """
    Убирает JUPYTER_PROXY_PATH из начала пути запроса
    Это позволяет FastAPI обрабатывать запросы как будто они пришли напрямую
    """
    async def dispatch(self, request: Request, call_next):
        if JUPYTER_PROXY_PATH and request.url.path.startswith(JUPYTER_PROXY_PATH):
            # Убираем префикс из пути
            request.scope["path"] = request.url.path[len(JUPYTER_PROXY_PATH):]
            # Убеждаемся что путь начинается с /
            if not request.scope["path"].startswith("/"):
                request.scope["path"] = "/" + request.scope["path"]
        
        response = await call_next(request)
        return response

# Добавляем middleware ПЕРВЫМ (он должен обработать запрос до остальных)
app.add_middleware(StripPrefixMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы - монтируем БЕЗ root_path
# JupyterHub прокси автоматически перенаправит /user/.../proxy/8001/static -> /static
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ============================================================================
# WEBSOCKET
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket для real-time обновлений"""
    await websocket.accept()
    app_state.add_websocket(websocket)
    
    try:
        # Отправляем приветствие
        import json
        await websocket.send_text(json.dumps({
            "type": "connected",
            "data": {"message": "Соединение установлено"}
        }))
        
        # Ожидаем сообщения
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Обработка ping
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "data": {}}))
    
    except WebSocketDisconnect:
        app_state.remove_websocket(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        app_state.remove_websocket(websocket)

# ============================================================================
# API МАРШРУТЫ
# ============================================================================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Главная страница"""
    # Передаём root_path для правильной генерации путей к статике
    return templates.TemplateResponse("index.html", {
        "request": request,
        "root_path": JUPYTER_PROXY_PATH if JUPYTER_PROXY_PATH else ""
    })

@app.post("/api/extract-requirements")
async def extract_requirements(
    project_file: UploadFile = File(...),
    requirements_file: UploadFile = File(...),
    project_name: str = Form(...),
    api_key: str = Form(""),  # Опционально - для GigaChat берется из переменных окружения
    ai_provider: str = Form("gemini")  # AI провайдер: gemini или gigachat
):
    """
    Умное извлечение требований из документа через LLM
    
    1. Сохраняем загруженные файлы
    2. Читаем документ (.txt, .pdf, .docx)
    3. Разбиваем на чанки если документ большой
    4. Обрабатываем каждый чанк через LLM
    5. Объединяем и дедуплицируем результаты
    6. Возвращаем для редактирования пользователем
    """
    try:
        # Сохраняем файлы
        project_path = UPLOAD_DIR / f"{project_name}_{int(time.time())}.zip"
        requirements_path = UPLOAD_DIR / f"req_{project_name}_{int(time.time())}.{requirements_file.filename.split('.')[-1]}"
        
        with open(project_path, "wb") as f:
            content = await project_file.read()
            f.write(content)
        
        with open(requirements_path, "wb") as f:
            content = await requirements_file.read()
            f.write(content)
        
        # Создаём LLM клиента для извлечения
        from llm.requirements_extractor import RequirementsExtractor, read_document

        # Проверка настроек для GigaChat
        if ai_provider.lower() == "gigachat":
            if not os.getenv('JPY_API_TOKEN'):
                raise ValueError(
                    "GigaChat выбран, но JPY_API_TOKEN не установлен. "
                    "Установите переменную окружения в notebook (ячейка 2) и перезапустите сервер."
                )
            if not os.getenv('GIGACHAT_API_URL'):
                raise ValueError(
                    "GigaChat выбран, но GIGACHAT_API_URL не установлен. "
                    "Установите переменную окружения в notebook (ячейка 2) и перезапустите сервер."
                )
            print(f"✅ GigaChat переменные окружения проверены")
        elif ai_provider.lower() == "gemini":
            if not api_key or len(api_key.strip()) == 0:
                raise ValueError(
                    "Gemini выбран, но API ключ не предоставлен. "
                    "Введите API ключ в поле 'API Ключ' в интерфейсе."
                )

        # Используем выбранный AI провайдер (Gemini или GigaChat)
        if ai_provider.lower() == "gemini" and api_key:
            masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
            print(f"🔑 API Key received: {masked_key}")
        
        llm_client = create_llm_client(provider=ai_provider, api_key=api_key, rate_limit_seconds=8)
        extractor = RequirementsExtractor(llm_client, chunk_size=15000, overlap=500)
        
        # Callback для прогресса
        async def progress_callback(current_chunk, total_chunks, requirements_count):
            await app_state.broadcast_message("extraction_progress", {
                "current": current_chunk,
                "total": total_chunks,
                "percentage": round((current_chunk / total_chunks) * 100, 1),
                "requirements_found": requirements_count,
                "status": f"Обработка фрагмента {current_chunk}/{total_chunks}"
            })
        
        # Читаем документ
        print(f"📄 Чтение документа: {requirements_file.filename}")
        await app_state.broadcast_message("extraction_progress", {
            "status": "Чтение документа...",
            "percentage": 0
        })
        
        document_text = read_document(str(requirements_path))
        
        if not document_text or len(document_text) < 50:
            raise HTTPException(status_code=400, detail="Документ пустой или слишком короткий")
        
        print(f"📊 Размер документа: {len(document_text)} символов")
        
        # Извлекаем требования через LLM
        await app_state.broadcast_message("extraction_progress", {
            "status": "Извлечение требований через LLM...",
            "percentage": 5
        })
        
        requirements = await extractor.extract_from_text(document_text, progress_callback)
        
        if not requirements:
            raise HTTPException(status_code=400, detail="Не удалось извлечь требования из документа")
        
        # Создаём проект в БД
        project_id = app_state.database.create_project(project_name)
        
        # Сохраняем требования
        app_state.database.create_requirements_batch(project_id, requirements)
        
        # Сохраняем информацию для последующего использования
        app_state.analysis_tasks[project_id] = {
            'project_path': str(project_path),
            'requirements_path': str(requirements_path),
            'project_name': project_name,
            'requirements': requirements
        }
        
        await app_state.broadcast_message("extraction_complete", {
            "status": "✅ Извлечение завершено",
            "requirements_count": len(requirements)
        })
        
        return JSONResponse({
            "success": True,
            "project_id": project_id,
            "requirements": requirements,
            "message": f"Извлечено {len(requirements)} требований через LLM"
        })
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error extracting requirements: {e}")
        print(error_trace)

        await app_state.broadcast_message("extraction_error", {
            "error": str(e)
        })

        # Возвращаем JSON вместо HTTPException для правильной обработки на фронтенде
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": f"Ошибка извлечения требований: {str(e)}"
            }
        )

@app.post("/api/update-requirements")
async def update_requirements(
    project_id: int = Form(...),
    requirements: str = Form(...)  # JSON string с массивом требований
):
    """
    Обновление требований после редактирования пользователем
    
    Args:
        project_id: ID проекта
        requirements: JSON строка с массивом требований
    """
    try:
        import json
        requirements_list = json.loads(requirements)
        
        if not requirements_list:
            raise HTTPException(status_code=400, detail="Список требований пуст")
        
        # Удаляем старые требования
        app_state.database.delete_requirements(project_id)
        
        # Сохраняем новые
        app_state.database.create_requirements_batch(project_id, requirements_list)
        
        # Обновляем кэш
        if project_id in app_state.analysis_tasks:
            app_state.analysis_tasks[project_id]['requirements'] = requirements_list
        
        return JSONResponse({
            "success": True,
            "message": f"Обновлено {len(requirements_list)} требований"
        })
    
    except Exception as e:
        print(f"Error updating requirements: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-audit")
async def start_audit(request: AnalysisRequest):
    """
    Запуск анализа
    
    1. Находим проект в БД
    2. Создаём LLM клиента
    3. Запускаем анализ в фоновом режиме
    """
    try:
        # Находим проект
        project = app_state.database.get_project_by_name(request.project_name)
        
        if not project:
            raise HTTPException(status_code=404, detail="Проект не найден")
        
        project_id = project.project_id
        
        # Обновляем статус
        app_state.database.update_project_status(project_id, "analysis_started")

        # Создаём LLM клиента в зависимости от выбранного провайдера
        if request.settings.ai_provider.lower() == "gemini" and request.settings.api_key:
            key = request.settings.api_key
            masked_key = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "***"
            print(f"🔑 API Key for audit: {masked_key}")

        llm_client = create_llm_client(
            provider=request.settings.ai_provider,
            api_key=request.settings.api_key,
            rate_limit_seconds=request.settings.rate_limit_seconds
        )
        app_state.llm_clients[project_id] = llm_client
        
        # Запускаем анализ в фоне
        app_state.current_analysis = project_id
        asyncio.create_task(run_analysis(project_id, request.settings))
        
        return JSONResponse({
            "success": True,
            "project_id": project_id,
            "message": "Анализ запущен"
        })
    
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/results")
async def get_results():
    """Получение результатов анализа"""
    try:
        project_id = app_state.current_analysis
        
        if not project_id:
            # Берём последний завершённый проект
            projects = app_state.database.list_projects(limit=1)
            if not projects:
                return JSONResponse({"success": False, "error": "Нет проектов"})
            project_id = projects[0].project_id
        
        # Получаем результаты
        results_data = app_state.database.get_results_by_project(project_id)
        
        results = []
        for requirement, result in results_data:
            results.append({
                "requirement": requirement.rule_text,
                "status": result.status,
                "explanation": result.explanation,
                "details": result.details,
                "confidence": result.confidence,
                "ai_analysis": result.ai_analysis
            })
        
        return JSONResponse({
            "success": True,
            "data": results
        })
    
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse({"success": False, "error": str(e)})

@app.get("/api/status")
async def get_system_status():
    """Получение статуса системы"""
    return JSONResponse({
        "status": "ready" if not app_state.current_analysis else "analyzing",
        "current_analysis": app_state.current_analysis,
        "connected_clients": len(app_state.websocket_connections)
    })

# ============================================================================
# ЛОГИКА АНАЛИЗА
# ============================================================================

async def run_analysis(project_id: int, settings: AnalysisSettings):
    """
    ГЛАВНАЯ ФУНКЦИЯ - запуск анализа проекта
    
    Args:
        project_id: ID проекта
        settings: Настройки анализа
    """
    try:
        print(f"🚀 Запуск анализа проекта {project_id}")
        
        # Получаем LLM клиента
        llm_client = app_state.llm_clients.get(project_id)
        if not llm_client:
            raise Exception("LLM клиент не найден")
        
        # Получаем требования
        requirements = app_state.database.get_requirements(project_id)
        
        if not requirements:
            raise Exception("Требования не найдены")
        
        print(f"📋 Найдено {len(requirements)} требований")
        
        # Получаем информацию о проекте
        task_info = app_state.analysis_tasks.get(project_id)
        if not task_info:
            raise Exception("Информация о проекте не найдена")
        
        # Распаковываем архив
        project_root = PROJECTS_DIR / task_info['project_name']
        project_root.mkdir(exist_ok=True)
        
        print(f"📦 Распаковка архива в {project_root}")
        safe_extract_zip(task_info['project_path'], str(project_root))
        
        # Создаём манифест файлов
        manifest = build_manifest(str(project_root), max_file_size_mb=settings.max_file_size)
        code_paths = expand_code_paths(manifest)
        
        print(f"📂 Найдено {len(code_paths)} файлов")
        
        # Строим RAG индекс
        print(f"🔍 Построение RAG индекса...")
        await app_state.broadcast_message("agent_thought", {
            "phase": "searching",
            "text": "Создаю индекс для поиска по коду",
            "action": f"Индексирую {len(code_paths)} файлов",
            "emotion": "🔍"
        })
        
        retriever = build_rag_index(code_paths)
        
        # Анализируем каждое требование
        total_requirements = len(requirements)
        
        for i, requirement in enumerate(requirements):
            try:
                print(f"\n📝 Анализ {i+1}/{total_requirements}: {requirement.rule_text[:50]}...")
                
                # Отправляем прогресс
                await app_state.broadcast_message("progress_update", {
                    "current": i,
                    "total": total_requirements,
                    "percentage": round((i / total_requirements) * 100, 1),
                    "current_requirement": requirement.rule_text[:100],
                    "agent_status": f"Анализирую требование {i+1}",
                    "completed": False
                })
                
                # Анализируем требование
                result = await analyze_single_requirement(
                    requirement.rule_text,
                    retriever,
                    llm_client,
                    str(project_root)
                )
                
                # Сохраняем результат
                # Используем checked_files если есть, иначе берём из observations
                scanned_files_str = ",".join(result.checked_files) if result.checked_files else ",".join([obs.location.file for obs in result.observations[:5]])

                compliance_result = ComplianceResult(
                    rule_id=requirement.rule_id,
                    status=result.status,
                    explanation=result.summary,
                    details=result.reasoning,
                    scanned_files=scanned_files_str,
                    ai_analysis=result.ai_analysis if result.ai_analysis else f"Агент: {result.agent_steps} шагов, уверенность {result.confidence}",
                    confidence=result.confidence
                )
                
                app_state.database.save_result(compliance_result)
                
                # Обновляем прогресс
                await app_state.broadcast_message("progress_update", {
                    "current": i + 1,
                    "total": total_requirements,
                    "percentage": round(((i + 1) / total_requirements) * 100, 1),
                    "current_requirement": requirement.rule_text[:100],
                    "agent_status": f"Завершено: {result.status}",
                    "completed": False
                })
            
            except Exception as e:
                print(f"❌ Ошибка анализа требования {requirement.rule_id}: {e}")
                
                # Сохраняем ошибку
                error_result = ComplianceResult(
                    rule_id=requirement.rule_id,
                    status="❓",
                    explanation=f"Ошибка анализа: {str(e)}",
                    details="",
                    scanned_files="",
                    ai_analysis="",
                    confidence=0.0
                )
                app_state.database.save_result(error_result)
        
        # Завершение
        app_state.database.update_project_status(project_id, "analysis_completed")
        
        await app_state.broadcast_message("progress_update", {
            "current": total_requirements,
            "total": total_requirements,
            "percentage": 100.0,
            "current_requirement": "Анализ завершён!",
            "agent_status": "Все требования проанализированы",
            "completed": True
        })
        
        await app_state.broadcast_message("analysis_complete", {
            "status": "✅",
            "text": "Анализ успешно завершён",
            "reasoning": f"Проанализировано {total_requirements} требований",
            "aiComment": "Результаты доступны в отчёте"
        })
        
        app_state.current_analysis = None
        print(f"✅ Анализ завершён!")
    
    except Exception as e:
        print(f"❌ Ошибка анализа: {e}")
        
        app_state.database.update_project_status(project_id, "analysis_failed")
        
        await app_state.broadcast_message("error", {
            "message": f"Ошибка анализа: {str(e)}"
        })
        
        app_state.current_analysis = None

async def analyze_single_requirement(
    requirement_text: str,
    retriever,
    llm_client,
    project_root: str
):
    """
    Анализ одного требования
    
    Args:
        requirement_text: Текст требования
        retriever: RAG retriever
        llm_client: LLM клиент
        project_root: Корень проекта
        
    Returns:
        AnalysisResult
    """
    # Callback для WebSocket
    async def ws_callback(message_type: str, data: Dict):
        await app_state.broadcast_message(message_type, data)
    
    # RAG поиск (уменьшено до 5 для экономии контекста)
    rag_results = retriever.search(requirement_text, top_k=5)
    
    # Создаём агента
    agent = AutonomousAgent(llm_client, project_root, retriever=retriever)
    
    # Запускаем анализ
    result = await agent.analyze_requirement(
        requirement=requirement_text,
        initial_chunks=rag_results,
        ui_callback=ws_callback
    )
    
    return result

# ============================================================================
# ЗАПУСК ПРИЛОЖЕНИЯ
# ============================================================================

if __name__ == "__main__":
    print("🚀 Запуск интеллектуального аудитора ВНД v3.0")
    print("🌐 Интерфейс: http://localhost:8001")
    print("📊 БЕЗ захардкоженных паттернов - ВСЁ через LLM!")
    print("🤖 Автономный агент с сжатием контекста")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info"
    )

@app.post("/api/chat-requirement")
async def chat_requirement(request: ChatRequest):
    """
    Чат с агентом по конкретному требованию
    """
    try:
        project_path = PROJECTS_DIR / request.project_name
        if not project_path.exists():
            raise HTTPException(status_code=404, detail="Project not found")

        # Создаём LLM клиента (легковесного для чата)
        llm_client = create_llm_client(
            provider=request.ai_provider,
            api_key=request.api_key,
            rate_limit_seconds=15.0 # Используем тот же rate limit
        )
        
        # Инициализируем агента
        agent = AutonomousAgent(llm_client, str(project_path))
        
        # Восстанавливаем контекст (какие файлы уже смотрели)
        for file in request.context_files:
            # Формат file: "path/to/file.py:10-50" или просто путь
            path_part = file.split(':')[0]
            agent.visited_files.add(path_part)
            agent.checked_files.append(file)
            
        # Callback для UI (отправляем действия агента в чат)
        async def chat_ui_callback(msg_type: str, data: Dict[str, Any]):
            # В чате мы хотим видеть только действия, но в упрощенном виде
            # Можно реализовать стриминг через WebSocket, но пока просто вернем ответ
            # В будущем можно добавить стриминг мыслей в чат
            pass

        # Запускаем ответ на вопрос
        answer = await agent.answer_question(
            requirement=request.requirement_text,
            question=request.user_message,
            history=request.history,
            ui_callback=chat_ui_callback
        )
        
        return {"success": True, "answer": answer}
        
    except Exception as e:
        print(f"Chat error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )