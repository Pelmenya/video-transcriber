# 🎥 Video Transcriber

Автоматическая транскрибация видео с использованием AI (Whisper от Groq). Превращает любое видео в текстовую расшифровку с таймкодами.

## ✨ Особенности

- 🚀 **Автоматизация** - просто запустите скрипт с путем к видео
- 📁 **Пакетная обработка** - обрабатывайте целые папки с видео
- ⏭️ **Умный пропуск** - не обрабатывает повторно уже транскрибированные видео
- 🎯 **Высокая точность** - использует Whisper-large-v3 от Groq
- ⏱️ **Таймкоды** - получайте JSON с точными временными метками
- 🌍 **Мультиязычность** - поддержка русского, английского и других языков
- 📊 **Статистика** - детальный отчет по обработанным файлам

## 🎬 Поддерживаемые форматы

`.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`, `.wmv`

## 📋 Требования

- **Node.js** v18+ ([скачать](https://nodejs.org/))
- **FFmpeg** ([инструкция по установке](#установка-ffmpeg))
- **Groq API Key** (бесплатно на [console.groq.com](https://console.groq.com/keys))

## 🚀 Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/yourusername/video-transcriber.git
cd video-transcriber
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить API ключ

Создайте файл `.env` в корне проекта:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Получить ключ: https://console.groq.com/keys

### 4. Установить FFmpeg

#### Windows

```powershell
# Через winget
winget install Gyan.FFmpeg

# Через chocolatey
choco install ffmpeg
```

#### macOS

```bash
brew install ffmpeg
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

**После установки FFmpeg обновите путь в `transcribe.js`:**

Откройте `transcribe.js` и измените строку 11:
```javascript
FFMPEG_PATH: "путь_к_ffmpeg_на_вашей_системе",
```

Найти путь к ffmpeg:
```bash
# Windows
where ffmpeg

# macOS/Linux
which ffmpeg
```

### 5. Запустить транскрибацию

```bash
# Одно видео
node transcribe.js video.mp4

# Вся папка с видео
node transcribe.js ./videos
```

## 📖 Использование

### Обработать одно видео

```bash
node transcribe.js lecture.mp4
```

### Обработать все видео в папке

```bash
node transcribe.js ./my-videos
```

### Результаты

Скрипт создаст папку `output` со следующей структурой:

```
output/
├── video-name-1/
│   ├── transcript.txt      # Полный текст
│   └── transcript.json     # JSON с таймкодами
├── video-name-2/
│   ├── transcript.txt
│   └── transcript.json
└── ...
```

## ⚙️ Конфигурация

Отредактируйте объект `CONFIG` в `transcribe.js`:

```javascript
const CONFIG = {
  CHUNK_DURATION: 1200,        // Длина частей (секунды)
  MODEL: "whisper-large-v3",   // Модель Whisper
  LANGUAGE: "ru",              // Язык: ru, en, auto
  RATE_LIMIT_DELAY: 5000,      // Пауза между запросами (мс)
  VIDEO_EXTENSIONS: [...],     // Поддерживаемые форматы
};
```

## 🔧 Как это работает

### Алгоритм транскрибации (3 этапа):

```mermaid
graph LR
    A[Видео] -->|FFmpeg| B[Аудио MP3]
    B -->|Нарезка| C[Части по 20 мин]
    C -->|Groq Whisper| D[Транскрипция]
    D --> E[Текст + JSON]
```

#### 1. Извлечение аудио
- FFmpeg конвертирует видео в аудио (моно, 16kHz, 64kbps)
- Оптимизировано для распознавания речи

#### 2. Разделение на части
- Whisper API имеет лимиты на длину файла
- FFmpeg автоматически режет аудио на 20-минутные сегменты

#### 3. Транскрибация через Groq API
- Каждая часть отправляется в Groq Whisper API
- Результаты объединяются в полную транскрипцию
- Пауза 5 сек между запросами (rate limit)

## 💡 Примеры использования

### Создание субтитров
Используйте `transcript.json` с таймкодами для генерации SRT/VTT файлов

### Конспекты лекций
Получите полный текст лекции для создания учебных материалов

### SEO-оптимизация
Добавьте текстовую расшифровку к видео на сайте

### Анализ встреч
Транскрибируйте записи совещаний для дальнейшего анализа

## 🐛 Решение проблем

### FFmpeg не найден

Убедитесь, что FFmpeg установлен и путь в `transcribe.js` правильный:

```bash
# Проверить установку
ffmpeg -version
```

### 403 Forbidden от Groq API

- Проверьте правильность API ключа в `.env`
- Убедитесь, что у вас есть доступные credits на [console.groq.com](https://console.groq.com)

### Видео не обрабатывается

- Проверьте формат видео (должен быть в списке поддерживаемых)
- Убедитесь, что файл не поврежден

## 📊 Производительность

- **52-минутное видео** → ~3-4 минуты обработки
- **Скорость**: зависит от длины видео и количества частей
- **API лимиты**: Groq имеет rate limits (пауза 5 сек между запросами)

## 🤝 Вклад в проект

Contributions are welcome! Открывайте issues и pull requests.

## 📝 Лицензия

MIT License - свободно используйте в своих проектах

## 👤 Автор

Создано с помощью Claude Code и энтузиазма! 🚀

---

⭐ Поставьте звезду, если проект был полезен!
