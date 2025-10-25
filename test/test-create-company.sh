#!/bin/bash

# Login and extract token
echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"
echo ""

# Create company immediately
echo "Creating company..."
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Poppi",
    "industry": "Beverages",
    "description": "Poppi is a prebiotic soda brand known for being a lower-sugar and lower-calorie alternative to traditional soda. It is made with apple cider vinegar, fruit juices, and prebiotics, and comes in a variety of nostalgic and modern flavors.",
    "platforms": [
      {
        "platformName": "LinkedIn",
        "profileUrl": "https://www.linkedin.com/company/poppi"
      }
    ]
  }'

echo ""