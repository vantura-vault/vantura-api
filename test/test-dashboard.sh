#!/bin/bash

echo "📊 Testing Dashboard API..."
echo ""

# Login
echo "1️⃣  Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}' | jq -r '.data.token')

echo "✅ Logged in"
echo ""

# Get dashboard
echo "2️⃣  Fetching dashboard..."
DASHBOARD=$(curl -s "http://localhost:3000/api/dashboard/me" \
  -H "Authorization: Bearer $TOKEN")

echo ""
echo "📈 DASHBOARD OVERVIEW"
echo "────────────────────────────────────────"
echo "$DASHBOARD" | jq '{
  company: .data.company.name,
  totalFollowers: .data.overview.totalFollowers,
  totalPosts: .data.overview.totalPosts,
  platforms: .data.overview.platformCount,
  avgGrowth: "\(.data.overview.averageGrowthRate)%",
  fastestGrowing: .data.overview.fastestGrowingPlatform
}'

echo ""
echo "📱 PLATFORM BREAKDOWN"
echo "────────────────────────────────────────"
echo "$DASHBOARD" | jq '.data.platforms[] | {
  platform: .name,
  followers: .current.followers,
  posts: .current.posts,
  growth: "\(.growth.followers.percentage)%",
  trend: .growth.followers.trend
}'

echo ""
echo "💡 INSIGHTS"
echo "────────────────────────────────────────"
echo "$DASHBOARD" | jq -r '.data.insights[]'

echo ""
echo "✅ Dashboard test complete!"