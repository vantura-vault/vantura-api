#!/bin/bash

echo "🎯 Testing Competitor Tracking (DEBUG MODE)..."
echo ""

# Login as Poppi
echo "1️⃣  Logging in as Poppi..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}' | jq -r '.data.token')

echo "✅ Logged in with token: ${TOKEN:0:20}..."
echo ""

# Add Olipop as competitor (WITH DEBUG)
echo "2️⃣  Adding Olipop as competitor..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/competitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Olipop",
    "industry": "Beverages",
    "description": "Olipop is a new kind of soda that tastes delicious and supports digestive health with plant fiber and prebiotics.",
    "platforms": [
      {
        "platformName": "Instagram",
        "profileUrl": "https://instagram.com/drinkolipop"
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status Code: $HTTP_STATUS"
echo "Raw Response: $BODY"
echo ""

# Try to parse if it's JSON
if echo "$BODY" | jq . > /dev/null 2>&1; then
  echo "✅ Valid JSON"
  echo "$BODY" | jq '.message'
else
  echo "❌ NOT VALID JSON - This is your problem!"
fi

echo ""

# Add Health-Ade as competitor (WITH DEBUG)
echo "3️⃣  Adding Health-Ade as competitor..."
RESPONSE2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/competitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Health-Ade",
    "industry": "Beverages",
    "description": "Health-Ade is a kombucha brand focused on gut health and organic ingredients.",
    "platforms": [
      {
        "platformName": "Instagram",
        "profileUrl": "https://instagram.com/healthade"
      }
    ]
  }')

HTTP_STATUS2=$(echo "$RESPONSE2" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | sed '/HTTP_STATUS:/d')

echo "Status Code: $HTTP_STATUS2"
echo "Raw Response: $BODY2"
echo ""

# List all competitors (WITH DEBUG)
echo "4️⃣  Listing all competitors..."
RESPONSE3=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:3000/api/competitors \
  -H "Authorization: Bearer $TOKEN")

HTTP_STATUS3=$(echo "$RESPONSE3" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY3=$(echo "$RESPONSE3" | sed '/HTTP_STATUS:/d')

echo "Status Code: $HTTP_STATUS3"
echo "Raw Response: $BODY3"
echo ""

echo "5️⃣  Checking dashboard competitor count..."
curl -s http://localhost:3000/api/dashboard/me \
  -H "Authorization: Bearer $TOKEN" | jq '{
    competitorsTracked: .data.overview.competitorsTracked
  }'

echo ""
echo "✅ Debug complete!"