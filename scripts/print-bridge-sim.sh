#!/usr/bin/env bash
set -u

API_URL="${API_URL:-http://localhost:3101/api}"
POLL_SECONDS="${POLL_SECONDS:-3}"

echo "========================================"
echo " DrizaTx Print Bridge Simulator"
echo " API_URL=$API_URL"
echo " POLL_SECONDS=$POLL_SECONDS"
echo "========================================"

while true; do
  echo
  echo "----- CLAIM $(date '+%Y-%m-%d %H:%M:%S') -----"

  RESPONSE="$(curl -s -X POST "$API_URL/print-jobs/claim")"
  JOB_ID="$(echo "$RESPONSE" | jq -r '.job.id // empty')"

  if [ -z "$JOB_ID" ]; then
    echo "No hay jobs pendientes."
    sleep "$POLL_SECONDS"
    continue
  fi

  TICKET_NUMBER="$(echo "$RESPONSE" | jq -r '.job.ticketNumber // empty')"
  SERVICE_NAME="$(echo "$RESPONSE" | jq -r '.job.serviceName // empty')"

  echo "Job tomado: id=$JOB_ID ticket=$TICKET_NUMBER service=$SERVICE_NAME"

  # Simulación de impresión exitosa
  echo "Simulando impresión..."
  sleep 1

  echo "Marcando job $JOB_ID como printed..."
  curl -s -X POST "$API_URL/print-jobs/$JOB_ID/printed" | jq

  sleep "$POLL_SECONDS"
done
