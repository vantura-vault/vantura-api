#!/bin/bash

echo "📊 Testing Competitor Comparison..."
echo ""

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}' | jq -r '.data.token')

echo "✅ Logged in"
echo ""

# Get comparison
echo "🎯 COMPETITIVE ANALYSIS"
echo "═══════════════════════════════════════════════════"
COMPARISON=$(curl -s http://localhost:3000/api/competitors/compare \
  -H "Authorization: Bearer $TOKEN")

echo ""
echo "YOUR COMPANY:"
echo "$COMPARISON" | jq '.data.yourCompany'

echo ""
echo "COMPETITORS:"
echo "$COMPARISON" | jq '.data.competitors'

echo ""
echo "💡 INSIGHTS:"
echo "$COMPARISON" | jq -r '.data.insights[]' | sed 's/^/   • /'

echo ""
echo "✅ Comparison complete!"