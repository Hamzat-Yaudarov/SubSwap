# 🐛 Troubleshooting Guide

Common issues and solutions for Wormz Bot + MiniApp.

---

## Installation & Setup Issues

### Issue: `npm install` fails

**Cause**: Missing Node.js or corrupted npm cache

**Solution**:
```bash
# Check Node.js version (should be 18+)
node --version

# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Issue: Cannot find module errors

**Cause**: Dependencies not installed properly

**Solution**:
```bash
npm install
npm start
```

### Issue: Cannot read .env file

**Cause**: .env file not created

**Solution**:
```bash
cp .env.example .env
# Edit .env with your values
```

---

## Database Issues

### Issue: "connect ECONNREFUSED 127.0.0.1:5432"

**Cause**: PostgreSQL not running or wrong connection string

**Solution**:
1. Check DATABASE_URL in .env
2. For Neon: Use full PostgreSQL URL from Neon dashboard
3. For local: Start PostgreSQL service
   ```bash
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

### Issue: "password authentication failed"

**Cause**: Wrong database credentials in DATABASE_URL

**Solution**:
1. Verify credentials in .env
2. Format: `postgresql://user:password@host:port/database`
3. Check for special characters (URL encode if needed)

### Issue: "relation does not exist"

**Cause**: Database schema not initialized

**Solution**:
```bash
# Restart server - it will auto-initialize
npm start
```

If schema still fails:
1. Check database has write permissions
2. Verify PostgreSQL version (9.5+)
3. Check server logs for SQL errors

### Issue: Database grows too large

**Cause**: Too much data accumulated

**Solution**:
1. Set up automatic backups
2. Archive old chat posts:
   ```sql
   DELETE FROM chat_posts WHERE expires_at < NOW() - INTERVAL '30 days';
   ```

---

## Telegram Bot Issues

### Issue: Bot doesn't respond to /start

**Cause**: BOT_TOKEN invalid or polling disabled

**Solution**:
1. Verify BOT_TOKEN in .env (should start with numbers)
2. Check bot is created via @BotFather
3. Restart server:
   ```bash
   npm start
   ```

### Issue: "getMe() failed" error in logs

**Cause**: Invalid BOT_TOKEN format

**Solution**:
```bash
# Get new token from @BotFather
# Format: 123456789:ABCDEFGHijklmnop...

# Update .env
BOT_TOKEN=your_new_token

# Restart
npm start
```

### Issue: Bot sends old messages after restart

**Cause**: Polling mode caches messages

**Solution**:
- This is normal behavior
- All messages will be processed once
- Consider webhook mode for production (setup in next version)

### Issue: Notifications not sent

**Cause**: Bot not polling or user blocked bot

**Solution**:
1. Check bot is running
2. Verify user didn't block bot
3. Check logs for errors
4. Try sending message directly to bot

---

## MiniApp Issues

### Issue: MiniApp doesn't load

**Cause**: WEBAPP_URL incorrect or server down

**Solution**:
1. Check WEBAPP_URL in .env matches Railway domain
2. Verify server is running:
   ```bash
   curl https://your-railway-app.up.railway.app/health
   ```
3. Check browser console (F12) for errors
4. Clear browser cache

### Issue: "Error: Failed to fetch"

**Cause**: API endpoint error or wrong URL

**Solution**:
1. Check server logs
2. Verify API endpoints in routes/api.js
3. Check X-Init-Data header is sent
4. Test endpoint with curl:
   ```bash
   curl http://localhost:8080/api/profile \
     -H "X-Init-Data: ..."
   ```

### Issue: "Invalid init data"

**Cause**: WebApp initData not valid

**Solution**:
1. Only happens in browser (not in Telegram)
2. Open MiniApp from Telegram bot, not direct URL
3. Verify bot is configured correctly

### Issue: Form submissions not working

**Cause**: API errors or validation

**Solution**:
1. Check browser console for errors
2. Check server logs
3. Verify form data format
4. Check rating/permissions

### Issue: Buttons unresponsive

**Cause**: JavaScript error or network issue

**Solution**:
1. Open browser console (F12)
2. Look for red errors
3. Check network tab (XHR/Fetch requests)
4. Restart MiniApp

---

## Railway Deployment Issues

### Issue: "Build failed"

**Cause**: Missing files or build errors

**Solution**:
1. Check all files committed to git
2. Verify package.json exists
3. Check Node.js version compatibility
4. View Railway deployment logs

### Issue: "Service crashing after deploy"

**Cause**: Missing environment variables or database error

**Solution**:
1. Go to Railway dashboard
2. Check "Variables" tab - all required vars set?
3. Check "Logs" for error messages
4. Verify DATABASE_URL is correct

### Issue: App works locally but not on Railway

**Cause**: Environment variable differences

**Solution**:
1. Verify all variables copied to Railway
2. Check `NODE_ENV=production` is set
3. Verify DATABASE_URL works:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
4. Check Railway PostgreSQL is healthy

### Issue: "Cannot find module" on Railway

**Cause**: Dependencies not installed

**Solution**:
1. Ensure package.json has all dependencies
2. Remove package-lock.json locally and regenerate:
   ```bash
   rm package-lock.json
   npm install
   git add package-lock.json
   ```
3. Push changes to Railway

### Issue: WEBAPP_URL points to old domain

**Cause**: Railway domain changed

**Solution**:
1. Get new Railway domain from dashboard
2. Update WEBAPP_URL variable
3. Wait 1-2 minutes for restart
4. Test MiniApp again

---

## API Issues

### Issue: 401 - Invalid init data

**Cause**: Missing or invalid X-Init-Data header

**Solution**:
1. Only call API from MiniApp (has initData)
2. Verify Telegram WebApp SDK loaded
3. Check header is sent:
   ```javascript
   headers: {
     'X-Init-Data': window.Telegram?.WebApp?.initData || ''
   }
   ```

### Issue: 403 - You must be an administrator

**Cause**: User not admin of channel

**Solution**:
1. Make user admin of the Telegram channel
2. Try adding channel again

### Issue: 404 - Channel not found

**Cause**: Bot cannot access channel

**Solution**:
1. Verify bot is admin of channel
2. Check channel is not private
3. Verify channel link format
4. Try different channel

### Issue: 429 - Rate limited

**Cause**: Too many requests or daily limit exceeded

**Solution**:
1. For chat posts: Wait 24 hours
2. For re-posts: Wait 1 hour
3. Implement client-side rate limiting
4. Show cooldown timer to user

---

## Performance Issues

### Issue: Slow database queries

**Cause**: Missing indexes or large dataset

**Solution**:
1. Check indexes exist in schema
2. Monitor slow query log:
   ```sql
   SET log_min_duration_statement = 1000; -- Log queries > 1s
   ```
3. Optimize N+1 queries in code

### Issue: Memory leak in bot

**Cause**: Event listeners not cleaned up

**Solution**:
1. Restart bot regularly:
   ```bash
   # Railway: Set restart policy
   ```
2. Monitor memory usage in logs

### Issue: Many pending database connections

**Cause**: Connection pool misconfigured

**Solution**:
```javascript
// In db/pool.js, adjust max connections:
const pool = new Pool({
  max: 20, // Reduce from default
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

---

## Telegram API Issues

### Issue: "getChat() failed"

**Cause**: Channel ID invalid or bot doesn't have access

**Solution**:
1. Verify channel exists
2. Add bot as admin to channel
3. Check channel is not private

### Issue: "getChatMember() failed"

**Cause**: User not in channel or bot can't check

**Solution**:
1. Verify user subscribed to channel
2. Check bot is admin
3. Try different channel

### Issue: Rate limited by Telegram API

**Cause**: Too many requests to Telegram API

**Solution**:
1. Implement exponential backoff in utils/telegram.js
2. Cache user membership checks
3. Add request throttling

---

## Debug Mode

Enable detailed logging:

```bash
# Set environment variable
DEBUG=* npm start

# Or in code
process.env.DEBUG = 'express:*,bot:*';
```

Check logs:
```bash
# View server logs
npm start 2>&1 | tee app.log

# View Railway logs
railway logs -f

# View database logs
tail -f /var/log/postgresql/postgresql.log
```

---

## Getting Help

1. **Check logs**:
   - Local: `npm start` output
   - Railway: Logs tab in dashboard
   - Database: PostgreSQL error logs

2. **Check this guide**: Search for your error message

3. **Check documentation**:
   - README.md - Setup
   - DEPLOYMENT.md - Railway
   - API_REFERENCE.md - API
   - PROJECT_SUMMARY.md - Overview

4. **Resources**:
   - Telegram Bot API: https://core.telegram.org/bots/api
   - Railway Support: https://railway.app/support
   - PostgreSQL Docs: https://www.postgresql.org/docs/
   - Node.js Docs: https://nodejs.org/docs/

5. **Report Issues**:
   - Create detailed error report with:
     - Exact error message
     - Steps to reproduce
     - Environment (local/Railway)
     - Log output
     - Relevant code

---

## Emergency Fixes

### Quick restart (if stuck)
```bash
# Local
Ctrl+C
npm start

# Railway
Click "Restart" in Railway dashboard
```

### Reset database (removes all data)
```bash
# WARNING: This deletes everything
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then restart (schema auto-initializes)
npm start
```

### Rollback Railway deployment
1. Go to Railway dashboard
2. Click "Deployments"
3. Find previous good version
4. Click "Redeploy"

---

**Still having issues?** Check the logs first, then compare with this guide. If unresolved, create a detailed issue report.
