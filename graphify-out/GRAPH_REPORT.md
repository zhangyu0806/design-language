# Graph Report - .  (2026-07-14)

## Corpus Check
- 32 files · ~49,810 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 190 nodes · 288 edges · 21 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `startPreviewServer()` - 12 edges
2. `openStaticAsset()` - 10 edges
3. `discoverPreviewManifestSource()` - 10 edges
4. `startPreviewBrowserScenario()` - 10 edges
5. `readTag()` - 7 edges
6. `notFound()` - 6 edges
7. `verifyProcFd()` - 6 edges
8. `parsePreviewManifest()` - 6 edges
9. `send()` - 6 edges
10. `Element` - 6 edges

## Surprising Connections (you probably didn't know these)
- `parsePreviewManifest()` --calls--> `parserAccepts()`  [INFERRED]
  scripts/dl-preview-selection.mjs → tests/dl-preview-html-chrome.test.mjs
- `parseSelection()` --calls--> `storeSelection()`  [INFERRED]
  scripts/dl-preview-selection.mjs → tests/dl-preview-selection.test.mjs
- `startPreviewServer()` --calls--> `storeFactory()`  [INFERRED]
  scripts/dl-preview-server.mjs → tests/fixtures/dl-preview-signal-child.mjs
- `startPreviewServer()` --calls--> `startFixture()`  [INFERRED]
  scripts/dl-preview-server.mjs → tests/dl-preview-server.test.mjs
- `verifyProcFd()` --calls--> `open()`  [INFERRED]
  scripts/dl-preview-paths.mjs → tests/dl-preview-server.test.mjs

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (17): createPreviewLifecycle(), assertPreviewServerPlatform(), contained(), notFound(), openStaticAsset(), parsePathname(), PathError, protectedCanonicalPath() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (3): makePreviewFixture(), manifestHtml(), parserAccepts()

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (13): onChromeRunning(), onPreviewReady(), report(), assertHealthy(), assertSelectionTrace(), closeBrowserFixture(), fillAndChoose(), fixtureHtml() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (11): runInner(), watchdog(), abortChrome(), CdpError, chromePath(), createTransport(), launchChrome(), stopChrome() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (9): validSelection(), createSelectionStore(), deferred(), fakeStore(), manualCheckpoint(), storeSelection(), flushReport(), stop() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.35
Nodes (13): asciiLower(), commentEnd(), decodeAttributeValue(), discoverPreviewManifestSource(), integrationMode(), isAsciiLetter(), isSpace(), popForeign() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (3): browserFixture(), Element, statusNode()

### Community 7 - "Community 7"
Cohesion: 0.2
Nodes (4): request(), send(), startFixture(), report()

### Community 8 - "Community 8"
Cohesion: 0.27
Nodes (8): ProtocolError, rawValues(), reject(), sendError(), sendJson(), validateAuthority(), validateSelectionHeaders(), methodError()

### Community 9 - "Community 9"
Cohesion: 0.42
Nodes (8): dialRecord(), exactKeys(), fail(), parseManifestDocument(), parsePreviewManifest(), parseSelection(), plainRecord(), SelectionError

### Community 10 - "Community 10"
Cohesion: 0.6
Nodes (5): codepoints(), main(), make_ranges(), subset_chunk(), unicode_range_str()

### Community 11 - "Community 11"
Cohesion: 0.53
Nodes (5): CliError, main(), output(), parseCliArgs(), parsePort()

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (2): deferred(), lifecycleFixture()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (0):

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0):

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **1 isolated node(s):** `CliError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 14`** (2 nodes): `App.tsx`, `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `Button()`, `Button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `Field()`, `Field.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `Card()`, `Card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `requestFixture()`, `dl-preview-protocol.test.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `pureLoc()`, `dl-preview-structure.test.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `startPreviewServer()` connect `Community 0` to `Community 9`, `Community 11`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `parsePreviewManifest()` connect `Community 9` to `Community 0`, `Community 1`, `Community 5`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `startFixture()` connect `Community 7` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `startPreviewServer()` (e.g. with `verifyProcFd()` and `resolvePreviewRoot()`) actually correct?**
  _`startPreviewServer()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `openStaticAsset()` (e.g. with `open()` and `serveStatic()`) actually correct?**
  _`openStaticAsset()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `startPreviewBrowserScenario()` (e.g. with `launchChrome()` and `onChromeRunning()`) actually correct?**
  _`startPreviewBrowserScenario()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CliError` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
