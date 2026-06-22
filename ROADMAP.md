# Roadmap: от транскрайбера к «видео → MD-тикет»

> Этот инструмент — фундамент (audio→transcript) более крупного пайплайна:
> **принять ЛЮБОЕ видео и довести его до структурного, агент-ингестируемого тикета.**
> Применение — интейк агентской фабрики / баг-трекинга / методичек из видео.

## Зачем
Сейчас типичный интейк «видео-в-задачу» завязан на конкретный инструмент (напр. Loom) и ручную запись. Правильнее — **источник-агностично**: любой скринкаст / запись экрана / mp4 → транскрипт + on-screen evidence → готовый тикет, который агент берёт в работу без парсинга чужого формата.

## Полная архитектура
```
видео (file / URL)
  ├─ audio  → транскрипт (Whisper/ASR)                      [Phase 1 ✅]
  ├─ vision → keyframes (scene/interval) → VLM:             [Phase 2 ⏳]
  │           on-screen текст, console errors, UI-состояние, стек
  └─ fusion → LLM(transcript + frame captions + meta) →     [Phase 3 ⏳]
              синтез структурного тикета
  → выход: ticket.md  (title / repro / expected-vs-actual /  [Phase 3 ⏳]
           evidence / severity / suggested fix) — агент-ингестируемый
```

## Статус по фазам
| Phase | Что | Статус |
|---|---|---|
| **1. Transcription** | ffmpeg извлечение аудио → чанкинг (20 мин) → Groq Whisper с rate-limit fallback + retry → `transcript.txt` + `transcript.json` (таймкоды/сегменты), батч, smart-skip | ✅ **готово** (этот репо) |
| **2. Vision keyframes** | ffmpeg scene-detect / interval sampling → VLM (Claude Vision / Qwen-VL) подписывает кадры: on-screen текст, console/network, UI-состояние, стек | ⏳ план |
| **3. Fusion → ticket.md** | LLM берёт транскрипт + подписи кадров + метаданные → синтез структурного MD-тикета (title / repro / expected-vs-actual / evidence / severity / suggested fix) | ⏳ план |
| **4. Интеграция** | обёртка как MCP-tool (`video_to_ticket`) / HTTP endpoint → тикет уходит в goal-loop фабрики | ⏳ план |

## Принципы
- **Источник-агностично** — любой видеофайл/URL, без vendor-lock.
- **Evidence из видео** — vision-слой вытаскивает то, что аудио не несёт (console/UI/стек на экране).
- **MD на выходе** — детерминированный, агент-ингестируемый формат (вместо чужого).
- **Прод-готовность** — rate-limit fallback, retry, батч, идемпотентный skip (уже в Phase 1).

## Использование сегодня (Phase 1)
```bash
node transcribe.js video.mp4      # одно видео → output/<name>/transcript.{txt,json}
node transcribe.js ./videos       # батч по папке
```

---
Дмитрий Ляпин · [github.com/Pelmenya](https://github.com/Pelmenya)
