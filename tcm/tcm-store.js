/**
 * tcm-store.js —— 测试用例管理模块 L1 存储层
 *
 * 职责：
 *   1. 集合读写：getState() / collection() / commit()（唯一写入口）
 *   2. 持久化：persist()（500ms 防抖 → app.js persist() → POST /api/app-state 整包）
 *   3. 并发提示：每次成功 persist 后 state._rev++
 *   4. 写入守卫：开发期断言拦截 tcm-execution 对 basicCaseLibrary 业务字段的非法写入
 *   5. migrate()：幂等的 Schema 迁移编排，调用 TCM.model 归一化全部集合
 *
 * 硬约束（系统设计 §8.3）：
 *   - 禁止任何模块直接 state.xxx.push()，一律走 commit()
 *   - 禁止在循环里逐条 persist()
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-store] 依赖缺失：请确保 tcm-core.js 在 tcm-store.js 之前加载。");
  }

  /** 本模块托管的 6 个共享集合 */
  const MANAGED_COLLECTIONS = C.COLLECTIONS;

  /**
   * 宿主（app.js）自有、但允许 TCM 通过 commit() 写入的共享集合。
   *
   * 目前只有 `bugs`：执行台「失败一键建 Bug」需要向 state.bugs 追加缺陷记录。
   * 这些集合**不参与** TCM 的 normalize/migrate（由 app.js 自己的归一化负责），
   * 也不计入 TCM.const.COLLECTIONS（保持 6 个集合的对外契约不变）。
   */
  const HOST_COLLECTIONS = Object.freeze(["bugs"]);

  /**
   * 判断集合名是否允许写入。
   * @param {string} key 集合名
   * @returns {boolean} 是否允许
   */
  function isWritableCollection(key) {
    return MANAGED_COLLECTIONS.includes(key) || HOST_COLLECTIONS.includes(key);
  }

  /** 集合名 → 集合级归一化函数名 */
  const COLLECTION_NORMALIZERS = Object.freeze({
    basicCaseLibrary: "normalizeCaseAssetList",
    testPlans: "normalizeTestPlanList",
    caseExecutions: "normalizeCaseExecutionList",
    reviewTickets: "normalizeReviewTicketList",
    caseDirectories: "normalizeCaseDirectoryList",
    caseVersions: "normalizeCaseVersionList"
  });

  /** 可选的状态提供者（单测/宿主注入用），默认读 window.state */
  let stateProvider = null;

  /** 最近一次 commit 被守卫拒绝的原因，便于调试 */
  let lastGuardError = "";

  /**
   * 获取全局状态对象。
   * @returns {object} app.js 的 state 对象；不可用时返回空对象兜底
   */
  function getState() {
    if (typeof stateProvider === "function") {
      const provided = stateProvider();
      if (provided && typeof provided === "object") {
        return provided;
      }
    }
    const hostState = global.state;
    return hostState && typeof hostState === "object" ? hostState : {};
  }

  /**
   * 注入状态提供者（仅单测 / 特殊宿主使用）。
   * @param {Function|null} provider 返回 state 对象的函数，传 null 恢复默认
   * @returns {void}
   */
  function setStateProvider(provider) {
    stateProvider = typeof provider === "function" ? provider : null;
  }

  /**
   * 读取集合（永远返回数组引用；集合缺失时就地初始化为空数组）。
   * @param {string} name 集合名
   * @returns {Array<object>} 集合数组
   */
  function collection(name) {
    const key = U.str(name);
    const state = getState();
    if (!Array.isArray(state[key])) {
      state[key] = [];
    }
    return state[key];
  }

  /* ------------------------------------------------------------------ *
   * 写入守卫
   * ------------------------------------------------------------------ */

  /**
   * 从调用栈推断发起写入的模块名（开发期断言用）。
   * @param {string} [explicit] 调用方显式声明的来源
   * @returns {string} 模块名，如 "execution" / "library"；无法判定时返回 ""
   */
  function detectSource(explicit) {
    const declared = U.str(explicit);
    if (declared) {
      return declared.replace(/^tcm-/, "").replace(/\.js$/, "");
    }
    let stack = "";
    try {
      stack = String(new Error().stack || "");
    } catch (_error) {
      return "";
    }
    const matches = stack.match(/tcm-[a-z0-9-]+\.js/gi) || [];
    for (let index = 0; index < matches.length; index += 1) {
      const fileName = String(matches[index]).toLowerCase();
      if (fileName === "tcm-store.js" || fileName === "tcm-core.js" || fileName === "tcm-model.js") {
        continue;
      }
      return fileName.replace(/^tcm-/, "").replace(/\.js$/, "");
    }
    return "";
  }

  /**
   * 判断两个 linkedDefects 数组是否为「仅追加」关系（prev 是 next 的前缀）。
   * @param {Array<object>} prev 旧数组
   * @param {Array<object>} next 新数组
   * @returns {boolean} 是否只做了追加
   */
  function isAppendOnlyDefects(prev, next) {
    const before = U.toArray(prev);
    const after = U.toArray(next);
    if (after.length < before.length) {
      return false;
    }
    for (let index = 0; index < before.length; index += 1) {
      if (JSON.stringify(before[index]) !== JSON.stringify(after[index])) {
        return false;
      }
    }
    return true;
  }

  /**
   * 资产保护守卫（系统设计 §8.3 硬约束）：
   * tcm-execution 模块不得修改 basicCaseLibrary 的任何业务字段，
   * 唯一例外是一键建 Bug 时向 asset.linkedDefects 追加一项。
   *
   * @param {Array<object>} prevList 写入前的资产列表
   * @param {Array<object>} nextList 待写入的资产列表
   * @returns {{allowed:boolean, reason:string}} 判定结果
   */
  function checkExecutionAssetGuard(prevList, nextList) {
    const before = U.toArray(prevList);
    const after = U.toArray(nextList);

    if (before.length !== after.length) {
      return { allowed: false, reason: "执行流程不得新增或删除用例资产" };
    }

    const beforeMap = new Map(before.map((item) => [U.str(item && item.id), item]));

    for (let index = 0; index < after.length; index += 1) {
      const nextAsset = after[index] && typeof after[index] === "object" ? after[index] : {};
      const id = U.str(nextAsset.id);
      const prevAsset = beforeMap.get(id);
      if (!prevAsset) {
        return { allowed: false, reason: `执行流程不得新增用例资产（id=${id || "空"}）` };
      }
      if (!isAppendOnlyDefects(prevAsset.linkedDefects, nextAsset.linkedDefects)) {
        return { allowed: false, reason: `执行流程只能向 linkedDefects 追加，不能覆盖（id=${id}）` };
      }
      const prevRest = Object.assign({}, prevAsset);
      const nextRest = Object.assign({}, nextAsset);
      delete prevRest.linkedDefects;
      delete nextRest.linkedDefects;
      if (JSON.stringify(prevRest) !== JSON.stringify(nextRest)) {
        return { allowed: false, reason: `执行流程不得修改用例资产业务字段（id=${id}）` };
      }
    }

    return { allowed: true, reason: "" };
  }

  /**
   * 输出开发期守卫错误。
   * @param {string} message 错误描述
   * @returns {void}
   */
  function reportGuardError(message) {
    lastGuardError = message;
    if (global.console && typeof global.console.error === "function") {
      global.console.error(`[TCM.store] 写入被拒绝：${message}`);
    }
  }

  /* ------------------------------------------------------------------ *
   * 写入与持久化
   * ------------------------------------------------------------------ */

  /**
   * 提交集合（**唯一写入口**）。
   *
   * @param {string} name 集合名（必须在 TCM.const.COLLECTIONS 内）
   * @param {Array<object>} nextList 新的集合内容
   * @param {{source?:string, silent?:boolean, skipNormalize?:boolean, reason?:string}} [options] 选项
   *   - source：显式声明调用模块（不传则从调用栈推断）
   *   - silent：true 时只写内存不触发 persist
   *   - skipNormalize：true 时跳过集合级归一化（仅在调用方已归一化时使用）
   *   - reason：写入原因，用于守卫例外（如 "linkDefect"）
   * @returns {boolean} 是否写入成功（被守卫拒绝时返回 false）
   */
  function commit(name, nextList, options) {
    const key = U.str(name);
    const opts = options && typeof options === "object" ? options : {};

    if (!isWritableCollection(key)) {
      reportGuardError(
        `未知集合「${key}」，允许的集合：${MANAGED_COLLECTIONS.concat(HOST_COLLECTIONS).join(" / ")}`
      );
      return false;
    }
    if (!Array.isArray(nextList)) {
      reportGuardError(`集合「${key}」的写入值必须是数组`);
      return false;
    }

    const state = getState();
    const prevList = Array.isArray(state[key]) ? state[key] : [];

    let normalized = nextList;
    if (!opts.skipNormalize) {
      const normalizerName = COLLECTION_NORMALIZERS[key];
      const normalizer = TCM.model && typeof TCM.model[normalizerName] === "function"
        ? TCM.model[normalizerName]
        : null;
      if (normalizer) {
        normalized = normalizer(nextList, { operator: U.currentOperator(state) });
      }
    }

    const source = detectSource(opts.source);
    if (source === "execution" && key === "basicCaseLibrary") {
      const verdict = checkExecutionAssetGuard(prevList, normalized);
      if (!verdict.allowed) {
        reportGuardError(`${verdict.reason}（来源模块：tcm-execution.js）`);
        return false;
      }
    }

    state[key] = normalized;
    lastGuardError = "";

    if (!opts.silent) {
      persist();
    }
    return true;
  }

  /**
   * 递增 _rev（并发提示用，Q10）。
   * @returns {number} 递增后的 _rev
   */
  function bumpRev() {
    const state = getState();
    const current = typeof state._rev === "number" && Number.isFinite(state._rev) ? state._rev : 0;
    state._rev = current + 1;
    return state._rev;
  }

  /**
   * 真正执行持久化：_rev++ → 调用 app.js persist() → 广播 state:persisted。
   * @returns {void}
   */
  function flushPersist() {
    const rev = bumpRev();
    if (typeof global.persist === "function") {
      try {
        global.persist();
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error("[TCM.store] 调用 app.js persist() 失败：", error);
        }
      }
    }
    TCM.bus.emit(C.EVENTS.STATE_PERSISTED, { rev, at: U.nowIso() });
  }

  const debouncedPersist = U.debounce(flushPersist, C.PERSIST_DEBOUNCE_MS);

  /**
   * 请求持久化（500ms 防抖合并，Q8 体积护栏）。
   * @returns {void}
   */
  function persist() {
    debouncedPersist();
  }

  /**
   * 立即冲刷待持久化的写入（页面卸载 / 单测收尾使用）。
   * @returns {void}
   */
  function flush() {
    debouncedPersist.flush();
  }

  /**
   * 取消待持久化的写入（仅单测使用）。
   * @returns {void}
   */
  function cancelPersist() {
    debouncedPersist.cancel();
  }

  /* ------------------------------------------------------------------ *
   * Schema 迁移
   * ------------------------------------------------------------------ */

  /**
   * 幂等的 Schema 迁移编排（T01 交付项 6）。
   *
   * 对传入 state 就地执行：
   *   - 6 个新集合缺失 → []
   *   - 逐集合调用 TCM.model.normalizeXxxList()（内含 product/module/type/version 等字段补全，
   *     以及 asset.testPlans → asset.linkedBatchIds 改名）
   *   - _rev 非数字 → 0
   *
   * 连续执行多次结果完全一致（幂等）。
   *
   * @param {object} state 待迁移的状态对象（通常是 app.js 的 state）
   * @returns {object} 同一个 state 引用，便于链式调用
   */
  function migrate(state) {
    const target = state && typeof state === "object" ? state : {};
    const options = { operator: U.currentOperator(target) };

    MANAGED_COLLECTIONS.forEach((key) => {
      if (!Array.isArray(target[key])) {
        target[key] = [];
      }
      const normalizerName = COLLECTION_NORMALIZERS[key];
      const normalizer = TCM.model && typeof TCM.model[normalizerName] === "function"
        ? TCM.model[normalizerName]
        : null;
      if (normalizer) {
        target[key] = normalizer(target[key], options);
      }
    });

    if (typeof target._rev !== "number" || !Number.isFinite(target._rev)) {
      target._rev = 0;
    }

    return target;
  }

  /* ------------------------------------------------------------------ *
   * 便捷读取
   * ------------------------------------------------------------------ */

  /**
   * 按 id 查找集合中的一条记录。
   * @param {string} name 集合名
   * @param {string} id 记录 id
   * @returns {object|null} 命中的记录，未命中返回 null
   */
  function findById(name, id) {
    const target = U.str(id);
    if (!target) {
      return null;
    }
    return collection(name).find((item) => item && U.str(item.id) === target) || null;
  }

  /**
   * 获取最近一次被守卫拒绝的原因（调试用）。
   * @returns {string} 错误描述，无错误时为空串
   */
  function getLastGuardError() {
    return lastGuardError;
  }

  TCM.store = {
    getState,
    setStateProvider,
    collection,
    findById,
    commit,
    persist,
    flush,
    cancelPersist,
    bumpRev,
    migrate,
    getLastGuardError,
    // 暴露给单测的内部实现
    _internals: {
      detectSource,
      checkExecutionAssetGuard,
      isAppendOnlyDefects,
      isWritableCollection,
      COLLECTION_NORMALIZERS,
      MANAGED_COLLECTIONS,
      HOST_COLLECTIONS
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
