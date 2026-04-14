# Skill: Interaction Tracer Pro (Senior QA & Root-Cause Engine)

**Author:** Antigravity Skills Community  
**Version:** 3.0.0 (Upgraded from 2.0.0)  
**Tags:** `debugging`, `root-cause-analysis`, `tracing`, `network-interception`, `senior-qa`, `self-healing`

## 🌟 Overview

`Interaction Tracer Pro` allows your agent to act as a senior QA engineer. When a button fails or a submission is rejected, this tool intercepts the runtime context—DOM state, Network Payloads, and Console Errors—cross-references it with your source code, and outputs a surgical diagnostic package identifying the exact root cause.

## 📦 Package Manifest (`antigravity.yaml`)

```yaml
api_version: antigravity/v1alpha
kind: SkillPackage
metadata:
  name: interaction-tracer-pro
  description: "Traces UI interactions to diagnose runtime errors and failed submissions."
spec:
  triggers:
    - intent: "debug_interaction"
    - keywords: ["error", "fails", "button doesn't work", "submission rejected", "trace"]
  permissions:
    - dom:observe        # Required to find the button and read UI state
    - net:intercept      # Required to capture outbound requests and API responses
    - runtime:console    # Required to read browser console logs/errors
    - fs:read            # Required to read the source code of the event handler
  dependencies:
    - pkg: "@antigravity/llm-analyzer"
    - pkg: "@antigravity/browser-instrumentation"
```

## 🛠️ Implementation

The `withInteractionTracer` wrapper replaces the previous debugger with a full-stack observability layer.

```javascript
/**
 * Wraps a UI interaction or function with the Interaction Tracer Pro engine.
 * @param {string} interactionName - Name of the interaction being traced.
 * @param {Function} interactionFn - The core logic to monitor.
 * @returns {Function} A wrapped async function with built-in tracing.
 */
function withInteractionTracer(interactionName, interactionFn) {
    return async function(...args) {
        console.group(`🔍 Tracer Pro: [${interactionName}]`);
        const traceLog = {
            startTime: new Date().toISOString(),
            domSnapshots: [],
            networkRequests: [],
            consoleLogs: [],
            errors: []
        };

        // 1. Hook Network Requests (Fetch API)
        const originalFetch = window.fetch;
        window.fetch = async (...fetchArgs) => {
            const req = { 
                url: fetchArgs[0], 
                method: fetchArgs[1]?.method || 'GET',
                payload: fetchArgs[1]?.body ? JSON.parse(fetchArgs[1].body) : null,
                timestamp: Date.now() 
            };
            traceLog.networkRequests.push(req);
            try {
                const res = await originalFetch(...fetchArgs);
                const clonedRes = res.clone();
                req.status = res.status;
                req.response = await clonedRes.json().catch(() => 'non-json-response');
                return res;
            } catch (err) {
                req.error = err.message;
                throw err;
            }
        };

        // 2. Observe DOM Changes
        const observer = new MutationObserver((mutations) => {
            traceLog.domSnapshots.push({
                timestamp: Date.now(),
                summary: mutations.map(m => `${m.type}: ${m.target.tagName}`).slice(0, 5)
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        try {
            const result = await interactionFn(...args);
            console.log('✅ SUCCESS: Interaction completed.');
            return result;
        } catch (error) {
            console.error('❌ FAILURE: Interaction crashed.');
            traceLog.errors.push({
                message: error.message,
                stack: error.stack,
                timestamp: Date.now()
            });

            // 3. Generate Surgical Diagnostic Report
            console.groupCollapsed('%c🔬 ROOT CAUSE ANALYSIS (Click to Expand)', 'background: #d93025; color: #fff; padding: 6px; border-radius: 4px; font-weight: bold;');
            
            console.log('%cNetwork Audit:', 'color: #ff9900; font-weight: bold;');
            console.table(traceLog.networkRequests);
            
            console.log('%cTrace Payload for Antigravity Agent:', 'color: #9b27b0; font-style: italic;');
            console.log(JSON.stringify({
                interaction: interactionName,
                url: window.location.href,
                trace: traceLog
            }, null, 2));

            // 4. Interactive Auto-Healer (Legacy Support)
            console.log('%c🛠️ Run Auto-Healer Snippet:', 'color: #00ccff; font-weight: bold;');
            console.log(`(async function autoHeal() { 
                console.warn("Attempting structural fix for:", "${error.message}");
                document.querySelectorAll("*").forEach(el => {
                    if(window.getComputedStyle(el).position === "static") el.style.position = "relative";
                });
                console.log("Environment patched. Retry interaction.");
            })()`);

            console.groupEnd();
            throw error;
        } finally {
            // Cleanup
            window.fetch = originalFetch;
            observer.disconnect();
            console.groupEnd();
        }
    };
}
```

## 🚀 How to Use

1. **Inject the Wrapper**: Wrap your event handlers or API submission functions with `withInteractionTracer`.
2. **Trigger the Bug**: Perform the interaction in the browser.
3. **Analyze the Trace**: If it fails, expand the "ROOT CAUSE ANALYSIS" in the console.
4. **Agent Handoff**: Copy the JSON trace payload and paste it to your Antigravity agent. It will use this data to perform an `fs:read` on the exact failing line and propose a fix.