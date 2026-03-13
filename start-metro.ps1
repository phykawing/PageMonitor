if ($env:PATH -notlike '*nodejs*') { $env:PATH = 'C:\Program Files\nodejs;' + $env:PATH }
$projectDir = $PSScriptRoot
Set-Location $projectDir
& node "$projectDir\node_modules\react-native\cli.js" start --reset-cache
