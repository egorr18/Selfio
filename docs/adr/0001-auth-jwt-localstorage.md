# 0001 — Auth: JWT + LocalStorage

Status: accepted  
Date: 2026-01-19

## Context
Frontend — статичний (GitHub Pages) + локальний бекенд (Docker).
Потрібен простий спосіб авторизації між сторінками без server-side сесій.

## Decision
Використовуємо JWT (Bearer token):
- бекенд повертає `token` після /auth/login та /auth/register
- фронтенд зберігає токен у `localStorage` (`selfio_token`)
- запити на protected endpoints робимо з заголовком:
  `Authorization: Bearer <token>`

## Consequences
✅ Плюси:
- працює зі статичним хостингом (GitHub Pages)
- просто дебажити та переносити між сторінками
- не потрібні cookies/sessions

⚠️ Мінуси/ризики:
- XSS ризик: якщо з’явиться ін’єкція скриптів — localStorage можуть вкрасти
- потрібна дисципліна: не вставляти HTML з user input

## Alternatives
1) HttpOnly cookies + sameSite — безпечніше, але складніше на GitHub Pages та CORS
2) Server-side sessions — потребує іншої архітектури

## Notes
Для production-безпеки бажано:
- CSP заголовки
- уникати innerHTML з даними користувача
