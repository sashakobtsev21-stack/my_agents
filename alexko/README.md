<div align="center">

# 🧑‍💻 my_agents — моя AI-команда для Claude Code

**Один репозиторий с готовой командой агентов, скиллов и инструментов, который я подключаю к любому своему проекту.**

[![version](https://img.shields.io/badge/version-3.10.31-6366f1?style=for-the-badge)](package.json)
[![license](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)](LICENSE)
[![agents](https://img.shields.io/badge/agents-104-10b981?style=for-the-badge)](.claude/agents/)
[![plugins](https://img.shields.io/badge/plugins-33-8b5cf6?style=for-the-badge)](.claude-plugin/marketplace.json)
[![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a?style=for-the-badge&logo=node.js&logoColor=white)](package.json)

</div>

---

## 🎯 За 30 секунд

Вместо того чтобы в каждом проекте заново объяснять Claude «кем быть» и «как делать», я держу готовую **команду** здесь и подключаю одной командой. После этого за разработку, ревью, тесты, безопасность и автоматизацию берётся не одна модель, а **104 специализированных агента** — Claude сам раскладывает задачу по ролям и работает параллельно.

| Блок | Кол-во | Что это |
|---|---:|---|
| 🤖 **Агенты** | 104 | роли-специалисты (`кто` делает) — [`.claude/agents/`](.claude/agents/) |
| 🧩 **Скиллы** | 41 | пошаговые рецепты (`как` делать) — [`.claude/skills/`](.claude/skills/) |
| ⌨️ **Команды** | 168 | slash-ярлыки (быстрый запуск) — [`.claude/commands/`](.claude/commands/) |
| 🔌 **Плагины** | 33 | тематические бандлы — [`marketplace.json`](.claude-plugin/marketplace.json) |
| 🛠️ **MCP-инструменты** | ~305 | реальные действия (память/swarm/git/нейро) |

> 🚀 **Витрины:** [`docs/start.html`](docs/start.html) — точка входа · [`docs/concepts.html`](docs/concepts.html) «для чайников» · [`docs/how-it-works.html`](docs/how-it-works.html) как устроено · [`docs/agent-catalog.html`](docs/agent-catalog.html) реестр (описания на русском).

---

## 🧭 Под твой проект (не универсально)

Команда **подстраивается под тип проекта** — `node scripts/detect-profile.mjs <путь>` определяет стек и подбирает пак агентов. Полная карта — [`docs/CORE-AGENTS.md`](docs/CORE-AGENTS.md).

| Профиль | Кого подключает |
|---|---|
| 🎮 **Android / Unity игра** | `game-director`, `unity-engine-architect`, `gameplay-programmer`, `physics-programmer`, `rendering-engineer`, `mobile-performance-engineer`, `build-release-engineer`, `game-qa-engineer` |
| 🕷️ **Веб-скрапинг / краулер** | `web-scraping-specialist` + плагин `ruflo-browser` (Playwright), `backend-dev`, `data-engineer`, `database-specialist`, `debugger`, `incident-responder` |
| 🔌 **Backend / API** | `backend-dev`, `database-specialist`, `security-auditor`, `devops-engineer`, `cicd-engineer` |
| 🖥️ **Frontend / SPA** | `frontend-specialist`, `accessibility-specialist`, `ui-ux-designer`, `perf-analyzer` |
| 📊 **Data / ML** | `ml-developer`, `data-engineer`, `data-analyst`, `python-specialist` |

Всегда плюс ядро (`coder`/`reviewer`/`tester`/`planner`/`researcher`/`debugger`/`security-auditor`). Нишевые агенты (консенсус/sublinear/Flow-Nexus) — в «advanced», в обычной работе не мешают.

---

## 🔗 Как подключить

> **Важно:** `npx alexko …` (бренд-команда; `npx ruflo …` — рабочий алиас) ставит **публичный npm-пакет** — это общий движок, а не моя кастомная команда. Чтобы получить именно моих агентов/скиллы — способ 1 или 2.

**Способ 1 — плагины из этого репозитория (рекомендуется).** В сессии Claude Code в целевом проекте:
```bash
/plugin marketplace add sashakobtsev21-stack/my_agents
/plugin install ruflo-core@ruflo
/plugin install ruflo-swarm@ruflo
/plugin install ruflo-browser@ruflo        # для скрапинга
```

**Способ 2 — подключить команду в проект одной командой** (копирует ядро + пак под тип проекта, скиллы, команды, статуслайн в `<проект>/.claude/`):
```bash
node scripts/connect-to-project.mjs /path/to/your/game   # авто-детект профиля (--all для всех агентов)
```
Затем открой папку проекта в Claude Code — агенты/скиллы доступны там, панель отражает этот проект.

**Способ 3 — полный цикл с MCP-инструментами** (сборка живёт в `v3/`, pnpm):
```bash
cd v3 && pnpm install --frozen-lockfile && pnpm build
claude mcp add my-agents -- node v3/@claude-flow/cli/bin/cli.js mcp start
```

---

## ⚡ Как пользоваться

Подключил → просто ставь задачу, Claude сам подберёт агентов и скиллы. Два главных сценария-скилла:

- **`/analyze-project <путь или git-URL>`** — аудит существующего проекта (уязвимости, сборка, узкие места, тесты, git) → отчёт `P1/P2/P3` + план. Git-URL клонируется автоматически.
- **`/new-project`** — сборка нового продукта с нуля (идея → спека → архитектура → код → тесты).

У обоих **verify-гейт**: «готово» = собирается + тесты проходят + реально запускается, а не «по словам».

```text
Проанализируй https://github.com/me/my-scraper и предложи план улучшений.
Собери игру-раннер на Unity для Android: дизайн, реализация, тесты.
Найди пробелы в тестах src/api и сгенерируй недостающие.
```

---

## 🖥️ Статуслайн (нижняя панель в Claude Code)

AlexKo рисует внизу **лаконичную** панель (скрипт `.claude/helpers/statusline.cjs`) — только то, что помогает в работе:

```
▊ AlexKo V3.6  ● user  │  Opus 4.8  │  ● 34% ctx
────────────────────────────────────────
🤖 Swarm ○ [ 0/15]    ⚪ CVE 0/0    🧪 Tests 74
```

- **`● N% ctx`** — заполнение окна контекста (зелёный <70 · жёлтый ≥70 · красный ≥90 → пора сохраняться). Самый полезный сигнал.
- **🤖 Swarm `[N/15]`** — сколько агентов работает прямо сейчас (`○` нет / `◉` идёт).
- **`CVE n/m`** — безопасность: ⚪ не сканировали · 🟢 чисто · 🟡 в работе · 🔴 есть уязвимости.
- **🧪 Tests N** — сколько тест-файлов в проекте.

Стоимость скрыта по умолчанию (`RUFLO_STATUSLINE_SHOW_COST=1` вернёт). Подробно — [`docs/concepts.html`](docs/concepts.html).

---

## 🗂️ Структура

```
my_agents/
├── .claude/          # ядро команды: agents/ (104), skills/ (41), commands/ (168), helpers/
├── .claude-plugin/   # marketplace.json (33 плагина) + хуки
├── plugins/          # 33 плагина ruflo-*
├── v3/               # монорепо v3 (CLI, MCP, память, swarm, security) — pnpm, 23 пакета
├── ruflo/ · alexko/  # npm-обёртки CLI (один и тот же движок)
├── docs/             # витрины, гайды, CORE-AGENTS, аудиты
└── scripts/          # утилиты: check-agents, detect-profile, gen-*
```

---

## 🩺 Состояние

- **Сборка:** `cd v3 && pnpm build` → 23/23 пакета, 0 ошибок. `npm audit` → 0 уязвимостей в корне.
- **Честность:** непроверенные перф-цифры («150x–12500x», «Flash Attention») вычищены или помечены `unverified`.
- **Агенты:** 104 агента / 41 скилл — фронтматтер валиден, дублей нет, связность чистая. Счётчики и витрины **авто-обновляются** хуком (`scripts/check-agents.mjs`).
- **Тесты:** ~300+ ключевых тестов зелёные; тяжёлые native-тесты (ruvector/sona/onnx) зелёные в CI.
- Форк [ruvnet/claude-flow](https://github.com/ruvnet/claude-flow) (MIT); `LICENSE` © ruvnet сохранён.

## 📜 Лицензия

MIT — см. [`LICENSE`](LICENSE).
