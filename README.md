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
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=4173
```

The `.env` file is ignored by Git and should not be committed to GitHub.

You can also set environment variables directly when starting the server:

```bash
OPENAI_API_KEY=your_api_key npm start
```

The AI configuration panel includes a `检测Key` button. Use it to confirm that
the current key and model can successfully call the AI service before generating
test cases.

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
