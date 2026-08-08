# Codex VM runbook

Use this workflow for `news-vm` work from Windows.

## Rule

Do not send multiline Python, Bash, patches, or CJK text through inline SSH.

Use one of these wrappers instead:

- `tools/codex_vm_run.cmd`
- `tools/codex_vm_run.ps1`

The `.cmd` wrapper is preferred when PowerShell itself is unreliable.

## Examples

Run a Python script on the VM in the audio repo:

```cmd
tools\codex_vm_run.cmd --interpreter python3 C:\Temp\probe.py
```

Run a Bash script on the VM:

```cmd
tools\codex_vm_run.cmd --interpreter bash C:\Temp\probe.sh
```

Run in another VM directory:

```cmd
tools\codex_vm_run.cmd --cwd /home/vboxuser/books --interpreter python3 C:\Temp\probe.py
```

## Safe usage pattern

1. Put complex remote logic in a local temporary script file.
2. Keep PowerShell scripts ASCII-only when possible.
3. Let the wrapper upload the script to `/tmp`.
4. Let the VM execute the uploaded file locally.
5. Keep direct SSH only for simple commands such as `git status` or `systemctl status`.

## Why

Windows shell, SSH, Linux shell, and Python each parse quoting differently.
Inline multiline commands are fragile, especially with `$`, backticks, quotes,
parentheses, regular expressions, or Chinese text.
