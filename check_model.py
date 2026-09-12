#!/usr/bin/env python3
"""
Скрипт для проверки и диагностики локальной модели all-MiniLM-L6-v2
Запустите: python3 check_model.py
"""

from pathlib import Path

def check_model():
    model_dir = Path("rag/all-MiniLM-L6-v2")
    
    print("=" * 70)
    print("🔍 Проверка локальной модели all-MiniLM-L6-v2")
    print("=" * 70)
    print()
    
    # Проверка существования папки
    if not model_dir.exists():
        print("❌ Папка модели не найдена:", model_dir.absolute())
        print()
        print("✅ Решение: Скачайте модель или удалите папку, чтобы")
        print("   система автоматически загрузила модель из HuggingFace")
        return False
    
    print(f"✅ Папка модели найдена: {model_dir.absolute()}")
    print()
    
    # Проверка обязательных файлов
    required_files = {
        'config.json': 'Конфигурация модели',
        'tokenizer.json': 'Токенизатор',
        'tokenizer_config.json': 'Конфигурация токенизатора',
        'vocab.txt': 'Словарь',
        'special_tokens_map.json': 'Специальные токены'
    }
    
    # Дополнительные файлы (хотя бы один должен быть)
    model_weight_files = [
        'pytorch_model.bin',  # PyTorch формат
        'model.safetensors',  # SafeTensors формат
        'tf_model.h5',        # TensorFlow формат
    ]
    
    missing_files = []
    found_files = []
    
    print("📋 Проверка обязательных файлов:")
    for file, description in required_files.items():
        file_path = model_dir / file
        if file_path.exists():
            size = file_path.stat().st_size
            print(f"  ✅ {file:30s} ({size:,} байт) - {description}")
            found_files.append(file)
        else:
            print(f"  ❌ {file:30s} - {description} - ОТСУТСТВУЕТ!")
            missing_files.append(file)
    
    print()
    print("📋 Проверка файлов весов модели (нужен хотя бы один):")
    weights_found = False
    for file in model_weight_files:
        file_path = model_dir / file
        if file_path.exists():
            size = file_path.stat().st_size
            print(f"  ✅ {file:30s} ({size:,} байт)")
            weights_found = True
        else:
            print(f"  ⚪ {file:30s} - не найден")
    
    if not weights_found:
        print()
        print("  ❌ Не найден ни один файл весов модели!")
        missing_files.append("pytorch_model.bin или model.safetensors")
    
    print()
    print("=" * 70)
    
    # Финальный вердикт
    if missing_files:
        print("❌ МОДЕЛЬ НЕПОЛНАЯ!")
        print()
        print("Отсутствующие файлы:")
        for f in missing_files:
            print(f"  - {f}")
        print()
        print("🔧 Решение:")
        print("  1. Удалите папку rag/all-MiniLM-L6-v2/")
        print("     rm -rf rag/all-MiniLM-L6-v2/")
        print()
        print("  2. Или скачайте полную модель с HuggingFace:")
        print("     https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2")
        print()
        print("  3. Или используйте TF-IDF режим (без embeddings)")
        print("     См. файл DISABLE_EMBEDDINGS.md")
        return False
    else:
        print("✅ МОДЕЛЬ ПОЛНАЯ И ГОТОВА К ИСПОЛЬЗОВАНИЮ!")
        print()
        
        # Пробуем загрузить модель
        print("🔄 Попытка загрузки модели...")
        try:
            from sentence_transformers import SentenceTransformer
            print("  ✅ sentence-transformers установлен")
            
            print(f"  🔄 Загрузка модели из {model_dir}...")
            model = SentenceTransformer(str(model_dir))
            print(f"  ✅ Модель успешно загружена!")
            print(f"  📊 Размерность embeddings: {model.get_sentence_embedding_dimension()}")
            print(f"  📏 Макс. длина последовательности: {model.max_seq_length}")
            
            # Тестовое преобразование
            print("  🔄 Тестовое преобразование...")
            test_text = "Hello, this is a test"
            embedding = model.encode(test_text)
            print(f"  ✅ Тест пройден! Размер вектора: {len(embedding)}")
            
            return True
            
        except ImportError:
            print("  ⚠️ sentence-transformers не установлен")
            print("  Установите: pip install sentence-transformers torch")
            return False
        except Exception as e:
            print(f"  ❌ Ошибка загрузки модели: {e}")
            print()
            print("  🔧 Возможные причины:")
            print("    - Файлы модели повреждены")
            print("    - Несовместимая версия библиотек")
            print("    - Недостаточно RAM")
            print()
            print("  Попробуйте удалить папку и скачать модель заново")
            return False

if __name__ == "__main__":
    success = check_model()
    print()
    if not success:
        exit(1)