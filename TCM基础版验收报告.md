# TCM 测试用例管理 · 基础版验收报告

> 验收对象：测试用例管理模块（`tcm/` 14 模块 + `scripts/tcm_xlsx.py`）基础版（v1）
> 验收日期：2026-08-08 ｜ 环境：Node 22.22 / Python 3.13（托管 venv，openpyxl 3.1.5）/ 服务 `:49173`
> 验收人：产品通（自动化验收 + 运行时冒烟）

## 一、结论

**✅ 基础版验收通过，建议放行。** 所有硬性验收指标全绿；发现 2 项非阻塞改进点（见第五节），不阻断发布。

| 验收维度 | 结果 | 说明 |
|---------|------|------|
| 模型/存储层单测 | **97 / 97 通过** | `tests/tcm-model.test.js` |
| 遗留自测套件 | **20 / 20 通过** | `tests/app-logic.test.js`（TCM 改造未打挂旧逻辑） |
| 运行时端到端冒烟 | **11 / 11 硬指标通过** | `tmp/tcm_acceptance_smoke.cjs`（jsdom） |
| 静态资源托管 | **14 / 14 HTTP 200** | server.js 全量托管 tcm 资源 |
| xlsx 导入/导出 | **通过** | 导出 .xlsx + 导入回环一致 |
| 发现项 | 2 项（非阻塞） | 业务作用域默认行为、计数徽标一致性 |

## 二、验收方法与工具

1. **模型层单测**：`node --test tests/tcm-model.test.js`（node:test 内置，离线可跑）。
2. **资源托管探测**：对 14 个 `/tcm/*` 资源逐个 `curl` 校验 HTTP 200。
3. **运行时端到端冒烟**：用 jsdom 加载 14 个 tcm 脚本 → `TCM.shell.mount` → 渲染 6 子视图 → 播种资产 → 走通「资产→计划→执行」闭环，断言解耦与唯一键。
4. **xlsx 工具链**：构造 payload 跑 `scripts/tcm_xlsx.py export/import`，校验产物可被 openpyxl 正确回读。

> 说明：受环境限制未装浏览器二进制（playwright 无本地浏览器），UI 视觉项（sticky/hover/布局）按设计约定由代码审查覆盖，建议发布前补一次真机浏览器走查。

## 三、详细验收项

### 3.1 模型/存储层（97/97）
覆盖：迁移幂等、枚举兜底（非法 priority/status/type 回退默认）、`asset.testPlans → asset.linkedBatchIds` 改名、目录树聚合、`caseExecutions` 业务唯一键 `(planId,round,caseAssetId)` 去重、写入守卫（执行模块禁写 `basicCaseLibrary` 业务字段）、xlsx 脚本存在性与降级。

### 3.2 静态资源与集成
- 14 个 tcm 资源（含 `tcm.css` 与 13 个 JS 模块）全部 HTTP 200。
- `app.js` 接入 6 个 TCM 共享集合（`basicCaseLibrary / testPlans / caseExecutions / reviewTickets / caseDirectories / caseVersions`）、`setStateProvider`、壳层挂载；`index.html` 含 6 子 Tab 容器与全局单例挂载点。

### 3.3 模块加载与壳层（jsdom 冒烟）
- 14 模块加载零异常；`window.TCM` 命名空间完整（`util/bus/store/model/shell` + 6 视图 + `caseEditor/io/ai/steps`）。
- 壳层 `mount` 成功，渲染 6 个子 Tab（用例库/测试计划/测试执行/用例评审/统计看板/追溯视图）。
- **6 个子视图均渲染真实内容（非空、非占位）**——库 len≈10.6k、计划 len≈679、执行 len≈252、评审 len≈1.4k、看板 len≈12.5k、追溯 len≈985。
  - ⚠️ 注意：`tcm-shell.js` 注释仍写「计划/执行/评审/看板/追溯 即将上线」，但**实际均已实装真实视图**，注释过时（见第六节）。

### 3.4 闭环约束（运行时验证设计红线）
- **资产 ↔ 执行解耦**：向 `caseExecutions` 写入执行结果后，`basicCaseLibrary` 长度不变（执行不污染用例资产，规避旧 `mergeCasesIntoState` 整体替换冲掉手补用例的坑）。✅
- **唯一键去重**：同 `(planId,round,caseAssetId)` 重复推送，`normalizeCaseExecutionList` 去重为 1 条。✅
- **多级目录派生**：`buildDirectoryTree` 由资产字段派生业务→产品→模块→场景 多级目录。✅

### 3.5 xlsx 导入/导出
- 导出：生成合法 `.xlsx`（工作表「测试用例」、表头 10 列、数据 2 行、含冻结首行与自动筛选）。✅
- 导入：base64 回读解析为 `{ok:true, rows:2}`，与导出数据一致。✅
- 降级：环境缺 `openpyxl` 时脚本按约定打印 `TCM_XLSX_ERROR:OPENPYXL_MISSING` 并以退出码 3 结束，server 桥接自动降级 CSV（设计内，已验证）。✅

## 四、遗留自测
`tests/app-logic.test.js` 20/20 通过，确认 TCM 重构未破坏既有应用逻辑。

## 五、发现项（非阻塞，建议跟进）

> **状态更新（2026-08-08 发版前）：F1 / F2 / 文档同步三项均已修复并通过两轮独立回归，详见第九节。**

**F1（中）｜用例库默认业务作用域** —— ✅ 已修复
- 现象：`basicCaseBusiness` 为空时，库视图默认作用域取 `C.BUSINESS[0]`（本地收款），其余业务（如本地付款）资产不可见，需手动在目录树选业务才展示。
- 影响：新用户进入用例库只看到首个业务线的资产，易误以为「别的业务没数据」，可发现性差。
- 建议：默认作用域改为「全部业务」或在目录树顶部加「全部」节点；或在空作用域时给出明确引导。

**F2（低-中）｜子 Tab 计数徽标 vs 可见行不一致** —— ✅ 已修复
- 现象：用例库子 Tab 徽标 = 全库总数（如 3），但默认列表仅显示作用域内 2 条，存在认知落差。
- 建议：徽标随当前业务作用域变化，或在徽标旁标注作用域；与 F1 一并处理最佳。

## 六、文档同步建议 —— ✅ 已完成
`tcm-shell.js` 中 6 个子视图的「即将上线」占位文案/注释已过时——执行/评审/看板/追溯实际均已实装。建议同步注释与占位描述，避免对维护者产生误导。

## 七、部署提醒
- xlsx 导入/导出依赖 `openpyxl`。本环境初始缺失，已在托管 venv 安装 `openpyxl 3.1.5` 使真实导出可用；**部署环境需确保 openpyxl 就位**，否则自动降级 CSV（功能可用但非 xlsx）。

## 八、可重复验收脚本
- 模型单测：`node --test tests/tcm-model.test.js`
- 端到端冒烟：`tmp/tcm_acceptance_smoke.cjs`（需 jsdom + 托管 node）
- xlsx 回环：见本报告 §3.5 命令

---

# 九、发版前调整记录（2026-08-08）

针对第五、六节的 3 项发现，已完成修复 + 两轮独立回归。

## 9.1 修复内容

**F1｜默认业务作用域改为「全部业务」**

关键设计判定：「全部业务」是**视图作用域**而非资产字段值。资产的 `business` 仍必须是合法业务线，作用域哨兵向下游（新建/导入/编辑）透传时一律降级为空串，避免 UI 概念污染出非法数据。未复用空串作哨兵，因为空串在存量逻辑里已代表「未设置」会被兜底成首个业务线，语义冲突。

- `tcm/tcm-core.js`：新增 `ALL_BUSINESS = "__ALL__"` / `ALL_BUSINESS_LABEL`、`DEFAULTS.BUSINESS_SCOPE`（与资产兜底用的 `DEFAULTS.BUSINESS` 分离）、`U.isAllBusiness/businessScope/businessScopeLabel`
- `tcm/tcm-library.js`：`selectedPath.business` 默认全部；目录树顶部加「全部业务」节点；左侧导航子菜单加「全部业务」入口；`rowHtml` 在全部作用域下注入 `.tcm-badge-business` 业务标签；`createDirectory()` 加守卫（须先选具体业务才能建目录）
- `app.js`：新增 `normalizeBasicCaseBusinessScope()`；`defaultState().basicCaseBusiness` 由首个业务线改为 `"__ALL__"`；Legacy 降级路径同步（约 12 处）

**F2｜子 Tab 徽标对齐可见行**

- `tcm/tcm-shell.js` `countOf()` 优先调用视图的 `getVisibleCount()`，异常/非法返回值回落集合长度；徽标 `title` 标注口径（`当前视图可见 X 条 · 全部 Y 条`）
- `tcm-library / tcm-execution / tcm-review` 各自实现 `getVisibleCount()`；plans/dashboard/trace 未实现则回落集合长度（无作用域收窄，口径本就一致）
- 保持 shell 与视图解耦：shell 不感知视图内部筛选逻辑

**文档同步**

- `tcm-shell.js` 占位机制保留但语义改为**异常兜底**（`renderPlaceholder` → `renderFallback`，文案「视图暂不可用，请刷新重试」），非删除机制本身
- `docs/system_design.md` L676 同步为当前真实状态

## 9.2 回归中发现并修复的新缺陷

**A3｜`renderActive()` 渲染顺序调整引入容错回归**（第 1 轮 QA 发现，已修复）

F2 为让徽标读到渲染后最新值，把「先画 Tab 条再渲染视图」改为反序。副作用：视图 `render()` 抛出的异常会穿透 `renderActive()`，导致末尾的 `renderTabs()` 永不执行。

A/B 因果取证（同一份脏数据，仅改渲染顺序）：

```
调整后 (先视图后Tab):  Tab条 = 0   ← 冷启动命中则模块锁死，刷新亦无法自救
回滚顺序 (先Tab后视图): Tab条 = 6   ← 至少可切走自救
```

修法（保留 F2 顺序意图，仅在异常路径加防护）：
1. `renderActive()`：`instance.render()` 包 try/catch → 复用 `renderFallback`
2. `ensureViewMounted()`：`instance.mount()` 包 try/catch，且 `mountedViews.add` 提前到 `mount()` 之前，避免半成品重复挂载
3. `countOf()`：显式排除 `null/undefined`，避免 `Number(null) === 0` 被误判为合法计数

## 9.3 回归结果

| 项目 | 基线 | 结果 |
|------|------|------|
| `tests/tcm-model.test.js` | 97/97 | ✅ 97/97 |
| `tests/app-logic.test.js` | 20/20 | ✅ 20/20 |
| `tmp/tcm_acceptance_smoke.cjs` | 11/11 → **13/13** | ✅ 13/13 |
| `tmp/tcm_uat_regression.cjs`（新建） | — | ✅ **66/66** |
| 静态资源 | 15/15 HTTP 200 + 字节比对 | ✅ 通过 |

9 大攻击面全绿：`__ALL__` 数据污染 8/8、持久化隔离 5/5、渲染顺序 8/8、`getVisibleCount` 契约 13/13、`applyFilters` 契约 6/6、Legacy 降级 7/7、存量迁移 8/8、PRD §6.5 写入隔离 5/5、断言强度审计 6/6。

**冒烟基线加固**：原 F2 校验使用的 `note()` 实现为 `results.push({ok:true})`——恒真、零校验，即原 11/11 中**不含任何 F2 回归保护**（属历史缺失，非本轮改弱）。已替换为 2 条真断言（含反向约束），基线提升至 13/13，并新增 6 条元断言防止日后再被降级。

## 9.4 勘误

- §3.2 静态资源数「14 个」应为 **15 个**（14 个 JS + 1 个 CSS）。
- 原报告仅校验 HTTP 200；本轮补充字节级比对（chunked 编码下 `curl %{size_download}` 恒为 0，需读实际字节），确认服务托管的是改动后文件而非缓存旧版。

## 9.5 仍需人工确认（无浏览器二进制，未做真机走查）

1. `.tcm-badge-business` 业务标签在「全部业务」作用域下的视觉表现
2. `.tcm-subtab.is-unavailable`（原 `is-pending`）改名后的样式
3. 目录树「全部业务」节点的选中态高亮

## 9.6 遗留项

- **`tcm/` 目录尚未纳入 git 版本库**（`git ls-files tcm/` 为空，全部处于 untracked）。14 个模块 + 测试 + 文档均无版本保护，建议尽快 `git add tcm/ tests/tcm-model.test.js docs/ scripts/tcm_xlsx.py` 并提交，否则后续回归缺少 diff 基准，误操作亦无从恢复。
- Legacy 降级路径在「全部业务」作用域下导航无高亮节点，属 cosmetic，已确认无数据影响。
- `plans / dashboard / trace` 三视图未实现 `getVisibleCount()`，当前无作用域收窄故口径一致；若未来为其加入筛选，需同步补接口，否则 F2 的认知落差会在这三个 Tab 重现。
- xlsx 导入导出依赖 `openpyxl`，部署环境需确保就位，否则降级 CSV。
