# Story 001: Settings modal not scrollable on small screens

**Epic:** UX & Responsiveness
**Status:** Done
**Priority:** High

## Problem

On smaller screens (e.g. remote desktop, tablets, zoomed-in browsers), the settings modal extends beyond the viewport. Users cannot scroll to reach the API key input, save button, or other settings — forcing them to zoom out in the browser.

## Root cause

The `.modal` CSS class had no `max-height` or `overflow-y`, so the modal content overflowed the viewport without any scroll capability.

## Solution

- Added `max-height: calc(100vh - 2rem)` and `overflow-y: auto` to `.modal`
- Added dark-themed scrollbar styling (`::-webkit-scrollbar`)

## Files changed

- `static/style.css` — modal scroll + scrollbar styling
