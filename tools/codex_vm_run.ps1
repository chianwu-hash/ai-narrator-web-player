param(
    [string]$HostName = "news-vm",
    [string]$Cwd = "/home/vboxuser/nblm-audio",
    [Parameter(Mandatory = $true)]
    [string]$ScriptFile,
    [ValidateSet("python3", "bash", "sh")]
    [string]$Interpreter = "python3",
    [switch]$KeepRemote
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ScriptFile)) {
    throw "ScriptFile not found: $ScriptFile"
}

$resolved = Resolve-Path -LiteralPath $ScriptFile
$extension = [System.IO.Path]::GetExtension($resolved.Path)
if ([string]::IsNullOrWhiteSpace($extension)) {
    if ($Interpreter -eq "python3") {
        $extension = ".py"
    } else {
        $extension = ".sh"
    }
}

$remotePath = "/tmp/codex-run-$([System.Guid]::NewGuid().ToString('N'))$extension"

& scp $resolved.Path "${HostName}:$remotePath"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$cleanup = "rm -f '$remotePath'"
if ($KeepRemote) {
    $cleanup = "true"
}

$remoteCommand = "cd '$Cwd' && chmod 700 '$remotePath' && $Interpreter '$remotePath'; status=`$?; $cleanup; exit `$status"

& ssh $HostName $remoteCommand
exit $LASTEXITCODE
