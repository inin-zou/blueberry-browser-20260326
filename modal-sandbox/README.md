# Blueberry Modal Sandbox

Cloud-based isolated execution environment for browser automation and script execution.

## Setup

### 1. Install Modal CLI

```bash
pip install modal
```

### 2. Authenticate

```bash
modal setup
# Or if you have tokens:
modal token set --token-id ak-xxx --token-secret as-xxx
```

### 3. Test locally

```bash
cd modal-sandbox
modal run app.py
```

This runs two tests:
- `run_script`: Executes JS against an HTML DOM snapshot
- `run_playwright`: Navigates to example.com, reads content, takes screenshot

### 4. Deploy

```bash
modal deploy app.py
```

This makes `run_script` and `run_playwright` available as remote functions.

## API

### `run_script(html_snapshot, script) -> dict`

Execute JavaScript against a DOM snapshot in Node.js + jsdom.

```python
result = await run_script.remote.aio(
    "<html><body><h1>Hello</h1></body></html>",
    "return document.querySelector('h1').textContent;"
)
# { "success": true, "output": "Hello" }
```

### `run_playwright(steps) -> dict`

Execute multi-step browser automation:

```python
result = await run_playwright.remote.aio([
    {"action": "navigate", "data": {"url": "https://blocket.se"}},
    {"action": "type", "data": {"selector": "input[type=search]", "text": "hello kitty"}},
    {"action": "click", "data": {"selector": "button[type=submit]"}},
    {"action": "read", "data": {}},
    {"action": "screenshot", "data": {}},
])
```

Supported actions: `navigate`, `click`, `type`, `scroll`, `screenshot`, `read`, `wait`

## Integration with Blueberry

To use Modal sandbox from Electron, call the Modal functions via the Modal Python client
or expose them as a REST API using `@modal.web_endpoint()`.

## Container Image

The sandbox runs in an isolated container with:
- Debian Slim + Python 3.11
- Node.js 20
- Playwright + Chromium (headless)
- jsdom for DOM parsing

Each execution gets a fresh container — no state leaks between runs.
