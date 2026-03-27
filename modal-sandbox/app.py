"""
Blueberry Browser — Modal Cloud Sandbox

Provides two capabilities:
1. run_script: Execute JavaScript against an HTML DOM snapshot (safe data extraction)
2. run_playwright: Execute a multi-step browser automation task with Playwright

Deploy: modal deploy app.py
Test:   modal run app.py
"""

import modal

# Define the container image with Playwright + Node.js
playwright_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "wget", "gnupg")
    # Install Node.js 20
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    # Install Playwright Python + browsers
    .pip_install("playwright")
    .run_commands("playwright install chromium", "playwright install-deps chromium")
)

app = modal.App("blueberry-sandbox")


@app.function(image=playwright_image, timeout=60)
async def run_script(html_snapshot: str, script: str) -> dict:
    """
    Execute JavaScript against an HTML DOM snapshot in a sandboxed Node.js environment.
    Returns the script's output as JSON.
    """
    import subprocess
    import json
    import tempfile
    import os

    # Write the HTML to a temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f:
        f.write(html_snapshot)
        html_path = f.name

    # Wrap the user script in a Node.js runner that loads the HTML via jsdom-like approach
    node_script = f"""
const fs = require('fs');
const html = fs.readFileSync('{html_path}', 'utf-8');

// Minimal DOM parsing using Node's built-in
const {{ JSDOM }} = (() => {{
    try {{ return require('jsdom'); }} catch {{
        // Fallback: use regex-based extraction
        return {{ JSDOM: null }};
    }}
}})();

async function main() {{
    let document, window;
    if (JSDOM) {{
        const dom = new JSDOM(html);
        document = dom.window.document;
        window = dom.window;
    }}

    try {{
        const result = await (async function() {{
            {script}
        }})();
        console.log(JSON.stringify({{ success: true, output: result }}));
    }} catch (e) {{
        console.log(JSON.stringify({{ success: false, error: e.message }}));
    }}
}}
main();
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
        f.write(node_script)
        script_path = f.name

    try:
        # Install jsdom for DOM parsing
        subprocess.run(["npm", "install", "jsdom"], capture_output=True, timeout=30)

        result = subprocess.run(
            ["node", script_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        os.unlink(html_path)
        os.unlink(script_path)

        if result.returncode != 0:
            return {"success": False, "error": result.stderr[:500]}

        # Parse the last line as JSON
        lines = result.stdout.strip().split("\n")
        for line in reversed(lines):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return {"success": False, "error": "No JSON output from script"}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Script execution timed out (30s)"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.function(image=playwright_image, timeout=120)
async def run_playwright(steps: list[dict]) -> dict:
    """
    Execute a multi-step browser automation task using Playwright.

    Each step is: { action: 'navigate'|'click'|'type'|'scroll'|'screenshot'|'read',
                    data: { url?, selector?, text?, direction? } }

    Returns: { success: bool, results: [...], screenshots: [...] }
    """
    from playwright.async_api import async_playwright

    results = []
    screenshots = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        for i, step in enumerate(steps):
            action = step.get("action", "")
            data = step.get("data", {})

            try:
                if action == "navigate":
                    url = data.get("url", "")
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    results.append({"step": i + 1, "action": action, "success": True, "url": url})

                elif action == "click":
                    selector = data.get("selector", "")
                    await page.click(selector, timeout=5000)
                    results.append({"step": i + 1, "action": action, "success": True, "selector": selector})

                elif action == "type":
                    selector = data.get("selector", "")
                    text = data.get("text", "")
                    await page.fill(selector, text)
                    results.append({"step": i + 1, "action": action, "success": True, "typed": text})

                elif action == "scroll":
                    direction = data.get("direction", "down")
                    pixels = data.get("pixels", 500)
                    delta = pixels if direction == "down" else -pixels
                    await page.evaluate(f"window.scrollBy(0, {delta})")
                    results.append({"step": i + 1, "action": action, "success": True})

                elif action == "screenshot":
                    import base64
                    screenshot_bytes = await page.screenshot()
                    b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
                    screenshots.append({"step": i + 1, "image": f"data:image/png;base64,{b64}"})
                    results.append({"step": i + 1, "action": action, "success": True})

                elif action == "read":
                    content = await page.content()
                    text_content = await page.evaluate("document.body.innerText")
                    results.append({
                        "step": i + 1,
                        "action": action,
                        "success": True,
                        "content": text_content[:3000],
                        "title": await page.title(),
                    })

                elif action == "wait":
                    import asyncio
                    ms = data.get("ms", 1000)
                    await asyncio.sleep(ms / 1000)
                    results.append({"step": i + 1, "action": action, "success": True})

                else:
                    results.append({"step": i + 1, "action": action, "success": False, "error": f"Unknown action: {action}"})

            except Exception as e:
                results.append({"step": i + 1, "action": action, "success": False, "error": str(e)})

        await browser.close()

    return {
        "success": all(r.get("success", False) for r in results),
        "results": results,
        "screenshots": screenshots,
    }


# Test entry point
@app.local_entrypoint()
async def main():
    import json

    # Test 1: Run a simple script
    print("=== Test 1: run_script ===")
    result = await run_script.remote.aio(
        "<html><body><h1>Hello</h1><p>World</p></body></html>",
        "return document.querySelector('h1').textContent;"
    )
    print(json.dumps(result, indent=2))

    # Test 2: Run Playwright automation
    print("\n=== Test 2: run_playwright ===")
    result = await run_playwright.remote.aio([
        {"action": "navigate", "data": {"url": "https://example.com"}},
        {"action": "read", "data": {}},
        {"action": "screenshot", "data": {}},
    ])
    print(f"Success: {result['success']}")
    print(f"Steps: {len(result['results'])}")
    for r in result["results"]:
        status = "OK" if r["success"] else f"FAIL: {r.get('error', '')}"
        print(f"  Step {r['step']}: {r['action']} — {status}")
    print(f"Screenshots: {len(result['screenshots'])}")
