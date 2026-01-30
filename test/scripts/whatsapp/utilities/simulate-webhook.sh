#!/bin/bash
# Script para simular webhooks de Twilio
#
# Uso:
#   ./test/scripts/whatsapp/utilities/simulate-webhook.sh status <MessageSid> <Status>
#   ./test/scripts/whatsapp/utilities/simulate-webhook.sh inbound <MessageSid> <From> <Body>
#
# Ejemplos:
#   ./test/scripts/whatsapp/utilities/simulate-webhook.sh status SM123 delivered
#   ./test/scripts/whatsapp/utilities/simulate-webhook.sh inbound SM456 "whatsapp:+5492944123456" "si confirmo"

BASE_URL="${BASE_URL:-http://localhost:5000}"
WEBHOOK_PATH="/api/webhooks/twilio"

if [ "$1" = "status" ]; then
  MESSAGE_SID="$2"
  STATUS="$3"
  
  if [ -z "$MESSAGE_SID" ] || [ -z "$STATUS" ]; then
    echo "Usage: $0 status <MessageSid> <Status>"
    echo "Example: $0 status SM123 delivered"
    exit 1
  fi
  
  echo "📤 Sending status update webhook..."
  curl -X POST "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/json" \
    -d "{
      \"MessageSid\": \"${MESSAGE_SID}\",
      \"MessageStatus\": \"${STATUS}\",
      \"AccountSid\": \"ACtest\"
    }"
  echo -e "\n"

elif [ "$1" = "inbound" ]; then
  MESSAGE_SID="$2"
  FROM="$3"
  BODY="$4"
  
  if [ -z "$MESSAGE_SID" ] || [ -z "$FROM" ] || [ -z "$BODY" ]; then
    echo "Usage: $0 inbound <MessageSid> <From> <Body>"
    echo "Example: $0 inbound SM456 \"whatsapp:+5492944123456\" \"si confirmo\""
    exit 1
  fi
  
  echo "📥 Sending inbound message webhook..."
  curl -X POST "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/json" \
    -d "{
      \"MessageSid\": \"${MESSAGE_SID}\",
      \"From\": \"${FROM}\",
      \"Body\": \"${BODY}\",
      \"AccountSid\": \"ACtest\"
    }"
  echo -e "\n"

else
  echo "Usage: $0 {status|inbound} [args...]"
  echo ""
  echo "Commands:"
  echo "  status <MessageSid> <Status>     - Simulate status update webhook"
  echo "  inbound <MessageSid> <From> <Body> - Simulate inbound message webhook"
  echo ""
  echo "Examples:"
  echo "  $0 status SM123 delivered"
  echo "  $0 inbound SM456 \"whatsapp:+5492944123456\" \"si confirmo\""
  exit 1
fi

