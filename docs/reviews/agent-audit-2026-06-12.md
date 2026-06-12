# Полный аудит агентной системы my_agents — 2026-06-12

> Read-only аудит v3.10.42 на Windows-хосте (win32 10.0.26200, PowerShell).
> Методология: 6 фаз (инвентарь → структура → качество промптов → граф координации → build/тесты/smoke → безопасность) + адверсариальная верификация каждой High/Critical находки двумя скептиками-субагентами. Все находки подкреплены `file:line`-доказательствами; в репозиторий не внесено ни одного изменения (артефакты регенерации каталога откатывались через `git restore`).

---

## 1. Вердикт

**🟡 Система работоспособна, но требует исправлений: 3 Critical и 14 High находок.** Ядро живо — build v3 зелёный, `check-agents.mjs` зелёный (0 dangling refs по его правилам), каталог агентов свеж, секретов в репо нет, root `npm audit` чистый. Но: тест-сьют v3 красный, в зависимостях v3-workspace 1 critical + 10 high CVE, в координационном графе есть неразрешимые SendMessage-адреса в core-пайплайне, а ~30 промптов ссылаются на несуществующие/недоступные MCP-тулы. Ни один Critical не блокирует основной CLI-рантайм.

---

## 2. Объём проверки

| Что | Проверено | Метод |
|---|---|---|
| Агенты | 104 активных (`.claude/agents/**`, без 19 архивных `agents-advanced/`) | пофайловое ревью 6 параллельными ревьюерами + собственный structural-чекер |
| Скиллы | 41 (`.claude/skills/*/SKILL.md`) | инвентарь + выборочное ревью |
| Команды | 168 entries / 26 top-level (`.claude/commands/**`) | инвентарь, сверка с CLAUDE.md |
| Плагины | 33 (`plugins/ruflo-*`), 33/33 валидных `plugin.json`, marketplace.json консистентен | собственный schema-чекер |
| MCP-тулы | 330 зарегистрированных (`audit-cli-mcp-tools.mjs` PASS) | прогон аудит-скрипта |
| Хуки | `.claude/settings.json` (пути существуют, `agents-hook.mjs` работает с JSON-stdin), `.githooks/pre-commit` | чтение + smoke |
| Build | `v3/@claude-flow/cli` tsc + esbuild — **PASS** | реальный прогон |
| Тесты | `cd v3 && corepack pnpm test` — **FAIL** (7+ падений) | реальный прогон |
| Smoke/audit-скрипты | 20 smoke + 3 audit + 7 контрактов ruflo-core | реальные прогоны |
| Безопасность | скан секретов, root/graph-intelligence/v3 аудиты зависимостей, guardrail-скан промптов | реальные прогоны |
| Адверсариальная проверка | 19 High/Critical находок перепроверены 2 скептиками | субагенты, read-only |

`node scripts/gen-counts.mjs --check` — PASS: заявленные числа 104/41/168/33 в CLAUDE.md/README соответствуют факту.

---

## 3. Сводная таблица

| Категория | Critical | High | Medium | Low |
|---|---|---|---|---|
| A. Инвентарь и документация | 0 | 0 | 3 | 1 |
| B. Структура промптов и валидаторы | 0 | 1 | 1 | 1 |
| C. Качество промптов | 1 | 6 | 6 | 1 |
| D. Граф координации | 0 | 4 | 4 | 2 |
| E. Build / тесты / smoke | 1 | 3 | 3 | 2 |
| F. Безопасность и процесс | 1 | 0 | 2 | 1 |
| **Итого (44 находки)** | **3** | **14** | **19** | **8** |

---

## 4. Детальные находки

### A. Инвентарь и документация

**D-1 · Medium · Дрейф числа MCP-тулов: заявлено ~305, фактически 330**
- Где: `README.md:27`, `CLAUDE.md` (шапка, строка 4).
- Доказательство: `node scripts/audit-cli-mcp-tools.mjs` → `registeredToolCount: 330`, все referenced-тулы существуют.
- Почему важно: единственное число из шапки, не покрытое `gen-counts --check`, — дрейфует.
- Фикс: обновить число и/или включить MCP-счётчик в `gen-counts.mjs`. Трудоёмкость: S.

**D-2 · Medium · CLAUDE.md §Project Configuration противоречит settings.json** *(скептик: ЧАСТИЧНО — блок устарел)*
- Где: `CLAUDE.md:388-390` («hierarchical», «Max Agents: 8») vs `.claude/settings.json:201-204` (`"topology": "hierarchical-mesh"`, `"maxAgents": 15`) + customInstructions «15-agent swarm coordination».
- Почему важно: агент, читающий CLAUDE.md как конфиг-источник, получит неверные дефолты.
- Фикс: привести блок к фактическому settings.json (или явно пометить anti-drift-рекомендацию vs действующий конфиг). S.

**D-3 · Low · Комментарий в settings.json: «367 SKILL.md», фактически 323**
- Где: `.claude/settings.json` (поле-комментарий). Фикс: обновить число. S.

**D-4 · Medium · AGENTS.md документирует недоступные MCP-тулы**
- Где: `AGENTS.md` (таблицы MCP: `task_orchestrate`, `hive-mind_*`).
- Доказательство (скептик-1, ПОДТВЕРЖДЕНО): код `task_orchestrate`/`memory_usage` существует в `v3/.../mcp-tools/`, но **не подключён** к активному MCP-серверу CLI — рантайм-вызов недоступен.
- Фикс: заменить на фактический набор (`task_create`, `memory_store`, …). S.

### B. Структура промптов и валидаторы

**ST-1 · Medium · Стандарт секций из CLAUDE.md массово не соблюдается**
- Доказательство (собственный чекер по 104 агентам): нет «How you work» — 63, «Output contract» — 56, «Quality bar & anti-drift» — 59, «When to use» — 19, «Coordination» — 14. `## Model & cost` — 104/104 (это единственное, что enforce-ит `check-agents.mjs`).
- Почему важно: CLAUDE.md объявляет стандарт обязательным («MUST follow»), CI его не проверяет → стандарт декоративный.
- Фикс: либо расширить `check-agents.mjs` на все секции (и добить промпты), либо честно сузить стандарт. M–L.

**ST-2 · Low · 10 файлов с несовпадением имени файла и `name:`**
- Примеры: `analysis/code-analyzer.md` → `name: analyst`; `goal/agent.md` → `name: sublinear-goal-planner`; `templates/migration-plan.md` → `name: migration-planner`; `arch/system-design/arch-system-design.md` → `name: system-architect` и др.
- Каталог резолвит по `name:`, так что это в основном эргономика поиска. Фикс: переименование с регенерацией каталога. S–M.

**ST-3 · High · Системная слепая зона `check-agents.mjs`: однословные ссылки не проверяются**
- Где: `scripts/check-agents.mjs:21` — `REF_RE` требует **дефис** в backtick-токене.
- Доказательство (скептик-1, ПОДТВЕРЖДЕНО): `` `architect` ``, `` `animator` ``, `` `mesh` `` не попадают в connectivity-check → класс битых адресов (G-1…G-3) невидим для CI.
- Почему важно: это корневая причина, из-за которой битые SendMessage-адреса дожили до аудита при зелёном CI.
- Фикс: расширить regex на однословные токены + allowlist для топологий/общих слов. S.

### C. Качество промптов

**P-1 · Critical · game-director: Tier-0 в description vs «Tier 3» в теле** *(скептик: ПОДТВЕРЖДЕНО)*
- Где: `.claude/agents/game-dev/game-director.md:3` («Use as the Tier-0 lead») vs `:36` («This agent operates at **Tier 3** (execution specialist)»).
- Почему важно: прямое самопротиворечие в лид-агенте целого домена — ломает иерархию game-dev-пака.
- Фикс: строка 36 → Tier 0. S.

**P-2 · High · Легаси MCP-тулы `task_orchestrate`/`memory_usage` в ~30 промптах** *(скептик: ПОДТВЕРЖДЕНО)*
- Где (выборка): 12/13 github-агентов, `neural/safla-neural.md:68`, `templates/migration-plan.md`, goal-планировщики, hive-mind-агенты.
- Доказательство: тулы не зарегистрированы на активном MCP-сервере CLI (код есть, но не wired) — вызов в рантайме упадёт.
- Фикс: массовая замена на актуальные имена (`task_create`, `memory_store`, `swarm_init`, …). M.

**P-3 · Medium · `mcp__github__*` в 7 github-агентах — внешний сервер, не сконфигурированный по умолчанию** *(скептик: ЧАСТИЧНО — понижено с High)*
- Суть: ссылки легитимны для опционального официального GitHub MCP-сервера, но он не входит в дефолтную конфигурацию репо → у пользователя «из коробки» тулы недоступны; в промптах смешаны два стека (внешний `mcp__github__*` и встроенный `github_*` + `gh` CLI).
- Фикс: либо документировать требование внешнего сервера в каждом таком промпте, либо мигрировать на `gh` CLI / встроенные тулы. M.

**P-4 · High · Фантомные тулы `github_code_review`, `github_sync_coord`**
- Где: объявлены в guidance-листе (`v3/.../guidance-tools.ts`), отсутствуют в регистрации (`github-tools.ts`); упоминаются в промптах github-пака.
- Фикс: реализовать или удалить из guidance и промптов. S.

**P-5 · High · `npx claude-flow sparc run|tdd|…` — несуществующие CLI-команды** *(скептик: ПОДТВЕРЖДЕНО)*
- Где: `goal/code-goal-planner.md` (несколько блоков bash).
- Доказательство: в CLI 26 команд, `sparc` среди них нет — есть только слэш-команды `.claude/commands/sparc/*`.
- Фикс: заменить на `workflow run` / слэш-команды. S.

**P-6 · High · agentic-payments: 9 вымышленных `mcp__agentic-payments__*` тулов** *(скептик: ПОДТВЕРЖДЕНО)*
- Где: `.claude/agents/specialized/agentic-payments.md`.
- Доказательство: реализации нет ни в CLI, ни в плагинах; агент при этом сирота в графе агентов (G-8).
- Фикс: пометить experimental + убрать тулы, или реализовать. M.

**P-7 · High · dual-orchestrator: фазы «Codex» демонстрируются командами `claude -p`** *(скептик: ПОДТВЕРЖДЕНО как mislabeling)*
- Где: `.claude/agents/dual-mode/dual-orchestrator.md:134-139, 155-158` — заголовок «Phase 2: Headless Implementation (Codex)», внутри только `claude -p`; `codex exec` в файле отсутствует.
- Контракт: `dual-mode/codex-worker.md:11-15` — codex-воркер запускается **только** `codex exec`; `claude -p` валиден для Claude-воркеров.
- Фикс: исправить метки фаз и/или примеры. S.

**P-8 · High · goal-planner-reasoning: ложная самоидентификация + дубль ~45%** *(скептик: ЧАСТИЧНО — «95%» опровергнуто)*
- Где: `.claude/agents/reasoning/goal-planner.md:83` — называет себя «`goal-planner` … this file» при `name: goal-planner-reasoning` (строка 2).
- Дублирование: строки 8–49 практически идентичны `goal/goal-planner.md` (~45% reasoning-файла, ~23% канонического — не 95%).
- Фикс: исправить строку 83; решить merge/keep (канонический файл уже различает варианты в Scope). S/M.

**P-9 · Medium · Инверсия имён analysis-агентов** *(скептик: ПОДТВЕРЖДЕНО)*
- `analysis/analyze-code-quality.md` → `name: code-analyzer`; `analysis/code-analyzer.md` → `name: analyst`. Дезориентирует при навигации. Фикс: переименовать файлы + regen каталога. M.

**P-10 · Medium · migration-plan: 5 несуществующих целевых имён** *(скептик: ПОДТВЕРЖДЕНО, с оговоркой «template»)*
- Где: `templates/migration-plan.md` → `sparc-orchestrator`, `sparc-tester`, `performance-optimizer`, `smart-agents`, `token-analyzer` — 0 совпадений по `name:` в 104 активных. Ближайшие каноны: `sparc-coord`, `tester`, `perf-analyzer`, `smart-agent`, `analyst`.
- Фикс: заменить на канонические имена. S.

**P-11 · Medium · Дрейф путей документации в ≥10 промптах**
- Примеры: `RUVECTOR_SONA_INTEGRATION.md` (safla-neural — файла нет; скептик: ПОДТВЕРЖДЕНО), `api/auth-service.ts` (sparc/refinement — нет; doc-drift, не live-уязвимость), `docs/adr/*.md` в корне (ADR лежат в `v3/docs/adr` и `v3/implementation/adrs`), `docs/SPEC.md`, `docs/game/GDD.md`, `memory/usage.md`.
- Фикс: поправить пути или формулировки «if present». S.

**P-12 · Medium · Кластер устаревших фактов/версий в промптах**
- `sona@0.1.1` vs актуальной 0.1.5; «213 MCP tools», «19 hooks» (фактически 330/17); 1536-dim эмбеддинги vs фактических 384; ссылки на `@alpha`-каналы; неверифицируемые перф-клеймы у agentic-payments («<1ms Ed25519»). Позитив: запрещённых клеймов 150x/12500x/2.49–7.47x в 104 активных промптах **нет**.
- Фикс: точечные правки. S каждая.

**P-13 · Medium · Пересечения триггеров (роутинг-неоднозначность)**
- Кластеры: `workflow-automation` vs `cicd-engineer` (оба «GitHub Actions YAML»); `reviewer`/`security-auditor`/`dependency-auditor` (CVE-triage в обоих); `coder` vs языковые специалисты; `technical-artist`/`rendering-engineer`/`vfx-artist` (шейдеры в трёх); `queen-coordinator` vs `hierarchical-coordinator`.
- Фикс: развести формулировки «Use when» взаимоисключающими сигналами. M.

**P-14 · Low · Отклонения от объявленных дефолтов**
- `maxAgents: 5/6` в ряде промптов при стандарте 8; opus у части Tier-1 координаторов без обоснования в Model & cost; `unity-engine-architect` — opus при «Tier 3» формулировках. Фикс: ревизия. S.

### D. Граф координации

**G-1 · High · Неразрешимый адрес `architect` в core-пайплайне** *(скептик: ЧАСТИЧНО — подтверждён для SendMessage)*
- Битые SendMessage-адреса: `core/coder.md:45`, `core/planner.md:45`, `core/researcher.md:38` — агента `name: architect` не существует (канон — `system-architect`).
- Проза (не адресация, но вводит в заблуждение): `prompt-engineer.md:34`, `frontend-specialist.md:36`, `typescript-specialist.md:34`, `project-coordinator.md:24-26`.
- Следствие: каноничный пайплайн CLAUDE.md `researcher → architect → coder → tester → reviewer` буквально нереализуем.
- Фикс: заменить на `system-architect` (или завести алиас). S.

**G-2 · High · `animator` → несуществующий адрес**
- `game-dev/game-designer.md:37`; канон — `character-animator`. Фикс: S.

**G-3 · High · `hierarchical`/`mesh` как адреса агентов**
- `hive-mind/queen-coordinator.md:15,28`, `hive-mind/collective-intelligence-coordinator.md:28` — это названия топологий, агенты называются `hierarchical-coordinator`/`mesh-coordinator`. Фикс: S.

**G-4 · High · `performance-engineer` в пайплайне project-coordinator**
- `project-coordinator.md:24` — среди активных нет такого `name:` (есть `perf-analyzer`, `v3-performance-engineer`, `mobile-performance-engineer`). Фикс: S.

**G-5 · Medium · Swarm-координаторы ссылаются на архивный `performance-benchmarker`**
- Активный аналог — `benchmark-suite`. Фикс: замена ссылок. S.

**G-6 · Medium · Tier-2 consensus-агенты — только в архиве, без пометки** *(скептик: ЧАСТИЧНО)*
- `queen-coordinator.md:29` делегирует консенсус `raft-manager`/`byzantine-coordinator`/`quorum-manager` — все лежат в `agents-advanced/consensus/` (валидны по `check-agents`, который намеренно включает архив, но **не загружаются** Claude Code и не входят в активные 104). Промпт не помечает их archived/optional.
- Фикс: пометка в промпте либо возврат нужных в актив. S.

**G-7 · Medium · SPARC: разрыв на финальной фазе + фантомные роли**
- `sparc/refinement.md` передаёт работу «Completion phase» — агента фазы Completion нет; `templates/sparc-coordinator.md` упоминает роли «SPARC Researcher/Designer/Documenter», не существующие как агенты.
- Фикс: замкнуть на `production-validator`/`sparc-coder` или описать фазу без агента-адресата. S–M.

**G-8 · Low · Сироты в графе агент→агент: `agentic-payments`, `test-long-runner`** *(скептик: ЧАСТИЧНО — не полные сироты)*
- 0 входящих рёбер от других агентов, но оба доступны через `.agents/skills/*`, каталог и CLI. Фикс: либо вписать в координацию, либо принять как leaf-агентов. Info/Low.

**G-9 · Low · Никто не передаёт работу `prompt-engineer` и `accessibility-specialist`**
- Кандидаты на入 рёбра: `reviewer` → a11y, `frontend-specialist` → a11y. Low.

**G-10 · Medium · dual-mode: роль Optimizer не замкнута на активного агента**
- В пайплайнах dual-orchestrator уровень 3 («🟢 Optimizer») не маппится ни на один `name:`. Фикс: указать реального исполнителя. S.

### E. Build / тесты / smoke

**T-1 · High · Тест-сьют v3 красный**
- `cd v3 && corepack pnpm test`: падают `commands.test.ts` (5: memory search/list, config set/reset/export), `swarm.test.ts` (dynamic scaling), plugins-тест (путь к каталогу), neural DQN (порог производительности update); прогон завершается с unhandled errors без итоговой сводки.
- Почему важно: CI-сигнал недостоверен; README/CLAUDE не упоминают красные тесты.
- Фикс: разобрать каждое падение (часть выглядит как Windows-path/фикстуры, часть — реальные регрессии). M–L.

**T-2 · Critical · `inventory-capabilities.mjs` зависает навсегда на Windows**
- Где: `scripts/inventory-capabilities.mjs:23` — `while (dir !== '/')` никогда не завершается на win32 (нет якоря `verification.md` в репо + POSIX-условие корня); плюс нерекурсивный скан `MCP_TOOLS_DIR` занижает счёт после декомпозиции тулов.
- Доказательство: процесс убит вручную через ~70s, exit 4294967295.
- Фикс: якорь на `package.json`, `path.parse(dir).root`, рекурсивный скан. S–M.

**T-3 · High · Windows ESM-кластер: `import()` абсолютных путей без `pathToFileURL` (6 файлов)**
- Падают: `smoke-graph-pathfinder.mjs`, `smoke-graph-query-dispatch.mjs`, `smoke-graph-schema-migration.mjs`, `smoke-trajectory-graph-edges.mjs`, а также behavioral-пробы `plugins/ruflo-core/scripts/test-consensus-transport.mjs` (G2 → CT_EXIT=1) и `test-mcp-roundtrips.mjs` (note).
- Симптом: `Only URLs with a scheme in: file, data, and node are supported… Received protocol 'c:'`.
- Фикс: `pathToFileURL(p).href` во всех динамических импортах. S.

**T-4 · High · CRLF-кластер: regex'ы без нормализации `\r` (4 smoke) + нет `.gitattributes`**
- Падают ложно: `smoke-neural-trader-pipeline.mjs:109` (`/^---\n/` не матчит `---\r\n`; YAML всех 4 агентов плагина валиден — скептик подтвердил), `smoke-agent-execute-providers.mjs`, `smoke-wasm-provider-bridge.mjs`, `smoke-ruvllm-wasm-auto-init.mjs` (маркеры в исходниках существуют).
- Корень: `core.autocrlf=true` у клона + отсутствие `.gitattributes`; эталон обработки — `check-agents.mjs:44` (`.replace(/\r/g,'')`).
- Фикс: нормализация `\r` в 4 скриптах + `.gitattributes` (`* text=auto eol=lf`). S.

**T-5 · Medium · `spawnSync('npm'|'pnpm')` без `shell:true` → ENOENT на Windows**
- `scripts/audit-supply-chain.mjs` (его «2 CVE findings» — это его собственные ошибки спавна, ложная тревога), `smoke-cli-npx-install.mjs`.
- Фикс: `npm.cmd`/`shell:true`/`process.platform`-ветка. S.

**T-6 · Medium · gastown-bridge: package.json ссылается на неэмитируемые dist-файлы**
- `audit-plugin-packages.mjs` FAIL: `dist/formula.js`, `dist/formula.cjs`, `dist/convoy.d.ts` и др. отсутствуют после build. Реальный packaging-дрейф (плагин и так помечен ⚠️ experimental).
- Фикс: добить сборку или сузить `files`/`exports`. M.

**T-7 · Medium · `smoke-github-safe-injection.mjs`: PATH-шим fake-gh не работает на Windows**
- Шим без `.cmd` → вызывается реальный `gh`. Фикс: генерировать `gh.cmd` на win32. S.

**T-8 · Low · `smoke-memory-stats-legacy-db.mjs` требует невыставленную зависимость `sql.js`**
- Фикс: объявить dev-dep или резолвить из `v3/node_modules`. S.

**T-9 · Low · Шум в тестах: vitest-деприкейшены (`poolOptions` удалён в Vitest 4) + отсутствующие sourcemap (`q-learning.js.map` и др.)**
- Фикс: конфиг + пересборка карт. S.

Позитив (зелёное): build CLI; `audit-cli-mcp-tools` PASS; 12/20 smoke PASS; hooks-конфиг валиден (все пути существуют, `agents-hook.mjs` корректно работает при JSON-stdin); плагин-контракты ruflo-core: `test-cli-no-crash`, `verify` (ruflo-adr), `test-mcp-protocol`, `test-mcp-roundtrips`, `test-memory-import` — PASS (`test-hooks` требует аргумент-строку CLI-инвокации; без него — usage error по дизайну).

### F. Безопасность и процесс

**S-1 · Critical · v3-workspace: 16 уязвимостей в зависимостях (1 critical, 10 high, 5 moderate)**
- `cd v3 && corepack pnpm audit`: critical — protobufjs (prototype pollution, десятки путей через `agentdb@2.0.0-alpha.3.7`/aidefence-цепочку); high — minimatch ReDoS (через `@claude-flow/cli`), `@opentelemetry/*`, `uuid` и др.
- Корень: overrides в корневом `package.json` (npm) **не распространяются** на pnpm-workspace v3.
- Фикс: продублировать пины в `v3/package.json` → `pnpm.overrides`, пересобрать lockfile, перепрогнать audit. M.

**S-2 · Medium · Windows-ложь supply-chain-аудита маскирует реальное состояние**
- `audit-supply-chain.mjs` на Windows рапортует собственные ENOENT как находки (см. T-5) — оператор не видит ни реальных CVE, ни их отсутствия. Фикс: T-5. S.

**S-3 · Low · `graph-intelligence`: 3 moderate-уязвимости** — точечный bump. S.

**H-1 · Medium · `core.hooksPath` не включён в этом клоне**
- `.githooks/pre-commit` (защита от stale-каталога и dangling-ссылок) существует, но `git config core.hooksPath` пуст → pre-commit-гейт фактически выключен.
- Фикс: `git config core.hooksPath .githooks` (документировано в CLAUDE.md, но не применено). S.

Чистые зоны: секретов нет (`.env` не закоммичен, только `ruflo/.env.example` с плейсхолдерами; «находки» сканера — тестовые фикстуры); root `npm audit` — 0; guardrail-обходов/prompt-injection в 104 промптах не обнаружено; широкие permissions в settings.json (включая `git push`) соответствуют объявленной политике авто-пуша CLAUDE.md — отмечено как осознанная политика, не уязвимость.

---

## 5. Адверсариальная верификация (Фаза 6)

19 High/Critical находок перепроверены двумя независимыми скептиками с установкой «опровергнуть».

| Результат | Кол-во | Примеры |
|---|---|---|
| Подтверждено | 8 | game-director Tier; sparc-CLI-команды; agentic-payments-тулы; инверсия analyst; mislabel `claude -p`; migration-plan-имена; RUVECTOR_SONA_INTEGRATION.md; REF_RE |
| Частично (уточнено/понижено) | 9 | «95% дубль» → ~45%; «полные сироты» → сироты только в графе агентов; `mcp__github__*` High → Medium (легитимный внешний сервер); CRLF — баг скриптов, не данных; CLAUDE vs settings — устаревший блок, не тотальное противоречие |
| Отброшено как ложноположительное | 1 | «битые ссылки на agents-advanced» — архив намеренно включён в valid-refs `check-agents.mjs:64-78` |

Ключевые поправки скептиков вошли в severity/формулировки раздела 4.

---

## 6. Что НЕ удалось проверить

- **E2E-рантайм мультиагентных пайплайнов** (реальные SendMessage-цепочки между живыми агентами) — вне read-only-объёма; битые адреса подтверждены статически.
- **Поведение хуков в живой сессии Claude Code** — проверены только конфиг, пути и ручной прогон скриптов.
- **POSIX-прогон тестов/smoke** — аудит выполнен только на Windows; кластеры T-3/T-4/T-5/T-7, вероятно, зелёные на Linux/macOS (что и объясняет зелёный CI upstream), но это не проверено.
- **Фиксы уязвимостей** — `pnpm audit --fix`/бампы не применялись (read-only).
- **Внешние MCP-серверы** (postman/elastic/figma плагины Cursor) — вне периметра репо.
- **19 архивных агентов `agents-advanced/`** — детальное ревью промптов не проводилось (вне активного набора); проверена только их роль как ссылочных целей.
- **`test-hooks.mjs` 7 кейсов** — полный протокол прогона с локальной CLI-строкой не зафиксирован пофайлово (харнесс чувствителен к способу вызова на Windows).

---

## 7. Приоритизированный план исправлений

### P0 — сейчас (разблокирует доверие к CI и графу)
1. **Алиасы координации** (G-1…G-4): `architect`→`system-architect` (3 SendMessage + project-coordinator), `animator`→`character-animator`, `hierarchical`/`mesh`→`*-coordinator`, `performance-engineer`→`perf-analyzer`. Одновременно **расширить `REF_RE`** в `check-agents.mjs` на однословные refs + allowlist (ST-3), чтобы класс больше не возвращался.
2. **game-director.md:36** → Tier 0 (P-1).
3. **v3 `pnpm.overrides`** для protobufjs/minimatch/uuid/@opentelemetry (S-1) + перепрогон `corepack pnpm audit`.
4. **Тест-сьют v3** (T-1): разобрать 7+ падений; отделить Windows-фикстурные от реальных регрессий.

### P1 — на этой неделе (Windows-надёжность + рантайм-честность промптов)
5. **Windows-кластеры**: `pathToFileURL` в 6 файлах (T-3); `\r`-нормализация в 4 smoke + `.gitattributes` (T-4); `npm.cmd`/`shell:true` (T-5); fake-gh `.cmd`-шим (T-7); `sql.js` dep (T-8).
6. **`inventory-capabilities.mjs`**: якорь + `path.parse().root` + рекурсивный скан (T-2).
7. **MCP-честность промптов**: массовая замена `task_orchestrate`/`memory_usage` (~30 файлов, P-2); удалить/реализовать `github_code_review`/`github_sync_coord` (P-4); решение по `mcp__github__*` — документировать внешний сервер или мигрировать на `gh` CLI (P-3); AGENTS.md (D-4).
8. **gastown-bridge** packaging (T-6). Включить `git config core.hooksPath .githooks` (H-1).

### P2 — в этом месяце (качество промптов и документации)
9. P-5 (sparc-команды), P-7 (метки dual-orchestrator), P-8 (строка 83 + решение merge), P-9 (инверсия analyst), P-10 (migration-plan), G-5…G-7, G-10, P-11 (docs-пути), D-1…D-3 (числа), P-12 (версии/факты).
10. ST-1: решить судьбу стандарта секций (доводить 63 агента или сузить стандарт + обновить чекер); P-13 (развести триггеры).

### P3 — фоном
11. ST-2 (переименования файлов), P-14 (model-tier/maxAgents ревизия), G-8/G-9 (сироты), T-9 (vitest/sourcemap шум), S-3 (graph-intelligence bump).

### Верификация после правок (обязательный прогон)
```bash
node scripts/check-agents.mjs          # каталог + connectivity (после расширения REF_RE)
node scripts/gen-counts.mjs --check    # числа в доках
node scripts/audit-cli-mcp-tools.mjs   # MCP-регистрация
node scripts/audit-plugin-packages.mjs # packaging плагинов
cd v3 && corepack pnpm build && corepack pnpm test && corepack pnpm audit
```

---

*Аудит выполнен 2026-06-12. Доказательная база: реальные прогоны build/тестов/20 smoke/3 audit-скриптов/7 плагин-контрактов, пофайловое ревью 104 промптов шестью ревьюерами, граф-анализ, два независимых скептика. Изменения в репозиторий не вносились.*
