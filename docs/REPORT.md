# 📑 Отчёт по проекту my_agents

**Дата:** 2026-06-08 · **Состояние:** на проде (`origin/main`), дерево чисто.
**Репозиторий:** [`sashakobtsev21-stack/my_agents`](https://github.com/sashakobtsev21-stack/my_agents) — переиспользуемая AI-команда для Claude Code (форк `ruvnet/claude-flow`, MIT).

> Новичкам — [`CONCEPTS.md`](CONCEPTS.md); полный разбор — [`FULL-BREAKDOWN.md`](FULL-BREAKDOWN.md); точка входа — [`start.html`](start.html).

---

## 1. Текущее состояние (проверено в этом чекауте)

| Что | Значение | Проверка |
|---|---|---|
| Агенты | **126** | фронтматтер валиден, дублей нет, связность чистая |
| Скиллы | **41** | `name`+`description` валидны (+`analyze-project`, `new-project`) |
| Команды | **168** | по 20 группам |
| Плагины | **33** | marketplace ↔ папки сходятся |
| MCP-инструменты | **293** (рантайм) / ~313 в каталоге | подтверждено `tools/list` |
| Пакеты v3 | **24** | `pnpm -r build` → 23 с `build`-скриптом, 0 ошибок |
| Сборка v3 | ✅ **23/23 пакета** | чистый `pnpm install && pnpm build` |
| MCP-сервер | ✅ запускается | stdio handshake: `initialize` → `ruflo 3.10.31`, `tools/list` → 293 |
| Установка | ✅ `npm ci` | lockfile `my_agents@3.10.31` |
| git | local = origin, дерево чисто | — |

---

## 2. Что сделано

### Анализ и модернизация
- Многоагентный аудит репозитория с адверсариальной верификацией находок.
- **123 агент** приведён к единому стандарту промпта (триггерный `description`, *When to use*, *Output contract*, *Coordination* с тирами 0/1/2/3, *anti-drift*, `## Model & cost`).
- **47 агентов плагинов** выровнены по тиру (`## Model & cost`).

### Реестр и авто-правило связности (`b61a695a3`, `722806c45`)
- Авто-генерируемый каталог: `docs/AGENT-CATALOG.md` + `agent-catalog.html` (интерактивный) + `agent-report.html`.
- **Правило** `scripts/check-agents.mjs`: валидирует агентов и скиллы, регенерит реестр (новый агент добавляется сам), **перепроверяет связность** (любая `` `ссылка` `` обязана вести на реального агента/плагин/скилл).
- Автоматизация: `PostToolUse`-хук (`scripts/agents-hook.mjs`) + git `pre-commit` (`.githooks/pre-commit`, включается `git config core.hooksPath .githooks`).
- Починена 1 битая ссылка (`performance-analyzer` → `perf-analyzer`).

### Документация (`2f5016468`, `084c9bd03`, `f87518842`, `722806c45`)
- `CONCEPTS.md` / `concepts.html` — «для чайников»: агент vs скилл vs команда vs плагин vs MCP-инструмент + оргструктура.
- `FULL-BREAKDOWN.md` / `full-breakdown.html` — исчерпывающий разбор всех слоёв (авто-генерируется).
- `start.html` — единая точка входа во все витрины.
- `CLAUDE.md`: устаревший ручной список агентов заменён указателем на авто-реестр + правило.

### Честность метрик (`ccd1cd043`)
- Непроверенные «HNSW 150x–12500x» и «Flash Attention 2.49x–7.47x» вычищены из **user-facing** вывода CLI и `init`-генераторов (раньше попадали в `CLAUDE.md` каждого инициализированного проекта). Приведены к измеренным `~1.9x–4.7x` / «experimental, unverified».

### Идентичность форка (`76aca7b4b`, `9c13a5d8e`, `04fcf22a6`)
- **60 манифестов** (под-пакеты `v3/@claude-flow/*`, плагины, `v3/plugins/*`, `ruflo/`, `settings.json`) ребрендированы на `sashakobtsev21-stack/my_agents`.
- Сторонние tool-репозитории (`neural-trader`, `ruvector`), имена пакетов и `LICENSE` © ruvnet **сохранены** (требование MIT).

### Точечные исправления (`df49c40a6`, `71b09229a`, `4793f82be`)
- `ruflo-graph-intelligence`: добавлены README + команда `/graph-intelligence` (был пустой плагин).
- MCP `serverInfo` версия `3.0.0` → `3.10.31`; раз-линкованы битые ссылки `verification.md`.
- `agentdb-backend`: заэкранирована колонка-ключевое-слово `"references"` (SQLite-баг, маскировался try/catch).
- **Баг сборки:** `cli` не объявлял зависимость `@claude-flow/swarm` (на которую ссылается через TS project-references) → гонка `pnpm -r build` → `TS6305`. Добавлена зависимость → **чистая сборка 23/23**.

### Проверка рантайма (smoke-test)
- TS-сборка всего монорепо: **23/23 пакета, 0 ошибок**.
- MCP-сервер: stdio handshake `initialize` → `{"name":"ruflo","version":"3.10.31"}`, `tools/list` → **293 инструмента**.
- Нативные модули: `@ruvector/*` (prebuilt win32-x64-msvc), `onnxruntime` (грузит `all-MiniLM-L6-v2`, 384d), `better_sqlite3.node` собран.
- Память: бэкенд **`HNSW + sql.js` (WASM SQLite)** — нативная компиляция не требуется.

### Сессия 2026-06-08 (вторая волна) — `58032779b … 4f970cea2`

- **Честность (②).** Сфабрикованные перф-цифры («150x-12,500x», «2.49x-7.47x») вычищены **по всему репо**: рантайм-вывод CLI, ~240 файлов скиллов/агентов/команд/доков, исходники остальных пакетов + helpers + config + 2 связанных теста. Построчно — честные дисклеймеры не тронуты; исторические ADR и тест-фикстуры оставлены намеренно. Полые плагины (`gastown-bridge`, `code-intelligence`, `legal-contracts`) помечены **experimental** на витрине. → закрывает 🟠-пункт «перф-метрики во внутреннем коде».
- **CVE.** `vitest` → 4.1.8 (GHSA-5xrq-8626-4rwp); `npm audit` → **0 уязвимостей**.
- **First-class воркфлоу (①).** Скиллы `/analyze-project` и `/new-project` со встроенным **verify-гейтом** («готово» = собирается + тесты + запуск).
- **Декомпозиция god-file (④).** Из `commands/hooks.ts` вынесены `coverage-reader` и чистые хелперы (+тесты); 5331 → 5072 строк.
- **Курирование (⑤).** `docs/CORE-AGENTS.md` — ядро ~20 агентов + карта пересечений (без удалений, безопасный roadmap консолидации).
- **Типобезопасность.** Убраны `catch (e: any)` в `memory-bridge.ts` (хелпер `errMsg`), `: any` 32→25.
- **Покрытие тестами (③) — +158 тестов, 4 пакета, 0 регрессий:**
  `cli-core` 44 (JSON-memory backend, security-валидаторы) · `swarm` 44 (Agent entity, AgentPool, MessageBus) · `shared` 58 (config-validator, event-sourcing aggregates, Agent/Task/Memory проекции, core EventBus) · `neural` 12 (Pattern).
  Верификация: **swarm 698/698**, **cli-core 44/44** зелёные; пред-существующий `hooks/file-organization.test.ts` падает по env/CRLF (не связан с правками).
- **Пилот `/analyze-project`.** Прогнан end-to-end на реальном репо `mynewplaywrightproject`: аудит (3 параллельных специалиста + `npm audit`/typecheck/lint) → отчёт P1/P2/P3 → фиксы (redact ключа в телеметрии, CI-гейт visual/perf, `AI_MODEL`→Zod, serial-CRUD cleanup, contact-form ассерты, prettier) → **[PR #9](https://github.com/sashakobtsev21-stack/mynewplaywrightproject/pull/9)** (verify: typecheck/lint + husky/commitlint репо).

---

## 3. Что осталось сделать

### 🟠 Стоит сделать
- ✅ **Перф-метрики во внутреннем коде v3** — сделано во второй волне (вычищены по всему репо, построчно, с прогоном связанных тестов).
- **Memory end-to-end.** Прямой `memory_store` в standalone-вызове вернул `success:false` (эмбеддинг не прогрелся вне MCP-сессии). Нужно подтвердить запись+поиск в полноценном MCP-сеансе (сервер сам прогревает эмбеддер).
- **Полный прогон тестов v3.** `pnpm -r test` прогнан: **7876 passed / 148 failed** — все падения env-rooted (нет native `@ruvector/sona`/`ruvllm-wasm`/onnx на хосте + CRLF-хрупкость), **не вызваны правками**. В CI (с native-деками + LF) проходят. Стоит зафиксировать зелёный базлайн именно в CI.
- **Координаторы без юнит-тестов.** Покрытие подняли на 4 пакетах (+158), но тяжёлые `unified-/queen-/attention-coordinator`, `federation-hub` (800–2000 строк, async/таймеры) пока без прямых тестов.

### 🟡 Можно
- **Глубокий рерайт агентов плагинов (47).** Сейчас выровнены только по тиру; полноценные *When-to-use / Output / Coordination* — отдельный объём.
- **Единый стандарт для команд (168).** Команды пока только перечислены в реестре, без модернизации промптов.
- **Синхронизация шаблонов `v3/@claude-flow/cli/.claude/agents` (89)** — это отдельный init-набор, разошёлся с каноном `.claude/agents`.

### 🟢 Техдолг (точечно, с тестами)
- `SafeExecutor` — allowlist по `basename` (defense-in-depth; injection уже блокируется `shell:false`). Усилить, не ломая тесты security-модуля.
- Крупные файлы (>500 строк), DDD-слои-каркасы в ряде пакотов, `noImplicitAny:false`.
- `docs/STATUS.md` / `USERGUIDE.md` — upstream-справочник (помечен баннером); можно довести счётчики/ссылки или вынести как `legacy`.

### ⚪ К сведению (не баги)
- `npx ruflo …` ставит публичный npm-пакет, а не этот репозиторий — для своей команды подключай через marketplace или копирование `.claude/`.
- `core.hooksPath` — локальная git-настройка (не коммитится); на новой машине: `git config core.hooksPath .githooks`.
- Нативные бинарники нужны только для рантайма MCP-сервера, не для TS-сборки.

---

## 4. Журнал коммитов (серия доработок)

| Хеш | Описание |
|---|---|
| `58032779b…4f970cea2` | **вторая волна:** honesty-pass по всему репо, CVE vitest, скиллы `/analyze-project`+`/new-project`, декомпозиция `hooks.ts`, `CORE-AGENTS.md`, **+158 тестов** (cli-core/swarm/shared/neural), пилот → PR #9 |
| `b475a1e62` | docs: v3 собирается чисто 23/23 после фикса порядка сборки |
| `4793f82be` | fix(v3): объявлена зависимость `@claude-flow/swarm` в cli (детерминированная сборка) |
| `04fcf22a6` | identity: ребренд манифеста `ruflo-graph-intelligence` |
| `50dcec1a5` | docs+deps: обновление статуса README, регенерация витрин, синк v3-lockfile |
| `9c13a5d8e` | identity: ребренд манифестов `v3/plugins/*` |
| `722806c45` | feat: точка входа `start.html` + правило расширено на скиллы |
| `71b09229a` | fix(memory): экранирование колонки `"references"` |
| `162977a89` | refactor(agents): стандартизация 47 агентов плагинов |
| `df49c40a6` | fix: graph-intelligence + версия MCP + битые ссылки |
| `76aca7b4b` | identity: ребренд под-пакетов и плагинов |
| `ccd1cd043` | fix(cli): чистка непроверенных перф-метрик из user-facing |
| `f87518842` | docs: полный разбор `FULL-BREAKDOWN` |
| `084c9bd03` | docs: гайд для новичков `CONCEPTS` |
| `b61a695a3` | feat(agents): правило + тулинг авто-реестра и связности |
| `2f5016468` | docs: ссылки README на витрины + «как работает» в отчёте |

---

_Отчёт сгенерирован вручную по итогам серии доработок; авто-витрины (`AGENT-CATALOG`, `FULL-BREAKDOWN`, `agent-report`) обновляются `node scripts/gen-*.mjs`._
