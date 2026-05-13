# Mobile Breakpoint Testing Report

**Date**: May 13, 2026  
**Tester**: Manual Testing Session  
**Dev Server**: http://localhost:3000/  
**Task**: 23.1 Test at mobile breakpoints (320px, 375px, 640px)

## Testing Methodology

This report documents manual testing of the responsive web design implementation across three critical mobile breakpoints using browser DevTools device emulation.

### Test Breakpoints

| Breakpoint | Width | Device Reference | Tailwind Class |
|------------|-------|------------------|----------------|
| 320px | 320px × 568px | iPhone SE (1st gen) | Base (mobile-first) |
| 375px | 375px × 667px | iPhone 14, iPhone 13 | Base (mobile-first) |
| 640px | 640px × 1136px | Large phones | `sm:` prefix |

### Testing Checklist

For each breakpoint, verify:
- ✅ No horizontal scroll
- ✅ Touch targets meet 44×44px minimum
- ✅ Text remains readable without zoom
- ✅ Navigation works correctly
- ✅ Forms are usable
- ✅ Data tables display properly
- ✅ Modals fit within viewport
- ✅ Images maintain aspect ratio
- ✅ Adequate spacing between interactive elements

---

## Test Instructions

### Setup

1. **Open Browser DevTools**
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I`
   - Toggle device toolbar: `Ctrl+Shift+M`

2. **Navigate to**: http://localhost:3000/

3. **Login Credentials** (test with different roles):
   - Admin: Check user management, reports
   - Receptionist: Check appointments, patient registration
   - Doctor: Check examination forms, medical records
   - Pharmacist: Check inventory, prescriptions
   - Patient: Check self-service features

### Test Procedure for Each Breakpoint

#### 1. iPhone SE (320px × 568px)

**DevTools Settings**:
- Dimensions: 320 × 568
- Device Pixel Ratio: 2
- User Agent: Mobile Safari

**Pages to Test**:

##### Login Page
- [ ] Form fields are full-width and stack vertically
- [ ] Input fields have min-height 44px
- [ ] Login button is full-width and min-height 44px
- [ ] No horizontal scroll
- [ ] Logo/branding displays correctly

##### Dashboard (after login)
- [ ] Header displays correctly (hamburger menu, abbreviated logo, avatar only)
- [ ] Hamburger menu opens sidebar with backdrop overlay
- [ ] Sidebar slides in from left smoothly
- [ ] Backdrop closes sidebar when clicked
- [ ] Statistics cards stack in single column (grid-cols-1)
- [ ] Card padding is appropriate (p-4)
- [ ] Text sizes are readable (text-sm for body)
- [ ] No content overflow

##### Navigation
- [ ] Sidebar menu items have adequate touch targets (44×44px)
- [ ] Menu items have 8px spacing between them
- [ ] Active menu item is clearly indicated
- [ ] Sidebar closes properly on mobile
- [ ] User menu dropdown adjusts to full width with margins

##### Data Tables (e.g., Patients, Appointments)
- [ ] Tables switch to card view on mobile
- [ ] Cards display 2-3 priority columns
- [ ] Action buttons are in card footer
- [ ] Cards have adequate padding (p-4)
- [ ] No horizontal scroll in card view
- [ ] Touch targets for action buttons are adequate

##### Forms (e.g., Patient Registration, Appointment Booking)
- [ ] Form fields stack vertically (grid-cols-1)
- [ ] All inputs have min-height 44px
- [ ] Labels are above inputs (not side-by-side)
- [ ] Action buttons stack vertically (flex-col)
- [ ] Buttons are full-width (w-full)
- [ ] Form padding is appropriate (p-4)
- [ ] On-screen keyboard doesn't obscure inputs

##### Modals
- [ ] Modal occupies 95% width with 16px margins (inset-x-4)
- [ ] Modal header is fixed and visible
- [ ] Modal content scrolls if exceeds viewport
- [ ] Modal footer buttons stack vertically
- [ ] Close button meets 44×44px minimum
- [ ] Modal doesn't cause horizontal scroll

##### Charts (Reports page)
- [ ] Charts use ResponsiveContainer
- [ ] Chart height is 250px on mobile
- [ ] Axis labels are rotated (-45deg) to prevent overlap
- [ ] Font sizes are readable (12px)
- [ ] Legend displays correctly
- [ ] No horizontal scroll

**Critical Issues Found**:
```
[Document any issues found at 320px here]
```

---

#### 2. iPhone 14 (375px × 667px)

**DevTools Settings**:
- Dimensions: 375 × 667
- Device Pixel Ratio: 3
- User Agent: Mobile Safari

**Pages to Test**:
[Same checklist as 320px, but note any differences in behavior]

##### Key Differences from 320px
- [ ] More horizontal space allows for better spacing
- [ ] Text may be slightly more comfortable to read
- [ ] Cards may have more padding
- [ ] Forms should still stack vertically

**Critical Issues Found**:
```
[Document any issues found at 375px here]
```

---

#### 3. Large Phones (640px × 1136px)

**DevTools Settings**:
- Dimensions: 640 × 1136
- Device Pixel Ratio: 2
- User Agent: Mobile Safari

**Pages to Test**:
[Same checklist, but note `sm:` breakpoint behavior]

##### Key Differences (sm: breakpoint active)
- [ ] Header shows user name/role (not just avatar)
- [ ] Logo shows full text "Phòng Khám Nội"
- [ ] Dashboard cards may show 2 columns (sm:grid-cols-2)
- [ ] Form buttons may display inline (sm:flex-row)
- [ ] Modal buttons may display inline (sm:flex-row)
- [ ] Increased spacing (gap-4 → gap-6)
- [ ] Typography scales up (text-sm → text-base)

**Critical Issues Found**:
```
[Document any issues found at 640px here]
```

---

## Horizontal Scroll Test

For each breakpoint, perform the horizontal scroll test:

1. Navigate to each page
2. Scroll to bottom of page
3. Try to scroll horizontally (should not be possible)
4. Check DevTools console for overflow warnings
5. Inspect elements with DevTools to verify max-width constraints

**Results**:

| Page | 320px | 375px | 640px | Notes |
|------|-------|-------|-------|-------|
| Login | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| Dashboard | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| Patients List | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| Appointments | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| Patient Form | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| Reports | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |
| User Profile | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | ⬜ Pass / ❌ Fail | |

---

## Touch Target Verification

Use browser DevTools to measure interactive elements:

1. Right-click element → Inspect
2. Check computed dimensions in Styles panel
3. Verify min-width: 44px and min-height: 44px

**Sample Elements to Check**:

| Element | Location | 320px | 375px | 640px | Status |
|---------|----------|-------|-------|-------|--------|
| Hamburger menu button | Header | ⬜ | ⬜ | ⬜ | |
| Sidebar menu items | Navigation | ⬜ | ⬜ | ⬜ | |
| Form submit button | Forms | ⬜ | ⬜ | ⬜ | |
| Table action buttons | Data tables | ⬜ | ⬜ | ⬜ | |
| Modal close button | Modals | ⬜ | ⬜ | ⬜ | |
| Dropdown menu items | User menu | ⬜ | ⬜ | ⬜ | |
| Card action buttons | Dashboard | ⬜ | ⬜ | ⬜ | |

---

## Text Readability Test

Verify text remains readable without zoom:

1. Set browser zoom to 100%
2. Check that all text is legible
3. Minimum font size should be 12px
4. Body text should be 14px (text-sm) on mobile

**Results**:

| Text Type | 320px | 375px | 640px | Font Size | Status |
|-----------|-------|-------|-------|-----------|--------|
| Body text | ⬜ | ⬜ | ⬜ | 14px | |
| Headings (h1) | ⬜ | ⬜ | ⬜ | 24px | |
| Headings (h2) | ⬜ | ⬜ | ⬜ | 20px | |
| Button text | ⬜ | ⬜ | ⬜ | 14px | |
| Table/card labels | ⬜ | ⬜ | ⬜ | 12px | |
| Form labels | ⬜ | ⬜ | ⬜ | 14px | |

---

## Spacing Verification

Check spacing between interactive elements:

1. Use DevTools to measure margins between buttons
2. Verify minimum 8px spacing (touch-spacing utility)
3. Check that elements don't overlap

**Results**:

| Location | Elements | 320px | 375px | 640px | Spacing | Status |
|----------|----------|-------|-------|-------|---------|--------|
| Form buttons | Submit/Cancel | ⬜ | ⬜ | ⬜ | ≥8px | |
| Card actions | Edit/Delete | ⬜ | ⬜ | ⬜ | ≥8px | |
| Menu items | Navigation | ⬜ | ⬜ | ⬜ | ≥8px | |
| Modal buttons | Confirm/Cancel | ⬜ | ⬜ | ⬜ | ≥8px | |

---

## Summary

### Overall Results

| Breakpoint | Pass Rate | Critical Issues | Status |
|------------|-----------|-----------------|--------|
| 320px (iPhone SE) | __/__ tests | __ issues | ⬜ Pass / ❌ Fail |
| 375px (iPhone 14) | __/__ tests | __ issues | ⬜ Pass / ❌ Fail |
| 640px (Large phones) | __/__ tests | __ issues | ⬜ Pass / ❌ Fail |

### Critical Issues Summary

1. **[Issue Title]**
   - Breakpoint: 320px / 375px / 640px
   - Location: [Page/Component]
   - Description: [What's wrong]
   - Impact: High / Medium / Low
   - Fix Required: Yes / No

### Recommendations

- [ ] All critical issues resolved
- [ ] All touch targets meet 44×44px minimum
- [ ] No horizontal scroll detected
- [ ] Text is readable at all breakpoints
- [ ] Ready to proceed to tablet testing (Task 23.2)

---

## Testing Notes

**Browser Used**: Chrome/Edge DevTools Device Emulation  
**Testing Duration**: [Time spent]  
**Pages Tested**: [Number of pages]  
**Issues Found**: [Total count]  
**Issues Fixed**: [Count]  

**Next Steps**:
1. Fix any critical issues found
2. Re-test failed scenarios
3. Proceed to Task 23.2 (Tablet testing at 768px, 1024px)
