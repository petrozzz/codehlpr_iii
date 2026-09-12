"""
Умное извлечение требований из документов через LLM
С разбиением больших документов на чанки
"""

import re
from typing import List, Optional, Callable
from pathlib import Path


class RequirementsExtractor:
    """
    Извлекает требования из больших документов через LLM
    
    Основные возможности:
    - Разбиение документа на чанки с перекрытием
    - Обработка каждого чанка через LLM
    - Объединение и дедупликация результатов
    - Прогресс через callback
    """
    
    def __init__(self, llm_client, chunk_size: int = 15000, overlap: int = 500):
        """
        Args:
            llm_client: LLM клиент для обработки
            chunk_size: Размер чанка в символах
            overlap: Перекрытие между чанками для контекста
        """
        self.llm = llm_client
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def split_into_chunks(self, text: str) -> List[str]:
        """
        Разбивает текст на чанки с перекрытием
        
        Args:
            text: Исходный текст
            
        Returns:
            Список чанков
        """
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            # Если это последний чанк
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Пытаемся разбить по параграфу
            chunk_text = text[start:end]
            
            # Ищем конец параграфа
            last_para = chunk_text.rfind('\n\n')
            if last_para > self.chunk_size // 2:  # Если нашли параграф в второй половине
                end = start + last_para
            else:
                # Иначе ищем конец предложения
                last_sentence = max(
                    chunk_text.rfind('. '),
                    chunk_text.rfind('.\n'),
                    chunk_text.rfind('! '),
                    chunk_text.rfind('? ')
                )
                if last_sentence > self.chunk_size // 2:
                    end = start + last_sentence + 1
            
            chunks.append(text[start:end])
            start = end - self.overlap  # Перекрытие для контекста
        
        return chunks
    
    async def extract_from_chunk(
        self,
        chunk: str,
        chunk_index: int,
        total_chunks: int
    ) -> List[str]:
        """
        Извлекает требования из одного чанка
        
        Args:
            chunk: Текст чанка
            chunk_index: Номер чанка (для промпта)
            total_chunks: Общее количество чанков
            
        Returns:
            Список требований
        """
        system_prompt = """Извлеки все проверяемые требования из документа.

# ЧТО ИЗВЛЕКАТЬ

Требование = любое утверждение которое:
- Описывает ЧТО должно быть сделано (действие, поведение, результат)
- Можно проверить в коде, документации или конфигурации
- Содержит конкретику (числа, формулы, процессы, правила)

Извлекай требования из ЛЮБОЙ предметной области:
- Банковские расчеты (формулы риска, лимиты, категории)
- Бизнес-логика (процессы, правила, условия)
- Техническое (логирование, безопасность, производительность)
- Регуляторное (соответствие стандартам, отчетность)
- Инфраструктурное (развертывание, мониторинг, резервирование)

# КАК ОБРАБАТЫВАТЬ

**Составные утверждения** - разбивай на атомарные требования:
"Поле X должно быть от 5 до 10 символов и содержать только цифры"
→ 3 требования: минимум, максимум, формат

**Формулы и вычисления** - сохраняй как есть:
"Коэффициент риска = (Актив / Капитал) * 100, не более 25%"
→ 1 требование с формулой целиком

**Неявные требования** - делай явными:
"Клиент категории А получает ставку 5%"
→ "Система должна присваивать ставку 5% клиентам категории А"

**Термины** - сохраняй оригинальную терминологию документа

# НЕ ИЗВЛЕКАТЬ

- Описания контекста ("В целях безопасности...")
- Общие декларации без конкретики ("Система должна быть надежной")
- Дубликаты
- Чисто организационное ("Документ утверждается...")

# ФОРМАТ

Возвращай ТОЛЬКО пронумерованный список, каждое требование - отдельная строка:

1. [Полный текст требования]
2. [Полный текст требования]

Извлекай ВСЕ - лучше больше, чем пропустить важное.
"""
        
        chunk_context = ""
        if total_chunks > 1:
            chunk_context = f"\n\n[Это фрагмент {chunk_index + 1} из {total_chunks}. Извлекай требования только из этого фрагмента.]"
        
        user_prompt = f"""ДОКУМЕНТ (фрагмент):
{chunk}
{chunk_context}

Извлеки все конкретные требования из этого фрагмента."""
        
        try:
            response = self.llm.complete(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,
                max_tokens=4000
            )
            
            if not response or response.startswith("[LLM Error]"):
                return []
            
            # Парсим ответ
            requirements = []
            lines = response.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Убираем нумерацию
                cleaned = re.sub(r'^\d+[\.)]\s*', '', line)
                cleaned = re.sub(r'^[-•*]\s*', '', cleaned)
                
                if len(cleaned) > 20:  # Минимальная длина требования
                    requirements.append(cleaned)
            
            return requirements
        
        except Exception as e:
            print(f"❌ Ошибка извлечения из чанка {chunk_index + 1}: {e}")
            return []
    
    def deduplicate_requirements(self, requirements: List[str]) -> List[str]:
        """
        Убирает дубликаты требований
        
        Args:
            requirements: Список требований (могут быть дубликаты)
            
        Returns:
            Список уникальных требований
        """
        if not requirements:
            return []
        
        unique = []
        seen_normalized = set()
        
        for req in requirements:
            # Нормализуем для сравнения
            normalized = re.sub(r'\s+', ' ', req.lower().strip())
            normalized = re.sub(r'[^\w\s]', '', normalized)
            
            # Проверяем на похожесть
            is_duplicate = False
            for seen in seen_normalized:
                # Если совпадение > 85% - это дубликат
                similarity = self._similarity(normalized, seen)
                if similarity > 0.85:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique.append(req)
                seen_normalized.add(normalized)
        
        return unique
    
    def _similarity(self, s1: str, s2: str) -> float:
        """Простая метрика похожести строк"""
        words1 = set(s1.split())
        words2 = set(s2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1 & words2
        union = words1 | words2
        
        return len(intersection) / len(union)
    
    async def extract_from_text(
        self,
        text: str,
        progress_callback: Optional[Callable] = None
    ) -> List[str]:
        """
        Извлекает требования из текста
        
        Args:
            text: Исходный текст документа
            progress_callback: Callback для прогресса (chunk_index, total_chunks, requirements_so_far)
            
        Returns:
            Список требований
        """
        if not text or len(text) < 50:
            return []
        
        # Разбиваем на чанки
        chunks = self.split_into_chunks(text)
        total_chunks = len(chunks)
        
        print(f"📄 Документ разбит на {total_chunks} фрагментов")
        
        all_requirements = []
        
        # Обрабатываем каждый чанк
        for i, chunk in enumerate(chunks):
            print(f"🔍 Обработка фрагмента {i + 1}/{total_chunks}...")
            
            # Извлекаем требования
            chunk_requirements = await self.extract_from_chunk(chunk, i, total_chunks)
            
            if chunk_requirements:
                print(f"✅ Найдено {len(chunk_requirements)} требований")
                all_requirements.extend(chunk_requirements)
            
            # Отправляем прогресс
            if progress_callback:
                try:
                    await progress_callback(i + 1, total_chunks, len(all_requirements))
                except Exception:
                    pass
        
        # Дедупликация
        print(f"🔄 Объединение результатов...")
        unique_requirements = self.deduplicate_requirements(all_requirements)
        
        print(f"✅ Итого уникальных требований: {len(unique_requirements)}")
        
        return unique_requirements


def read_document(file_path: str) -> str:
    """
    Читает документ и возвращает текст
    
    Поддерживает: .txt, .pdf, .docx
    
    Args:
        file_path: Путь к файлу
        
    Returns:
        Текст документа
    """
    path = Path(file_path)
    extension = path.suffix.lower()
    
    try:
        if extension == '.txt':
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        
        elif extension == '.pdf':
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            text = []
            for page in doc:
                text.append(page.get_text())
            doc.close()
            return '\n\n'.join(text)
        
        elif extension == '.docx':
            from docx import Document
            doc = Document(file_path)
            text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    text.append(para.text)
            return '\n\n'.join(text)
        
        else:
            # Пробуем как текст
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
    
    except Exception as e:
        print(f"❌ Ошибка чтения документа: {e}")
        return ""