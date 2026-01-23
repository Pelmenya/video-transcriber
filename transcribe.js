import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import "dotenv/config";

// Конфигурация
const CONFIG = {
  CHUNK_DURATION: 1200, // 20 минут в секундах
  TEMP_DIR: "./temp",
  OUTPUT_DIR: "./output",
  FFMPEG_PATH: "C:\\Users\\Diamond\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe",
  MODELS: ["whisper-large-v3-turbo", "whisper-large-v3"], // переключаемся при rate limit
  LANGUAGE: "ru", // auto, en, ru, etc.
  RATE_LIMIT_DELAY: 15000, // пауза между запросами (мс) - 15 сек для rate limit
  VIDEO_EXTENSIONS: [".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv"],
};

// Извлечение аудио из видео
async function extractAudio(videoPath, videoName) {
  console.log("📽️  Извлекаю аудио из видео...");

  const tempDir = path.join(CONFIG.TEMP_DIR, videoName);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const audioPath = path.join(tempDir, "audio.mp3");

  execSync(
    `"${CONFIG.FFMPEG_PATH}" -i "${videoPath}" -vn -ar 16000 -ac 1 -b:a 64k "${audioPath}" -y`,
    { stdio: "inherit" }
  );

  console.log("✅ Аудио извлечено:", audioPath);
  return audioPath;
}

// Разделение аудио на части
async function splitAudio(audioPath, videoName) {
  console.log("✂️  Разрезаю аудио на части...");

  const chunksDir = path.join(CONFIG.TEMP_DIR, videoName, "chunks");
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  execSync(
    `"${CONFIG.FFMPEG_PATH}" -i "${audioPath}" -f segment -segment_time ${CONFIG.CHUNK_DURATION} -c copy "${chunksDir}/chunk_%02d.mp3" -y`,
    { stdio: "inherit" }
  );

  const chunks = fs
    .readdirSync(chunksDir)
    .filter((f) => f.endsWith(".mp3"))
    .sort()
    .map((f) => path.join(chunksDir, f));

  console.log(`✅ Создано частей: ${chunks.length}`);
  return chunks;
}

// Транскрибация одной части с retry и переключением моделей
async function transcribeChunk(chunkPath, index, total, videoName) {
  console.log(`🎙️  Транскрибирую часть ${index + 1}/${total}...`);

  for (let modelIdx = 0; modelIdx < CONFIG.MODELS.length; modelIdx++) {
    const model = CONFIG.MODELS[modelIdx];
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const curlCommand = `curl -s -w "\\nHTTP_CODE:%{http_code}" -X POST "https://api.groq.com/openai/v1/audio/transcriptions" -H "Authorization: Bearer ${process.env.GROQ_API_KEY}" -F "file=@${chunkPath}" -F "model=${model}" -F "language=${CONFIG.LANGUAGE}" -F "response_format=verbose_json"`;

        const result = execSync(curlCommand, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });

        const httpCodeMatch = result.match(/HTTP_CODE:(\d+)/);
        const httpCode = httpCodeMatch ? httpCodeMatch[1] : "unknown";
        const jsonResponse = result.replace(/\nHTTP_CODE:\d+$/, "").trim();

        if (httpCode === "429") {
          throw new Error(`RATE_LIMIT`);
        }

        if (httpCode !== "200") {
          throw new Error(`HTTP ${httpCode}: ${jsonResponse.substring(0, 100)}`);
        }

        const transcription = JSON.parse(jsonResponse);

        if (!transcription.text) {
          throw new Error("API вернул пустой текст");
        }

        console.log(`   ✓ [${model}] ${transcription.text.length} символов`);
        return transcription;

      } catch (error) {
        if (error.message === "RATE_LIMIT") {
          console.log(`   ⚠️ [${model}] Rate limit - переключаемся...`);
          break; // переходим к следующей модели
        }

        console.error(`   ⚠️ [${model}] Попытка ${attempt}/${maxRetries}: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = 15000;
          console.log(`   ⏳ Ждём ${delay / 1000} сек...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  }

  throw new Error(`Все модели вернули ошибку`);
}

// Обработка одного видео
async function processVideo(videoPath) {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = path.join(CONFIG.OUTPUT_DIR, videoName);

  // Проверка: уже обработано?
  const jsonPath = path.join(outputDir, "transcript.json");
  if (fs.existsSync(jsonPath)) {
    console.log(`⏭️  Пропускаю "${videoName}" - уже обработано`);
    return { skipped: true };
  }

  console.log(`\n🚀 Начинаю обработку: ${videoName}`);
  console.log("━".repeat(50));

  try {
    // 1. Извлекаем аудио
    const audioPath = await extractAudio(videoPath, videoName);

    // 2. Режем на части
    const chunks = await splitAudio(audioPath, videoName);

    // 3. Транскрибируем каждую часть
    const transcripts = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await transcribeChunk(
        chunks[i],
        i,
        chunks.length,
        videoName
      );
      transcripts.push({
        part: i + 1,
        text: result.text,
        segments: result.segments,
      });

      // Пауза между запросами (rate limit)
      if (i < chunks.length - 1) {
        console.log(`⏳ Пауза ${CONFIG.RATE_LIMIT_DELAY / 1000} сек...`);
        await new Promise((r) => setTimeout(r, CONFIG.RATE_LIMIT_DELAY));
      }
    }

    // 4. Сохраняем результат
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Полный текст
    const fullText = transcripts.map((t) => t.text).join("\n\n");
    const textPath = path.join(outputDir, "transcript.txt");
    fs.writeFileSync(textPath, fullText, "utf-8");

    // JSON с таймкодами
    fs.writeFileSync(jsonPath, JSON.stringify(transcripts, null, 2), "utf-8");

    console.log("\n✅ Готово!");
    console.log("📄 Текст:", textPath);
    console.log("📊 JSON с таймкодами:", jsonPath);

    // Очистка временных файлов
    console.log("🧹 Удаляю временные файлы...");
    const tempVideoDir = path.join(CONFIG.TEMP_DIR, videoName);
    if (fs.existsSync(tempVideoDir)) {
      fs.rmSync(tempVideoDir, { recursive: true, force: true });
    }

    return { success: true };
  } catch (error) {
    console.error(`❌ Ошибка при обработке "${videoName}":`, error.message);
    return { error: error.message };
  }
}

// Получение списка видео
function getVideoFiles(inputPath) {
  const stat = fs.statSync(inputPath);

  // Если это файл
  if (stat.isFile()) {
    const ext = path.extname(inputPath).toLowerCase();
    if (CONFIG.VIDEO_EXTENSIONS.includes(ext)) {
      return [path.resolve(inputPath)];
    } else {
      throw new Error(`Неподдерживаемый формат видео: ${ext}`);
    }
  }

  // Если это папка
  if (stat.isDirectory()) {
    const files = fs
      .readdirSync(inputPath)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return CONFIG.VIDEO_EXTENSIONS.includes(ext);
      })
      .map((file) => path.resolve(path.join(inputPath, file)));

    if (files.length === 0) {
      throw new Error(`В папке "${inputPath}" не найдено видео файлов`);
    }

    return files;
  }

  throw new Error(`Неизвестный тип: ${inputPath}`);
}

// Главная функция
async function main() {
  const inputPath = process.argv[2];

  console.log("\n🎥 Video Transcriber v1.0");
  console.log("━".repeat(50));

  // Проверка аргументов
  if (!inputPath) {
    console.log("\n📖 Использование:");
    console.log("  node transcribe.js <путь_к_видео_или_папке>");
    console.log("\n📝 Примеры:");
    console.log("  node transcribe.js video.mp4          # одно видео");
    console.log("  node transcribe.js ./videos            # все видео в папке");
    console.log("\n🎬 Поддерживаемые форматы:");
    console.log("  " + CONFIG.VIDEO_EXTENSIONS.join(", "));
    process.exit(1);
  }

  // Проверка существования
  if (!fs.existsSync(inputPath)) {
    console.error("❌ Не найдено:", inputPath);
    process.exit(1);
  }

  // Проверка API ключа
  if (!process.env.GROQ_API_KEY) {
    console.error("\n❌ GROQ_API_KEY не найден в .env файле");
    console.error("Создайте файл .env и добавьте:");
    console.error("GROQ_API_KEY=your_key_here");
    console.error("\nПолучить ключ: https://console.groq.com/keys");
    process.exit(1);
  }

  try {
    // Получаем список видео
    const videos = getVideoFiles(inputPath);
    console.log(`\n📁 Найдено видео: ${videos.length}`);

    const results = {
      total: videos.length,
      processed: 0,
      skipped: 0,
      errors: 0,
    };

    // Обрабатываем каждое видео
    for (let i = 0; i < videos.length; i++) {
      console.log(
        `\n${"═".repeat(50)}\n[${i + 1}/${videos.length}] ${path.basename(
          videos[i]
        )}\n${"═".repeat(50)}`
      );

      const result = await processVideo(videos[i]);

      if (result.success) results.processed++;
      else if (result.skipped) results.skipped++;
      else if (result.error) results.errors++;
    }

    // Итоговая статистика
    console.log("\n" + "═".repeat(50));
    console.log("🎉 Обработка завершена!");
    console.log("═".repeat(50));
    console.log(`📊 Статистика:`);
    console.log(`   Всего видео: ${results.total}`);
    console.log(`   ✅ Обработано: ${results.processed}`);
    console.log(`   ⏭️  Пропущено: ${results.skipped}`);
    console.log(`   ❌ Ошибок: ${results.errors}`);
    console.log(`\n📂 Результаты: ${path.resolve(CONFIG.OUTPUT_DIR)}`);

    // Удаляем папку temp полностью
    if (fs.existsSync(CONFIG.TEMP_DIR)) {
      fs.rmSync(CONFIG.TEMP_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("\n❌ Фатальная ошибка:", error.message);
    process.exit(1);
  }
}

main();
