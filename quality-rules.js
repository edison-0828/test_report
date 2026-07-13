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
      rules: []
    }
  }
};
