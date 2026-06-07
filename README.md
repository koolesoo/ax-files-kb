# ax.files — база знаний (демо)

Веб-интерфейс корпоративной базы знаний: каталог, семантический поиск, ответы на вопросы (RAG).

## Деплой на Netlify (GitHub)

1. Импортируйте репозиторий в [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git**.
2. Настройки сборки подхватятся из `netlify.toml` автоматически.
3. В **Site settings → Environment variables** добавьте:
   - `OPENAI_API_KEY` — обязательно (поиск и «Спросить ИИ»)
   - `OPENAI_MODEL` — опционально (`gpt-4o-mini`)
   - `OPENAI_EMBEDDING_MODEL` — опционально (`text-embedding-3-small`)
4. Задеплойте. Откройте `https://ваш-сайт.netlify.app/knowledge.html`

API доступен на том же домене: `/api/documents`, `/api/search`, `/api/ask`, `/api/health`.

## Локальная разработка

```bash
python3 -m pip install -r api/requirements.txt
cp .env.example .env   # вставьте OPENAI_API_KEY
npm run seed           # данные + индекс

npm run api            # :8000
npm run dev            # :3000
```

Откройте http://127.0.0.1:3000/knowledge.html

## Структура

| Путь | Назначение |
|------|------------|
| `index.html`, `knowledge.html`, `profile.html` | Страницы UI |
| `assets/` | CSS и JS |
| `api/main.py` | FastAPI: поиск и RAG |
| `data/synthetic.json` | Демо-корпус |
| `data/index.json` | Поисковый индекс (embeddings) |
| `netlify/functions/api.py` | Serverless-обёртка для Netlify |
