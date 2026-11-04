# Starts the portable MySQL prepared in this workspace, then Express.
# No Windows service is installed. The browser URL comes from .env.
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
$mysqlBase = Join-Path $projectPath 'tmp/mysql-runtime/mysql-8.4.4-winx64'
$mysqlData = Join-Path $projectPath 'tmp/mysql8-data'
$mysqlExe = Join-Path $mysqlBase 'bin/mysqld.exe'
if (-not (Test-Path -LiteralPath '.env')) {
    throw 'Create .env from .env.example first.'
}
$config = @{}
Get-Content -LiteralPath '.env' | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
}
if ($config['DB_PORT'] -eq '3318' -and (Test-Path -LiteralPath $mysqlExe)) {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', 3318); $running = $true }
    catch { $running = $false }
    finally { $client.Dispose() }
    if (-not $running) {
        $mysqlArgs = @('--no-defaults', ('--basedir="' + $mysqlBase + '"'), ('--datadir="' + $mysqlData + '"'), '--port=3318', '--bind-address=127.0.0.1', '--mysqlx=0', '--console')
        Start-Process -FilePath $mysqlExe -ArgumentList $mysqlArgs -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath 'tmp/mysql8.log') -RedirectStandardError (Join-Path $projectPath 'tmp/mysql8-error.log') | Out-Null
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 500
            $probe = [Net.Sockets.TcpClient]::new()
            try { $probe.Connect('127.0.0.1', 3318); $ready = $true }
            catch { }
            finally { $probe.Dispose() }
            if ($ready) { break }
        }
        if (-not $ready) { throw 'MySQL did not start. Check tmp/mysql8-error.log.' }
    }
} else {
    Write-Host 'Using the database configured in .env. Start that MySQL server first.'
}
npm.cmd start
