# 0002 — Plan: DB source of truth + local cache

Status: accepted  
Date: 2026-01-19

## Context
План користувача (free/pro/premium) має:
- зберігатися у БД
- коректно відображатися в UI після перезавантаження
- бути доступним для логіки upgrade/paywall

## Decision
1) Source of truth: Postgres (таблиця users, поле `plan`)
2) Frontend cache:
- `selfio_plan:<email>` (персональний ключ)
- `selfio_plan` (поточне значення для UI)

При login:
- зчитуємо `/me`
- оновлюємо localStorage

При виборі plan:
- POST `/plan/select`
- після успіху кешуємо локально

## Consequences
✅ Плюси:
- правильний стан завжди в БД
- UI швидко відкривається (кеш)
- легко дебажити

⚠️ Мінуси:
- треба синхронізація на login/refresh
- якщо бекенд недоступний — кеш може бути тимчасово неактуальний

## Alternatives
- тільки localStorage (але губиться між пристроями)
- тільки DB (але UI залежить від бекенду кожен раз)
