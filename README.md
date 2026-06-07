<div align="center">

# 🧑‍💻 my_agents — моя AI-команда для Claude Code

**Один репозиторий с готовой командой агентов, скиллов и инструментов, который я подключаю к любому своему проекту.**

[![version](https://img.shields.io/badge/version-3.10.31-6366f1?style=for-the-badge)](package.json)
[![license](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)](LICENSE)
[![agents](https://img.shields.io/badge/agents-121-10b981?style=for-the-badge)](.claude/agents/)
[![plugins](https://img.shields.io/badge/plugins-33-8b5cf6?style=for-the-badge)](.claude-plugin/marketplace.json)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a?style=for-the-badge&logo=node.js&logoColor=white)](package.json)

</div>

---

**my_agents** — это моя AI-команда для Claude Code. Вместо того чтобы в каждом проекте заново описывать роли и сценарии, я держу их здесь, в одном месте, и подключаю к нужному проекту одной командой. После подключения за разработку, ревью, тестирование, безопасность и автоматизацию берётся не одна модель, а целая команда специализированных агентов: **121 агент, 39 скиллов, 168 команд и 33 плагина** — собраны, выверены и готовы к работе.

## 📑 Оглавление

- [Что это и зачем](#-что-это-и-зачем)
- [Состав команды](#-состав-команды)
- [Как подключить к своему проекту](#-как-подключить-к-своему-проекту)
- [Как пользоваться](#-как-пользоваться)
- [Структура репозитория](#-структура-репозитория)
- [Состояние и качество](#-состояние-и-качество)
- [Лицензия](#-лицензия)

---

## 🎯 Что это и зачем

`my_agents` — **библиотека агентной команды для Claude Code**. Подключаешь репозиторий к проекту — и Claude Code получает доступ к специализированным агентам («бэкенд-разработчик», «ревьюер», «тестировщик», «архитектор», «security-аудитор» и десяткам других), готовым скиллам и slash-командам. Команда сама раскладывает задачу по ролям и работает параллельно.

**Что внутри (сверено с этим репозиторием):**

| | Состав | Где лежит |
|---|---|---|
| 🤖 **121 агент** | определения ролей с инструкциями и инструментами | [`.claude/agents/`](.claude/agents/) |
| 🧩 **39 скиллов** | пошаговые рецепты под конкретные задачи | [`.claude/skills/`](.claude/skills/) |
| ⌨️ **168 команд** | slash-команды для частых операций | [`.claude/commands/`](.claude/commands/) |
| 🔌 **33 плагина** | модули marketplace, каждый со своими агентами/скиллами/командами | [`plugins/`](plugins/) · [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) |
| 🛠️ **~313 MCP-инструментов** | оркестрация, память, swarm, GitHub-операции и т.д. | [`v3/@claude-flow/cli/src/mcp-tools/`](v3/@claude-flow/cli/) |

Под капотом — монорепозиторий v3 (`v3/@claude-flow/*`): CLI, MCP-сервер, векторная память (AgentDB/HNSW), swarm-координация и система хуков. Версия — **3.10.31**.

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

`agentdb-*` (5: память/RL/оптимизация/поиск) · `reasoningbank-*` (2) · `flow-nexus-*` (3) · `github-*` (5: ревью, релизы, проекты, мульти-репо, workflow) · `swarm-*` (3) · `sparc-methodology` · `hooks-automation` · `pair-programming` · `stream-chain` · `skill-builder` · `verification-quality` · `browser` · `dual-mode` · `performance-analysis` · `hive-mind-advanced` · `agentic-jujutsu` · `v3-*` (9: модернизация/архитектура/память/безопасность) · и др. Полный список — в [`.claude/skills/`](.claude/skills/).

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

Три рабочих способа. **Важно:** `npx ruflo …` ставит публичный npm-пакет, а не этот репозиторий — поэтому, чтобы подключить именно **мою** команду агентов/скиллов, используй способ 1 или 2.

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

Реальная сборка живёт в `v3/` и собирается через **pnpm**:

```bash
cd v3
pnpm install --frozen-lockfile
pnpm build
# затем зарегистрировать MCP-сервер в Claude Code:
claude mcp add my-agents -- node v3/@claude-flow/cli/bin/cli.js mcp start
```

---

## ⚡ Как пользоваться

После подключения просто ставь задачу — Claude Code сам подберёт агентов и скиллы. Примеры:

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
├── v3/                   # монорепозиторий v3 (CLI, MCP, память, swarm) — pnpm
│   └── @claude-flow/     # пакеты: cli, shared, neural, memory, security, guidance, …
├── ruflo/                # обёртка-пакет + исходники web-UI (ruvocal)
├── docs/                 # документация (STATUS, USERGUIDE, federation, reviews)
├── scripts/              # утилиты и smoke-тесты
├── tests/                # тесты верхнего уровня
└── bin/cli.js            # точка входа CLI → v3/@claude-flow/cli/bin/cli.js
```

---

## 🩺 Состояние и качество

Репозиторий регулярно проходит многоагентный аудит с адверсариальной верификацией находок. Текущее состояние:

### ✅ В порядке

- **Установка/сборка:** `npm ci` проходит (lockfile 3.10.31 с применёнными `overrides`); корневые скрипты честные — `build`/`typecheck` больше не маскируют ошибки.
- **Лёгкий клон:** история очищена от крупных бинарников — `.git` 74 МБ (клон ~147 МБ).
- **Безопасность:** реальных секретов в репозитории нет (всё — тестовые фикстуры/паттерны детекторов), `.env` в `.gitignore`; рабочие security-примитивы (`safe-executor`, `path-validator`, `input-validator`, `tool-output-guardrail`), защита от prompt-инъекций и prototype-pollution.
- **Каталог сверен:** 121 агент / 39 скиллов / 168 команд / 33 плагина — фронтматтер валиден, дублей имён нет.
- **CI:** удалены фиктивные и опасные унаследованные workflow (в т.ч. авто-`reset --hard` + push в `main`); доверенный гейт — `v3-ci.yml` (~190+ тестов, кросс-платформенно).

### 🟠 В планах / к сведению

- `npx ruflo …` ставит публичный npm-пакет, а не этот репозиторий — для своей команды подключай через marketplace или `.claude/` (см. [подключение](#-как-подключить-к-своему-проекту)).
- Несколько перф-метрик (HNSW «150x–12500x», Flash Attention) исправлены в документации, но ещё встречаются в строках вывода CLI — в плане на вычистку.
- Доки `docs/STATUS.md` и `docs/USERGUIDE.md` — это глубокий upstream-справочник (помечен баннером); источник правды по проекту — этот README и [`CLAUDE.md`](CLAUDE.md).
- Часть кода v3 — техдолг (несколько крупных файлов, DDD-слои-каркасы в ряде пакетов, пара латентных мест) — отслеживается и чинится точечно.

---

## 📜 Лицензия

Распространяется под лицензией **MIT** — см. [`LICENSE`](LICENSE). Можно свободно использовать, изменять и распространять при условии сохранения текста лицензии.

my_agents построен на основе open-source фреймворка [`ruvnet/claude-flow`](https://github.com/ruvnet/claude-flow) (MIT) и развивается отдельно под мои задачи. Отдельные сторонние компоненты идут со своими лицензиями (напр. Apache-2.0, Hugging Face chat-ui в [`ruflo/src/ruvocal/`](ruflo/src/ruvocal/LICENSE)) — их условия сохранены.

---

<div align="center">

**my_agents** — подключи команду к проекту, и пусть Claude Code работает не один, а со всей командой.

</div>
