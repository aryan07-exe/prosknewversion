# ProSk Assist - Auto Apply Assistant

A professional Chrome extension for automatically filling job application forms with your profile information.

## 🎨 Features

### ✨ Professional UI
- **Red & Black Theme**: Modern, professional dark theme
- **Clean Design**: No emojis, only professional SVG icons
- **Smooth Animations**: Polished transitions and hover effects

### 🎯 Core Functionality
- **Auto-Fill Forms**: Automatically fill job application forms
- **Multiple Profiles**: Manage multiple resumes/profiles
- **Profile Selection**: Easy profile switching
- **Smart Detection**: Works across different job sites

### 📱 Draggable Panel
- **On-Page Panel**: Floating panel that appears on the job application page
- **Fully Draggable**: Move it anywhere on the screen
- **Persistent Position**: Remembers where you placed it
- **Non-Intrusive**: Only closes when you click the close button

### 🔐 Secure Authentication
- **Token-Based Auth**: Secure sign-in system
- **Local Storage**: Your data stays on your device
- **Auto Sign-Out Detection**: Smart state management

## 📦 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the extension folder

## 🚀 Usage

### First Time Setup
1. Click the extension icon in your browser toolbar
2. Click the lock icon to sign in
3. Enter your credentials
4. Your profiles will be loaded automatically

### Using the Extension

#### Method 1: Direct Auto-Fill
1. Navigate to a job application page
2. Click the extension icon
3. Select your profile (if not already selected)
4. Click "Auto-Fill this page"

#### Method 2: Using the Panel
1. Navigate to a job application page
2. Click the extension icon
3. Click "Open Panel on Page"
4. Drag the panel to your preferred position
5. Click "Auto-Fill Form" in the panel

### Managing Profiles
1. Open the extension popup
2. Go to the "Roles" tab
3. View all your profiles
4. Click "Select" on any profile to use it
5. Use the search bar to filter profiles

## 🎨 Color Scheme

```
Primary Red:    #dc2626
Secondary Red:  #ef4444
Background:     #0a0a0a
Panel:          #1a1a1a
Text:           #ffffff
Muted Text:     #a3a3a3
Border:         #262626
Success:        #10b981
Warning:        #f59e0b
```

## 📁 Project Structure

```
prosk-assist/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── panel.js              # Draggable on-page panel
├── content.js            # Content script for form filling
├── background.js         # Background service worker
├── README.md             # This file
└── UPDATES.md            # Changelog
```

## 🔧 Technical Details

- **Manifest Version**: 3
- **Minimum Chrome Version**: 118
- **Permissions**: tabs, scripting, activeTab, storage, webNavigation
- **Content Scripts**: Injected on all HTTP/HTTPS pages

## 🐛 Troubleshooting

### Panel doesn't open
- Refresh the page and try again
- Make sure you're on an HTTP/HTTPS page (not chrome:// pages)

### Auto-fill not working
- Ensure you have a profile selected
- Check that you're signed in
- Some sites may have custom form structures

### Sign-in button still visible after login
- This has been fixed in v1.2.0
- If issue persists, clear extension data and sign in again

## 📝 Changelog

### Version 1.2.0 (Current)
- ✨ New draggable on-page panel
- 🎨 Complete UI redesign with red/black theme
- 🔧 Fixed sign-in state management
- 🎯 Replaced all emojis with professional SVG icons
- 💅 Enhanced toast notifications
- 📱 Improved responsive design

### Version 1.1.0
- Initial release with basic auto-fill functionality

## 🤝 Contributing

This is a private project. For issues or suggestions, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 👨‍💻 Developer Notes

### Building
No build process required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in developer mode
2. Navigate to a test job application site
3. Test all features:
   - Sign in/out
   - Profile selection
   - Auto-fill
   - Panel dragging
   - Toast notifications

### Debugging
- Check browser console for errors
- Use Chrome DevTools on the popup (right-click popup → Inspect)
- Check background service worker logs in `chrome://extensions`

---

**ProSk Assist** - Making job applications easier, one form at a time. 🚀
