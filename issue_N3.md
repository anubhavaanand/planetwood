## File: src/main.js:764-767 (completeTutorial)

### Trigger
`completeTutorial()` at line 764 removes the tutorial marker from DOM:
```javascript
if (tutorialMarker && tutorialMarker.parentNode) {
  tutorialMarker.parentNode.removeChild(tutorialMarker);
}
```

But `tutorialMarker` is a DOM element created at line 697-698, while `markerLabel` (line 713) is the `CSS2DObject` that wraps it and is added to the Three.js scene graph at line 715: `tutorialNpc.group.add(markerLabel)`.

The code removes `tutorialMarker` from DOM but **never removes `markerLabel` from the Three.js scene graph**.

### Impact
- `CSS2DObject` remains in scene graph, attached to `tutorialNpc.group`
- Label renderer still tries to render it (though DOM element is gone)
- Memory leak: `CSS2DObject` + `tutorialNpc` group reference retained
- If tutorial runs again, new marker added without removing old

### Suggested Fix
Remove the CSS2DObject from the group:
```javascript
function completeTutorial() {
  if (tutorialMarker && tutorialMarker.parentNode) {
    tutorialMarker.parentNode.removeChild(tutorialMarker);
  }
  // Also remove the CSS2DObject from Three.js scene graph
  if (tutorialNpc && tutorialNpc.group) {
    tutorialNpc.group.traverse(child => {
      if (child.isCSS2DObject && child.element === tutorialMarker) {
        tutorialNpc.group.remove(child);
      }
    });
  }
  // Or track markerLabel directly and remove it
  // ...
}
```

Better: store `markerLabel` reference and remove it directly.

### Verdict
**Nit** — CSS2DObject leak on tutorial completion.