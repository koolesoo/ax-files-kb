# ax.files — база знаний (демо)

## Быстрый деплой (рекомендуется): только Render

Один URL для всего — фронт + API.

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Репозиторий: `koolesoo/ax-files-kb`, ветка `main`
3. **Name:** `ax-files-kb-api` (или любое)
4. **Build:** `pip install -r api/requirements.txt`
5. **Start:** `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
6. **Environment:** `OPENAI_API_KEY` = ваш ключ
7. После деплоя откройте: `https://ВАШ-СЕРВИС.onrender.com/knowledge.html`

Проверка API: `https://ВАШ-СЕРВИС.onrender.com/api/health`

---

## Netlify (фронт) + Render (API)

### Render
Те же шаги, что выше. Скопируйте URL, например `https://ax-files-kb-api.onrender.com`.

### Netlify
1. Импорт `koolesoo/ax-files-kb` из GitHub
2. **Environment variables:**

| Переменная | Значение |
|------------|----------|
| `API_PROXY_URL` | `https://ax-files-kb-api.onrender.com` (ваш URL Render, без `/` в конце) |

3. **Deploy** → Clear cache and deploy
4. Откройте: `https://ваш-сайт.netlify.app/knowledge.html`

`OPENAI_API_KEY` нужен **только на Render**, не на Netlify.

При сборке Netlify записывает URL API в `assets/config.js` и прокси `/api/*`.

---

## Локально

```bash
pip install -r api/requirements.txt
cp .env.example .env
npm run seed
npm run api && npm run dev
```

http://127.0.0.1:3000/knowledge.html
