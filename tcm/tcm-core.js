/**
 * tcm-core.js —— 测试用例管理模块 L0 基础层
 *
 * 职责：
 *   1. 建立 window.TCM 命名空间（禁止污染裸全局）
 *   2. 定义系统设计 §3.0 的全部枚举字典（TCM.const）
 *   3. 提供通用工具函数（TCM.util）
 *   4. 提供极简事件总线（TCM.bus），跨模块通信唯一通道
 *
 * 加载顺序：core → store → model → shell → 各视图 → app.js
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};

  /* ------------------------------------------------------------------ *
   * 一、枚举字典（系统设计 §3.0，共 13 项）
   * ------------------------------------------------------------------ */

  /** 业务线（一级目录）——沿用 app.js BASIC_CASE_BUSINESSES */
  const BUSINESS = ["本地收款", "本地付款", "卡收单", "代付（国际付款）", "VA账户"];
  /**
   * 「全部业务」作用域哨兵值（★ F1）。
   *
   * 语义：它**不是**一条业务线，而是「不按 business 过滤」的视图作用域。
   * 选用 `__ALL__` 而非空串，是因为空串在存量代码里代表「未设置」，
   * 会被 app.js `normalizeLoadedState()` 兜底成 BUSINESS[0]；用显式哨兵可与之区分，
   * 同时前后双下划线保证永远不会与真实业务名冲突。
   *
   * 落地位置：`state.basicCaseBusiness`（LOCAL_STATE_KEYS，刷新后保持）。
   */
  const ALL_BUSINESS = "__ALL__";
  /** 「全部业务」作用域的显示文案 */
  const ALL_BUSINESS_LABEL = "全部业务";
  /** 优先级 */
  const PRIORITY = ["P0", "P1", "P2", "P3"];
  /** 用例状态 */
  const CASE_STATUS = ["草稿", "待评审", "已确认", "已废弃"];
  /** 用例类型（★ 新增） */
  const CASE_TYPE = ["功能", "接口", "性能", "安全", "兼容", "UI", "其他"];
  /** 执行结果（★ 新增） */
  const EXEC_STATUS = ["未执行", "通过", "失败", "阻塞", "跳过"];
  /** 计划状态（★ 新增） */
  const PLAN_STATUS = ["未开始", "进行中", "已完成", "已归档"];
  /** 轮次状态（★ 新增） */
  const ROUND_STATUS = ["未开始", "进行中", "已完成"];
  /** 评审单状态（★ 新增） */
  const REVIEW_STATUS = ["待评审", "评审中", "已完成", "已取消"];
  /** 评审结论（★ 新增），空串 = 未出结论 */
  const REVIEW_CONCLUSION = ["通过", "打回", "需修改", ""];
  /** 评审动作（★ 新增） */
  const REVIEW_ACTION = ["通过", "打回", "需修改", "评论"];
  /** 目录层级（★ 新增），business 固定不入库 */
  const DIR_LEVEL = ["business", "product", "module", "category"];
  /** 证据类型（★ 新增） */
  const EVIDENCE_KIND = ["image", "log", "link"];
  /** 需求引用类型（★ 新增），指向 state.batches / state.tasks */
  const REQ_TYPE = ["batch", "task"];

  /**
   * 各枚举的默认兜底值。
   *
   * 注意 `BUSINESS` 与 `BUSINESS_SCOPE` 的区别（★ F1）：
   *   - `BUSINESS`：**单条资产**的 business 字段兜底，必须是一条真实业务线，
   *     由 `normalizeCaseAsset()` 使用，不能改成「全部」，否则会产生非法资产数据。
   *   - `BUSINESS_SCOPE`：**用例库视图作用域**的兜底，默认「全部业务」，
   *     保证空态 / 新用户进入用例库时能看到所有业务线的资产。
   */
  const DEFAULTS = Object.freeze({
    BUSINESS: BUSINESS[0],
    BUSINESS_SCOPE: ALL_BUSINESS,
    PRIORITY: "P1",
    CASE_STATUS: "草稿",
    CASE_TYPE: "功能",
    EXEC_STATUS: "未执行",
    PLAN_STATUS: "未开始",
    ROUND_STATUS: "未开始",
    REVIEW_STATUS: "待评审",
    REVIEW_CONCLUSION: "",
    REVIEW_ACTION: "评论",
    DIR_LEVEL: "product",
    EVIDENCE_KIND: "image",
    REQ_TYPE: "batch",
    OPERATOR: "未指定"
  });

  /** 状态机：用例资产 status 允许的流转 */
  const CASE_STATUS_TRANSITIONS = Object.freeze({
    "草稿": ["待评审", "已废弃"],
    "待评审": ["已确认", "草稿", "已废弃"],
    "已确认": ["草稿", "已废弃"],
    "已废弃": ["草稿"]
  });

  /** 状态机：计划 status 允许的流转 */
  const PLAN_STATUS_TRANSITIONS = Object.freeze({
    "未开始": ["进行中", "已归档"],
    "进行中": ["已完成", "已归档"],
    "已完成": ["进行中", "已归档"],
    "已归档": []
  });

  /** 状态机：执行结果（可重复标记，任意目标态均允许） */
  const EXEC_STATUS_TRANSITIONS = Object.freeze({
    "未执行": ["通过", "失败", "阻塞", "跳过"],
    "通过": ["未执行", "失败", "阻塞", "跳过"],
    "失败": ["未执行", "通过", "阻塞", "跳过"],
    "阻塞": ["未执行", "通过", "失败", "跳过"],
    "跳过": ["未执行", "通过", "失败", "阻塞"]
  });

  /** 评审结论 → 用例状态回写映射（系统设计 §3.4） */
  const REVIEW_CONCLUSION_EFFECT = Object.freeze({
    "通过": { caseStatusFrom: "待评审", caseStatusTo: "已确认", ticketStatus: "已完成", writeFinishedAt: true },
    "打回": { caseStatusFrom: "待评审", caseStatusTo: "草稿", ticketStatus: "已完成", writeFinishedAt: true },
    "需修改": { caseStatusFrom: "待评审", caseStatusTo: "待评审", ticketStatus: "评审中", writeFinishedAt: false }
  });

  /** ID 前缀约定（系统设计 §8.3） */
  const ID_PREFIX = Object.freeze({
    CASE_ASSET: "bc",
    TEST_PLAN: "plan",
    EXECUTION: "exec",
    REVIEW: "rev",
    DIRECTORY: "dir",
    CASE_VERSION: "cv",
    COMMENT: "cmt"
  });

  /** 本模块引入的 6 个共享集合名（与 server.js sanitizeSharedState 逐项对齐） */
  const COLLECTIONS = Object.freeze([
    "basicCaseLibrary",
    "testPlans",
    "caseExecutions",
    "reviewTickets",
    "caseDirectories",
    "caseVersions"
  ]);

  /** 子 Tab 标识（T02 使用） */
  const SUB_TABS = Object.freeze([
    { key: "library", label: "用例库" },
    { key: "plans", label: "测试计划" },
    { key: "execution", label: "测试执行" },
    { key: "review", label: "用例评审" },
    { key: "dashboard", label: "统计看板" },
    { key: "trace", label: "追溯视图" }
  ]);

  /** 约定事件名（系统设计 §8.2） */
  const EVENTS = Object.freeze({
    CASE_UPDATED: "case:updated",
    CASE_DELETED: "case:deleted",
    CASE_BATCH_CHANGED: "case:batchChanged",
    DIR_CHANGED: "dir:changed",
    PLAN_CREATED: "plan:created",
    PLAN_UPDATED: "plan:updated",
    PLAN_ITEMS_CHANGED: "plan:itemsChanged",
    EXEC_MARKED: "exec:marked",
    EXEC_BUG_CREATED: "exec:bugCreated",
    REVIEW_REQUESTED: "review:requested",
    REVIEW_CREATED: "review:created",
    REVIEW_UPDATED: "review:updated",
    REVIEW_CONCLUDED: "review:concluded",
    // —— 追溯图谱跨模块跳转（T04）——
    REQ_FOCUS: "req:focus",
    CASE_FOCUS: "case:focus",
    PLAN_FOCUS: "plan:focus",
    EXEC_FOCUS: "exec:focus",
    REVIEW_FOCUS: "review:focus",
    DEFECT_FOCUS: "defect:focus",
    STATE_PERSISTED: "state:persisted",
    STATE_REMOTE_CHANGED: "state:remoteChanged"
  });

  /**
   * 统计看板数据窗口（★ T04，Q5），默认「本迭代」。
   * key 必须与 app.js `normalizeTcmLocalPreferences()` 里 `tcmDashboardWindow`
   * 的白名单 `["batch","rolling30","all"]` 完全一致，否则本地偏好无法回读。
   */
  const METRIC_WINDOW = Object.freeze([
    { key: "batch", label: "本迭代" },
    { key: "rolling30", label: "滚动 30 天" },
    { key: "all", label: "全部" }
  ]);

  /** 数据窗口 key 列表 */
  const METRIC_WINDOW_KEYS = Object.freeze(METRIC_WINDOW.map((item) => item.key));

  /** 滚动窗口天数 */
  const ROLLING_WINDOW_DAYS = 30;

  /** 追溯图谱的起点类型（★ T04） */
  const TRACE_ORIGIN_KIND = Object.freeze(["requirement", "case", "execution", "defect"]);

  /** 构成「评审判定」的动作（`评论` 只留痕不改状态） */
  const REVIEW_VERDICT_ACTIONS = Object.freeze(["通过", "打回", "需修改"]);

  /** 路径安全正则：exec- id 会被用作证据目录名，必须满足此约束 */
  const ID_SAFE_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

  /** 每条用例保留的最大历史版本数（Q8 容量护栏） */
  const MAX_VERSIONS_PER_CASE = 20;

  /** persist 防抖窗口（Q8：150ms → 500ms） */
  const PERSIST_DEBOUNCE_MS = 500;

  const CATALOG_CONFIG_KEY = "tcmCaseCatalogConfig";

  function catalogList(value) {
    return Array.from(new Set((Array.isArray(value) ? value : [])
      .map((item) => String(item === undefined || item === null ? "" : item).trim())
      .filter(Boolean)));
  }

  /** 读取可配置的用例字典；未配置时使用系统默认业务类型。 */
  function getCatalogConfig() {
    const state = global.state && typeof global.state === "object" ? global.state : {};
    const raw = state[CATALOG_CONFIG_KEY] && typeof state[CATALOG_CONFIG_KEY] === "object"
      ? state[CATALOG_CONFIG_KEY]
      : {};
    const businesses = catalogList(raw.businesses);
    return {
      businesses: businesses.length ? businesses : BUSINESS.slice(),
      components: catalogList(raw.components),
      tags: catalogList(raw.tags)
    };
  }

  TCM.const = Object.freeze({
    BUSINESS: Object.freeze(BUSINESS.slice()),
    ALL_BUSINESS,
    ALL_BUSINESS_LABEL,
    PRIORITY: Object.freeze(PRIORITY.slice()),
    CASE_STATUS: Object.freeze(CASE_STATUS.slice()),
    CASE_TYPE: Object.freeze(CASE_TYPE.slice()),
    EXEC_STATUS: Object.freeze(EXEC_STATUS.slice()),
    PLAN_STATUS: Object.freeze(PLAN_STATUS.slice()),
    ROUND_STATUS: Object.freeze(ROUND_STATUS.slice()),
    REVIEW_STATUS: Object.freeze(REVIEW_STATUS.slice()),
    REVIEW_CONCLUSION: Object.freeze(REVIEW_CONCLUSION.slice()),
    REVIEW_ACTION: Object.freeze(REVIEW_ACTION.slice()),
    DIR_LEVEL: Object.freeze(DIR_LEVEL.slice()),
    EVIDENCE_KIND: Object.freeze(EVIDENCE_KIND.slice()),
    REQ_TYPE: Object.freeze(REQ_TYPE.slice()),
    DEFAULTS,
    CASE_STATUS_TRANSITIONS,
    PLAN_STATUS_TRANSITIONS,
    EXEC_STATUS_TRANSITIONS,
    REVIEW_CONCLUSION_EFFECT,
    ID_PREFIX,
    COLLECTIONS,
    SUB_TABS,
    EVENTS,
    METRIC_WINDOW,
    METRIC_WINDOW_KEYS,
    ROLLING_WINDOW_DAYS,
    TRACE_ORIGIN_KIND,
    REVIEW_VERDICT_ACTIONS,
    ID_SAFE_PATTERN,
    MAX_VERSIONS_PER_CASE,
    PERSIST_DEBOUNCE_MS
  });

  TCM.catalog = Object.freeze({
    key: CATALOG_CONFIG_KEY,
    get: getCatalogConfig
  });

  /* ------------------------------------------------------------------ *
   * 二、工具函数 TCM.util
   * ------------------------------------------------------------------ */

  /**
   * 生成 6 位 [a-z0-9] 随机串。
   * @returns {string} 定长 6 位随机串
   */
  function rand6() {
    let out = "";
    while (out.length < 6) {
      out += Math.random().toString(36).slice(2);
    }
    return out.slice(0, 6);
  }

  /**
   * 生成业务 ID：`${prefix}-${Date.now()}-${rand6}`。
   * 结果一定满足 ID_SAFE_PATTERN（exec- id 会作为证据目录名）。
   * @param {string} prefix ID 前缀，可带或不带尾部横线（如 "exec" / "exec-"）
   * @returns {string} 形如 `exec-1786070267076-a1b2c3`
   */
  function uid(prefix) {
    const cleaned = String(prefix === undefined || prefix === null ? "id" : prefix)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+$/, "");
    const safePrefix = cleaned || "id";
    return `${safePrefix}-${Date.now()}-${rand6()}`;
  }

  /**
   * 校验 id 是否可安全用作文件系统路径片段。
   * @param {string} value 待校验 id
   * @returns {boolean} 是否安全
   */
  function isSafePathPart(value) {
    return ID_SAFE_PATTERN.test(String(value || ""));
  }

  /**
   * 当前时间的 ISO 8601 UTC 字符串（带毫秒）。
   * @returns {string} 如 `2026-08-08T10:00:00.000Z`
   */
  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * 当前日期 `YYYY-MM-DD`（资产 createdAt 沿用此格式以兼容存量）。
   * @returns {string} 如 `2026-08-08`
   */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * HTML 转义，行为与 app.js escapeHtml 完全一致。
   * @param {*} text 任意值
   * @returns {string} 转义后的字符串
   */
  function escapeHtml(text) {
    return String(text === undefined || text === null ? "" : text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /**
   * 防抖包装。
   * @param {Function} fn 目标函数
   * @param {number} ms 防抖窗口毫秒数
   * @returns {Function} 带 cancel()/flush() 的防抖函数
   */
  function debounce(fn, ms) {
    const wait = Number.isFinite(Number(ms)) ? Number(ms) : 0;
    let timer = null;
    let lastArgs = null;
    let lastThis = null;

    function invoke() {
      timer = null;
      const args = lastArgs || [];
      const context = lastThis;
      lastArgs = null;
      lastThis = null;
      fn.apply(context, args);
    }

    function debounced(...args) {
      lastArgs = args;
      lastThis = this;
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(invoke, wait);
    }

    debounced.cancel = function cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      lastArgs = null;
      lastThis = null;
    };

    debounced.flush = function flush() {
      if (timer !== null) {
        clearTimeout(timer);
        invoke();
      }
    };

    debounced.pending = function pending() {
      return timer !== null;
    };

    return debounced;
  }

  /**
   * 当前操作人：读 state.settings.currentOperator，为空回退 "未指定"。
   * @param {object} [stateRef] 可选，显式传入状态对象（便于单测）
   * @returns {string} 操作人名称
   */
  function currentOperator(stateRef) {
    const source = stateRef && typeof stateRef === "object" ? stateRef : global.state;
    const name = source && source.settings ? source.settings.currentOperator : "";
    const trimmed = String(name === undefined || name === null ? "" : name).trim();
    return trimmed || DEFAULTS.OPERATOR;
  }

  /**
   * 枚举兜底：值在候选集合内则原样返回，否则返回 fallback。
   * @param {*} value 待判定值
   * @param {Array<string>} allowed 允许值集合
   * @param {string} fallback 兜底值
   * @returns {string} 合法枚举值
   */
  function oneOf(value, allowed, fallback) {
    const list = Array.isArray(allowed) ? allowed : [];
    return list.includes(value) ? value : fallback;
  }

  /**
   * 判断某个业务作用域值是否代表「全部业务」（★ F1）。
   *
   * 空串（未设置）与哨兵值 `__ALL__` 都视为「全部」，
   * 这样存量 localStorage 里的空值可以平滑升级为新默认行为。
   *
   * @param {*} value 作用域值
   * @returns {boolean} 是否为「全部业务」
   */
  function isAllBusiness(value) {
    const text = String(value === undefined || value === null ? "" : value).trim();
    return !text || text === ALL_BUSINESS;
  }

  /**
   * 归一化业务作用域（★ F1）。
   *
   * 空值 / 非法值 / 哨兵值 → `ALL_BUSINESS`（全部业务）；合法业务线 → 原样返回。
   * 注意与 `oneOf(value, BUSINESS, DEFAULTS.BUSINESS)` 的差别：后者用于**资产字段**兜底，
   * 必须回落到一条真实业务线；本函数用于**视图作用域**，回落到「全部」。
   *
   * @param {*} value 作用域值
   * @returns {string} `ALL_BUSINESS` 或一条合法业务线
   */
  function businessScope(value) {
    if (isAllBusiness(value)) {
      return ALL_BUSINESS;
    }
    const text = String(value).trim();
    return BUSINESS.includes(text) ? text : ALL_BUSINESS;
  }

  /**
   * 业务作用域的显示文案（★ F1）。
   * @param {*} value 作用域值
   * @returns {string} 「全部业务」或业务线名称
   */
  function businessScopeLabel(value) {
    return isAllBusiness(value) ? ALL_BUSINESS_LABEL : businessScope(value);
  }

  /**
   * 安全转字符串并 trim。
   * @param {*} value 任意值
   * @param {string} [fallback] 空值时的兜底
   * @returns {string} 字符串
   */
  function str(value, fallback = "") {
    if (value === undefined || value === null) {
      return fallback;
    }
    const text = String(value).trim();
    return text || fallback;
  }

  /**
   * 安全转数字。
   * @param {*} value 任意值
   * @param {number} fallback 兜底值
   * @param {number} [min] 下界（含）
   * @returns {number} 数字
   */
  function num(value, fallback, min) {
    const parsed = Number(value);
    let result = Number.isFinite(parsed) ? parsed : fallback;
    if (min !== undefined && result < min) {
      result = min;
    }
    return result;
  }

  /**
   * 安全转布尔。
   * @param {*} value 任意值
   * @param {boolean} [fallback] 兜底值
   * @returns {boolean} 布尔值
   */
  function bool(value, fallback = false) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    if (value === "false" || value === 0 || value === "0") {
      return false;
    }
    if (value === "true" || value === 1 || value === "1") {
      return true;
    }
    return Boolean(value);
  }

  /**
   * 安全转数组。
   * @param {*} value 任意值
   * @returns {Array} 数组（非数组返回空数组）
   */
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * 字符串数组归一化：转字符串、trim、去空、去重。
   * @param {*} value 任意值（数组或以逗号分隔的字符串）
   * @returns {Array<string>} 归一化后的字符串数组
   */
  function stringList(value) {
    const raw = Array.isArray(value)
      ? value
      : String(value === undefined || value === null ? "" : value).split(/[,，;；]/);
    const seen = new Set();
    const out = [];
    raw.forEach((item) => {
      const text = String(item === undefined || item === null ? "" : item).trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    });
    return out;
  }

  /**
   * 深拷贝（JSON 安全）。
   * @param {*} value 任意可序列化值
   * @returns {*} 深拷贝副本
   */
  function clone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * 归一化为 ISO 8601 字符串；无法解析时返回 fallback。
   * @param {*} value 任意时间值
   * @param {string} [fallback] 兜底值
   * @returns {string} ISO 字符串或 fallback
   */
  function isoOr(value, fallback = "") {
    const text = str(value);
    if (!text) {
      return fallback;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }
    return parsed.toISOString();
  }

  /**
   * 归一化为 `YYYY-MM-DD`；无法解析时返回 fallback。
   * @param {*} value 任意日期值
   * @param {string} [fallback] 兜底值
   * @returns {string} 日期字符串或 fallback
   */
  function dateOr(value, fallback = "") {
    const text = str(value);
    if (!text) {
      return fallback;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }
    return parsed.toISOString().slice(0, 10);
  }

  TCM.util = {
    uid,
    rand6,
    isSafePathPart,
    nowIso,
    today,
    escapeHtml,
    debounce,
    currentOperator,
    oneOf,
    isAllBusiness,
    businessScope,
    businessScopeLabel,
    str,
    num,
    bool,
    toArray,
    stringList,
    clone,
    isoOr,
    dateOr
  };

  /* ------------------------------------------------------------------ *
   * 三、事件总线 TCM.bus
   * ------------------------------------------------------------------ */

  const listeners = new Map();

  /**
   * 订阅事件。
   * @param {string} eventName 事件名
   * @param {Function} handler 处理函数
   * @returns {Function} 取消订阅函数
   */
  function on(eventName, handler) {
    const name = str(eventName);
    if (!name || typeof handler !== "function") {
      return function noop() {};
    }
    if (!listeners.has(name)) {
      listeners.set(name, new Set());
    }
    listeners.get(name).add(handler);
    return function offThis() {
      off(name, handler);
    };
  }

  /**
   * 取消订阅。不传 handler 则清空该事件的全部订阅。
   * @param {string} eventName 事件名
   * @param {Function} [handler] 处理函数
   * @returns {void}
   */
  function off(eventName, handler) {
    const name = str(eventName);
    if (!name || !listeners.has(name)) {
      return;
    }
    if (typeof handler !== "function") {
      listeners.delete(name);
      return;
    }
    const set = listeners.get(name);
    set.delete(handler);
    if (set.size === 0) {
      listeners.delete(name);
    }
  }

  /**
   * 只订阅一次。
   * @param {string} eventName 事件名
   * @param {Function} handler 处理函数
   * @returns {Function} 取消订阅函数
   */
  function once(eventName, handler) {
    const dispose = on(eventName, function wrapped(payload) {
      dispose();
      handler(payload);
    });
    return dispose;
  }

  /**
   * 触发事件。单个订阅者异常不影响其他订阅者。
   * @param {string} eventName 事件名
   * @param {*} [payload] 负载
   * @returns {number} 实际触发的订阅者数量
   */
  function emit(eventName, payload) {
    const name = str(eventName);
    if (!name || !listeners.has(name)) {
      return 0;
    }
    const handlers = Array.from(listeners.get(name));
    let count = 0;
    handlers.forEach((handler) => {
      try {
        handler(payload, name);
        count += 1;
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error(`[TCM.bus] 事件 ${name} 的订阅者抛出异常：`, error);
        }
      }
    });
    return count;
  }

  /**
   * 清空全部订阅（仅测试/热重载使用）。
   * @returns {void}
   */
  function clear() {
    listeners.clear();
  }

  TCM.bus = { on, off, once, emit, clear };

  /** 模块版本号，便于排查缓存问题 */
  TCM.version = "1.0.0-T04";
})(typeof window !== "undefined" ? window : globalThis);
