# 基础用例库 · UX 改进落地说明（供研发 review / 二次修改）

> 目标：把「基础用例库」页面的 5 个体验问题落地成可直接 merge 的前端改动。
> 改动文件：`index.html`、`styles.css`、`app.js`。均为**增量修改**，未删除原有逻辑。

## 改动清单

### 1. 筛选区单行化（P0）
- `index.html`：给搜索框加 `basic-case-search`、3 个下拉加 `basic-case-filter-pill` 类。
- `styles.css`（新增 `.basic-case-toolbar.section-toolbar` 块）：工具栏改为 flex 单行，搜索框 `flex:1` 撑满，下拉压缩为药丸，宽屏 `min-width:120px`。筛选区高度从 ~2 行降为 1 行，列表可视区增加。

### 2. 「新增基础用例」按钮下沉（P0）
- `index.html`：顶部 `panel-header` 的按钮改为 `ghost-button`（次要入口）；在列表标题区 `compact-section-head` 内新增主 CTA `#addBasicCaseBtnInline`（实心主按钮，紧邻列表与「N 条」计数）。
- `app.js`：新增 `els.addBasicCaseBtnInline` 绑定，调用已有的 `openCaseModal("")`。
- `styles.css`：`.compact-section-head` 改为 flex 两端对齐；`.section-head-actions` 为右对齐操作组。

### 3. 目录面板可收起（P1）
- `index.html`：`.basic-case-layout` 加 `id="basicCaseLayout"`；目录头新增收起按钮 `#basicCaseTreeCollapse`。
- `app.js`：绑定折叠 toggle，切换 `.tree-collapsed` 类；状态写入 `localStorage.basicCaseTreeCollapsed`，刷新后保持；初始化时恢复。
- `styles.css`：`.tree-collapsed` 时栅格列宽变 `40px 1fr`，隐藏目录文字/树体，仅保留展开按钮。

### 4. 卡片操作分层（P1）
- `styles.css`：`.bcl-mini`（复制/详情/删除）默认 `opacity:0`，仅在 `.bcl-row:hover / .selected / :focus-within` 时显示。主操作「评审」始终可见，降低误触。

### 5. 已激活筛选标签 + 批量栏吸顶（P2）
- `index.html`：工具栏后新增 `#basicCaseActiveFilters` 容器（`aria-live="polite"`）。
- `app.js`：新增 `renderBasicCaseActiveFilters()`，在 `renderBasicCaseLibrary()` 两个分支均调用；根据搜索/优先级/状态动态渲染可单独 `×` 清除的标签，含「清除全部」。
- `styles.css`：`.basic-case-active-filters` 药丸样式；`.basic-case-batch-bar` 加 `position: sticky`，选择后吸顶常驻。

## 验证
- `node --check app.js` 通过。
- 交互逻辑全部复用既有函数（`openCaseModal` / `renderBasicCaseLibrary` / `updateBasicCaseBatchBar`），无新增后端依赖。

## 研发二次修改提示
- 收起态宽度（当前 40px）、hover 揭示策略（触屏无 hover，可加 `@media (hover:none)` 兜底常显）可按需调。
- 若希望顶部按钮彻底移除而非降为 ghost，删 `index.html` 第 514 行即可。
- 主题色/间距遵循现有 `--primary`、`--text-*` 变量体系，未硬编码。

## 验收与修复记录（QA 两轮回归）
> 由软件团队（工程师 + QA）在本轮完成实现与验收，结论：可交付。

### 本轮新增改动
- **触屏兜底**：`styles.css` 新增 `@media (hover:none){ .bcl-actions .bcl-mini{opacity:1} }`，触屏设备无 hover 时次要操作常显。

### QA 发现并已修复的 Bug
| Bug | 严重度 | 现象 | 根因 | 修复 |
|-----|--------|------|------|------|
| 批量栏吸顶失效 | P1 | 多选后批量栏随列表滚走，不吸顶 | `.basic-case-batch-bar` 的祖先 `.panel{overflow:hidden}` 创建滚动容器，吞掉 sticky | 新增 `.panel.basic-case-panel{overflow:clip}`（特异度 0,2,0 稳胜 `.panel` 的 0,1,0） |
| 收起箭头方向双重翻转 | P3 | 收起态箭头指向错误 | app.js 已切 `‹/›` 字形，CSS 又 `rotate(180deg)` 抵消 | 删除 `.tree-collapsed .tree-collapse-btn{transform:rotate(180deg)}`，仅保留 JS 字形切换 |
| 死声明 | P4 | `.basic-case-toolbar.section-toolbar` 的 `margin-bottom:10px` 永远被更高特异度规则覆盖 | 冗余声明 | 删除该 `margin-bottom` |

### 验证结论
- `node --check app.js` 通过；Grep 确认 `.panel.basic-case-panel{overflow:clip}` 已落地、rotate 规则已移除。
- 第 1 轮通过的 5 项（筛选单行化、新增按钮下沉、卡片操作分层、筛选标签、目录可收起）无回归。
- 仍需**浏览器实测**的项：真实长列表吸顶观感、触屏 `@media(hover:none)` 真机效果、旧版 Safari(<16) 优雅降级。
