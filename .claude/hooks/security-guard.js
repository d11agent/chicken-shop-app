#!/usr/bin/env node
/**
 * security-guard.js — Layer 1 Input Filtering (Banti security protocol)
 *
 * PreToolUse hook. Registered for: Bash | Write | Edit | Create | PowerShell
 * (PowerShell zaroor include hai — sirf Bash rakhne se PowerShell se bypass ho jata hai.)
 *
 * KEY DESIGN (learned the hard way):
 *   Code-execution patterns SIRF command-running tools (Bash / PowerShell) pe
 *   gate hote hain — Write / Edit / Create pe NAHI. Warna in tokens ko sirf
 *   *mention* karne wale docs/code (jaise ye file khud, ya CLAUDE.md) block ho
 *   jaate hain. Isliye file-writing tools yahan pass-through hain.
 *
 * SELF-BLOCK GOTCHA:
 *   Ye check Bash/PowerShell *commands* pe chalta hai. Koi bhi command jo
 *   trigger token ka literal naam le (jaise git commit message mein) khud block
 *   ho jayega. Fix = command/message ko reword karo — kabhi --no-verify / bypass
 *   mat karo. Block hona = detection sahi kaam kar rahi hai.
 *
 * Fail-open on internal errors: parse fail hone pe allow karta hai taaki poora
 * workflow brick na ho (single-owner dev tool tradeoff).
 */

'use strict';

const COMMAND_TOOLS = new Set(['Bash', 'PowerShell']);

/**
 * Dangerous patterns — SIRF command-running tools pe evaluate hote hain.
 * Regex false-positives se bacha gaya hai (lookbehind + word boundaries).
 */
const DANGEROUS = [
  {
    // download-and-pipe to a shell: curl/wget/iwr/irm ... | bash/sh/iex/powershell
    re: /(curl|wget|iwr|invoke-webrequest|irm|invoke-restmethod)\b[^\n]*\|\s*(bash|sh|zsh|iex|invoke-expression|powershell|pwsh)\b/i,
    why: 'download-and-pipe to shell (remote code execution)',
  },
  {
    // eval( but NOT retrieval( or obj.eval(  -> lookbehind rejects '.' and word chars
    re: /(?<![.\w])eval\s*\(/i,
    why: 'eval() dynamic code execution',
  },
  {
    // bare exec( but NOT re.exec()/str.exec() method calls
    re: /(?<![.\w])exec\s*\(/i,
    why: 'exec() dynamic code execution',
  },
  {
    re: /child_process/i,
    why: 'child_process spawn (arbitrary command execution)',
  },
  {
    // base64 -d / --decode  (decode-then-run pattern)
    re: /base64\s+(-d\b|--decode\b)/i,
    why: 'base64 decode (obfuscated payload)',
  },
  {
    re: /\b(invoke-expression|iex)\b/i,
    why: 'Invoke-Expression / IEX (PowerShell dynamic execution)',
  },
  {
    // -EncodedCommand / -enc  but NOT -Encoding  (-enc\b: 'g' after enc breaks boundary)
    re: /-(encodedcommand|enc)\b/i,
    why: 'encoded PowerShell command (obfuscation)',
  },
  {
    re: /frombase64string/i,
    why: 'FromBase64String (PowerShell payload decode)',
  },
];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function extractCommand(toolName, toolInput) {
  if (!toolInput) return '';
  // Bash + PowerShell dono 'command' field use karte hain
  if (typeof toolInput.command === 'string') return toolInput.command;
  return '';
}

(async () => {
  try {
    const raw = await readStdin();
    if (!raw.trim()) process.exit(0); // nothing to inspect -> allow

    const payload = JSON.parse(raw);
    const toolName = payload.tool_name || '';
    const toolInput = payload.tool_input || {};

    // File-writing tools -> pass-through (mention != execution)
    if (!COMMAND_TOOLS.has(toolName)) process.exit(0);

    const command = extractCommand(toolName, toolInput);
    if (!command) process.exit(0);

    for (const rule of DANGEROUS) {
      if (rule.re.test(command)) {
        process.stderr.write(
          `\n[security-guard] BLOCKED — ${rule.why}\n` +
            `Matched in ${toolName} command. Layer 1 input filter.\n` +
            `Agar ye legit hai (e.g. token ko sirf mention kar rahe ho): ` +
            `command ko reword karo. Kabhi bypass / --no-verify mat karo.\n`
        );
        process.exit(2); // exit 2 = block tool call, stderr Claude ko dikhta hai
      }
    }

    process.exit(0); // clean -> allow
  } catch (err) {
    // fail-open: internal error pe workflow brick nahi karna
    process.stderr.write(`[security-guard] internal error (allowing): ${err.message}\n`);
    process.exit(0);
  }
})();
