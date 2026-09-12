#!/usr/bin/env python3
"""
Простой скрипт запуска для JupyterHub с автоматической остановкой старых процессов
Без зависимости от psutil - работает везде!
"""

import os
import subprocess
import time

PORT = 8001

def kill_processes_on_port(port):
    """Останавливает все процессы, использующие указанный порт"""
    try:
        # Находим процессы на порту
        result = subprocess.run(
            ['lsof', '-ti', f':{port}'],
            capture_output=True,
            text=True
        )
        
        pids = result.stdout.strip().split('\n')
        pids = [pid.strip() for pid in pids if pid.strip()]
        
        if pids:
            print(f"⚠️  Найдено процессов на порту {port}: {len(pids)}")
            
            for pid in pids:
                try:
                    subprocess.run(['kill', '-9', pid])
                    print(f"✅ Процесс {pid} остановлен")
                except Exception as e:
                    print(f"⚠️  Не удалось остановить процесс {pid}: {e}")
            
            time.sleep(1)
            return len(pids)
        else:
            return 0
            
    except FileNotFoundError:
        # lsof не найден - пробуем другой метод
        print("⚠️  lsof не найден, пропускаем проверку порта")
        return 0
    except Exception as e:
        print(f"⚠️  Ошибка при проверке порта: {e}")
        return 0

def main():
    print("=" * 70)
    print("🚀 Запуск интеллектуального аудитора ВНД")
    print("=" * 70)
    print()
    
    # Останавливаем старые процессы
    print(f"🔍 Проверка порта {PORT}...")
    killed = kill_processes_on_port(PORT)
    
    if killed:
        print(f"✅ Остановлено процессов: {killed}")
    else:
        print(f"✅ Порт {PORT} свободен")
    
    print()
    print("🌐 Приложение будет доступно по адресу:")
    
    # Проверяем окружение JupyterHub
    user = os.environ.get('JUPYTERHUB_USER', os.getenv('USER', 'user'))
    proxy_path = f"/user/{user}/proxy/{PORT}"
    
    if 'JUPYTERHUB_USER' in os.environ:
        base_url = os.environ.get('JUPYTERHUB_BASE_URL', 'https://jupyterhub-datalab.apps.prom-datalab.ca.sbrf.ru')
        print(f"   {base_url}{proxy_path}/")
    else:
        print(f"   http://localhost:{PORT}/")
    
    print()
    print("⏹️  Для остановки нажмите кнопку 'Stop' в Jupyter или Ctrl+C")
    print()
    print("=" * 70)
    print()
    
    # Запускаем приложение
    try:
        # Используем os.execvp для замены текущего процесса
        # Это гарантирует что при остановке ячейки остановится и app.py
        os.execvp('python3', ['python3', 'app.py'])
    except KeyboardInterrupt:
        print("\n⏹️  Остановка приложения...")
    except Exception as e:
        print(f"\n❌ Ошибка запуска: {e}")

if __name__ == '__main__':
    main()