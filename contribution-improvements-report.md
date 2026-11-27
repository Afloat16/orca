# Orca 50 项改进状态

最新状态核验：北京时间 2026-11-27 19:12:14–19:12:32。完整状态来源为 V3，随后对仍开放的作者 PR、开放接续及活动跟进主题进行了有限增量核验。

累计作者投稿 51 个，其中 1 个已退役并由不同问题替补，有效改进范围 50 项。本轮 Afloat16 作者 PR 自身实际 merged：0；维护者接续实际合入的独立改进：30。两种口径分开统计。

## 已合入的 30 项

| 编号 | 原 PR → 接续 | 实际提升 | 状态 |
|---:|---|---|---|
| 01 | [#50598](https://github.com/stablyai/orca/pull/50598) → [#50671](https://github.com/stablyai/orca/pull/50671) | Gmail 转发附件遵守已有并发预算，减少请求过多导致的 429，同时保留附件顺序和总大小限制。 | 已合入 |
| 02 | [#50621](https://github.com/stablyai/orca/pull/50621) → [#50765](https://github.com/stablyai/orca/pull/50765) | 保留 Gmail 直接放在消息 body.data 中的附件，包括空文件，避免读取和转发时静默丢失。 | 已合入 |
| 03 | [#50601](https://github.com/stablyai/orca/pull/50601) → [#50675](https://github.com/stablyai/orca/pull/50675) | 一次 Gmail 修改请求复用刚创建的同名标签，避免重复创建冲突中断后续邮件修改。 | 已合入 |
| 04 | [#50534](https://github.com/stablyai/orca/pull/50534) → [#50611](https://github.com/stablyai/orca/pull/50611) | 保留无显式端口的方括号 IPv6 服务地址，避免终端端口发现误删右括号后丢弃合法链接。 | 已合入 |
| 05 | [#50646](https://github.com/stablyai/orca/pull/50646) → [#50766](https://github.com/stablyai/orca/pull/50766) | 尊重 Conductor 本机配置中显式留空的命令，避免重新启用用户已禁用的共享 setup 或 archive 命令。 | 已合入 |
| 06 | [#50633](https://github.com/stablyai/orca/pull/50633) → [#50764](https://github.com/stablyai/orca/pull/50764) | 正确统计 Copilot 总输入与输出 token，不再重复加入缓存子集和当前上下文长度，并修复旧缓存。 | 已合入 |
| 07 | [#50546](https://github.com/stablyai/orca/pull/50546) → [#50608](https://github.com/stablyai/orca/pull/50608) | 按 Ghostty 支持的数字语法解析调色板索引，避免十六、八、二进制索引误写入 ANSI 黑色槽位。 | 已合入 |
| 08 | [#50651](https://github.com/stablyai/orca/pull/50651) → [#50767](https://github.com/stablyai/orca/pull/50767) | 用明确的记录边界读取 Git worktree 路径，保留路径内部换行，使 Git Graph 能定位已有工作区。 | 已合入 |
| 09 | [#50552](https://github.com/stablyai/orca/pull/50552) → [#50673](https://github.com/stablyai/orca/pull/50673) | 保留 Git refspec 通配符中的字面量美元符号序列，避免替换语法把有效分支映射到错误引用。 | 已合入 |
| 10 | [#50556](https://github.com/stablyai/orca/pull/50556) → [#50663](https://github.com/stablyai/orca/pull/50663) | 将 `__proto__` 等 JSON 键作为自有数据属性保留，避免克隆时变成继承属性并影响策略校验。 | 已合入 |
| 11 | [#50558](https://github.com/stablyai/orca/pull/50558) → [#50664](https://github.com/stablyai/orca/pull/50664) | 对 JSONC 中实际生效的最后一个同名属性进行编辑，避免 MCP 修改落在被遮蔽的配置里。 | 已合入 |
| 12 | [#50643](https://github.com/stablyai/orca/pull/50643) → [#50781](https://github.com/stablyai/orca/pull/50781) | 读取旧版 OpenCode 分离存储的消息内容，恢复首条提示词、历史预览、转录和会话搜索内容读取。 | 初始范围已合入；补充修正已验证并发布，待接纳 |
| 13 | [#50565](https://github.com/stablyai/orca/pull/50565) → [#50670](https://github.com/stablyai/orca/pull/50670) | 保留结构化转录内容中的有意义空白和缩进，使显示与字符串内容一致；接续合并版细化了空行处理。 | 已合入 |
| 14 | [#50524](https://github.com/stablyai/orca/pull/50524) → [#50595](https://github.com/stablyai/orca/pull/50595) | 按检查上下文读取 Azure DevOps 最新提交状态，避免已成功重试的检查仍显示旧失败或被重复计数。 | 已合入 |
| 15 | [#50527](https://github.com/stablyai/orca/pull/50527) → [#50604](https://github.com/stablyai/orca/pull/50604) | 保留 Bitbucket 草稿标记，让草稿 PR 正确显示为草稿，同时保持已合并、已拒绝状态的优先级。 | 已合入 |
| 16 | [#50530](https://github.com/stablyai/orca/pull/50530) → [#50597](https://github.com/stablyai/orca/pull/50597) | Bitbucket 检查状态尚有未读取分页时，将仅有成功记录的前缀保持为中立，避免误报全部通过。 | 已合入 |
| 17 | [#50691](https://github.com/stablyai/orca/pull/50691) → [#50745](https://github.com/stablyai/orca/pull/50745) | 只用同一子流水线内的作业折叠其汇总，避免其他子流水线的同名作业隐藏失败状态和详情链接。 | 已合入 |
| 18 | [#50693](https://github.com/stablyai/orca/pull/50693) → [#50770](https://github.com/stablyai/orca/pull/50770) | 为 GitLab 子作业保留完整所属项目，将日志和重试请求发往正确项目，避免误用父项目导致 404 或重试失败。 | 已合入 |
| 19 | [#50684](https://github.com/stablyai/orca/pull/50684) → [#50708](https://github.com/stablyai/orca/pull/50708) | 评审创建成功但响应正文不可读时，先查询已创建的评审并返回其链接，避免直接引导重复提交。 | 已合入 |
| 20 | [#50680](https://github.com/stablyai/orca/pull/50680) → [#50706](https://github.com/stablyai/orca/pull/50706) | 在 Jira 展开及嵌套展开内容前保留标题，避免“仅 Linux”等上下文在转换为 Markdown 时丢失。 | 已合入 |
| 21 | [#50677](https://github.com/stablyai/orca/pull/50677) → [#50710](https://github.com/stablyai/orca/pull/50710) | 把 Jira 内联日期转换为稳定的日历日期文本，避免描述和评论中的截止日等信息消失。 | 已合入 |
| 22 | [#50542](https://github.com/stablyai/orca/pull/50542) → [#50603](https://github.com/stablyai/orca/pull/50603) | 按已解析工作区和凭据版本合并 Linear 并发读取，避免切换工作区后仍收到上一个工作区的项目或视图。 | 已合入 |
| 23 | [#50626](https://github.com/stablyai/orca/pull/50626) → [#50762](https://github.com/stablyai/orca/pull/50762) | 归档生成统一使用 pipeline 管理生产与输出，输出失败时正确取消生产并返回错误，避免永远等待 drain。 | 已合入 |
| 24 | [#50622](https://github.com/stablyai/orca/pull/50622) → [#50653](https://github.com/stablyai/orca/pull/50653) | 下载暂存文件关闭失败时拒绝完成，避免延迟写入错误后仍提升文件并报告成功。 | 已合入 |
| 25 | [#50584](https://github.com/stablyai/orca/pull/50584) → [#50676](https://github.com/stablyai/orca/pull/50676) | 识别 Node fetch 包装错误中的临时网络原因，使符合既有策略的连接重置和中断可以重试。 | 已合入 |
| 26 | [#50624](https://github.com/stablyai/orca/pull/50624) → [#50779](https://github.com/stablyai/orca/pull/50779) | 成功写入下载块后刷新闲置计时，避免仍在持续传输的长下载被 30 分钟清理器删除。 | 已合入 |
| 27 | [#50586](https://github.com/stablyai/orca/pull/50586) → [#50714](https://github.com/stablyai/orca/pull/50714) | 允许 ..assets 等合法 ZIP 子路径，同时继续拒绝真正的 ../ 越界路径，避免扩展安装误失败。 | 已合入 |
| 28 | [#50632](https://github.com/stablyai/orca/pull/50632) → [#50751](https://github.com/stablyai/orca/pull/50751) | MCP 订阅结果只清理自己拥有的 pending 槽位，避免旧请求完成后误清除新订阅并提前报告成功。 | 已合入 |
| 29 | [#50590](https://github.com/stablyai/orca/pull/50590) → [#50672](https://github.com/stablyai/orca/pull/50672) | 同步子进程达到有限超时后强制终止忽略 SIGTERM 的子进程，保证启动探测等调用能够返回。 | 已合入 |
| 30 | [#50754](https://github.com/stablyai/orca/pull/50754) → [#50785](https://github.com/stablyai/orca/pull/50785) | 修复 GitLab 合并请求中未改动行的评论定位，前方发生增删后仍能提交到正确行。 | 已合入 |

## 仍待上游合并的 20 项

| 编号 | 作者 PR / 接续 | 实际提升 | 状态 |
|---:|---|---|---|
| 31 | [#50512](https://github.com/stablyai/orca/pull/50512) | 按名称解析 Google Calendar 时继续读取后续页；达到分页上限仍不完整时明确报错，避免漏掉同名日历后误选。 | 作者 PR 开放 |
| 32 | [#50520](https://github.com/stablyai/orca/pull/50520) | 继续读取 Google Docs 评论后续页，保留未解决意见；分页上限、重复 token 或后页失败时显示真实的部分数量。 | 作者 PR 开放 |
| 33 | [#50594](https://github.com/stablyai/orca/pull/50594) | 同账户、同文件版本的并发 Drive 读取共享下载和转换，保留各调用者需要的不同内容区间。 | 作者 PR 开放 |
| 34 | [#50668](https://github.com/stablyai/orca/pull/50668) | Drive 按名称选择父文件夹前确认搜索完整且唯一，拒绝未完整搜索或截断结果，避免写入错误文件夹。 | 作者 PR 开放 |
| 35 | [#50607](https://github.com/stablyai/orca/pull/50607) | 主动释放 Google 401 重试和 404 空结果的不再读取的响应体，减少连接与传输资源滞留。 | 作者 PR 开放 |
| 36 | [#50507](https://github.com/stablyai/orca/pull/50507) | 为 Google Sheets 批量 upsert 建立键索引，避免每行重复扫描整个表，同时保持重复键和写入语义。 | 作者 PR 开放 |
| 37 | [#50543](https://github.com/stablyai/orca/pull/50543) | 保留 Ghostty 配置值中的字面量 #，使包含空格和井号的主题路径可以正常导入。 | 作者 PR 开放 |
| 38 | [#50659](https://github.com/stablyai/orca/pull/50659) | 只移除一次明确的 Git 引用命名空间，保留 origin/topic 等真实分支名，避免创建评审时选错 base。 | 原 PR 已关闭；完整候选已通过检查并已发布，待处理 |
| 39 | [#50560](https://github.com/stablyai/orca/pull/50560) | Markdown 引用展开保留行内代码的原始字面量，同时继续展开相邻正文中的引用。 | 作者 PR 开放 |
| 40 | [#50562](https://github.com/stablyai/orca/pull/50562) | Notebook 文本单元转为代码单元时移除不合法的 attachments 字段，保持保存后的 nbformat 有效。 | 作者 PR 开放 |
| 41 | [#50532](https://github.com/stablyai/orca/pull/50532) | Gitea 分支评审搜索达到分页上限时保留“查询不完整”状态，避免把未找到误判为确实不存在。 | 作者 PR 开放 |
| 42 | [#50688](https://github.com/stablyai/orca/pull/50688) | 保留 GitLab 新侧多行评论的起止行，让范围标签和代码跳转对应完整评论区间。 | 作者 PR 开放 |
| 43 | [#50536](https://github.com/stablyai/orca/pull/50536) | 严格校验 GitLab 分页数字头，拒绝 1e2、12, 12 等部分数字值，避免用错误页数过早结束读取。 | 作者 PR 开放 |
| 44 | [#50686](https://github.com/stablyai/orca/pull/50686) | 按规范化后的精确分支名判断是否同一分支，允许 Feature 到 feature 的合法评审创建，并继续拒绝真正相同的分支。 | 作者 PR 开放 |
| 45 | [#50539](https://github.com/stablyai/orca/pull/50539) | 先去除 Linear 工作区选择值的空白再校验，拒绝伪装成具体工作区的 all，避免详情查询落入错误工作区。 | 作者 PR 开放 |
| 46 | [#50581](https://github.com/stablyai/orca/pull/50581) | 新下载目的地使用排他方式占用，防止并发下载互相覆盖；后续修正保留完整失败载荷及恢复路径。 | 作者 PR 开放 |
| 47 | [#50635](https://github.com/stablyai/orca/pull/50635) → [#50761](https://github.com/stablyai/orca/pull/50761) | 并发首次 MCP 请求复用一个已登记子进程，避免重复启动、丢失所有权和 Session not found。 | 维护者接续 PR 开放 |
| 48 | [#50628](https://github.com/stablyai/orca/pull/50628) → [#50756](https://github.com/stablyai/orca/pull/50756) | 共享 MCP 子进程退出或 stdin 写入失败时及时拒绝待完成发送，避免永久等待 drain。 | 维护者接续 PR 开放 |
| 49 | [#50637](https://github.com/stablyai/orca/pull/50637) | 插件目录拒绝 HTTP 错误或超大响应后取消响应体，避免已经失败的传输继续占用资源。 | 作者 PR 开放 |
| 50 | [#50639](https://github.com/stablyai/orca/pull/50639) | 运行时版本替换发布失败时恢复或保留先前版本；备份清理验证完整替代版本后才删除，并使用异步 I/O。 | 作者 PR 开放 |

#50659 的完整候选为 [7a64e57a](https://github.com/Afloat16/orca/commit/7a64e57a8a085a4c5ce0afacce579472f034f819)，[验证结果及技术说明](https://github.com/stablyai/orca/pull/50659#issuecomment-7215955003)已发布。原 closed PR 仍保留历史 head，未将 fork 新 head 冒充成已合并 PR。

#50643 的额外兼容修正为 [9819750](https://github.com/Afloat16/orca/commit/981975040d7d71e231eb3c31965f9f0d5d9eb18f)，[7 个测试和 28 项完整检查](https://github.com/Afloat16/orca/actions/runs/45987772336/job/140467658038)通过，已更新[原有接续评论](https://github.com/stablyai/orca/pull/50781#issuecomment-7216513290)，不增加改进计数。
