# ax.files — база знаний (демо)

Каталог, семантический поиск и ответы на вопросы (RAG).

## Деплой: Netlify (фронт) + Render (API)

Netlify **не запускает Python** — API живёт на Render, Netlify проксирует `/api/*`.

### 1. API на Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (или Web Service из GitHub).
2. Репозиторий: `koolesoo/ax-files-kb` — подхватится `render.yaml`.
3. В **Environment** добавьте `OPENAI_API_KEY`.
4. После деплоя скопируйте URL сервиса, например:  
   `https://ax-files-kb-api.onrender.com`
5. Проверка: `https://ax-files-kb-api.onrender.com/api/health`

### 2. Фронт на Netlify

1. Импорт из GitHub → репозиторий `ax-files-kb`.
2. В **Environment variables** добавьте:

| Переменная | Значение |
|------------|----------|
| `API_PROXY_URL` | `https://ax-files-kb-api.onrender.com` (ваш URL Render **без** слэша в конце) |

3. **Trigger deploy** (пересобрать сайт).
4. Откройте: `https://ваш-сайт.netlify.app/knowledge.html`

`OPENAI_API_KEY` на Netlify **не нужен** — ключ только на Render.

## Локальная разработка

```bash
python3 -m pip install -r api/requirements.txt
cp .env.example .env
npm run seed
npm run api    # :8000
npm run dev    # :3000
```

http://127.0.0.1:3000/knowledge.html
