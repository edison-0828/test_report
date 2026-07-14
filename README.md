# Test Report

Test Report is a local test management tool for turning requirement or API
documents into executable test cases, tracking execution results, recording
bugs, and exporting test reports.

## Features

- Create test versions and tasks.
- Generate Chinese test cases from local files or documentation URLs.
- Track case execution status and execution notes.
- Record bugs with severity, status, owner, and regression notes.
- View version-based test summaries and export reports.
- Check whether an OpenAI API Key can call the selected model.

## Requirements

- Node.js 18 or later.
- npm.
- An OpenAI API Key if you want to use AI case generation.

## Setup

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

For local development, use the quieter dev command. It starts the same app but
disables the scheduled self-test loop by default:

```bash
npm run dev
```

Open the app:

```text
http://127.0.0.1:4173
```

The default port is `4173`. To use another port:

```bash
PORT=3000 npm start
```

Then open:

```text
http://127.0.0.1:3000
```

## Deploy To Internal Server

Recommended server path:

```text
/opt/test-report
```

Recommended long-running mode:

- Ubuntu server
- `systemd` service
- project Python virtual environment at `/opt/test-report/.venv`

### First-time server preparation

Install runtime dependencies on the server:

```bash
apt update
apt install -y nodejs npm python3-pip python3-venv python3-full
```

Create the app directory and Python environment:

```bash
mkdir -p /opt/test-report
cd /opt/test-report
python3 -m venv .venv
source .venv/bin/activate
pip install python-docx
```

Create server-side `.env` and keep it only on the server:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4
PORT=4173
CODEX_PYTHON=/opt/test-report/.venv/bin/python
```

The deploy script now hardens server data by default:

- Version, task, case, and bug data are stored under `/var/lib/test-report`
- Publish only replaces application code under `/opt/test-report`
- If the server still has old data in `/opt/test-report/app-state.json` or `/opt/test-report/team-members.json`, deploy automatically migrates it once

### One-command publish from your Windows machine

This repo now includes:

- `deploy.ps1`
- `ops/test-report.service`
- `ops/install-systemd-service.sh`

Usage:

```powershell
cd D:\TestReport
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

What it does:

1. Packages the project files.
2. Does not upload local runtime data such as `app-state.json`, `team-members.json`, or `tmp`.
3. Uploads them to `192.168.1.210`.
4. Keeps the server `.env` file in place.
5. Ensures `/var/lib/test-report` exists for server-side project data.
6. Migrates old server data from the app directory into `/var/lib/test-report` if needed.
7. Runs `npm install`.
8. Ensures `.venv` exists and installs `python-docx`.
9. Installs or refreshes a `systemd` service with fixed data file paths.
10. Restarts the service and sets it to start on boot.

After deploy, open:

```text
http://192.168.1.210:4173
```

### Service management on the server

Check status:

```bash
systemctl status test-report --no-pager
```

View logs:

```bash
journalctl -u test-report -n 100 --no-pager
```

Restart manually:

```bash
systemctl restart test-report
```

Enable startup on boot again if needed:

```bash
systemctl enable test-report
```

## AI Configuration

You can provide an OpenAI API Key in either of these ways:

1. Create a local `.env` file. This is recommended.
2. Enter the key in the AI configuration panel inside the app for the current
   page session.

Keys entered in the browser are used for the current check or generation
request only. They are not written to localStorage by the app.

Create `.env` from the example file:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.4
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=4173
LARK_API_BASE_URL=https://open.larksuite.com
LARK_APP_ID=your_lark_app_id
LARK_APP_SECRET=your_lark_app_secret
LARK_BASE_APP_TOKEN=your_lark_base_app_token
LARK_VERSION_TABLE_ID=your_version_table_id
LARK_TASK_TABLE_ID=your_task_table_id
LARK_CASE_TABLE_ID=your_case_table_id
LARK_BUG_TABLE_ID=your_bug_table_id
```

The `.env` file is ignored by Git and should not be committed to GitHub.

You can also set environment variables directly when starting the server:

```bash
OPENAI_API_KEY=your_api_key npm start
```

The AI configuration panel includes a `检测Key` button. Use it to confirm that
the current key and model can successfully call the AI service before generating
test cases.

## API Automation Configuration

Interface automation reads local site and environment settings from
`api-automation.config.json`. This file is ignored by Git, so put private
values such as merchant keys and signing API keys there.

Create it from `api-automation.config.example.json`, then fill the merchant key
and signing API key for each site:

```json
{
  "defaultSite": "klicklpay",
  "sites": {
    "klicklpay": {
      "label": "KlicklPay",
      "requiredHeaders": ["KlicklPay-Key"],
      "environments": {
        "test": {
          "baseUrl": "https://test-oapi.klicklpay.com",
          "headers": {
            "KlicklPay-Key": "your_test_key"
          }
        },
        "sandbox": {
          "baseUrl": "https://sandbox-oapi.klicklpay.com",
          "headers": {
            "KlicklPay-Key": "your_sandbox_key"
          }
        }
      },
      "signature": {
        "enabled": true,
        "status": "ready",
        "algorithm": "SHA256",
        "uppercase": true,
        "timestampUnit": "milliseconds",
        "nonceLength": 32,
        "stringTemplate": "{timestamp}{nonce}{body}",
        "apiKey": "your_signing_api_key"
      }
    },
    "sunpay": {
      "label": "SunPay",
      "requiredHeaders": ["SunPay-Key"],
      "environments": {
        "sandbox": {
          "baseUrl": "https://sandbox-oapi.sunpay.pro",
          "headers": {
            "SunPay-Key": "your_sandbox_key"
          }
        }
      },
      "signature": {
        "enabled": true,
        "status": "ready",
        "algorithm": "SHA256",
        "uppercase": true,
        "timestampUnit": "milliseconds",
        "nonceLength": 32,
        "stringTemplate": "{timestamp}{nonce}{body}",
        "apiKey": "your_signing_api_key"
      }
    }
  }
}
```

KlicklPay signing uses `timestamp + nonce + body` as the signature string, then
encrypts it with the API key by SHA256 and uppercases the result. Timestamp is
Unix time in milliseconds, nonce is a 32-character random string, and body is
omitted when the request has no body.

SunPay is sandbox-only for now and uses the same documented signature shape:
`timestamp + nonce + body`, SHA256 with API key, uppercased. The default SunPay
header names are configurable in `sites.sunpay.signature.headers`.

## Optional Lark Integration

Lark integration is optional. The main workflow only requires AI configuration
and local project data. If your team wants to manage results in Lark, the report
page includes a Lark integration panel that reads Lark credentials from `.env`,
checks whether the configured Base tables are accessible, and syncs versions,
tasks, test cases, and bugs to Lark Base.

Recommended setup:

1. Create a self-built app in Lark Open Platform.
2. Copy the app ID and app secret into `.env`.
3. Enable Base/Bitable record permissions for the app.
4. Add the app as a collaborator to the target Lark Base.
5. Create four Base tables and copy their table IDs into `.env`.
6. Restart the local server and click `检测 Lark` in the report page.

Sync behavior:

- `外部ID` is the unique key used for de-duplication.
- If a Lark record with the same `外部ID` already exists, the app updates it.
- If no matching `外部ID` exists, the app creates a new record.
- Do not rename or remove the `外部ID` field in the Base tables.

Default Base table fields:

`测试版本`

```text
外部ID
版本号
状态
负责人
任务数
用例数
BUG数
更新时间
```

`测试任务`

```text
外部ID
任务名称
所属版本
测试范围
负责人
状态
更新时间
```

`测试用例`

```text
外部ID
用例标题
模块
类型
优先级
前置条件
测试步骤
预期结果
执行状态
执行备注
所属版本
所属任务
更新时间
```

`BUG记录`

```text
外部ID
BUG标题
严重程度
状态
负责人
关联用例
备注
所属版本
所属任务
Lark
更新时间
```

The current integration is one-way: Test Report syncs data to Lark Base. It does
not read edited Lark rows back into the local app.

## Basic Workflow

1. Configure and check the AI Key.
2. Create a test version.
3. Create a test task.
4. Upload a requirement/API file or provide a documentation URL.
5. Generate test cases.
6. Execute cases and record bugs.
7. Review and export the test report.

## License

This project is source-available, not open source.

Copyright (c) 2026 Edison. All rights reserved.

The code is publicly visible for demonstration, learning, review, and
evaluation purposes only. Commercial use, redistribution, resale, hosted
service use, or copying substantial parts of this project is not permitted
without prior written permission from the author.
