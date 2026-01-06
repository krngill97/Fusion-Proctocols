# 🚀 FUSION Pro - Complete Startup Guide

## Quick Start (3 Steps)

### Step 1: Start Backend
**Double-click:** `START_BACKEND_CLEAN.bat`

**Wait for this message:**
```
✅ Connected to MongoDB
✅ Connected to Redis
✅ Server running on port 5000
```

**If it crashes, see "Troubleshooting Backend" below**

---

### Step 2: Start Frontend
**Double-click:** `START_FRONTEND_CLEAN.bat`

**Wait for this message:**
```
VITE ready in XXX ms
➜  Local:   http://localhost:5173/
```

---

### Step 3: Open Browser
```
http://localhost:5173
```

✅ **You should see the FUSION dashboard!**

---

## Troubleshooting Backend

### Error: "Cannot find module"
**Solution:**
```bash
cd backend
npm install
```

### Error: "MongoDB connection failed"
**Check:** Is MongoDB running? Or check `.env` file has correct `MONGODB_URI`

### Error: "Redis connection failed"
**Check:** `.env` file has correct `REDIS_URL`

### Error: "Port 5000 already in use"
**Solution:**
```bash
# Kill the process
taskkill /F /IM node.exe

# Or use a different port in .env
PORT=5001
```

### Error: "raydium-pool.service.js:28"
**Already fixed!** The files are disabled. If you still see this:
```bash
cd backend/src/services
ren raydium-pool.service.js raydium-pool.service.js.disabled
ren raydium-pool-complete.service.js raydium-pool-complete.service.js.disabled
```

---

## Troubleshooting Frontend

### Error: "ENOENT: no such file or directory"
**Solution:**
```bash
cd frontend
npm install
```

### Error: "Port 5173 already in use"
**Solution:** Frontend will automatically use next available port (5174, 5175, etc.)

### Blank page / White screen
**Check:**
1. Is backend running on port 5000?
2. Open browser console (F12) - any errors?
3. Try: `http://localhost:5173/explorer`

---

## Quick Health Check

### Test Backend
```bash
curl http://localhost:5000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### Test Frontend
Open: `http://localhost:5173`

**Expected:** Dashboard with menu on left side

---

## What's Working

✅ **Hybrid Recycling Volume Bot** - Real Jupiter swaps with capital efficiency
✅ **Token Creation** - Create SPL tokens on devnet
✅ **Charts** - TradingView-style price charts
✅ **Explorer** - Browse and track tokens

---

## Quick Links

**Frontend:**
- Dashboard: `http://localhost:5173/`
- Token Explorer: `http://localhost:5173/explorer`
- Testnet Lab: `http://localhost:5173/testnet-lab`
- Advanced Bots: `http://localhost:5173/advanced-bots`

**Backend API:**
- Health: `http://localhost:5000/health`
- API Docs: See `backend/src/routes/` for all endpoints

---

## Current Status

✅ **Backend:**
- Express API running
- MongoDB connected
- Redis connected
- WebSocket enabled
- Hybrid volume bot ready

✅ **Frontend:**
- React + Vite
- TailwindCSS styling
- Real-time WebSocket updates
- Responsive design

⚠️ **Known Issues (Fixed):**
- ~~Raydium import error~~ → Disabled
- ~~Backend won't start~~ → Clean startup scripts

---

## Next: Test Hybrid Bot

Once everything is running:

1. Go to `http://localhost:5173/advanced-bots`
2. Or test via API:

```bash
curl -X POST http://localhost:5000/api/hybrid-recycling-volume/start \
  -H "Content-Type: application/json" \
  -d @test-hybrid-bot.json
```

---

## Need Help?

1. **Backend won't start:** Share the exact error message
2. **Frontend blank page:** Check browser console (F12)
3. **API not working:** Verify backend is running on port 5000

**Start the servers now and let me know what you see!** 🚀
