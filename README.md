# glm-coding-quota

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that shows your **GLM Coding Plan quota** right in the composer — the 5-hour rolling window and the weekly credit window, straight from the BigModel team monitoring API.

输入框底栏常驻一个刻度环显示 5 小时窗口余量，悬停展开完整额度卡片（5 小时 / 每周两列：剩余百分比、重置时间、彩色刻度条）。数据来自 [open.bigmodel.cn](https://open.bigmodel.cn) 团队监控接口，5 分钟轮询 + 服务端缓存，不占请求额度。

![quota ring](icon.svg)

## Features

- Segmented tick ring beside the model selector — tracks the **5-hour window** at a glance (green / amber / red as it drains)
- Hover card with one row per quota window: label, remaining %, reset time, color-coded tick bar
- Optional plan-level badge (`level`) from the team API
- 5-minute client polling, 5-minute server cache, in-flight dedup — one API hit per refresh no matter how many UIs ask
- Works with any GLM Coding Plan key: reads `ZAI_CODING_CN_API_KEY` from env or `~/.dsh/.credentials.yaml`

## Install

```bash
dsh plugin --profile <your-profile> add glm-coding-quota
```

Then restart DeepSeek Harness. The ring appears next to the model selector in the composer.

## Configuration

The API key is picked up automatically (env `ZAI_CODING_CN_API_KEY`, or the same key DSH already stores in `~/.dsh/.credentials.yaml` for the GLM provider — no extra setup if you already use GLM models).

If your account belongs to multiple organizations or projects, pin the scope in your profile's `cordis.patch.yml`:

```yaml
- id: glm-coding-quota
  name: glm-coding-quota
  config:
    organization: org-xxxxxxxx   # optional, sent as bigmodel-organization
    project: proj_xxxxxxxx       # optional, sent as bigmodel-project
```

Omit both and the API resolves scope from the key alone. Env vars `BIGMODEL_ORGANIZATION` / `BIGMODEL_PROJECT` work too.

## Requirements

- DeepSeek Harness `>= 0.2.0-rc.1`
- A GLM Coding Plan subscription (team API access)

## Debug

`GET /api/glm-coding-quota/quota` on your DSH web-server port returns the raw mapped payload; add `?force=1` to bypass the cache. Useful for verifying the key/scope without the UI.

## License

[MIT](LICENSE)
