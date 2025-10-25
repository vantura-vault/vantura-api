#!/bin/bash

echo "🔄 Full Competitor Tracking Workflow"
echo "═══════════════════════════════════════════════════"
echo ""

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}' | jq -r '.data.token')

# Add competitor
echo "1️⃣  Adding competitor..."
COMP=$(curl -s -X POST http://localhost:3000/api/competitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Competitor",
    "platforms": [{"platformName": "LinkedIn", "profileUrl": "https://linkedin.com/test"}]
  }')

COMP_ID=$(echo "$COMP" | jq -r '.data.competitor.id')
REL_ID=$(echo "$COMP" | jq -r '.data.relationship.id')

echo "   Competitor ID: $COMP_ID"
echo "   Relationship ID: $REL_ID"
echo ""

# List competitors
echo "2️⃣  Listing competitors..."
curl -s http://localhost:3000/api/competitors \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
echo "   competitors found"
echo ""

# Get single competitor
echo "3️⃣  Getting competitor details..."
curl -s "http://localhost:3000/api/competitors/$COMP_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.name'
echo ""

# Compare
echo "4️⃣  Running comparison..."
curl -s http://localhost:3000/api/competitors/compare \
  -H "Authorization: Bearer $TOKEN" | jq '.data.insights[0]'
echo ""

# Remove competitor
echo "5️⃣  Removing competitor..."
curl -s -X DELETE "http://localhost:3000/api/competitors/$REL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

echo ""
echo "✅ Workflow complete!"