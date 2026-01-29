# Home Page Improvements Design

**Date:** 2025-01-17
**Status:** Design Approved
**Related Issues:** Home page UI/UX improvements

## Overview

This document outlines the design for five home page improvements:
1. Light mode styling (currently only dark mode exists)
2. MP4 online playback for recordings
3. Filter expired meetings from "upcoming meetings" list
4. Recording format settings in settings page
5. Merge settings page with user profile (avatar click opens modal)

---

## 1. Theme System (Light/Dark Mode)

### Current State
- `src/styles/index.css` has CSS variables with dark mode via `@media (prefers-color-scheme: dark)`
- `src/pages/Home.module.css` uses hardcoded dark colors that bypass CSS variables
- No theme switcher component exists

### Proposed Solution

#### Theme Context Provider
Create `src/contexts/ThemeContext.tsx`:
- Manages theme state: `'light' | 'dark' | 'system'`
- Persists to localStorage (`theme` key)
- Applies `data-theme` attribute to `<html>` element
- Reacts to system preference changes when in 'system' mode

#### CSS Variable Overhaul
Update styles to use semantic theme variables:
- Define separate light/dark theme variable sets
- Replace hardcoded colors in `.module.css` files with `var(--theme-*)` variables
- Keep gradient backgrounds but make them theme-aware

#### Theme Selector Component
Add to settings modal with:
- Three options: Light, Dark, System (follows OS preference)
- Visual preview of each theme option
- Radio button or card-based selection

#### Key Files to Modify
| File | Action |
|------|--------|
| `src/contexts/ThemeContext.tsx` | New file - theme provider |
| `src/styles/index.css` | Add `[data-theme="light"]` selectors |
| `src/pages/Home.module.css` | Replace hardcoded colors |
| `src/App.tsx` | Wrap with ThemeProvider |
| `src/components/user/SettingsTab.tsx` | Add theme selector |

---

## 2. MP4 Online Playback

### Current State
- `Recordings.tsx` already has a video player overlay using HTML5 `<video>` element (lines 265-289)
- HTML5 video natively supports MP4 playback in all modern browsers

### Proposed Solution

**Status:** Infrastructure already exists. Only verification needed:

1. Verify API returns proper MP4 URLs
2. Ensure CORS headers are configured
3. Optional enhancements:
   - Add loading state while video buffers
   - Add error handling for unsupported formats
   - Show file size/duration info before playback

#### Key Files to Check
| File | Action |
|------|--------|
| `Recordings.tsx` | Verify/Enhance error handling |
| Backend API | Verify MP4 URL format and CORS |

---

## 3. Expired Meeting Filtering

### Current State
- `Home.tsx` lines 669-677 show all meetings without time filtering:
  ```tsx
  const allMeetings = [...ongoingMeetings, ...scheduledMeetings];
  ```
- Scheduled meetings that have passed still appear in "upcoming meetings"

### Proposed Solution

#### Filter Logic
Add time-based filtering for scheduled meetings:
```tsx
const now = new Date();
const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

const upcomingMeetings = scheduledMeetings.filter(meeting => {
    if (!meeting.startTime) return true;
    const meetingTime = new Date(meeting.startTime);
    return meetingTime.getTime() > now.getTime() - GRACE_PERIOD_MS;
});
const allMeetings = [...ongoingMeetings, ...upcomingMeetings];
```

#### Grace Period
- 15-minute buffer allows meetings that just started to remain visible
- Prevents meetings from disappearing exactly at start time

#### Key Files to Modify
| File | Action |
|------|--------|
| `src/pages/Home.tsx` | Add filter logic around line 669 |
| `src/services/meetingApi.ts` | Consider adding filter option |

---

## 4. Recording Format Settings

### Current State
- No recording format preference setting exists
- Recording format is controlled server-side
- RecordingControl uses `useRecording` hook

### Proposed Solution

#### User Settings Storage
- Add `recordingFormat` to localStorage/user settings
- Default value: `'mp4'`
- Simple format: MP4 only (as per user preference)

#### Settings Modal Enhancement
Add "Recording" section in settings modal:
- Label: "Recording Format"
- Description: "MP4 format for all recordings"
- Radio button or dropdown for format selection (currently single option)

#### Meeting Room Integration
- Modify `useRecording` hook to read user's format preference
- Pass format parameter to recording API calls
- Update `RecordingControl` to display current format

#### Key Files to Modify
| File | Action |
|------|--------|
| `src/hooks/useRecording.ts` | Read format preference |
| `src/components/user/SettingsTab.tsx` | Add format setting |
| `src/components/meeting/RecordingControl.tsx` | Show format |
| Backend API | Accept format parameter |

---

## 5. User Profile + Settings Modal

### Current State
- Settings is a separate page (`/settings` route)
- User avatar in sidebar only has logout button
- No profile editing capability exists

### Proposed Solution

#### Unified Settings Modal
Replace settings page with tabbed modal:
- Triggered by clicking user avatar in sidebar
- Three tabs: **Profile**, **Settings**, **Devices**

#### Tab Contents

**Profile Tab:**
- User info display (username, email)
- Avatar display with initial
- Logout button

**Settings Tab:**
- Theme selector (Light/Dark/System)
- Language selection (existing)
- Recording format (new)

**Devices Tab:**
- Microphone selection (existing)
- Camera selection (existing)
- Speaker selection (existing)

#### Modal Structure
```tsx
<UserSettingsModal
  isOpen={showSettings}
  onClose={() => setShowSettings(false)}
  defaultTab="settings"
/>
```

#### Home.tsx Changes
- Remove "Settings" from sidebar navigation
- Make user avatar clickable to open modal
- Keep logout functionality in modal

#### Key Files to Modify
| File | Action |
|------|--------|
| `src/components/user/UserSettingsModal.tsx` | New - unified modal |
| `src/components/user/ProfileTab.tsx` | New - profile section |
| `src/components/user/SettingsTab.tsx` | New - settings section |
| `src/components/user/DevicesTab.tsx` | New - device settings |
| `src/pages/Home.tsx` | Avatar click handler |
| `src/pages/Settings.tsx` | Delete (no longer needed) |

---

## Implementation Order

Recommended sequence for implementation:

1. **Theme System** - Foundation for UI changes
   - Create ThemeContext
   - Update CSS variables
   - Build ThemeSelector component

2. **UserSettingsModal** - Unifies settings + profile
   - Create modal component with tabs
   - Migrate existing settings content
   - Update Home.tsx avatar click handler

3. **Recording Format Setting** - Add to settings tab
   - Create settings storage hook
   - Add format selector to Settings tab
   - Integrate with useRecording hook

4. **Expired Meeting Filtering** - Quick fix
   - Add time-based filter to Home.tsx

5. **MP4 Playback Verification** - Confirm existing
   - Test MP4 URLs work correctly
   - Add error handling if needed

---

## Data Flow

### Theme State
```
ThemeContext (localStorage)
    ↓
HTML data-theme attribute
    ↓
CSS variables (:root vs [data-theme="light"])
    ↓
All components using var(--theme-*)
```

### Recording Format Preference
```
SettingsTab (user selection)
    ↓
localStorage (recordingFormat: 'mp4')
    ↓
useRecording hook (reads on mount)
    ↓
Recording API call (includes format)
```

### Settings Modal Trigger
```
User clicks avatar
    ↓
showSettings state = true
    ↓
UserSettingsModal opens
    ↓
Tabs: Profile | Settings | Devices
```

---

## Technical Considerations

### CSS Variables Migration
- Home.module.css has ~1500 lines with hardcoded dark colors
- Need to create mapping of current colors to theme variables
- Gradient backgrounds may need separate handling

### localStorage Key Namespacing
- Use prefix to avoid conflicts: `zhihui_`
- Keys: `zhihui_theme`, `zhihui_recordingFormat`

### Browser Compatibility
- CSS variables: IE11+ (not a concern for modern app)
- localStorage: Widely supported
- data-theme attribute: All browsers

---

## Testing Checklist

- [ ] Light mode displays correctly across all pages
- [ ] Dark mode displays correctly across all pages
- [ ] Theme preference persists across sessions
- [ ] Theme switching works without page reload
- [ ] Settings modal opens from avatar click
- [ ] All three tabs (Profile, Settings, Devices) work
- [ ] Recording format saves and persists
- [ ] Expired meetings are filtered from upcoming list
- [ ] MP4 recordings play in browser
- [ ] Logout works from modal
