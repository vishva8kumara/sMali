#!/bin/sh
# Validate configuration
if [ -z "$AGG_INTERVAL_SECONDS" ]; then
  echo "ERROR: AGG_INTERVAL_SECONDS not set"
  exit 1
fi

while true; do
  node aggregator.js
  sleep "$AGG_INTERVAL_SECONDS"
done
