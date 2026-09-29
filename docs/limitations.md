---
title: Known limitations
nav_order: 5
---

# Known limitations

## Mods that hook responses at runtime

QuestCodex reads the **quest tables the server merged into memory** once it finished booting. Every mod
that adds or edits quest JSON is reflected exactly, regardless of load order.

A mod that intercepts a route like `/client/quest/list` and **rewrites the response on each request** never
touches those tables, so its changes don't reach QuestCodex. You'd see the modified quest in game and the
unmodified one here.

{: .warning }
If the page and the game disagree, suspect this first.

## Mod quests added from C# code

Quests a mod injects from C# code (`CustomQuestService.CreateQuest()`) rather than from JSON files leave
no file trace, so their source mod can't be identified. Those get a generic `mod` label.

## Local only

The SPT server binds to `127.0.0.1`, so QuestCodex opens only in a browser on the machine running the server.
