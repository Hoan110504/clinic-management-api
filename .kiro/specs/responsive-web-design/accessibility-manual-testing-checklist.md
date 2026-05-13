# Accessibility Manual Testing Checklist

**Task**: 22 - Accessibility compliance verification  
**Date**: 2024  
**Tester**: _____________  
**Browser**: _____________  
**Version**: _____________

## Overview

This checklist helps verify WCAG 2.1 AA compliance across all breakpoints for the responsive web design implementation. Complete this checklist for each target browser and device.

---

## Test Environment Setup

### Browsers to Test
- [ ] Chrome/Edge (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (macOS)
- [ ] Safari (iOS - iPhone)
- [ ] Safari (iOS - iPad)

### Viewport Sizes to Test
- [ ] Mobile: 375px width (iPhone)
- [ ] Mobile: 320px width (iPhone SE)
- [ ] Tablet: 768px width (iPad portrait)
- [ ] Tablet: 1024px width (iPad landscape)
- [ ] Desktop: 1280px width (laptop)
- [ ] Desktop: 1920px width (desktop)

---

## Task 22.1: Semantic HTML Verification

### Heading Hierarchy
- [ ] Page has exactly one `<h1>` element
- [ ] Heading levels are not skipped (h1 → h2 → h3, not h1 → h3)
- [ ] Heading hierarchy is maintained when text abbreviates on mobile
- [ ] Logo text changes from "Phòng Khám Nội" to "PKN" on mobile but remains `<h1>`

### Landmark Regions
- [ ] `<header>` element is present and contains site header
- [ ] `<aside>` element is present for sidebar navigation
- [ ] `<nav>` element is present inside sidebar
- [ ] `<main>` element is present for main content area
- [ ] Landmarks are present at all breakpoints (mobile, tablet, desktop)

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Task 22.2: Focus Indicators Testing

### Visual Focus Indicators
- [ ] Focus ring is visible on menu toggle button (Tab to it)
- [ ] Focus ring is visible on all navigation menu items
- [ ] Focus ring is visible on user menu button
- [ ] Focus ring is visible on all dropdown menu items
- [ ] Focus ring is visible on all form inputs
- [ ] Focus ring is visible on all buttons
- [ ] Focus ring is visible on all links
- [ ] Focus ring color is blue (#3b82f6) with 2px width
- [ ] Focus ring has 2px offset from element

### Keyboard Navigation - Mobile (375px)
- [ ] Tab key moves focus through interactive elements in logical order
- [ ] Shift+Tab moves focus backward
- [ ] Enter/Space activates menu toggle button
- [ ] Enter/Space opens user menu dropdown
- [ ] Arrow keys navigate through dropdown menu items
- [ ] Escape key closes dropdown menus
- [ ] No keyboard traps (can Tab out of all components)
- [ ] Focus order follows visual layout

### Keyboard Navigation - Tablet (768px)
- [ ] All keyboard navigation works as on mobile
- [ ] Sidebar navigation is keyboard accessible
- [ ] Focus order is logical with sidebar visible

### Keyboard Navigation - Desktop (1280px)
- [ ] All keyboard navigation works as on tablet
- [ ] Focus indicators remain visible on hover-capable devices
- [ ] Keyboard and mouse interactions don't conflict

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Task 22.3: ARIA Attributes Verification

### Mobile Menu Toggle Button
- [ ] Has `aria-label` that describes action ("Mở menu" or "Đóng menu")
- [ ] Has `aria-expanded` attribute (true when open, false when closed)
- [ ] Has `aria-controls` pointing to "main-navigation" or "patient-navigation"
- [ ] `aria-label` updates when sidebar state changes
- [ ] `aria-expanded` updates when sidebar state changes

### Backdrop Overlay (Mobile Only)
- [ ] Backdrop has `aria-hidden="true"` attribute
- [ ] Backdrop is not announced by screen reader
- [ ] Backdrop is only present on mobile viewports (< 768px)

### Navigation Sidebar
- [ ] Sidebar has `id` attribute ("main-navigation" or "patient-navigation")
- [ ] Sidebar has `aria-label` describing purpose
- [ ] `<nav>` element inside sidebar has `aria-label`
- [ ] ARIA labels are in Vietnamese and descriptive

### User Menu Dropdown
- [ ] Toggle button has `aria-expanded` (true when open, false when closed)
- [ ] Toggle button has `aria-haspopup="true"`
- [ ] Toggle button has `aria-label="Menu người dùng"`
- [ ] Dropdown container has `role="menu"`
- [ ] Dropdown container has `aria-label`
- [ ] Each menu item has `role="menuitem"`
- [ ] ARIA attributes update when dropdown opens/closes

### Screen Reader Testing (Optional but Recommended)
Screen Reader: _____________ (NVDA, JAWS, VoiceOver, etc.)

- [ ] Menu toggle button is announced with correct label
- [ ] Sidebar state changes are announced
- [ ] Navigation items are announced correctly
- [ ] User menu items are announced correctly
- [ ] Backdrop is not announced (aria-hidden works)
- [ ] Focus changes are announced
- [ ] Page structure (landmarks) is navigable

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Task 22.4: Color Contrast Verification

### Text Color Combinations
Test with browser DevTools or contrast checker tool:

- [ ] Body text (text-gray-700 on white): Contrast ≥ 4.5:1
- [ ] Secondary text (text-gray-500 on white): Contrast ≥ 4.5:1
- [ ] Link text (text-blue-600 on white): Contrast ≥ 4.5:1
- [ ] Error text (text-red-600 on white): Contrast ≥ 4.5:1
- [ ] Active menu item (text-blue-600 on bg-blue-50): Contrast ≥ 4.5:1
- [ ] Submenu items (various colors on light backgrounds): Contrast ≥ 4.5:1

### Focus Indicators
- [ ] Focus ring (blue-600 #3b82f6 on white): Contrast ≥ 3:1
- [ ] Focus ring is visible on all backgrounds used in the app

### Automated Testing Tools
Run one or more of these tools:

- [ ] **Chrome Lighthouse**: Accessibility score ≥ 90
  - Open DevTools → Lighthouse → Run accessibility audit
  - Screenshot or note score: _______

- [ ] **axe DevTools**: No critical or serious issues
  - Install browser extension
  - Run scan on each page type
  - Issues found: _______

- [ ] **WAVE**: No contrast errors
  - Visit https://wave.webaim.org/
  - Enter site URL
  - Issues found: _______

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Responsive Behavior Testing

### Mobile (375px)
- [ ] Sidebar slides in from left when menu opened
- [ ] Backdrop appears behind sidebar
- [ ] Clicking backdrop closes sidebar
- [ ] User info hidden, only avatar shown
- [ ] Logo abbreviated to "PKN"
- [ ] All interactive elements ≥ 44x44px
- [ ] No horizontal scroll
- [ ] Touch targets have adequate spacing (≥ 8px)

### Tablet (768px)
- [ ] Sidebar behavior transitions correctly
- [ ] User info becomes visible
- [ ] Full logo text shown
- [ ] Layout adapts smoothly

### Desktop (1280px)
- [ ] Sidebar visible by default
- [ ] All elements properly spaced
- [ ] Content uses available space effectively

### Orientation Changes
- [ ] Portrait to landscape: Layout adapts correctly
- [ ] Landscape to portrait: Layout adapts correctly
- [ ] No content loss during orientation change
- [ ] Focus is maintained during orientation change

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Cross-Browser Compatibility

### Chrome/Edge (Chromium)
Version: _______
- [ ] All accessibility features work
- [ ] Focus indicators visible
- [ ] ARIA attributes recognized
- [ ] Keyboard navigation works
- [ ] No console errors

### Firefox
Version: _______
- [ ] All accessibility features work
- [ ] Focus indicators visible
- [ ] ARIA attributes recognized
- [ ] Keyboard navigation works
- [ ] No console errors

### Safari (macOS)
Version: _______
- [ ] All accessibility features work
- [ ] Focus indicators visible
- [ ] ARIA attributes recognized
- [ ] Keyboard navigation works
- [ ] No console errors

### Safari (iOS - iPhone)
iOS Version: _______
- [ ] Touch interactions work correctly
- [ ] VoiceOver announces elements correctly (if tested)
- [ ] Focus indicators visible when using external keyboard
- [ ] No layout issues

### Safari (iOS - iPad)
iOS Version: _______
- [ ] Touch interactions work correctly
- [ ] VoiceOver announces elements correctly (if tested)
- [ ] Focus indicators visible when using external keyboard
- [ ] Orientation changes work correctly

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## Issues Found

### Critical Issues (Must Fix)
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

### Minor Issues (Should Fix)
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

### Observations (Nice to Have)
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

---

## Overall Assessment

### Compliance Status
- [ ] **PASS**: All WCAG 2.1 AA requirements met
- [ ] **PASS WITH ISSUES**: Minor issues found but overall compliant
- [ ] **FAIL**: Critical accessibility issues found

### Recommendations
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Sign-off
- **Tester Name**: _______________________
- **Date**: _______________________
- **Signature**: _______________________

---

## Automated Test Results

### Vitest Accessibility Tests
```bash
npm test accessibility.test.jsx
```

**Result**: ☐ PASS ☐ FAIL  
**Tests Passed**: _____ / 24  
**Date**: _______

### Notes
```
_________________________________________________________________
_________________________________________________________________
```

---

## Reference

### WCAG 2.1 AA Requirements Tested
- **1.3.1 Info and Relationships (Level A)**: Semantic HTML structure
- **2.1.1 Keyboard (Level A)**: Keyboard navigation functionality
- **2.4.3 Focus Order (Level A)**: Logical focus order
- **2.4.7 Focus Visible (Level AA)**: Visible focus indicators
- **1.4.3 Contrast (Minimum) (Level AA)**: 4.5:1 contrast ratio for text
- **4.1.2 Name, Role, Value (Level A)**: ARIA attributes for dynamic content

### Tools Used
- Browser DevTools (Lighthouse, Accessibility Inspector)
- axe DevTools browser extension
- WAVE Web Accessibility Evaluation Tool
- Screen reader (if available)
- Keyboard-only navigation

### Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
