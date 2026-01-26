#!/bin/bash

# ==============================
# Color helpers
# ==============================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================
# Configuration
# ==============================
LOCAL_URL="http://localhost:3005/api/v1"
PROD_URL="https://jm-showroomer-back.onrender.com/api/v1"
TEST_TOKEN="TEST_ID_TOKEN"

# ==============================
# Helper function
# ==============================
function run_test() {
    local METHOD=$1
    local URL=$2
    local DESC=$3
    local TOKEN=$4

    printf "${BLUE}[$DESC]${NC} ${METHOD} ${URL}\n"
    if [[ -z "$TOKEN" ]]; then
        curl -s -w "\nHTTP Status: %{http_code}\n\n" -X $METHOD "$URL"
    else
        curl -s -w "\nHTTP Status: %{http_code}\n\n" -H "Authorization: Bearer $TOKEN" -X $METHOD "$URL"
    fi
}

# ==============================
# LOCAL DEV TESTS
# ==============================
echo -e "\n${GREEN}===============================${NC}"
echo -e "${GREEN}✅ LOCAL DEV TESTS (mock user)${NC}"
echo -e "${GREEN}===============================${NC}\n"

run_test GET  "$LOCAL_URL/health" "LOCAL GET /health"
run_test GET  "$LOCAL_URL/lookbooks" "LOCAL GET /lookbooks"
run_test GET  "$LOCAL_URL/showrooms" "LOCAL GET /showrooms"
run_test POST "$LOCAL_URL/users/dev/register-test" "LOCAL POST /users/dev/register-test"
run_test GET  "$LOCAL_URL/users/me" "LOCAL GET /users/me (mock)" "$TEST_TOKEN"
run_test POST "$LOCAL_URL/users/complete-onboarding" "LOCAL POST /users/complete-onboarding (mock)" "$TEST_TOKEN"
run_test POST "$LOCAL_URL/users/request-owner" "LOCAL POST /users/request-owner (mock)" "$TEST_TOKEN"
run_test POST "$LOCAL_URL/showrooms/create" "LOCAL POST /showrooms/create (mock OWNER)" "$TEST_TOKEN"
run_test POST "$LOCAL_URL/lookbooks/create" "LOCAL POST /lookbooks/create (mock OWNER)" "$TEST_TOKEN"

# ==============================
# PROD Render Tests (no real token)
# ==============================
echo -e "\n${YELLOW}===============================${NC}"
echo -e "${YELLOW}🌐 PROD TESTS (no real token)${NC}"
echo -e "${YELLOW}===============================${NC}\n"

run_test GET "$PROD_URL/health" "PROD GET /health"
run_test GET "$PROD_URL/lookbooks" "PROD GET /lookbooks"
run_test GET "$PROD_URL/showrooms" "PROD GET /showrooms"

echo -e "${YELLOW}[PROD SKIPPED] /users/dev/register-test, /users/me, /complete-onboarding, /request-owner${NC}"
echo -e "${YELLOW}Protected endpoints require real Firebase idToken${NC}\n"
