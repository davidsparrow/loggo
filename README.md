# LogoCode

A VS Code extension for visual codebase exploration — interactive D3 graph canvas, unified search, agent-assisted code changes, and two-panel diff views.

## Features

- **Interactive Graph Canvas** — D3 force-directed visualization of code structure with card-based nodes, zoom/pan, and tooltips
- **Sidebar Panels** — Files, Chat, Search, and Saved tabs in a clean sidebar layout
- **Unified Search** — Text and Semantic search modes with a single toggle
- **Agent Workflow** — Plan → Diff → Apply three-phase workflow with slash commands (`/diff`, `/apply`, `/reset`)
- **Two-Panel Diff View** — Side-by-side before/after graph comparison with synchronized pan/zoom, hover sync, and file-level accept
- **Editor Context Menus** — Right-click to search in workspace, search semantically, or ask the agent
- **Agent Context Basket** — Collect context from search results and editor selections for agent conversations
- **MCP & Connectors Panel** — Overview panel for MCP servers and external connectors (see Planned v2 Features)

## Getting Started

1. Open a workspace in VS Code
2. Click the **LogoCode** icon in the Activity Bar (circuit board icon)
3. Use **LogoCode: Open Graph Canvas** from the Command Palette to visualize your codebase
4. Use the sidebar panels for file browsing, search, chat, and saved presets

## Commands

| Command | Description |
|---------|-------------|
| `LogoCode: Open Graph Canvas` | Opens the interactive D3 code map |
| `LogoCode: Refresh Analysis` | Re-analyzes the workspace |
| `Search in Workspace (Text)` | Text search from editor selection |
| `Search Semantically` | Semantic search from editor selection |
| `Ask Agent About This` | Send editor selection to the agent |
| `LogoCode: MCP & Connectors` | Opens the MCP & Connectors panel |

<!-- ============================================================
     Planned v2 Features
     ============================================================

     The following features are currently implemented as mock/demo
     UI with "Coming Soon" indicators. Full integration is planned
     for v2:

     - **MCP Server Connections** — Start/stop MCP servers, view
       logs, monitor uptime. Currently shows mock server cards
       (Local Codemap Server, Semantic Index Server) with toggle
       buttons that display "Coming soon in v2" messages.

     - **External Connector Management** — Connect to Gmail, Slack,
       Google Sheets, and custom services. Currently shows mock
       connector cards with enable/disable toggles that display
       "Coming soon in v2" messages.

     - **Semantic Search (RuVector)** — Full local LLM-powered
       semantic search via RuVector integration. Currently uses
       a stub/fallback implementation.

     ============================================================ -->

## License

MIT

