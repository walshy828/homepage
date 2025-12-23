# PWA (Progressive Web App) Setup Guide

Your Homepage Dashboard is now configured as a Progressive Web App! This allows users to install it on their devices and use it offline.

## What's been configured:

### 1. **Web App Manifest** (`manifest.json`)
- App name, description, and branding
- Icon sizes for all devices (72px to 512px)
- Theme colors (indigo #6366f1)
- Display mode: standalone (hides browser UI)
- App shortcuts for quick actions

### 2. **Service Worker** (`sw.js`)
- Caches static assets for offline use
- Cache-first strategy for app shell
- Network-first for API calls
- Automatic updates when new version is available

### 3. **App Icons**
Generated icons in the `/icons` directory:
- 72x72, 96x96, 128x128, 144x144 (mobile)
- 152x152, 192x192 (Apple devices)
- 384x384, 512x512 (high-res displays)

### 4. **HTML Meta Tags**
- PWA manifest link
- Theme color for mobile browsers
- Apple mobile web app tags
- Microsoft tile configurations

## Testing Your PWA

### Local Testing:
1. **Serve via HTTPS or localhost**
   - PWAs require HTTPS (localhost is exempt)
   - Your app should already be running on localhost

2. **Chrome DevTools**
   ```
   - Open Chrome DevTools (F12)
   - Go to "Application" tab
   - Check "Manifest" section - should show all icons and metadata
   - Check "Service Workers" - should show registered worker
   - Use "Lighthouse" tab to audit PWA score
   ```

3. **Install on Desktop (Chrome/Edge)**
   - Look for install icon in address bar (⊕ or computer icon)
   - Click "Install Homepage Dashboard"
   - App opens in standalone window

4. **Install on Mobile**
   - **iOS (Safari)**: Tap Share → "Add to Home Screen"
   - **Android (Chrome)**: Tap menu → "Add to Home Screen" or "Install App"

## PWA Features Enabled

✅ **Installable** - Can be installed on home screen  
✅ **Offline Support** - Caches static assets for offline use  
✅ **App-like Experience** - Runs in standalone window  
✅ **Fast Loading** - Cached resources load instantly  
✅ **Auto-Updates** - Service worker updates when deployedmultiple times  
✅ **Cross-Platform** - Works on iOS, Android, Desktop  
✅ **App Shortcuts** - Quick access to "Add Link" and "Add Note"

## Customization

### Update Icons:
Replace files in `/icons/` directory with your own branding.

### Change Theme Color:
Edit `manifest.json`:
```json
"theme_color": "#6366f1",  // Your brand color
"background_color": "#0f172a"  // Splash screen color
```

Also update in `index.html`:
```html
<meta name="theme-color" content="#6366f1">
```

### Modify Cache Strategy:
Edit `sw.js` to change what's cached:
```javascript
const urlsToCache = [
  '/',
  '/index.html',
  // Add more files to cache
];
```

### Add More Shortcuts:
Edit `manifest.json` → `shortcuts` array:
```json
{
  "name": "View Dashboard",
  "url": "/#dashboard",
  "icons": [...]
}
```

## Deployment Notes

### Production Checklist:
- [ ] Serve app over HTTPS
- [ ] Update `start_url` in manifest if not at root
- [ ] Test on multiple devices/browsers
- [ ] Monitor service worker updates
- [ ] Set appropriate cache expiration

### Backend Configuration:
Ensure your backend serves the PWA files correctly:

#### Flask/FastAPI:
```python
# Serve manifest with correct MIME type
@app.get("/manifest.json")
async def manifest():
    return FileResponse("frontend/manifest.json", media_type="application/manifest+json")

# Serve service worker from root
@app.get("/sw.js")
async def service_worker():
    return FileResponse("frontend/sw.js", media_type="application/javascript")
```

#### Static File Headers:
```python
# Set Cache-Control for service worker (short cache)
response.headers["Cache-Control"] = "max-age=0, no-cache, no-store, must-revalidate"
```

## Troubleshooting

### Service Worker Not Registering:
- Check browser console for errors
- Ensure HTTPS or localhost
- Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)

### Icons Not Showing:
- Verify icon paths in manifest.json
- Check that files exist in `/icons/` directory
- Ensure correct MIME types served

### Not Installable:
- Run Lighthouse PWA audit in Chrome DevTools
- Check all PWA criteria are met
- Ensure manifest is properly linked in HTML

### Cache Issues:
- Increment `CACHE_NAME` version in `sw.js`
- Use "Clear storage" in Chrome DevTools → Application tab
- Unregister old service worker

## Advanced Features (Future Enhancements)

Consider adding:
- **Push Notifications**: Notify users of updates
- **Background Sync**: Sync data when connection restored  
- **Share Target**: Allow sharing links to your app
- **Periodic Background Sync**: Fetch new content in background
- **Web Share API**: Share content from your app

## Resources

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Workbox](https://developers.google.com/web/tools/workbox) - Advanced caching library

---

**Your app is now a PWA! 🎉**

Users can install it just like a native app and use core features offline.
