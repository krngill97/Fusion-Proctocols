$body = Get-Content 'C:\Users\richp\Downloads\fusion-pro-design\test-hybrid-bot.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:5000/api/hybrid-recycling-volume/start' -Method POST -Body $body -ContentType 'application/json'
    Write-Output "SUCCESS!"
    Write-Output ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Output "ERROR: $_"
    Write-Output $_.Exception.Message
}
