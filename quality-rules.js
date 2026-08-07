window.CASE_QUALITY_RULESETS = {
  common: {
    id: "common",
    name: "通用规则",
    description: "所有业务共用的基础用例质量规则。",
    rules: [
      {
        id: "common-required-fields",
        category: "完整性",
        severity: "high",
        name: "标题、步骤、预期结果不能为空",
        status: "active",
        checkType: "built-in"
      },
      {
        id: "common-duplicate-cases",
        category: "重复检查",
        severity: "medium",
        name: "识别重复标题和高度重复的步骤/预期",
        status: "active",
        checkType: "built-in"
      }
    ]
  },
  businesses: {
    "VA业务": {
      id: "va",
      name: "VA业务",
      aliases: ["VA", "虚拟账户", "Virtual Account"],
      description: "VA业务规则会用于检查开户、入金、通知、账户状态等场景覆盖。",
      rules: []
    },
    "卡收单业务": {
      id: "card-acquiring",
      name: "卡收单业务",
      aliases: ["卡收单", "CARD收单", "Card Acquiring"],
      description: "卡收单业务规则会用于检查支付、3DS、授权、拒付、回调等场景覆盖。",
      rules: [
        { id: "A1", category: "结构完整性", severity: "error", name: "必填字段完整", description: "每条用例必须包含用例ID、用例标题、测试维度、优先级、前置条件、测试步骤、预期结果。", target: "case", checkType: "required", status: "active" },
        { id: "A2", category: "结构完整性", severity: "error", name: "用例ID格式", description: "用例ID必须符合格式：模块缩写-维度缩写-三位序号，如 CARD-TRX-001、CARD-3DS-002。", target: "case", checkType: "regex", status: "active" },
        { id: "A3", category: "结构完整性", severity: "error", name: "优先级枚举值", description: "优先级字段必须为 P0、P1 或 P2 之一。", target: "case", checkType: "enum", status: "active" },
        { id: "A4", category: "结构完整性", severity: "error", name: "测试步骤非空", description: "每条用例至少包含 1 个可执行的测试步骤，步骤不能为空。", target: "case", checkType: "required", status: "active" },
        { id: "A5", category: "结构完整性", severity: "error", name: "预期结果非空", description: "每条用例必须有明确的预期结果描述，字数不少于 10 个字符，需包含可验证信息。", target: "case", checkType: "required", status: "active" },
        { id: "B1", category: "维度覆盖", severity: "error", name: "交易类型覆盖", description: "用例集必须覆盖消费 payment、撤销 void、退款 refund 至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B2", category: "维度覆盖", severity: "error", name: "下单方式覆盖", description: "用例集必须覆盖收银台 cashier 和直连 API direct 至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B3", category: "维度覆盖", severity: "error", name: "卡品牌覆盖", description: "用例集必须覆盖 Visa 和 Mastercard 卡品牌至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B4", category: "维度覆盖", severity: "error", name: "响应码覆盖", description: "用例集必须包含至少 1 个成功场景（响应码 00 或 approved）和至少 3 种不同失败场景。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B5", category: "维度覆盖", severity: "error", name: "金额边界覆盖", description: "用例集必须覆盖零额、最小金额、正常金额、超最大限额至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B6", category: "维度覆盖", severity: "error", name: "3DS验证覆盖", description: "用例集必须覆盖 3DS 验证通过、3DS 验证失败/放弃、非 3DS 交易至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B7", category: "维度覆盖", severity: "error", name: "回调通知覆盖", description: "用例集必须覆盖支付成功回调、支付失败回调、回调超时重试至少各 1 条。", target: "suite", checkType: "coverage", status: "active" },
        { id: "B8", category: "维度覆盖", severity: "error", name: "幂等性覆盖", description: "用例集必须包含至少 1 条同一请求重复提交、系统去重且不重复扣款的幂等性用例。", target: "suite", checkType: "coverage", status: "active" },
        { id: "C1", category: "业务逻辑", severity: "error", name: "撤销/退款需原交易", description: "撤销或退款用例的前置条件必须引用一笔成功的原交易。", target: "case", checkType: "conditional", status: "active" },
        { id: "C2", category: "业务逻辑", severity: "error", name: "退款不超原额", description: "退款金额不能超过原交易金额，支持部分退款但不允许超额退款。", target: "case", checkType: "conditional", status: "active" },
        { id: "C3", category: "业务逻辑", severity: "warning", name: "撤销窗口限制", description: "撤销用例应说明在渠道支持的撤销时间窗口内，通常为当日 T+0；跨日撤销应使用退款。", target: "case", checkType: "conditional", status: "active" },
        { id: "C4", category: "业务逻辑", severity: "error", name: "零额必失败", description: "金额为 0 的用例预期结果必须是交易失败或拒绝。", target: "case", checkType: "conditional", status: "active" },
        { id: "C5", category: "业务逻辑", severity: "error", name: "负额必失败", description: "金额为负数的用例预期结果必须是交易失败或拒绝。", target: "case", checkType: "conditional", status: "active" },
        { id: "C6", category: "业务逻辑", severity: "error", name: "超限必拒绝", description: "金额超过最大限额的用例预期结果必须是拒绝或失败。", target: "case", checkType: "conditional", status: "active" },
        { id: "C7", category: "业务逻辑", severity: "error", name: "3DS未验必失败", description: "3DS 验证失败、放弃或超时的用例预期结果必须是交易失败。", target: "case", checkType: "conditional", status: "active" },
        { id: "C8", category: "业务逻辑", severity: "error", name: "签名错必拒绝", description: "签名或验签错误的用例预期结果必须是拒绝。", target: "case", checkType: "conditional", status: "active" },
        { id: "D1", category: "冲突重复", severity: "warning", name: "用例不重复", description: "不允许两条用例的测试维度和测试条件完全相同。", target: "suite", checkType: "dedupe", status: "active" },
        { id: "D2", category: "冲突重复", severity: "error", name: "用例ID不重复", description: "用例ID必须全局唯一，不允许重复。", target: "suite", checkType: "dedupe", status: "active" },
        { id: "D3", category: "冲突重复", severity: "error", name: "无矛盾预期", description: "测试条件相同的用例之间不能一个预期成功、一个预期失败。", target: "suite", checkType: "compare", status: "active" },
        { id: "E1", category: "规范标准", severity: "error", name: "核心链路有P0", description: "核心支付链路（下单、支付、回调）至少有 1 条 P0 优先级用例。", target: "suite", checkType: "range", status: "active" },
        { id: "E2", category: "规范标准", severity: "warning", name: "P0占比合理", description: "P0 用例数量建议占总数的 20%-40%。", target: "suite", checkType: "range", status: "active" },
        { id: "E3", category: "规范标准", severity: "warning", name: "步骤可执行", description: "测试步骤应包含具体操作描述和输入数据，不能仅是概念性描述。", target: "case", checkType: "length/regex", status: "active" },
        { id: "E4", category: "规范标准", severity: "warning", name: "预期可验证", description: "预期结果应包含响应码、状态、金额、错误信息等可验证信息，不能仅写成功或失败。", target: "case", checkType: "length/regex", status: "active" }
      ]
    }
  }
};
