import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "D:/TestReport/outputs/019f7d53-543b-7311-8fb2-c7f162337a7f";
const outputFile = `${outputDir}/商户交易网站白名单_测试用例.xlsx`;
await fs.mkdir(outputDir, { recursive: true });

const wb = Workbook.create();
const overview = wb.worksheets.add("测试说明");
const casesSheet = wb.worksheets.add("测试用例");
const matrix = wb.worksheets.add("覆盖矩阵");
const rules = wb.worksheets.add("规则与测试数据");
for (const s of [overview, casesSheet, matrix, rules]) s.showGridLines = false;

const cases = [];
const add = (module, pri, type, title, pre, steps, data, expected, req, tag="正常") => {
  cases.push([`TC-${String(cases.length + 1).padStart(3,"0")}`, module, pri, type, title, pre, steps, data, expected, req, tag, "未执行", "", "", "", ""]);
};

// 准入与权限
add("准入审批","P0","功能","审批通过后域名入库并立即生效","商户M001已完成合规审核；白名单为空","1.运营新增域名并关联M001；2.保存；3.查询详情","https://pay.good.com","记录新增成功；网站状态=生效中；商户总体加白状态自动开启；仅关联M001","4.1 入库生效","主流程");
add("准入审批","P0","合规","未审批域名不得写入生产白名单","申请处于待审/拒绝状态","尝试由普通运营或接口直接新增","https://adult-ai.example","系统拒绝新增并记录操作者、原因；不得进入生效名单","4.1 人工审批","反向");
add("准入审批","P1","功能","审批材料与域名记录可追溯","域名审批通过","查看域名详情及审计记录","申请邮件/工单号、审批人、审批时间、结论","可关联到原始审批证据，字段完整可查询","4.1 人工审批","审计");
add("准入审批","P0","权限","无白名单管理权限的账号不能新增","使用只读/客服账号登录","进入商家管理并尝试新增","M001 + https://pay.good.com","入口不可见或操作被拒绝；越权接口返回403；生成安全日志","4.1 入库生效","权限");
add("准入审批","P0","权限","仅授权角色可开关总体加白状态","M001存在生效域名；使用只读账号","点击总体开关并调用开关接口","关闭","状态不变；返回无权限；记录越权行为","4.1 网关判断逻辑","权限");
add("准入审批","P1","并发","两名运营同时新增相同域名","M001白名单为空","两个会话同时提交相同配置","https://pay.good.com","只产生一条有效记录；另一请求提示重复；无脏数据","商户域名唯一性","并发");

// 后台管理
add("白名单管理","P0","功能","首次录入网站自动开启商户总体加白","M002无任何网站，当前不限制","新增并保存一个网站","https://shop.good.com","网站=生效中；总体开关=开启；列表列展示开启","4.1 默认打开","主流程");
add("白名单管理","P0","功能","无网站时默认不限制交易来源","M003从未配置网站","从多个合法/未知来源发起交易","https://any.example","请求不因来源白名单被拦截；其他风控仍正常执行","4.1 无输入则不限制","兼容");
add("白名单管理","P0","功能","配置多个网站后任一生效网站均可通过","M004配置3个生效网站","分别从3个网站发起交易","a.good.com；b.good.com；c.good.com","三笔均通过来源校验","4.1 某个或某批网站","主流程");
add("白名单管理","P0","边界","单商户允许录入20个网站","M005已有19个网站","新增第20个网站并保存","https://site20.good.com","保存成功；共20条；总体开关开启","最多20个域名","边界");
add("白名单管理","P0","边界","单商户禁止录入第21个网站","M005已有20个网站","新增第21个网站","https://site21.good.com","前后端均拒绝；提示最多20个；原20条不变","最多20个域名","边界");
add("白名单管理","P1","校验","空值和纯空格不能作为网站记录","进入新增页面","分别提交空值、空格、换行","空；三个空格","校验失败且不新增记录；商户总体状态不被误开启","商户域名输入","反向");
add("白名单管理","P1","校验","非法URL格式被拒绝","进入新增页面","逐项提交非法值","abc；://bad；javascript:alert(1)；含中文空格","明确提示格式错误，不落库","网站域名输入","反向");
add("白名单管理","P0","安全","危险协议不可加入白名单","进入新增页面","提交非HTTP(S)协议","file://；data:；javascript:；ftp://","全部拒绝，防止脚本/本地资源注入","内容安全","安全");
add("白名单管理","P1","功能","重复网站不能重复新增","M006已有生效网站","再次新增完全相同值","https://pay.good.com","提示重复；只保留一条记录；状态不变","商户域名100%匹配","反向");
add("白名单管理","P1","隔离","不同商户可配置相同网站且彼此隔离","M007已有网站","给M008新增相同网站并发起交易","https://shared.good.com","两商户各自记录存在；校验只读取当前商户配置","商户维度","隔离");
add("白名单管理","P0","功能","关闭单个网站后状态变为未生效","网站处于生效中，总体开关开启","点击该网站关闭并刷新","https://pay.good.com","状态=未生效；刷新后保持；该来源随后被拦截","4.2 网站状态","主流程");
add("白名单管理","P0","功能","重新开启未生效网站","网站处于未生效","点击开启并发起交易","https://pay.good.com","状态=生效中；请求恢复通过","4.2 网站状态","主流程");
add("白名单管理","P0","功能","编辑网站不改变原网站状态","网站状态=未生效","编辑为新网站并保存","old.good.com→new.good.com","域名更新成功；状态仍=未生效；审计保留前后值","4.2 编辑不影响状态","主流程");
add("白名单管理","P0","功能","删除网站后记录不再展示且立即失效","网站生效中","删除、确认、刷新；从被删来源交易","https://pay.good.com","列表无记录；请求被拦截；审计中可追溯删除，不可物理抹除审计证据","4.2 删除","主流程");
add("白名单管理","P1","功能","取消删除不改变数据","网站生效中","点击删除后取消","https://pay.good.com","记录与状态均不变；交易继续通过","4.2 删除","反向");
add("白名单管理","P0","功能","总体开关关闭后不执行来源限制","M009有生效网站且总体开关开启","关闭总体开关，从非名单来源请求","https://unknown.example","列表列显示关闭；请求不因来源白名单被拦截；网站记录与状态保留","4.1 Icon开关","主流程");
add("白名单管理","P0","功能","总体开关重新开启后恢复限制","M009总体开关关闭且有生效网站","开启总体开关，从非名单来源请求","https://unknown.example","请求被拦截，名单来源仍通过","4.1 Icon开关","主流程");
add("白名单管理","P0","口径","删除最后一条网站后的总体开关行为","商户仅1条网站且总体开关开启","删除最后一条网站并刷新","最后一条记录","按需求默认回到不限制且列表展示关闭；若产品保留手动状态需在上线前统一口径","4.1 无输入则不限制","待确认");
add("白名单管理","P0","口径","全部网站未生效时的网关行为","商户有记录但全部状态=未生效，总体开关开启","从名单内及名单外来源请求","2个来源","建议全部拦截并告警，避免零有效名单导致放开；产品需明确","4.1/4.2 状态组合","待确认");
add("白名单管理","P1","显示","商家管理列表新增总体加白状态列","存在开启、关闭、无配置三类商户","搜索、分页、排序并刷新列表","M001/M002/M003","状态显示准确并与详情一致；分页/筛选不串商户","4.1 列表新增一列","界面");
add("白名单管理","P1","一致性","缓存更新及时且多节点一致","网关多实例，域名刚新增/关闭/删除","连续请求并切换网关节点","同一商户同一来源","在约定生效SLA内各节点一致；无长时间一部分放行一部分拒绝","入库生效","一致性");

// 网关核心匹配
add("网关校验","P0","功能","生效白名单来源正常流转","总体开关开；域名生效","提交支付请求","Source=https://pay.good.com","通过来源校验，继续后续支付流程，不误报","仅白名单允许流转","主流程");
add("网关校验","P0","功能","非白名单来源被拦截","总体开关开；存在生效白名单","从未知来源提交","https://evil.example","交易在渠道下发前阻断；返回INVALID_SOURCE_URL/来源域名未授权；触发告警及日志","报错提示","主流程");
add("网关校验","P0","功能","缺失Referer/来源字段被拦截","总体开关开","移除Referer/Origin后提交","无Referer、无Origin","阻断；返回约定的MISSING_REFERER；触发告警并存证","日志含MISSING_REFERER","反向");
add("网关校验","P0","口径","Origin与Referer同时存在且一致","总体开关开；来源在白名单","浏览器同时发送两个字段","Origin/Referer均为pay.good.com","通过；日志记录实际采用字段","来源字段规则","主流程");
add("网关校验","P0","安全","Origin与Referer冲突时拒绝","Origin在白名单，Referer为非白名单，反向再测","发送冲突请求","good.com vs evil.example","拒绝或进入高风险校验，绝不可仅取有利字段放行；记录冲突上下文","来源字段规则","安全");
add("网关校验","P0","严格匹配","协议不同时不匹配","仅配置https URL","从http来源发起","http://pay.good.com","按100%匹配拒绝，返回INVALID_SOURCE_URL","100%匹配","边界");
add("网关校验","P0","严格匹配","子域名不自动继承","仅配置pay.good.com","从子域名发起","https://sub.pay.good.com","拒绝；不得使用endsWith造成子域绕过","100%匹配","安全");
add("网关校验","P0","严格匹配","父域名不自动匹配子域配置","仅配置sub.pay.good.com","从父域名发起","https://pay.good.com","拒绝","100%匹配","边界");
add("网关校验","P0","安全","相似后缀域名不得绕过","配置good.com","从拼接后缀域发起","https://good.com.evil.example","拒绝；必须解析URL后比较，不得字符串包含匹配","100%匹配","安全");
add("网关校验","P0","安全","用户信息段伪装不得绕过","配置good.com","从带userinfo URL请求","https://good.com@evil.example/pay","真实host为evil.example，应拒绝","100%匹配","安全");
add("网关校验","P0","安全","前缀拼接域名不得绕过","配置good.com","从相似域请求","https://notgood.com","拒绝","100%匹配","安全");
add("网关校验","P1","严格匹配","显式端口差异处理","配置无端口URL","分别从默认端口和非默认端口请求","https://pay.good.com:443；:8443","按100%字符串匹配均应拒绝；若采用Origin规范化，需明确443等价规则并补充审批口径","100%匹配","待确认");
add("网关校验","P1","严格匹配","路径差异处理","配置实际支付页完整URL","从同域不同路径请求","/checkout vs /adult-ai","按需求实际支付页面100%匹配应拒绝不同路径；若仅校验域名会产生业务绕用风险，需明确","实际支付页面域名","待确认");
add("网关校验","P1","严格匹配","查询参数与片段差异处理","配置无查询参数URL","使用query/fragment请求","?campaign=x；#step2","明确是按完整URL还是Origin匹配；不得因浏览器不发送fragment导致不可实现口径","100%匹配","待确认");
add("网关校验","P1","严格匹配","Host大小写差异处理","配置小写","来源host大写","https://PAY.GOOD.COM","域名按DNS语义建议等价通过；若坚持字符串100%则拒绝，产品需确认","100%匹配","待确认");
add("网关校验","P1","严格匹配","尾部斜杠差异处理","配置不带/","来源带/","https://pay.good.com/","按完整字符串100%应拒绝；建议统一规范化口径并确认","100%匹配","待确认");
add("网关校验","P1","国际化","IDN域名Unicode/Punycode一致性","审批并配置IDN域名","Unicode与Punycode形式分别请求","https://例子.测试 / xn--","比较应基于安全规范化后的host且不产生绕过；显示原值与规范值","域名校验","安全");
add("网关校验","P1","网络","IPv4/IPv6/localhost来源处理","总体开关开","提交IP或本机来源","127.0.0.1；[::1]；私网IP","生产环境拒绝录入或拒绝请求，除非显式审批；记录安全事件","域名合规","安全");
add("网关校验","P0","隔离","不能使用其他商户的同名/相近白名单","M010配置a.com，M011配置b.com","M010从b.com请求，M011从a.com请求","交叉请求","两笔均拒绝；缓存键含merchantId","商户维度","隔离");
add("网关校验","P0","安全","客户端传入merchantId不得造成越权匹配","攻击者可修改请求参数","使用A的签名/凭证但篡改merchantId为B","B白名单包含攻击来源","必须以鉴权后的商户身份查名单；签名失败或拒绝，不能按可控参数放行","商户维度","安全");
add("网关校验","P0","安全","伪造Referer不能成为唯一信任依据","可用curl直接调用API","手工设置Referer为白名单值","Referer=https://pay.good.com，实际调用方未知","若架构允许服务端直连，单靠Referer可伪造；需结合签名、托管会话/支付Token、Origin策略或风控识别并告警","主动防御","安全");
add("网关校验","P0","顺序","白名单校验发生在渠道下发之前","渠道侧可观测请求数","发起非授权来源交易","evil.example","网关本地阻断；渠道侧请求数不增加；无资金指令生成","阻断交易","主流程");
add("网关校验","P1","幂等","失败请求重试不产生渠道交易","同一paymentId非授权来源","连续重试3次","相同paymentId","每次均阻断；不产生渠道订单；日志可按同一链路聚合且原始事件保留","阻断交易","稳定性");

// Redirect URL
add("重定向域名","P0","功能","未配置Redirect URL时不影响正常支付","主来源在白名单，Redirect未配置","发起支付并完成回跳流程","redirect为空","来源校验通过；不得因非必填字段报错","Redirect非必填","兼容");
add("重定向域名","P0","功能","已配置且匹配的Redirect URL允许使用","主来源和Redirect均审批生效","提交支付请求","redirect=https://return.good.com/result","正常流转并回跳到授权地址","Redirect校验","主流程");
add("重定向域名","P0","功能","未授权Redirect URL被阻断","启用Redirect校验","提交外部回跳地址","https://evil.example/callback","交易创建前拒绝或不接受该回跳地址；返回明确错误并告警","Redirect校验","反向");
add("重定向域名","P0","安全","开放重定向参数不能绕过","配置good.com/redirect","嵌套恶意目标参数","https://good.com/redirect?next=https://evil.example","网关校验不能证明落地安全；应要求商户整改开放重定向或进行风险告警","Redirect校验","安全");
add("重定向域名","P1","安全","编码与双重编码绕过被拒绝","启用Redirect校验","提交URL编码、双重编码、反斜杠变体","%2F%2Fevil；%252F；\\evil","规范化后识别真实目标；非授权则拒绝","Redirect校验","安全");
add("重定向域名","P1","安全","协议相对URL与非HTTPS跳转被拒绝","启用Redirect校验","提交协议相对/HTTP地址","//evil.example；http://return.good.com","拒绝或严格按已审批完整值处理，不得降级到不安全协议","Redirect校验","安全");

// CSP
add("CSP防护","P0","安全","收银台响应包含frame-ancestors","商户有1个生效白名单","请求收银台并查看响应头","https://www.abc.com","响应包含Content-Security-Policy: frame-ancestors 'self' https://www.abc.com","6.1 CSP","主流程");
add("CSP防护","P0","安全","多个生效域名动态写入CSP","商户有3个生效网站","请求收银台","a/b/c.good.com","frame-ancestors包含self和全部生效、合法origin，无重复无非法语法","6.1 动态读取","主流程");
add("CSP防护","P0","安全","未生效/已删除域名不出现在CSP","存在生效、未生效、已删除记录","请求收银台并检查头","3种状态","仅生效域名进入frame-ancestors","4.2 + 6.1","主流程");
add("CSP防护","P0","安全","未授权站点iframe加载被浏览器阻止","恶意站点可嵌入收银台URL","用真实浏览器加载iframe","evil.example","浏览器阻止渲染；控制台出现CSP拒绝；收银台敏感内容不可见","Clickjacking","安全");
add("CSP防护","P0","安全","授权站点iframe可正常加载","授权域名生效","在授权页嵌入收银台并支付","good.com","正常渲染和交互；无CSP报错","6.1 CSP","主流程");
add("CSP防护","P0","安全","域名输入不能注入CSP指令","后台尝试录入恶意字符串","保存后请求收银台","good.com; frame-ancestors *；换行注入","录入阶段拒绝；响应头无注入、无通配符扩大授权","6.1 CSP","安全");
add("CSP防护","P1","兼容","CSP与现有安全头不冲突","系统已有default-src/script-src及X-Frame-Options","请求收银台并在授权域加载","现有CSP策略","合并策略语法有效；不覆盖其他指令；授权站点可用、非授权被拒","6.1 CSP","兼容");
add("CSP防护","P1","缓存","商户间CSP不可被CDN/缓存串用","M012与M013白名单不同","交替请求同一收银台路径","a.com / b.com","每个响应只含当前商户域名；Cache-Key/Vary策略避免串商户","动态CSP","隔离");
add("CSP防护","P1","容量","20个域名时响应头长度可接受","商户配置20个最长合法域名","请求收银台并检查网关/CDN/浏览器","20个域名","响应未被截断或返回431；CSP全部生效；长度在基础设施限制内","最多20个+6.1","边界");

// 日志告警
add("日志审计","P0","审计","INVALID_SOURCE_URL失败日志字段完整","从非授权来源请求","查询风险日志","merchantId、source、UA、timestamp、requestId、errorCode","字段完整准确；时间统一时区/UTC；可关联原请求；敏感数据脱敏","日志留存","审计");
add("日志审计","P0","审计","MISSING_REFERER失败日志字段完整","缺失来源提交","查询日志","无source","errorCode=MISSING_REFERER；明确记录字段缺失而非空字符串；其余上下文完整","日志留存","审计");
add("日志审计","P0","安全","失败事件触发风险告警","构造非授权来源","提交一次和连续多次","evil.example","单次按规则告警；聚合频率可控；包含商户与来源；通知到指定渠道","触发风险告警","主流程");
add("日志审计","P0","安全","日志不可被普通运营修改或删除","已有失败日志","普通账号尝试修改/删除/覆盖","指定requestId","操作被拒绝并记录越权；原日志哈希/签名或WORM证据不变","不可篡改","权限");
add("日志审计","P0","审计","管理员查询行为也被审计","管理员检索和导出失败日志","查看审计轨迹","时间范围+merchantId","记录查询人、时间、条件、导出动作；满足最小权限","不可篡改","审计");
add("日志审计","P1","审计","可按商户号、错误码、时间回溯","存在多商户、多错误事件","组合筛选并导出","M001 + INVALID_SOURCE_URL + 24h","结果完整且无跨商户误混；导出与页面计数一致","回溯能力","主流程");
add("日志审计","P1","合规","日志留存周期与归档策略验证","已配置合规留存策略","检查在线、归档、到期销毁控制","跨月/跨年样本","在批准的留存期内可查且不可篡改；到期销毁需审批并留存销毁证据","日志留存","待确认");
add("日志审计","P0","安全","日志防注入与敏感数据泄漏","来源/UA包含换行、脚本、超长字符","提交失败请求并查看/导出日志","CRLF、<script>、10KB UA","安全编码与截断；不可伪造新日志行；不记录卡号/CVV/密钥等敏感信息","完整上下文","安全");
add("日志审计","P1","可用性","告警风暴限流但不丢原始证据","同商户每秒大量失败","持续压测5分钟","INVALID_SOURCE_URL","告警聚合/限流；每个原始失败事件仍按策略可靠存储；统计可对账","风险告警+日志","稳定性");
add("日志审计","P1","可靠性","日志系统异常时采用安全策略","模拟日志存储不可用","提交非授权及授权来源请求","两类请求","非授权请求仍必须阻断；日志进入可靠队列/补偿；不得因日志故障放行风险请求","不可篡改/阻断","故障");

// 性能与发布
add("性能稳定性","P0","性能","白名单校验满足支付链路时延SLA","准备空名单、1条、20条三组商户","各压测正常与失败请求","目标并发按生产峰值×安全系数","P95/P99增量在批准SLA内；错误率和资源使用可接受","网关判断逻辑","性能");
add("性能稳定性","P0","稳定性","白名单存储超时采用Fail-Closed策略","总体开关开启；模拟DB/缓存超时","从名单与非名单来源请求","超时/连接失败","不得默认放行；返回可识别系统错误、告警并记录；恢复后自动正常","主动防御","故障");
add("性能稳定性","P1","稳定性","缓存穿透与热点商户保护","热门商户20域名，缓存冷启动","高并发请求","同merchantId","无DB雪崩；缓存键隔离；限流/单飞生效；结果正确","网关判断逻辑","性能");
add("性能稳定性","P0","发布","存量无网站商户升级后保持兼容","升级前大量商户未配置网站","发布后回归支付","来源各异","按需求默认不限制，支付成功率无异常下降；同时输出待补录清单供合规治理","无输入不限制","兼容");
add("性能稳定性","P0","发布","灰度/回滚不产生规则不一致","多节点灰度发布","交替访问新旧节点并执行开关/编辑","名单与非名单来源","同一商户决策一致；回滚不丢配置与审计日志","入库生效","发布");
add("性能稳定性","P1","恢复","备份恢复后名单与审计一致","存在近期增删改和失败日志","执行灾备恢复并对账","恢复点前后记录","白名单状态、商户关联、审计链完整；RPO/RTO符合批准指标","日志与入库","灾备");
add("性能稳定性","P0","业务","成人色情AI网站场景必须阻断并可定责","该网站未获批或审批后被关闭","从该网站嵌入/调用收银台并交易","违规站点、相关商户号","交易在渠道前阻断；告警含商户、来源、UA、时间；CSP阻止嵌入；可导出审计证据","需求背景/方案价值","验收");

// Overview
overview.mergeCells("A1:H2");
overview.getRange("A1").values = [["商户交易网站白名单机制｜测试方案与执行用例"]];
overview.getRange("A4:B11").values = [
  ["文档版本","V1.0"],["生成日期",new Date("2026-07-20T00:00:00+08:00")],["测试对象","商户网站白名单、Redirect URL、CSP、网关阻断、风险告警与审计日志"],
  ["用例总数",cases.length],["P0数量",null],["P1数量",null],["默认执行状态","未执行"],["适用阶段","接口测试、系统测试、安全测试、验收测试、上线回归"]
];
overview.getRange("B5").format.numberFormat = "yyyy-mm-dd";
overview.getRange("B8").formulas = [["=COUNTIF('测试用例'!$C$5:$C$200,\"P0\")"]];
overview.getRange("B9").formulas = [["=COUNTIF('测试用例'!$C$5:$C$200,\"P1\")"]];
overview.mergeCells("D4:H4"); overview.getRange("D4").values = [["上线前必须确认的判定口径"]];
overview.getRange("D5:H10").merge(true);
overview.getRange("D5:D10").values = [
  ["1. “100%匹配”究竟指完整URL字符串、Origin（协议+主机+端口）还是仅Host；路径是否纳入。"],
  ["2. Origin与Referer的读取优先级、冲突策略，以及服务端直连无法可信证明来源时的补强机制。"],
  ["3. 商户有记录但全部未生效、删除最后一条记录时，是全拒绝还是回到不限制。"],
  ["4. Redirect URL的匹配粒度、校验时点、错误码和开放重定向治理方式。"],
  ["5. 白名单变更生效SLA、故障时Fail-Closed返回码、日志留存期限和告警阈值。"],
  ["6. CSP仅能限制iframe嵌入，不能单独证明API调用来源，需与网关鉴权/支付会话绑定联合防护。"]
];
overview.mergeCells("A13:H13"); overview.getRange("A13").values = [["建议验收门槛"]];
overview.getRange("A14:H18").merge(true);
overview.getRange("A14:A18").values = [
  ["• 所有P0用例通过，P1无阻断上线的高风险缺陷；违规来源在任何渠道下发前被阻断。"],
  ["• INVALID_SOURCE_URL、MISSING_REFERER均形成不可篡改审计事件，字段完整且可检索导出。"],
  ["• 授权站点可正常嵌入，非授权站点被CSP阻止；20域名场景无响应头截断。"],
  ["• 白名单配置、缓存、多网关节点决策一致；存储/日志异常时不允许Fail-Open。"],
  ["• 与Visa/Nuvei要求对应的审批证据、域名记录、失败事件及处置链路可在一次审计导出中关联。"]
];

// Cases sheet
casesSheet.mergeCells("A1:P2"); casesSheet.getRange("A1").values = [["商户交易网站白名单测试用例（执行表）"]];
casesSheet.getRange("A3:P3").merge(); casesSheet.getRange("A3").values = [["说明：带“待确认”的预期结果用于推动产品/安全口径落定；落定后需将其改为唯一、可判定的预期结果再执行。"]];
const headers = ["用例ID","模块","优先级","测试类型","用例标题","前置条件","操作步骤","测试数据","预期结果","需求依据","场景标签","执行状态","实际结果","缺陷编号","执行人","执行日期"];
casesSheet.getRange("A4:P4").values = [headers];
casesSheet.getRangeByIndexes(4,0,cases.length,headers.length).values = cases;
casesSheet.tables.add(`A4:P${cases.length+4}`, true, "WhitelistTestCases").style = "TableStyleMedium2";
casesSheet.freezePanes.freezeRows(4); casesSheet.freezePanes.freezeColumns(5);
casesSheet.getRange(`L5:L${cases.length+4}`).dataValidation = {rule:{type:"list",values:["未执行","通过","失败","阻塞","不适用"]}};

// Matrix
matrix.mergeCells("A1:F2"); matrix.getRange("A1").values = [["测试覆盖矩阵"]];
matrix.getRange("A4:F4").values = [["模块","用例数","P0","P1","待确认","覆盖重点"]];
const modules = [
  ["准入审批","审批证据、权限、并发"],["白名单管理","增删改开关、20条边界、状态组合"],["网关校验","精确匹配、隔离、防绕过、错误码"],
  ["重定向域名","非必填、匹配、开放重定向与编码绕过"],["CSP防护","动态frame-ancestors、点击劫持、缓存隔离"],["日志审计","不可篡改、完整上下文、告警、可回溯"],["性能稳定性","时延、Fail-Closed、灰度、灾备、业务验收"]
];
matrix.getRange(`A5:A${modules.length+4}`).values = modules.map(x=>[x[0]]);
matrix.getRange(`F5:F${modules.length+4}`).values = modules.map(x=>[x[1]]);
for(let i=0;i<modules.length;i++){
  const r=5+i;
  matrix.getRange(`B${r}`).formulas=[[`=COUNTIF('测试用例'!$B$5:$B$200,A${r})`]];
  matrix.getRange(`C${r}`).formulas=[[`=COUNTIFS('测试用例'!$B$5:$B$200,A${r},'测试用例'!$C$5:$C$200,\"P0\")`]];
  matrix.getRange(`D${r}`).formulas=[[`=COUNTIFS('测试用例'!$B$5:$B$200,A${r},'测试用例'!$C$5:$C$200,\"P1\")`]];
  matrix.getRange(`E${r}`).formulas=[[`=COUNTIFS('测试用例'!$B$5:$B$200,A${r},'测试用例'!$K$5:$K$200,\"待确认\")`]];
}
const totalRow=modules.length+5;
matrix.getRange(`A${totalRow}:F${totalRow}`).values=[["合计",null,null,null,null,""]];
matrix.getRange(`B${totalRow}`).formulas=[[`=SUM(B5:B${totalRow-1})`]];
matrix.getRange(`C${totalRow}`).formulas=[[`=SUM(C5:C${totalRow-1})`]];
matrix.getRange(`D${totalRow}`).formulas=[[`=SUM(D5:D${totalRow-1})`]];
matrix.getRange(`E${totalRow}`).formulas=[[`=SUM(E5:E${totalRow-1})`]];

// Rules and data
rules.mergeCells("A1:F2"); rules.getRange("A1").values = [["规则基线与建议测试数据"]];
rules.getRange("A4:F4").values = [["类别","配置/样例","预期用途","风险点","当前口径","确认责任方"]];
const ruleRows = [
  ["授权主来源","https://pay.good.com","正向支付","完整URL与Origin差异","待确认匹配粒度","产品+架构+安全"],
  ["授权第二来源","https://shop.good.com/checkout","多域名/路径测试","同域不同业务路径绕用","建议完整支付页或受控路径","产品+合规"],
  ["未授权来源","https://evil.example","INVALID_SOURCE_URL","必须在渠道前阻断","明确","网关"],
  ["相似域名","https://good.com.evil.example","防后缀匹配绕过","字符串contains/endsWith漏洞","必须拒绝","安全"],
  ["伪装URL","https://good.com@evil.example","URL解析安全","userinfo欺骗","必须按解析后host拒绝","安全"],
  ["缺失来源","Origin/Referer均缺失","MISSING_REFERER","服务端直连/隐私策略","必须阻断并存证（白名单开启时）","产品+网关"],
  ["冲突来源","Origin=good；Referer=evil","字段优先级","选择性取值绕过","建议拒绝并告警","架构+安全"],
  ["授权Redirect","https://return.good.com/result","成功回跳","开放重定向","非必填；配置后严格校验","产品+安全"],
  ["违规业务站点","成人色情AI网站样例（隔离测试环境）","端到端阻断验收","禁止访问真实违规内容","必须阻断、告警、留证","合规+安全"],
  ["容量数据","20个最长合法HTTPS URL","上限/CSP头长度/性能","代理响应头限制","需验证基础设施上限","运维"]
];
rules.getRange(`A5:F${ruleRows.length+4}`).values = ruleRows;
rules.tables.add(`A4:F${ruleRows.length+4}`,true,"RulesAndData").style="TableStyleMedium2";
rules.mergeCells(`A${ruleRows.length+7}:F${ruleRows.length+7}`); rules.getRange(`A${ruleRows.length+7}`).values=[["推荐的网关决策顺序"]];
rules.getRange(`A${ruleRows.length+8}:F${ruleRows.length+13}`).merge(true);
rules.getRange(`A${ruleRows.length+8}:A${ruleRows.length+13}`).values=[
  ["1. 以鉴权/签名确认的merchantId读取配置，禁止信任客户端可篡改商户号。"],
  ["2. 若无任何网站配置或总体开关关闭：按当前需求跳过来源限制，但保留基础风控。"],
  ["3. 若限制开启：解析并规范化可信来源字段；缺失返回MISSING_REFERER，冲突按高风险拒绝。"],
  ["4. 只与“生效中”的当前商户记录比较；不命中返回INVALID_SOURCE_URL，并在渠道下发前终止。"],
  ["5. 生成风险告警和不可篡改事件，包含merchantId、来源、UA、时间戳、requestId和决策依据。"],
  ["6. 收银台响应按当前商户生效名单生成CSP frame-ancestors；CSP是补充防护，不替代网关鉴权。"]
];

// Styling
const titleFmt={fill:"#17365D",font:{bold:true,color:"#FFFFFF",size:18},horizontalAlignment:"center",verticalAlignment:"center"};
for(const s of [overview,casesSheet,matrix,rules]) s.getRange("A1:"+(s===casesSheet?"P2":s===overview?"H2":"F2")).format=titleFmt;
overview.getRange("A4:A11").format={fill:"#D9EAF7",font:{bold:true,color:"#17365D"},verticalAlignment:"center"};
overview.getRange("A4:B11").format.borders={preset:"all",style:"thin",color:"#B4C7E7"};
overview.getRange("B4:B11").format={wrapText:true,verticalAlignment:"center"};
overview.getRange("D4:H4").format={fill:"#F4B183",font:{bold:true,color:"#7F2704"},horizontalAlignment:"center"};
overview.getRange("D5:H10").format={fill:"#FFF2CC",wrapText:true,verticalAlignment:"top",borders:{preset:"outside",style:"thin",color:"#D6B656"}};
overview.getRange("A13:H13").format={fill:"#70AD47",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center"};
overview.getRange("A14:H18").format={fill:"#E2F0D9",wrapText:true,verticalAlignment:"top",borders:{preset:"outside",style:"thin",color:"#A9D18E"}};
overview.getRange("A1:H18").format.font.name="Microsoft YaHei";
overview.getRange("A1:H2").format.rowHeight=30; overview.getRange("A4:H18").format.rowHeight=24; overview.getRange("A6:H6").format.rowHeight=40;
overview.getRange("A:A").format.columnWidth=18; overview.getRange("B:B").format.columnWidth=52; overview.getRange("C:C").format.columnWidth=3; overview.getRange("D:H").format.columnWidth=18;

casesSheet.getRange("A3:P3").format={fill:"#FFF2CC",font:{italic:true,color:"#7F6000"},wrapText:true};
casesSheet.getRange("A4:P4").format={fill:"#4472C4",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center",verticalAlignment:"center",wrapText:true};
casesSheet.getRange(`A5:P${cases.length+4}`).format={font:{name:"Microsoft YaHei",size:9},verticalAlignment:"top",wrapText:true};
casesSheet.getRange(`A5:E${cases.length+4}`).format.verticalAlignment="center";
casesSheet.getRange(`A5:A${cases.length+4}`).format.horizontalAlignment="center";
casesSheet.getRange(`C5:D${cases.length+4}`).format.horizontalAlignment="center";
casesSheet.getRange(`K5:L${cases.length+4}`).format.horizontalAlignment="center";
casesSheet.getRange(`P5:P${cases.length+4}`).format.numberFormat="yyyy-mm-dd";
const widths=[11,15,9,12,30,32,38,30,46,24,11,11,28,14,12,13];
for(let i=0;i<widths.length;i++) casesSheet.getRangeByIndexes(0,i,cases.length+4,1).format.columnWidth=widths[i];
casesSheet.getRange("A1:P2").format.rowHeight=30; casesSheet.getRange("A3:P4").format.rowHeight=28; casesSheet.getRange(`A5:P${cases.length+4}`).format.rowHeight=58;
casesSheet.getRange(`C5:C${cases.length+4}`).conditionalFormats.add("containsText",{text:"P0",format:{fill:"#F4CCCC",font:{bold:true,color:"#9C0006"}}});
casesSheet.getRange(`K5:K${cases.length+4}`).conditionalFormats.add("containsText",{text:"待确认",format:{fill:"#FFF2CC",font:{bold:true,color:"#7F6000"}}});
casesSheet.getRange(`L5:L${cases.length+4}`).conditionalFormats.add("containsText",{text:"通过",format:{fill:"#C6EFCE",font:{color:"#006100"}}});
casesSheet.getRange(`L5:L${cases.length+4}`).conditionalFormats.add("containsText",{text:"失败",format:{fill:"#FFC7CE",font:{color:"#9C0006"}}});

for(const s of [matrix,rules]){
  s.getRange("A4:F4").format={fill:"#4472C4",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center",verticalAlignment:"center",wrapText:true};
  s.getUsedRange().format.font.name="Microsoft YaHei";
  s.freezePanes.freezeRows(4);
}
matrix.getRange(`A5:F${totalRow}`).format={wrapText:true,verticalAlignment:"center",borders:{preset:"all",style:"thin",color:"#D9E2F3"}};
matrix.getRange(`A${totalRow}:F${totalRow}`).format={fill:"#D9EAD3",font:{bold:true,color:"#274E13"}};
matrix.getRange("A:A").format.columnWidth=18; matrix.getRange("B:E").format.columnWidth=12; matrix.getRange("F:F").format.columnWidth=55;
matrix.getRange("A1:F2").format.rowHeight=30; matrix.getRange(`A4:F${totalRow}`).format.rowHeight=28;
rules.getRange(`A5:F${ruleRows.length+4}`).format={wrapText:true,verticalAlignment:"top"};
rules.getRange(`A${ruleRows.length+7}:F${ruleRows.length+7}`).format={fill:"#70AD47",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center"};
rules.getRange(`A${ruleRows.length+8}:F${ruleRows.length+13}`).format={fill:"#E2F0D9",wrapText:true,verticalAlignment:"top",borders:{preset:"outside",style:"thin",color:"#A9D18E"}};
const rw=[18,36,28,34,30,18]; for(let i=0;i<rw.length;i++) rules.getRangeByIndexes(0,i,ruleRows.length+13,1).format.columnWidth=rw[i];
rules.getRange("A1:F2").format.rowHeight=30; rules.getRange(`A4:F${ruleRows.length+4}`).format.rowHeight=44; rules.getRange(`A${ruleRows.length+8}:F${ruleRows.length+13}`).format.rowHeight=30;

// Compact verification, previews, export
console.log((await wb.inspect({kind:"table",range:"测试用例!A4:P12",include:"values,formulas",tableMaxRows:12,tableMaxCols:16,maxChars:6000})).ndjson);
console.log((await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},summary:"formula error scan",maxChars:2000})).ndjson);
for(const [name,range] of [["测试说明","A1:H18"],["测试用例","A1:P16"],["覆盖矩阵",`A1:F${totalRow}`],["规则与测试数据",`A1:F${ruleRows.length+13}`]]){
  const img=await wb.render({sheetName:name,range,scale:1,format:"png"});
  await fs.writeFile(`${outputDir}/preview_${name}.png`,new Uint8Array(await img.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(wb); await xlsx.save(outputFile);
console.log(JSON.stringify({outputFile,cases:cases.length,totalRow}));
