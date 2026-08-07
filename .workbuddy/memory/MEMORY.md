# TestReport 项目记忆

## 项目概况
- QA 全流程管理工具（TestFlowTool）
- 技术栈：纯 Node.js http + fs，前端 vanilla JS，playwright-core 为唯一 npm 依赖
- 状态持久化到 app-state.json，Python (python-docx) 导出报告
- 支持 Lark（飞书）Bitable 同步

## 核心功能模块
1. 版本管理（batch lifecycle）
2. 任务管理（task assignment）
3. AI 用例生成（OpenAI Responses API, structured output）
4. 缺陷记录（bug tracking）
5. 报告导出（python-docx）
6. UI 自动化（playwright-core, 8种action: goto/click/fill/waitFor/assertVisible/assertText/screenshot/waitForTimeout）

## 数据结构
- case.steps = 纯文本字符串（\n分隔），来自 AI 生成的数组
- case.automationSteps = 结构化对象数组（stepType/locatorType/target/inputValue/remark），前端编辑器配置
- 前端存储格式 → 运行时格式转换由 buildAutomationRuntimeSteps() 完成

## 2026-06-16 改动
- 用例→自动化步骤映射：AI 生成用例时同时输出 automationSteps
- schema 新增 automationSteps 数组（openPage/click/input/waitElement/assertText/assertElement/screenshot/wait + text/placeholder/label/css）
- prompt 新增自动化步骤生成指令
- 前端 requestAiCases 自动设置 automationEnabled/automationTargetPath/automationSteps
- inferAutomationTargetPath() 从 openPage 步骤推断目标路径

## 工程约定
- 项目用 git 管理。未提交的本地改动可直接 `git checkout -- <files>` 整体撤回（比手动反向 Edit 可靠，曾因 Edit 落盘失败踩坑）
- 静态服务每次从磁盘读文件，前端改动无需重启进程

## 待做
- 执行结果回写（pass/fail/skip → 用例状态）
- 失败→自动建 Bug
- 定时/批量执行（cron + 多任务并发）
- 执行日志与截图留存
- 数据统计看板（2026-07-31 实现过一版总览看板，已撤回；2026-08-03 用户决定不做，搁置）