# SAT FAST STUDY — Backend

API-сервер для мобильного приложения подготовки к Digital SAT в стиле Duolingo. Не просто банк вопросов — система, которая честно отслеживает реальный прогресс, приоритизирует слабые темы и не даёт забросить подготовку.

Мобильное приложение (React Native / Expo), которое потребляет этот API: [SAT GG Frontend](https://github.com/zhenisqur/Sat-Fast-Study-FRONTEND)

## Идея продукта

Большинство SAT-приложений — это либо статичный банк вопросов (скучно, легко забросить), либо игрушка с фейковыми уровнями без реальной методики за ней. Мы делаем третье: **ежедневный ассистент**, который на основе реальных данных о прогрессе ученика говорит "делай ровно это сегодня" — без необходимости самому разбираться, с чего начинать подготовку.

## Технологии

- **NestJS** + **TypeScript**
- **PostgreSQL** + **Prisma ORM** (с адаптером `@prisma/adapter-pg`)
- **JWT** аутентификация (`@nestjs/jwt`, `passport-jwt`) + Google/Apple OAuth
- **Docker Compose** для локальной БД

## Архитектура

Чёткое разделение по слоям в каждом модуле: `Controller → Service → Repository → Prisma`. Контроллер не знает про Prisma, сервис не пишет сырой SQL/Prisma-синтаксис напрямую (кроме простых случаев), репозиторий — единственное место с прямыми вызовами `prisma.*`.

```
src/
├── common/
│   ├── database/       # PrismaService, глобальный модуль подключения к БД
│   ├── guards/          # JwtAuthGuard, RolesGuard
│   └── decorators/        # @CurrentUser, @Roles
├── modules/
│   ├── auth/              # регистрация, логин, Google/Apple OAuth
│   ├── users/               # профиль пользователя
│   ├── sat/                   # вопросы, полноформатные тесты (в разработке)
│   ├── levels/                  # Practice-режим: 50+50 уровней, дневная норма
│   ├── study/                     # Study-режим: 30-уровневый путь по доменам SAT
│   ├── ai/                          # AI-тьютор с защитой от математических галлюцинаций
│   └── admin/                         # аналитика для админ-панели
prisma/
├── schema.prisma        # полная схема БД
└── migrations/            # история миграций
scripts/                    # batch-импорт контента (вопросы, уроки) из JSON
```

## Ключевые механики API

- **`/auth/*`** — email/password + Google/Apple OAuth, единая JWT-сессия
- **`/levels/*`** — Practice-режим: 50 уровней на секцию (Math / Reading & Writing), дневная норма 15+15, каждая секция левелапится независимо
- **`/study/*`** — Study-режим: единый путь из 30 официальных доменов College Board, два таба на уровень (Math + Grammar), честный mastery-gate — уровень открывается только когда все вопросы квиза отвечены верно хотя бы раз
- **`/ai/tutor/*`** — сократический AI-тьютор: не спойлерит финальный ответ, ведёт ученика к решению пошагово, с независимой верификацией математических вычислений

Полный контракт всех эндпоинтов — в [`API_CONTRACT.md`](./API_CONTRACT.md).

## Запуск локально

```bash
npm install
cp .env.example .env
```

В `.env` пропиши реальные значения (`DATABASE_URL`, `JWT_SECRET`, при необходимости `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID`, `ANTHROPIC_API_KEY` для AI-тьютора).

```bash
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Сервер поднимется на `http://localhost:3000`.

### Наполнение базы контентом

```bash
npx ts-node -r tsconfig-paths/register scripts/import-questions-json.ts "./seed-data/math/question-math.json"
npx ts-node -r tsconfig-paths/register scripts/import-questions-json.ts "./seed-data/grammar/question-grammar-clean.json"
npx ts-node -r tsconfig-paths/register scripts/import-all-lessons.ts "./seed-data/study/math"
npx ts-node -r tsconfig-paths/register scripts/import-all-lessons.ts "./seed-data/study/grammar"
```

## Статус

Основной цикл (регистрация → Practice → Study → прогресс) полностью реализован и протестирован end-to-end с реальным мобильным клиентом. В разработке: диагностика при онбординге, Mistake Review (модель уже в схеме БД, эндпоинт в работе), полноформатные adaptive-тесты.

