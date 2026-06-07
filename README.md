# ax.files — база знаний (демо)

Каталог, семантический поиск и ответы на вопросы (RAG). **Всё на Netlify.**

## Деплой на Netlify

1. [app.netlify.com](https://app.netlify.com) → **Import from Git** → `koolesoo/ax-files-kb`
2. **Environment variables** (обязательно):

| Переменная | Значение |
|------------|----------|
| `OPENAI_API_KEY` | ваш ключ OpenAI (единственная обязательная) |

Остальные переменные (`OPENAI_MODEL` и т.д.) — только если нужно переопределить дефолты. **Не помечайте их как secret** в Netlify — иначе сработает ложное срабатывание сканера.

3. Deploy → откройте `https://ваш-сайт.netlify.app/knowledge.html`

API на том же домене: `/api/documents`, `/api/search`, `/api/ask`, `/api/health`

## Локально

```bash
pip install -r api/requirements.txt
cp .env.example .env
npm run seed
npm run api    # :8000 — Python API
npm run dev    # :3000 — статика
```

http://127.0.0.1:3000/knowledge.html

## Архитектура на Netlify

- **Статика** — HTML/CSS/JS из корня репозитория
- **API** — Netlify Function `netlify/functions/api.mjs` (Node.js)
- **Данные** — `data/synthetic.json`, `data/index.json` (включены в функцию)
