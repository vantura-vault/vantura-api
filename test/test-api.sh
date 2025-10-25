#!/bin/bash

# Vantura API Test Script
# Tests all major endpoints

echo "🧪 Testing Vantura API"
echo "====================="
echo ""

API_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test health endpoint
echo -e "${BLUE}1. Testing health endpoint...${NC}"
HEALTH=$(curl -s "${API_URL}/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
fi
echo ""

# Test login
echo -e "${BLUE}2. Testing login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@vantura.com","password":"demo123"}')

if echo "$LOGIN_RESPONSE" | grep -q "mock-token-123"; then
  echo -e "${GREEN}✓ Login successful${NC}"
  TOKEN="mock-token-123"
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi
echo ""

# Test metrics endpoint (requires auth)
echo -e "${BLUE}3. Testing metrics endpoint...${NC}"
METRICS=$(curl -s "${API_URL}/api/metrics" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$METRICS" | grep -q "totalFollowers"; then
  echo -e "${GREEN}✓ Metrics endpoint works${NC}"
else
  echo -e "${RED}✗ Metrics endpoint failed${NC}"
fi
echo ""

# Test platforms endpoint (requires auth)
echo -e "${BLUE}4. Testing platforms endpoint...${NC}"
PLATFORMS=$(curl -s "${API_URL}/api/platforms" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$PLATFORMS" | grep -q "linkedin"; then
  echo -e "${GREEN}✓ Platforms endpoint works${NC}"
else
  echo -e "${RED}✗ Platforms endpoint failed${NC}"
fi
echo ""

# Test recommendations endpoint (requires auth)
echo -e "${BLUE}5. Testing recommendations endpoint...${NC}"
RECOMMENDATIONS=$(curl -s "${API_URL}/api/recommendations" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$RECOMMENDATIONS" | grep -q "recommendations"; then
  echo -e "${GREEN}✓ Recommendations endpoint works${NC}"
else
  echo -e "${RED}✗ Recommendations endpoint failed${NC}"
fi
echo ""

# Test unauthorized access
echo -e "${BLUE}6. Testing unauthorized access...${NC}"
UNAUTHORIZED=$(curl -s -w "%{http_code}" "${API_URL}/api/metrics")

if echo "$UNAUTHORIZED" | grep -q "401"; then
  echo -e "${GREEN}✓ Auth protection works${NC}"
else
  echo -e "${RED}✗ Auth protection failed${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${GREEN}========================================${NC}"
