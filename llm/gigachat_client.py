"""
GigaChat LLM Client - клиент для работы с GigaChat API
Поддерживает работу через переменные окружения JPY_API_TOKEN и GIGACHAT_API_URL
"""

import os
import requests
import json
import time
from typing import Optional

class GigaChatClient:
    """
    Клиент для работы с GigaChat API

    Использует переменные окружения:
    - JPY_API_TOKEN: токен доступа
    - GIGACHAT_API_URL: базовый URL API (например, https://gigachat.devices.sberbank.ru/api/v1)
    """

    def __init__(self, api_token: Optional[str] = None, base_url: Optional[str] = None):
        """
        Args:
            api_token: Токен доступа (если не указан, берётся из JPY_API_TOKEN)
            base_url: Базовый URL API (если не указан, берётся из GIGACHAT_API_URL)
        """
        self.api_token = api_token or os.getenv('JPY_API_TOKEN')
        self.base_url = base_url or os.getenv('GIGACHAT_API_URL')

        if not self.api_token:
            raise ValueError("GigaChat API token not found. Set JPY_API_TOKEN environment variable or pass api_token parameter")

        if not self.base_url:
            raise ValueError("GigaChat API URL not found. Set GIGACHAT_API_URL environment variable or pass base_url parameter")

        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        # Rate limiting: 1 запрос в 8 секунд (как у Gemini)
        self.rate_limit_seconds = 8.0
        self.last_request_time = 0

        # Статистика
        self.total_requests = 0
        self.total_tokens = 0

    def _wait_rate_limit(self):
        """Ожидание rate limit"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_seconds:
            wait_time = self.rate_limit_seconds - elapsed
            print(f"⏳ Rate limit: ожидание {wait_time:.1f}s")
            time.sleep(wait_time)

        self.last_request_time = time.time()

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.01,
        max_tokens: int = 8192,
        model: str = "GigaChat-2-Max",
        max_retries: int = 3
    ) -> str:
        """
        Получить completion от GigaChat

        Args:
            system_prompt: Системный промпт
            user_prompt: Пользовательский промпт
            temperature: Температура (0.01 = детерминированно)
            max_tokens: Максимум токенов в ответе
            model: Модель GigaChat (по умолчанию GigaChat-2)
            max_retries: Максимум попыток при ошибке 429

        Returns:
            Текст ответа от модели
        """
        self._wait_rate_limit()

        # GigaChat API использует массив сообщений
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "n": 1
        }

        retry_count = 0
        while retry_count <= max_retries:
            try:
                response = requests.post(
                    url=f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=data,
                    timeout=120  # 2 минуты таймаут
                )

                self.total_requests += 1

                # HTTP 429: Rate Limit - автоматическая повторная попытка
                if response.status_code == 429:
                    if retry_count < max_retries:
                        retry_count += 1
                        print(f"⚠️ HTTP 429 Rate Limit - ожидание 8s перед попыткой {retry_count}/{max_retries}")
                        time.sleep(6)  # Пауза 8 секунд
                        continue  # Повторная попытка
                    else:
                        error_msg = f"[GigaChat Error] HTTP 429: Rate limit exceeded after {max_retries} retries"
                        print(f"❌ {error_msg}")
                        return error_msg

                if response.ok:
                    result = response.json()

                    # Извлекаем текст из ответа
                    if "choices" in result and len(result["choices"]) > 0:
                        content = result["choices"][0]["message"]["content"]

                        # Статистика токенов (если доступна)
                        if "usage" in result:
                            self.total_tokens += result["usage"].get("total_tokens", 0)

                        return content
                    else:
                        return "[GigaChat Error] Неожиданный формат ответа"

                else:
                    error_msg = f"[GigaChat Error] HTTP {response.status_code}: {response.text}"
                    print(f"❌ {error_msg}")
                    return error_msg

            except requests.exceptions.Timeout:
                error_msg = "[GigaChat Error] Request timeout (120s)"
                print(f"❌ {error_msg}")
                return error_msg

            except requests.exceptions.RequestException as e:
                error_msg = f"[GigaChat Error] Request failed: {str(e)}"
                print(f"❌ {error_msg}")
                return error_msg

            except Exception as e:
                error_msg = f"[GigaChat Error] Unexpected error: {str(e)}"
                print(f"❌ {error_msg}")
                return error_msg

        # Этот код недостижим, но для безопасности
        return "[GigaChat Error] Unexpected loop exit"

    def get_available_models(self) -> list:
        """
        Получить список доступных моделей GigaChat

        Returns:
            Список названий моделей
        """
        try:
            response = requests.get(
                url=f"{self.base_url}/models",
                headers=self.headers,
                timeout=30
            )

            if response.ok:
                result = response.json()
                if "data" in result:
                    return [model["id"] for model in result["data"]]
                return []
            else:
                print(f"❌ Не удалось получить список моделей: {response.status_code}")
                return []

        except Exception as e:
            print(f"❌ Ошибка получения моделей: {e}")
            return []

    def get_stats(self) -> dict:
        """Получить статистику использования"""
        return {
            "total_requests": self.total_requests,
            "total_tokens": self.total_tokens,
            "rate_limit_seconds": self.rate_limit_seconds
        }

# Пример использования (для тестирования)
if __name__ == "__main__":
    print("🧪 Тестирование GigaChat клиента...")
    print("")

    # Проверка переменных окружения
    if not os.getenv('JPY_API_TOKEN'):
        print("❌ JPY_API_TOKEN не установлен")
        exit(1)

    if not os.getenv('GIGACHAT_API_URL'):
        print("❌ GIGACHAT_API_URL не установлен")
        exit(1)

    print(f"✅ JPY_API_TOKEN: {os.getenv('JPY_API_TOKEN')[:20]}...")
    print(f"✅ GIGACHAT_API_URL: {os.getenv('GIGACHAT_API_URL')}")
    print("")