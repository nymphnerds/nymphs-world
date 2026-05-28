---
name: windows-caveats
description: Windows and WSL development pitfalls - path separators, case sensitivity, mixed environments, dotnet tooling, and cross-OS gotchas when developing on or for Windows
---

# Windows Caveats — Cross-OS Development Pitfalls

Use this skill when developing on **Windows** or in a **mixed WSL/Windows environment**, or when code must run correctly on both Windows and Linux.

**For native Linux development (CachyOS, Ubuntu, etc.), these caveats do NOT apply — ignore this skill unless targeting Windows.**

---

## 1. Mixed Environment (WSL/Windows)

### 1.1 The Split-Stack Problem
When backends run inside WSL and frontends run as Windows applications:
- **Never assume both layers run on the same OS**
- Backend paths use `/`, frontend paths may use `\`
- When executing commands, use `wsl` prefix for backend operations if invoking from Windows
- Verify paths are WSL-accessible (not Windows paths) for any server-side code

### 1.2 WSL File Access Performance
- Files edited in Windows and accessed from WSL (via `/mnt/c/...` CrossFS/Plan9 mount) suffer severe I/O penalties
- **Rule:** Keep project source inside WSL's native filesystem (e.g., `/home/user/`), never on `/mnt/c/`
- Symptoms: slow builds, file watchers missing changes, high disk usage

### 1.3 `dotnet watch` on WSL
The default file watcher relies on `inotify` which misses changes when files are edited from a Windows IDE and mounted via CrossFS (Plan9).
- **Fix:** Use the polling watcher:
  ```bash
  DOTNET_USE_POLLING_FILE_WATCHER=true dotnet watch run
  ```
- Or add to `.csproj`:
  ```xml
  <ItemGroup>
    <Watch Include="**\*.cs" Exclude="obj\**;bin\**" />
  </ItemGroup>
  ```

---

## 2. Path Separators

### 2.1 Forward Slash vs Backslash
| OS | Separator | Example |
|----|-----------|---------|
| Linux/WSL | `/` | `/home/rauty/project/src` |
| Windows | `\` | `C:\Users\rauty\project\src` |

### 2.2 Common Pitfalls
```javascript
// JavaScript/Node.js — backslash is an escape character in strings:
const path = "data\\users.json";  // BUG: \u is an escape sequence!

// ALWAYS use forward slashes in JS strings, or use path modules:
const path = require('path');
const safe = path.join("data", "users.json");  // Cross-platform
```

```csharp
// C# — use verbatim strings or Path.Combine:
var bad = "data\\users.json";   // Works but fragile
var good = @"data\users.json";  // Verbatim string
var best = Path.Combine("data", "users.json");  // Cross-platform
```

### 2.3 `path.normalize` Does NOT Convert Backslashes on Linux
**Critical:** On Linux (including WSL), `path.normalize()` does NOT convert `\` to `/`. A string like `..\\..\\etc\\passwd` stays literal — the backslashes are treated as regular characters, not path separators.

**Implication for security:** Path traversal checks that rely on `path.normalize()` to catch `..` sequences may fail if the input contains backslashes on Linux. Always check for `..` as a raw string sequence, not just after normalization.

### 2.4 WSL Path Conversion
When a Windows frontend needs to talk to a WSL backend:
```
Windows: C:\Users\rauty\project\file.txt
WSL:     /home/rauty/project/file.txt
```
Use `wslpath` to convert:
```bash
wslpath 'C:\Users\rauty\project\file.txt'  # → /home/rauty/project/file.txt
```

---

## 3. Filesystem Case Sensitivity

### 3.1 The #1 Cross-OS Bug
- **Linux/WSL:** Case-sensitive (`File.txt` ≠ `file.txt`)
- **Windows:** Case-insensitive (`File.txt` = `file.txt`)

**Symptom:** Code works on Windows, throws `FileNotFoundException` on Linux.

```python
# Works on Windows, fails on Linux:
open("Data/Users.Json")  # Actual file is data/users.json
```

```csharp
// Same issue in C#:
File.ReadAllText("Data/Users.Json");  // WONT WORK on Linux if file is data/users.json
```

**Rule:** Always verify exact case when referencing files in code. Run on Linux first, or use `ls` to confirm filenames.

### 3.2 Git on Windows
Git on Windows defaults to case-insensitive tracking. Renaming `file.txt` to `File.txt` may not be detected.
- **Fix:** `git config core.ignorecase false` (use cautiously — can cause issues on Windows)
- **Better:** Never rely on case-only differences in filenames.

---

## 4. C# / .NET Windows vs Linux Differences

### 4.1 String Comparison Culture
```csharp
// Default (culture-sensitive) — varies by OS:
string.Equals("a", "A");  // True on en-US, behavior varies on tr-TR

// On Linux, CurrentCulture differs from Windows.
// Always pass StringComparison explicitly:
string.Equals("a", "A", StringComparison.Ordinal);          // Fast, byte-by-byte
string.Equals("a", "A", StringComparison.OrdinalIgnoreCase); // Case-insensitive, cross-platform
```

### 4.2 User Secrets (Windows-Only Feature)
```csharp
// User Secrets work on Windows with Visual Studio:
dotnet user-secrets set "ConnectionStrings:Default" "..."

// On Linux: User Secrets store path differs, may not work as expected.
// Prefer environment variables or managed identity in production:
export MY_CONNECTION_STRING="Server=localhost"
```

### 4.3 SSL Certificates
```bash
# Windows: dotnet dev-certs https --trust works with Windows cert store
# Linux: may not work — depends on distro cert management
dotnet dev-certs https --trust   # May fail or require manual trust on Linux

# For development on Linux, accept self-signed certs or use HTTP locally.
# For production, use nginx/Caddy reverse proxy with Let's Encrypt.
```

### 4.4 Environment Variable Syntax
```bash
# Linux (bash):
export MY_VAR="value"

# Windows (PowerShell):
$env:MY_VAR="value"

# Windows (CMD):
set MY_VAR=value
```

---

## 5. Terminal Command Differences

### 5.1 Command Chaining on Windows
- **Linux/WSL:** `cmd1 && cmd2 || cmd3`
- **PowerShell:** `cmd1 -and cmd2` (different semantics) or `cmd1; if ($?) { cmd2 }`
- **CMD:** `cmd1 && cmd2`

### 5.2 Path Quoting
- **Linux:** `"/path/with spaces/file.txt"`
- **Windows CMD:** `"\path\with spaces\file.txt"` or `"/path/with spaces/file.txt"`
- **PowerShell:** `'/path/with spaces/file.txt'` (single quotes = literal)

---

## 6. Unity on Windows vs Linux

### 6.1 Editor Path Handling
```csharp
// DON'T hardcode separators:
var path = "Assets\\Scenes\\Level1.unity";  // Windows-only

// DO use Path.Combine or Application.dataPath:
var path = Path.Combine(Application.dataPath, "Scenes", "Level1.unity");
```

### 6.2 Build Platform Differences
- **Windows Editor → Linux Build:** Asset import differs (texture compression, shader variants)
- **Always test builds on the target platform**, not just in the Editor

---

## 7. When This Skill Applies

**Toggle on when:**
- Developing on Windows (native or WSL)
- Code must support both Windows and Linux
- Debugging cross-OS path or case-sensitivity issues
- Working with .NET/Unity projects that target Windows

**Ignore when:**
- Developing on native Linux (CachyOS) for Linux-only targets
- Working on web applications served from Linux servers
- The project has no Windows deployment target

---

## 8. Quick Reference: Linux-Native vs Windows

| Concern | Linux Native (CachyOS) | Windows / WSL |
|---------|----------------------|---------------|
| Path separator | `/` always | `\` on Windows, `/` in WSL |
| Case sensitivity | Always case-sensitive | Case-insensitive (Windows) |
| Env vars | `export VAR=value` | `$env:VAR="value"` (PS) |
| Line endings | `\n` (LF) | `\r\n` (CRLF) on Windows |
| File watchers | `inotify` works natively | `inotify` broken on CrossFS mounts |
| SSL dev certs | May need manual trust | `dotnet dev-certs --trust` works |
| User Secrets | Limited support | Full support with Visual Studio |

---

*Skill version: 1.0 — Created by extracting Windows caveats from cline-thinking, csharp-caveats, nymphs-safety, unity-caveats, and worbi-conventions*