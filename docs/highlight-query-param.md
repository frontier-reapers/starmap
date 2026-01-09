# Plan: Add highlight query parameter with blue dots and dimming

Add a `?highlight=SystemName1,SystemName2,98000001` query parameter that displays large blue dots on specified systems while dimming all other stars by 50%. This feature will use the existing sprite infrastructure (like the hover glow) and integrate seamlessly with the current query parameter and rendering pipeline.

## Steps

1. **Parse highlight parameter on load** — After the existing `focusParam` parsing (line 1361), extract the `highlight` parameter, split by commas, and store system names/IDs in a `highlightedSystems` Set. Handle both initial page load and browser back/forward navigation via the existing `popstate` handler.

2. **Create highlight ring sprite infrastructure** — Build a dedicated ring sprite function that creates a **bright blue ring** approximately 2x the size of the base glow sprite. This will be a separate canvas texture with a blue radial gradient forming a ring outline rather than a filled circle. Store them in a `highlightSprites` array and position each at the correct `(x, y, z)` coordinate of highlighted systems. The ring should render with additive blending for consistent appearance.

3. **Implement system lookup utility** — Create a helper function to resolve system names or IDs to their data indices (similar to `focusOnSystem` logic, lines 1303–1325). This will map each highlight parameter value to the actual system position in the `data.positions` array.

4. **Add dimming logic for non-highlighted stars** — Modify the opacity of all three star category materials (regular, stations, black holes) when highlights are active. Reduce from `1.0` to `0.5` for all `starPoints.children[i].material.opacity`. Create a `restoreStarOpacity()` function to reset to `1.0` when highlights are cleared. When changing between 1.0 and 0.5 opacity, ensure smooth transitions without flickering over about 0.5s.

5. **Integrate highlight activation function** — Create `applyHighlights(systemList)` function that: (a) clears existing highlight sprites, (b) resolves each system name/ID, (c) creates and positions blue sprites, (d) dims non-highlighted stars, and (e) stores the highlighted system indices. Also add `clearHighlights()` to remove sprites and restore opacity.

6. **Wire up popstate navigation** — Update the existing `popstate` handler (line 1368) to detect `?highlight` parameter changes and call `applyHighlights()` or `clearHighlights()` as needed, ensuring browser back/forward properly manages highlight state.

## Further Considerations

1. **Highlight color choice** — Use a bright cyan/blue (e.g., `0x00d4ff` or `0x00aaff`) distinct from orange (focus/hover) and red (stations). Verify the glow effect renders clearly with additive blending. Option: test if a slightly larger, pulsing animation enhances visibility without distraction.

2. **CSS labels for highlighted systems** — Create small persistent labels (approximately 50% the size of standard labels) in cyan color without borders for each highlighted system. These should use CSS2DObject positioning like the existing hover and route labels. Create a `.label.highlighted` CSS class with cyan text (`#00d4ff`), reduced font size, and no background/border (transparent). Position labels above highlighted sprites.

3. **Highlight syncs with focus changes only** — Highlights are updated only when the focus changes (via `focusOnSystem()` or URL focus parameter). When a system is focused, it becomes the sole highlighted system. The `?highlight` parameter is not independently updated in the URL—instead, highlights follow the focus. This keeps the implementation simple and ties the feature to existing focus functionality.

4. **Performance with many highlights** — Dimming is done via material opacity (fast), and blue sprites are added per-highlight. Testing with 100+ highlights recommended to ensure smooth performance with the existing three-category star geometry.

## A note about Focus

Focus is a separate feature that centers the view on a single system and highlights it with an orange glow. The highlight query parameter is intended to allow multiple systems to be highlighted simultaneously with blue dots, while focus remains a single-system feature. When a system is focused, it will override the highlight parameter to ensure clarity in user interaction.
