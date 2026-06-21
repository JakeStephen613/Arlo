#!/bin/bash
# Run against local server: bash smoke_test.sh
# Requires the server running: uvicorn app.main:app --port 10000 --reload
# Requires a valid user ID in USER_ID env var (optional — anon endpoints work without it)

BASE="http://localhost:10000"
USER="${USER_ID:-test-user-123}"
PASS=0; FAIL=0

check() {
  local name=$1 result=$2
  if [ "$result" = "ok" ]; then
    echo "PASS: $name"; ((PASS++))
  else
    echo "FAIL: $name — $result"; ((FAIL++))
  fi
}

py_check() {
  python3 -c "$1" 2>/dev/null || echo "error"
}

# Health check
check "ping" "$(curl -sf "$BASE/ping" | py_check 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("status")=="ok" else "bad")')"

# Study session — anon endpoint (x-user-id header, no JWT)
check "study-session" "$(curl -sf -X POST "$BASE/api/study-session" \
  -H 'Content-Type: application/json' -H "x-user-id: $USER" \
  -d '{"objective":"photosynthesis","duration":30}' \
  | py_check 'import sys,json; d=json.load(sys.stdin); print("ok" if isinstance(d.get("blocks"), list) and len(d["blocks"])>0 else "bad: "+str(d)[:200))')"

# PDF parse — multipart endpoint
check "pdf-parse-endpoint-exists" "$(curl -sf -o /dev/null -w '%{http_code}' -X POST "$BASE/api/pdf/parse" \
  | python3 -c 'import sys; code=sys.stdin.read().strip(); print("ok" if code in ("400","422") else "bad: "+code)')"

# Chatbot — no auth required for anon path
check "chatbot" "$(curl -sf -X POST "$BASE/api/chatbot" \
  -H 'Content-Type: application/json' \
  -d "{\"user_input\":\"What is photosynthesis?\",\"topic\":\"Biology\",\"user_id\":\"$USER\"}" \
  | py_check 'import sys,json; d=json.load(sys.stdin); print("ok" if "message" in d else "bad: "+str(d)[:200))')"

# Teaching combined
check "teaching-combined" "$(curl -sf -X POST "$BASE/api/combined" \
  -H 'Content-Type: application/json' \
  -d '{"teaching_description":"The mitochondria and cellular respiration"}' \
  | py_check 'import sys,json; d=json.load(sys.stdin); print("ok" if isinstance(d.get("lesson"), list) and len(d["lesson"])>0 else "bad: "+str(d)[:200))')"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
