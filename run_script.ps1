while ($true) {
    # Start node.js and store the process information
    $process = Start-Process "node" -ArgumentList "index.js" -PassThru -NoNewWindow

    # Let it run for 3600 seconds (1 hour)
    Start-Sleep -Seconds 900

    # Forcefully stop the process
    Stop-Process -Id $process.Id -Force

    # Wait for 10 seconds before restarting the loop
    Start-Sleep -Seconds 30
}
