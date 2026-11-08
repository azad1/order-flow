param(
    [Parameter(Mandatory = $true)][ValidateSet('Protect', 'Unprotect', 'Prompt')][string]$Mode,
    [string]$OutputFile
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Security
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
$entropy = $utf8.GetBytes('OrderFlow/KotakNeo/Token/v1')
$plainBytes = $null
$checkBytes = $null
$pointer = [IntPtr]::Zero
$temporaryFile = $null
try {
    if ($Mode -eq 'Unprotect') {
        $encrypted = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
        $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $entropy, $scope)
        # Only the Node server captures this pipe. Never invoke this mode to display a token.
        [Console]::Out.Write($utf8.GetString($plainBytes))
    } else {
        if ($Mode -eq 'Prompt') {
            if (!$OutputFile -or !(Test-Path -LiteralPath (Split-Path -Parent $OutputFile))) { throw 'Missing output folder.' }
            Write-Host 'Paste the Access Token from your active Kotak Neo application.'
            Write-Host 'Your typing is hidden. Press Enter to save, or Ctrl+C to cancel.'
            $secure = Read-Host 'Kotak access token' -AsSecureString
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
        } else {
            $plain = [Console]::In.ReadToEnd().Trim()
        }
        if (!$plain -or $plain -match '\s') { throw 'The token must be a single non-empty value.' }
        $plainBytes = $utf8.GetBytes($plain)
        $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($plainBytes, $entropy, $scope)
        $checkBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $entropy, $scope)
        if ([Convert]::ToBase64String($checkBytes) -ne [Convert]::ToBase64String($plainBytes)) { throw 'Encryption verification failed.' }
        $encoded = [Convert]::ToBase64String($encrypted)
        if ($Mode -eq 'Prompt') {
            $temporaryFile = $OutputFile + '.new-' + [Guid]::NewGuid().ToString('N')
            [System.IO.File]::WriteAllText($temporaryFile, "OrderFlowKotakDPAPI:1`n$encoded`n", $utf8)
            if (Test-Path -LiteralPath $OutputFile) { [System.IO.File]::Replace($temporaryFile, $OutputFile, $null) }
            else { [System.IO.File]::Move($temporaryFile, $OutputFile) }
        } else { [Console]::Out.Write($encoded) }
    }
} catch {
    # Do not echo exception details: they may contain input or captured output.
    [Console]::Error.WriteLine('Windows could not protect or unlock the token. Use the same Windows account and try again.')
    exit 1
} finally {
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
    if ($checkBytes) { [Array]::Clear($checkBytes, 0, $checkBytes.Length) }
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) { Remove-Item -LiteralPath $temporaryFile }
    $plain = $null
}
