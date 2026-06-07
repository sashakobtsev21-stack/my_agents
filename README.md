<div align="center">

# 🧑‍💻 my_agents — моя IT-команда для Claude Code

**Переиспользуемый набор агентов, скиллов, плагинов и команд, который подключается к любым проектам.**

[![version](https://img.shields.io/badge/version-3.10.31-6366f1?style=for-the-badge)](package.json)
[![license](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)](LICENSE)
[![fork of ruvnet/claude-flow](https://img.shields.io/badge/fork_of-ruvnet%2Fclaude--flow-D97757?style=for-the-badge&logo=github)](https://github.com/ruvnet/claude-flow)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a?style=for-the-badge&logo=node.js&logoColor=white)](package.json)

</div>

---

> [!NOTE]
> Это **форк** [`ruvnet/claude-flow`](https://github.com/ruvnet/claude-flow) (он же **Ruflo**), собранный как личная **«IT-команда»**: каталог готовых AI-агентов, скиллов и инструментов, который я подключаю к своим другим проектам, чтобы они выполняли разработку, анализ, тестирование, ревью и автоматизацию. Лицензия — MIT (см. [Происхождение и лицензия](#-происхождение-и-лицензия)).

## 📑 Оглавление

- [Что это и зачем](#-что-это-и-зачем)
- [Состав команды](#-состав-команды)
- [Как подключить к своему проекту](#-как-подключить-к-своему-проекту)
- [Как пользоваться](#-как-пользоваться)
- [Структура репозитория](#-структура-репозитория)
- [Состояние и известные проблемы](#-состояние-и-известные-проблемы)
- [Происхождение и лицензия](#-происхождение-и-лицензия)

---

## 🎯 Что это и зачем

`my_agents` — это **библиотека агентной команды для Claude Code**. Вместо того чтобы в каждом проекте заново описывать роли, навыки и сценарии, ты держишь их здесь в одном месте и **подключаешь к нужному проекту**. После подключения Claude Code получает доступ к специализированным агентам («бэкенд-разработчик», «ревьюер», «тестировщик», «архитектор», «security-аудитор» и т.д.), готовым скиллам и slash-командам.

**Что внутри (проверено по этому репозиторию):**

| | Состав | Где лежит |
|---|---|---|
| 🤖 **121 агент** | определения ролей с инструкциями и инструментами | [`.claude/agents/`](.claude/agents/) |
| 🧩 **39 скиллов** | пошаговые рецепты под конкретные задачи | [`.claude/skills/`](.claude/skills/) |
| ⌨️ **168 команд** | slash-команды для частых операций | [`.claude/commands/`](.claude/commands/) |
| 🔌 **33 плагина** | модули marketplace (`ruflo`), каждый со своими агентами/скиллами/командами | [`plugins/`](plugins/) · [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) |
| 🛠️ **~313 MCP-инструментов** | оркестрация, память, swarm, GitHub-операции и т.д. | [`v3/@claude-flow/cli/src/mcp-tools/`](v3/@claude-flow/cli/) |

Под капотом — монорепозиторий `claude-flow` v3 (`v3/@claude-flow/*`): CLI, MCP-сервер, векторная память (AgentDB/HNSW), swarm-координация и система хуков. Версия пакетов — **3.10.31**.

---

## 👥 Состав команды

### Агенты (121, по направлениям)

| Направление | Кол-во | Примеры ролей |
|---|---:|---|
| **Core (разработка)** | 5 | `coder`, `planner`, `researcher`, `reviewer`, `tester` |
| **Game Dev (Unity / 3D mobile)** | 15 | `unity-engine-architect`, `gameplay-programmer`, `rendering-engineer`, `game-qa-engineer`, `vfx-artist`, `mobile-performance-engineer` |
| **GitHub** | 13 | `pr-manager`, `code-review-swarm`, `release-manager`, `issue-tracker`, `workflow-automation` |
| **Consensus / распределённые** | 7 | `byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `crdt-synchronizer`, `quorum-manager` |
| **Swarm / Hive-mind** | 8 | `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `swarm-memory-manager` |
| **SPARC (методология)** | 4 | `specification`, `pseudocode`, `architecture`, `refinement` |
| **Optimization / Performance** | 5 | `perf-analyzer`, `performance-benchmarker`, `task-orchestrator` |
| **DevOps / Development / Data** | 8 | `devops-engineer`, `observability-engineer`, `backend-api`, `migration-engineer`, `data-engineer` |
| **Flow-Nexus / Dual-mode / Goal / Sublinear / Neural** | 22 | облачные песочницы, связка Claude+Codex, GOAP-планировщик, sublinear-граф |
| **Шаблоны и прочее** | 34 | `templates/`, `v3/`, `analysis`, `testing`, `documentation`, `database-specialist`, `dependency-auditor`, … |

Полный список — в [`.claude/agents/`](.claude/agents/). Каждый агент — это `.md` с описанием роли, зоны ответственности и доступных инструментов.

### Скиллы (39)

`agentdb-*` (5: память/RL/оптимизация/поиск) · `reasoningbank-*` (2) · `flow-nexus-*` (3) · `github-*` (5: ревью, релизы, проекты, мульти-репо, workflow) · `swarm-*` (3) · `sparc-methodology` · `hooks-automation` · `pair-programming` · `stream-chain` · `skill-builder` · `verification-quality` · `browser` · `performance-analysis` · `hive-mind-advanced` · `agentic-jujutsu` · `v3-*` (9: модернизация/архитектура/память/безопасность) · и др. Полный список — в [`.claude/skills/`](.claude/skills/).

### Плагины (33, marketplace `ruflo`)

<details>
<summary><strong>Раскрыть список плагинов</strong></summary>

| Плагин | Назначение |
|---|---|
| `ruflo-core` | Основа: MCP-инструменты, команды, паттерны оркестрации |
| `ruflo-swarm` | Команды агентов, swarm-координация, изоляция в worktree |
| `ruflo-autopilot` | Автономное выполнение задач в цикле `/loop` |
| `ruflo-loop-workers` | Фоновые задачи по таймеру / cron |
| `ruflo-workflows` | Шаблоны многошаговых сценариев |
| `ruflo-federation` | Безопасная федерация агентов между машинами |
| `ruflo-agentdb` | Контроллеры памяти AgentDB + HNSW |
| `ruflo-rag-memory` | Гибридный поиск, graph-hops, ранжирование |
| `ruflo-rvf` | Портативная память агентов между сессиями |
| `ruflo-ruvector` | Векторная БД (HNSW, Graph RAG) |
| `ruflo-knowledge-graph` | Построение и обход графа сущностей |
| `ruflo-intelligence` | Самообучение (SONA-паттерны, роутинг моделей) |
| `ruflo-graph-intelligence` | Sublinear-граф: PageRank, дельта-обновления |
| `ruflo-daa` | Динамическое поведение агентов |
| `ruflo-ruvllm` | Локальные LLM (Ollama и т.п.) с роутингом |
| `ruflo-goals` | Декомпозиция целей и планирование (GOAP) |
| `ruflo-testgen` | Поиск пробелов в тестах и их генерация |
| `ruflo-browser` | Браузерная автоматизация (Playwright) |
| `ruflo-jujutsu` | Анализ git-диффов, оценка рисков, выбор ревьюеров |
| `ruflo-docs` | Генерация и поддержка документации |
| `ruflo-security-audit` | Поиск уязвимостей и CVE |
| `ruflo-aidefence` | Защита от prompt-инъекций, детект PII |
| `ruflo-adr` | Учёт архитектурных решений (ADR) |
| `ruflo-ddd` | Скаффолдинг Domain-Driven Design |
| `ruflo-sparc` | Методология SPARC с гейтами качества |
| `ruflo-migrations` | Безопасные миграции схемы БД |
| `ruflo-observability` | Логи, трейсы, метрики |
| `ruflo-cost-tracker` | Учёт токенов, бюджеты, алерты по стоимости |
| `ruflo-agent` | Запуск агентов: локальная WASM-песочница + Anthropic Managed Agents |
| `ruflo-plugin-creator` | Создание, валидация и публикация своих плагинов |
| `ruflo-iot-cognitum` | IoT: трост-скоринг, детект аномалий, флоты |
| `ruflo-neural-trader` | AI-трейдинг: бэктест, 4 агента |
| `ruflo-market-data` | Приём рыночных данных, векторизация OHLCV |

</details>

---

## 🔗 Как подключить к своему проекту

Есть три рабочих способа. **Важно:** команда `npx ruflo …` ставит **опубликованный в npm пакет от автора оригинала (ruvnet)**, а не содержимое *этого* форка. Чтобы подключать именно **свою** команду агентов/скиллов, используй способ 1 или 2.

### Способ 1 — Плагины Claude Code из этого репозитория (рекомендуется)

В целевом проекте, в сессии Claude Code:

```bash
# Подключить marketplace из этого репозитория
/plugin marketplace add sashakobtsev21-stack/my_agents

# Поставить нужные плагины (имя marketplace — "ruflo")
/plugin install ruflo-core@ruflo
/plugin install ruflo-swarm@ruflo
/plugin install ruflo-testgen@ruflo
/plugin install ruflo-security-audit@ruflo
```

Это добавит в проект агентов, скиллы и slash-команды соответствующих плагинов. (MCP-сервер при этом не регистрируется — для полного цикла с MCP-инструментами нужен способ 3.)

### Способ 2 — Прямое копирование `.claude/` в проект

Если нужен весь каталог команды без marketplace — скопируй директории в `.claude/` целевого проекта:

```bash
# из корня целевого проекта
cp -r /path/to/my_agents/.claude/agents   .claude/
cp -r /path/to/my_agents/.claude/skills   .claude/
cp -r /path/to/my_agents/.claude/commands .claude/
```

Или подключи как git-сабмодуль, чтобы получать обновления:

```bash
git submodule add https://github.com/sashakobtsev21-stack/my_agents .my_agents
```

### Способ 3 — Полный цикл с MCP (через v3-воркспейс)

Реальная сборка живёт в `v3/` и собирается через **pnpm** (не npm — см. [известные проблемы](#-состояние-и-известные-проблемы)):

```bash
cd v3
pnpm install --frozen-lockfile
pnpm build
# затем зарегистрировать MCP-сервер в Claude Code:
claude mcp add my-agents -- node v3/@claude-flow/cli/bin/cli.js mcp start
```

---

## ⚡ Как пользоваться

После подключения проси Claude Code задействовать команду — он сам подберёт агентов и скиллы. Примеры:

```text
Собери swarm: архитектор спроектирует, кодер реализует, тестировщик напишет тесты,
ревьюер проверит. Задача — добавить OAuth-аутентификацию.
```

```text
Запусти security-аудит этого проекта и собери отчёт по найденным уязвимостям.
```

```text
Найди пробелы в тестовом покрытии модуля src/api и сгенерируй недостающие тесты.
```

Slash-командой можно вызвать конкретный сценарий напрямую (см. [`.claude/commands/`](.claude/commands/)), а скиллы Claude подхватывает автоматически по описанию задачи.

---

## 🗂️ Структура репозитория

```
my_agents/
├── .claude/              # ← ядро «команды»: agents/ (121), skills/ (39), commands/ (168)
├── .claude-plugin/       # marketplace.json (33 плагина) + хуки
├── plugins/              # 33 плагина ruflo-* (агенты/скиллы/команды каждого)
├── v3/                   # монорепозиторий claude-flow v3 (CLI, MCP, память, swarm) — pnpm
│   └── @claude-flow/     # пакеты: cli, shared, neural, memory, security, guidance, …
├── ruflo/                # обёртка-пакет + исходники web-UI (ruvocal)
├── docs/                 # документация (STATUS, USERGUIDE, federation, reviews)
├── scripts/              # утилиты и smoke-тесты
├── tests/                # тесты верхнего уровня
└── bin/cli.js            # точка входа CLI → v3/@claude-flow/cli/bin/cli.js
```

---

## 🩺 Состояние и известные проблемы

Раздел отражает состояние **после** комплекса исправлений (находки получены многоагентным аудитом и прошли адверсариальную верификацию). Критичные проблемы устранены; оставшееся — в основном косметика форка и техдолг, унаследованный от upstream, и работу агентов/скиллов это не ломает.

### ✅ Исправлено

- **`npm ci` в корне снова проходит** — `package-lock.json` перегенерирован под 3.10.31 с применением `overrides` (проверено `npm ci --dry-run`).
- **Корневые скрипты сборки** в порядке: `main → bin/cli.js`, убраны висячие `dev`/`tsc`/`vitest`, скрипты делегируют в `v3`; снята маскировка ошибок `|| true` с `build`/`typecheck` (сборка больше не «зелёная» при реальном сбое).
- **Вес клона:** история очищена от крупных бинарников — `.git` 426 МБ → **74 МБ** (клон ~147 МБ).
- **Идентичность** (корневой `package.json`, `plugin.json`, `marketplace.json`, `CLAUDE.md`, `SECURITY.md`) → `sashakobtsev21-stack/my_agents`; версии сведены к **3.10.31**.
- **Безопасность установки:** `@claude-flow/browser` `postinstall` больше не делает `npm install -g` (только подсказка).
- **Гигиена:** удалены 33 `tmp.json`, sourcemaps, `*.rvf`/`*.bak`/чекпоинт/lock-артефакты; `.gitignore` переписан.
- **CI:** удалены фиктивный `integration-tests.yml` и опасные/сломанные унаследованные workflow — `rollback-manager.yml` (авто-`reset --hard` + push в `main` при падении CI!), `status-badges.yml`, `verification-pipeline.yml`, `clone-tracker.yml`.

### 🟠 Осталось (некритично)

- **`npx ruflo …` ставит npm-пакет автора оригинала**, а не этот форк. Для своей команды используй marketplace из репозитория или копирование `.claude/` (см. [подключение](#-как-подключить-к-своему-проекту)).
- **Идентичность под-пакетов не менялась:** манифесты `v3/@claude-flow/*`, `plugins/ruflo-*` (33) и `ruflo/` сохраняют атрибуцию `ruvnet` — это корректно для экосистемы `@claude-flow` и работе не мешает; `LICENSE` (© ruvnet) сохранён намеренно (MIT).
- **Непроверенные перф-метрики** (HNSW «150x–12500x», Flash Attention «2.49x–7.47x») исправлены в доках, но всё ещё встречаются в строках help/вывода самого CLI и в генераторах `init` — стоит вычистить.
- **Старые reference-доки** `docs/STATUS.md` и `docs/USERGUIDE.md` остаются upstream-овыми (устаревшие версия/счётчики, битые ссылки на `verification.md`) — помечены баннером. Источник правды — этот README и `CLAUDE.md`.
- **Runbook публикации в `CLAUDE.md`** относится к upstream-пакетам и к форку неприменим.

### 🟡 Качество кода / техдолг (из upstream)

- ~28% исходников длиннее задекларированных 500 строк (крупнейший — `cli/src/commands/hooks.ts`, 5331 строк); `tsconfig` `strict:true`, но `noImplicitAny:false`.
- DDD-слои (`domain/`/`application/`) в `memory`/`neural`/`security`/`swarm` — это каркас, не подключённый к рантайму (в `claims`/`aidefence` подключён правильно).
- Несколько мелких латентных мест в коде upstream: `agentdb-backend` использует незаэкранированное зарезервированное слово-колонку `references`; `SafeExecutor` сверяет allowlist по basename. В текущих путях не эксплуатируются, но стоит поправить.
- `.githooks/pre-commit` — no-op (не подключён через `core.hooksPath`).
- Доверенный CI-гейт — **`v3-ci.yml`** (кросс-платформенный, реальные smoke-скрипты и ~190+ тестов в `v3`); корневой `ci.yml` — advisory (`continue-on-error`).

### ✅ Что хорошо

- **Реальных секретов нет** — все совпадения это тестовые фикстуры/паттерны детекторов; `.env` в `.gitignore`.
- **Безопасные точки входа** и **реальные security-примитивы** (`v3/@claude-flow/security/src/`: `safe-executor`, `path-validator`, `input-validator`, `tool-output-guardrail`), анти-инъекционный `github-safe.js`, защита от prototype-pollution на границе БД.
- **121 агент / 39 скиллов / 168 команд / 33 плагина** — фронтматтер корректен, дублей имён нет; счётчики сверены с файловой системой.
- **Низкий техдолг по маркерам** (TODO/FIXME ~34 на ~484k строк), продуманный MCP-stdio (лимит буфера, корректные JSON-RPC коды).

> Reference-доки (upstream, для глубины): [`docs/USERGUIDE.md`](docs/USERGUIDE.md), [`docs/STATUS.md`](docs/STATUS.md), [`docs/reviews/`](docs/reviews/). Источник правды по этому форку — данный README и [`CLAUDE.md`](CLAUDE.md).

---

## 📜 Происхождение и лицензия

- **Форк** проекта [`ruvnet/claude-flow`](https://github.com/ruvnet/claude-flow) (Ruflo) под лицензией **MIT** (© 2024–2026 ruvnet, см. [`LICENSE`](LICENSE)).
- Этот форк диверговал от upstream — например, добавлены 15 агентов Unity / 3D mobile game-dev студии.
- В составе есть сторонние компоненты со своими лицензиями (напр. Apache-2.0 от Hugging Face в `ruflo/src/ruvocal/LICENSE`) — учитывай при распространении.
- Бренды, хостинг-сервисы (`flo.ruv.io`, `goal.ruv.io`) и npm-пакеты `@claude-flow/*` / `ruflo` принадлежат автору оригинала; этот репозиторий их не контролирует.

---

<div align="center">

**my_agents** — подключи команду агентов к проекту и пусть Claude Code работает не один, а со всей командой.

</div>
