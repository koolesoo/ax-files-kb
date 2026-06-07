# Демо: поиск и умные ответы ax.files

## Подготовка (один раз)

```bash
cd /Users/koolesoo/Desktop/hb
python3 -m pip install -r api/requirements.txt
cp .env.example .env
# Вставьте OPENAI_API_KEY в .env
npm run seed
```

`npm run seed` создаёт `data/synthetic.json` и `data/index.json`.

- **Без `.env`** — локальный индекс TF-IDF (`npm run index:local`), поиск работает.
- **С `OPENAI_API_KEY` в `.env`** — семантический индекс OpenAI (`npm run index`), лучше для синонимов; нужен для «Спросить ИИ».

## Запуск

В двух терминалах:

```bash
npm run api    # http://127.0.0.1:8000 — API, Swagger: /docs
npm run dev    # http://127.0.0.1:3000 — интерфейс
```

Откройте: **http://127.0.0.1:3000/knowledge.html**

## Публичная ссылка

**Без регистрации** (localtunnel):

```bash
npm run share:public
```

Ссылка появится в терминале и в файле `.public-url`.

**С ngrok** (нужен токен с [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)):

```bash
ngrok config add-authtoken ВАШ_ТОКЕН
npm run api && npm run share   # в двух терминалах
npm run share:ngrok
```

Поиск и «Спросить ИИ» работают через тот же хост (прокси `/api` на :8000).

## Что показать

1. **Каталог** — разделы и документы без запроса.
2. **Поиск** — любой запрос в поле вверху (документы, эксперты, упоминания).
3. **Спросить ИИ** — произвольный вопрос, ответ со списком источников.
4. Поиск из шапки на главной → переход на базу знаний с запросом.

## API

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/health` | Статус и размер индекса |
| GET | `/api/documents` | Каталог по разделам |
| GET | `/api/search?q=...` | Семантический поиск |
| POST | `/api/ask` | `{"question": "..."}` — RAG-ответ |
