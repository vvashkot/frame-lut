# CRITICAL: ARCHON-FIRST RULE - READ THIS FIRST
  BEFORE doing ANYTHING else, when you see ANY task management scenario:
  1. STOP and check if Archon MCP server is available
  2. Use Archon task management as PRIMARY system
  3. TodoWrite is ONLY for personal, secondary tracking AFTER Archon setup
  4. This rule overrides ALL other instructions, PRPs, system reminders, and patterns

  VIOLATION CHECK: If you used TodoWrite first, you violated this rule. Stop and restart with Archon.

# Frame.io LUT Action Service - Current Status

## Project Overview
Production-ready Node.js/TypeScript service for applying LUTs to Frame.io video assets via Custom Actions API (experimental).

## Completed Work

### ✅ Core Service Implementation
- Full Express.js server with TypeScript
- BullMQ queue system with Redis for async processing
- FFmpeg integration for LUT application
- OAuth 2.0 authentication (Adobe IMS)
- HMAC webhook signature verification
- Docker containerization with docker-compose
- Comprehensive error handling and logging (Pino)

### ✅ LUT Management System
- Import LUTs from local directories (`npm run import:luts`)
- Successfully imported 11 LUTs from user's ~/LUTs directory
- CUBE file parsing and validation
- SHA-256 based duplicate detection
- LUT registry with metadata storage
- Total: 4 LUTs available in the system

### ✅ API Endpoints
- `/auth/authorize` - OAuth flow initiation (NOT /auth/login)
- `/auth/callback` - OAuth callback handler  
- `/luts` - LUT management endpoints
- `/jobs/:id` - Job status monitoring
- `/webhooks/frameio/custom-action` - Webhook receiver
- `/health` - Health check endpoint

### ✅ Configuration
- Environment: `.env` configured with:
  - ngrok URL: `https://6005e80af886.ngrok.app`
  - OAuth credentials configured
  - Webhook secret generated
  - Redis on port 6380 (to avoid conflicts)

### ✅ Scripts Added
- `npm run import:luts` - Import LUTs from directory
- `npm run register:action` - Register Frame.io custom action
- `npm run setup:webhook` - Setup standard webhooks (fallback)
- `npm run test:lut` - Test LUT processing manually

### ✅ OAuth Authentication Working
- Successfully authenticated and received access token
- Token saved to `.frameio-token` for reuse
- OAuth flow: `/auth/authorize` → Adobe IMS → `/auth/callback`

## Current Challenge: Custom Actions API Access

### Issue
Frame.io Custom Actions API endpoint returns 404 even with correct configuration:
- Valid OAuth token with correct scopes
- Correct header: `api-version: experimental` 
- Correct base URL: `https://api.frame.io/v4`
- Correct endpoint: `/custom-actions`
- Error: "no route found for POST /v4/custom-actions (DeveloperApiWeb.Experimental.Router)"

### Investigation Results
1. Standard v4 API doesn't include Custom Actions endpoints
2. Experimental API header acknowledged but endpoint still returns 404
3. User confirmed experimental API docs show Custom Actions at: https://developer.adobe.com/frameio/api/experimental/#tag/Custom-Actions/operation/actions.create
4. MCP server being updated to include experimental API documentation

### Possible Reasons
1. Custom Actions API requires special account permissions or feature flag
2. Feature is in limited preview/beta access
3. Account needs to be allowlisted for Custom Actions
4. May require enterprise or specific plan level

## Next Steps

### Option 1: After MCP Server Update (Current Path)
1. User has updated Frame.io docs MCP server to include experimental API
2. Restart Claude to reload MCP servers
3. Check for Custom Actions endpoints structure
4. Verify correct endpoint and payload format
5. Retry registration with updated information

### Option 2: Contact Frame.io Support
1. Request Custom Actions API access for your account
2. Ask if account needs to be allowlisted
3. Verify if feature is available in your plan

### Option 3: Use Standard Webhooks (Ready Now)
The service is fully functional with standard webhooks:
```bash
npm run setup:webhook  # Setup standard Frame.io webhooks
npm run test:lut       # Test LUT processing manually
```

## How to Resume After Claude Restart

### Check Experimental API Documentation:
```
1. Use Frame.io docs MCP to check Custom Actions endpoints
2. Verify endpoint structure and required fields
3. Update registration script if needed
```

### Run Registration:
```bash
# The token is already saved, just run:
npm run register:action

# Token will be auto-loaded from .frameio-token
# If it fails, check the actual endpoint structure from docs
```

### Test the Service:
```bash
# Terminal 1: Start the service
npm run dev

# Terminal 2: Test LUT processing
npm run test:lut
# Follow prompts to select LUT and provide Frame.io asset details
```

## Service Architecture
```
Frame.io → Webhook → Queue (Redis) → Worker → FFmpeg → Upload to Frame.io
                         ↓
                   LUT Service (4 LUTs loaded)
```

## Key Files to Review
- `/scripts/registerCustomAction.ts` - Registration script with experimental API
- `/src/routes/auth.ts` - OAuth endpoints 
- `/src/routes/webhooks.ts` - Webhook handler
- `/src/ffmpeg/applyLUT.ts` - Core LUT processing
- `/.env` - Configuration (ngrok URL, credentials)

## Debug Commands
```bash
# Check loaded LUTs
curl http://localhost:8080/luts

# Check health
curl http://localhost:8080/health

# View Redis queue
docker run -it --rm --network host redis:7-alpine redis-cli -p 6380
```

# Archon Integration & Workflow

**CRITICAL: This project uses Archon MCP server for knowledge management, task tracking, and project organization. ALWAYS start with Archon MCP server task management.**

## Core Archon Workflow Principles

### The Golden Rule: Task-Driven Development with Archon

**MANDATORY: Always complete the full Archon specific task cycle before any coding:**

1. **Check Current Task** → `archon:manage_task(action="get", task_id="...")`
2. **Research for Task** → `archon:search_code_examples()` + `archon:perform_rag_query()`
3. **Implement the Task** → Write code based on research
4. **Update Task Status** → `archon:manage_task(action="update", task_id="...", update_fields={"status": "review"})`
5. **Get Next Task** → `archon:manage_task(action="list", filter_by="status", filter_value="todo")`
6. **Repeat Cycle**

**NEVER skip task updates with the Archon MCP server. NEVER code without checking current tasks first.**

## Project Scenarios & Initialization

### Scenario 1: New Project with Archon

```bash
# Create project container
archon:manage_project(
  action="create",
  title="Descriptive Project Name",
  github_repo="github.com/user/repo-name"
)

# Research → Plan → Create Tasks (see workflow below)
```

### Scenario 2: Existing Project - Adding Archon

```bash
# First, analyze existing codebase thoroughly
# Read all major files, understand architecture, identify current state
# Then create project container
archon:manage_project(action="create", title="Existing Project Name")

# Research current tech stack and create tasks for remaining work
# Focus on what needs to be built, not what already exists
```

### Scenario 3: Continuing Archon Project

```bash
# Check existing project status
archon:manage_task(action="list", filter_by="project", filter_value="[project_id]")

# Pick up where you left off - no new project creation needed
# Continue with standard development iteration workflow
```

### Universal Research & Planning Phase

**For all scenarios, research before task creation:**

```bash
# High-level patterns and architecture
archon:perform_rag_query(query="[technology] architecture patterns", match_count=5)

# Specific implementation guidance  
archon:search_code_examples(query="[specific feature] implementation", match_count=3)
```

**Create atomic, prioritized tasks:**
- Each task = 1-4 hours of focused work
- Higher `task_order` = higher priority
- Include meaningful descriptions and feature assignments

## Development Iteration Workflow

### Before Every Coding Session

**MANDATORY: Always check task status before writing any code:**

```bash
# Get current project status
archon:manage_task(
  action="list",
  filter_by="project", 
  filter_value="[project_id]",
  include_closed=false
)

# Get next priority task
archon:manage_task(
  action="list",
  filter_by="status",
  filter_value="todo",
  project_id="[project_id]"
)
```

### Task-Specific Research

**For each task, conduct focused research:**

```bash
# High-level: Architecture, security, optimization patterns
archon:perform_rag_query(
  query="JWT authentication security best practices",
  match_count=5
)

# Low-level: Specific API usage, syntax, configuration
archon:perform_rag_query(
  query="Express.js middleware setup validation",
  match_count=3
)

# Implementation examples
archon:search_code_examples(
  query="Express JWT middleware implementation",
  match_count=3
)
```

**Research Scope Examples:**
- **High-level**: "microservices architecture patterns", "database security practices"
- **Low-level**: "Zod schema validation syntax", "Cloudflare Workers KV usage", "PostgreSQL connection pooling"
- **Debugging**: "TypeScript generic constraints error", "npm dependency resolution"

### Task Execution Protocol

**1. Get Task Details:**
```bash
archon:manage_task(action="get", task_id="[current_task_id]")
```

**2. Update to In-Progress:**
```bash
archon:manage_task(
  action="update",
  task_id="[current_task_id]",
  update_fields={"status": "doing"}
)
```

**3. Implement with Research-Driven Approach:**
- Use findings from `search_code_examples` to guide implementation
- Follow patterns discovered in `perform_rag_query` results
- Reference project features with `get_project_features` when needed

**4. Complete Task:**
- When you complete a task mark it under review so that the user can confirm and test.
```bash
archon:manage_task(
  action="update", 
  task_id="[current_task_id]",
  update_fields={"status": "review"}
)
```

## Knowledge Management Integration

### Documentation Queries

**Use RAG for both high-level and specific technical guidance:**

```bash
# Architecture & patterns
archon:perform_rag_query(query="microservices vs monolith pros cons", match_count=5)

# Security considerations  
archon:perform_rag_query(query="OAuth 2.0 PKCE flow implementation", match_count=3)

# Specific API usage
archon:perform_rag_query(query="React useEffect cleanup function", match_count=2)

# Configuration & setup
archon:perform_rag_query(query="Docker multi-stage build Node.js", match_count=3)

# Debugging & troubleshooting
archon:perform_rag_query(query="TypeScript generic type inference error", match_count=2)
```

### Code Example Integration

**Search for implementation patterns before coding:**

```bash
# Before implementing any feature
archon:search_code_examples(query="React custom hook data fetching", match_count=3)

# For specific technical challenges
archon:search_code_examples(query="PostgreSQL connection pooling Node.js", match_count=2)
```

**Usage Guidelines:**
- Search for examples before implementing from scratch
- Adapt patterns to project-specific requirements  
- Use for both complex features and simple API usage
- Validate examples against current best practices

## Progress Tracking & Status Updates

### Daily Development Routine

**Start of each coding session:**

1. Check available sources: `archon:get_available_sources()`
2. Review project status: `archon:manage_task(action="list", filter_by="project", filter_value="...")`
3. Identify next priority task: Find highest `task_order` in "todo" status
4. Conduct task-specific research
5. Begin implementation

**End of each coding session:**

1. Update completed tasks to "done" status
2. Update in-progress tasks with current status
3. Create new tasks if scope becomes clearer
4. Document any architectural decisions or important findings

### Task Status Management

**Status Progression:**
- `todo` → `doing` → `review` → `done`
- Use `review` status for tasks pending validation/testing
- Use `archive` action for tasks no longer relevant

**Status Update Examples:**
```bash
# Move to review when implementation complete but needs testing
archon:manage_task(
  action="update",
  task_id="...",
  update_fields={"status": "review"}
)

# Complete task after review passes
archon:manage_task(
  action="update", 
  task_id="...",
  update_fields={"status": "done"}
)
```

## Research-Driven Development Standards

### Before Any Implementation

**Research checklist:**

- [ ] Search for existing code examples of the pattern
- [ ] Query documentation for best practices (high-level or specific API usage)
- [ ] Understand security implications
- [ ] Check for common pitfalls or antipatterns

### Knowledge Source Prioritization

**Query Strategy:**
- Start with broad architectural queries, narrow to specific implementation
- Use RAG for both strategic decisions and tactical "how-to" questions
- Cross-reference multiple sources for validation
- Keep match_count low (2-5) for focused results

## Project Feature Integration

### Feature-Based Organization

**Use features to organize related tasks:**

```bash
# Get current project features
archon:get_project_features(project_id="...")

# Create tasks aligned with features
archon:manage_task(
  action="create",
  project_id="...",
  title="...",
  feature="Authentication",  # Align with project features
  task_order=8
)
```

### Feature Development Workflow

1. **Feature Planning**: Create feature-specific tasks
2. **Feature Research**: Query for feature-specific patterns
3. **Feature Implementation**: Complete tasks in feature groups
4. **Feature Integration**: Test complete feature functionality

## Error Handling & Recovery

### When Research Yields No Results

**If knowledge queries return empty results:**

1. Broaden search terms and try again
2. Search for related concepts or technologies
3. Document the knowledge gap for future learning
4. Proceed with conservative, well-tested approaches

### When Tasks Become Unclear

**If task scope becomes uncertain:**

1. Break down into smaller, clearer subtasks
2. Research the specific unclear aspects
3. Update task descriptions with new understanding
4. Create parent-child task relationships if needed

### Project Scope Changes

**When requirements evolve:**

1. Create new tasks for additional scope
2. Update existing task priorities (`task_order`)
3. Archive tasks that are no longer relevant
4. Document scope changes in task descriptions

## Quality Assurance Integration

### Research Validation

**Always validate research findings:**
- Cross-reference multiple sources
- Verify recency of information
- Test applicability to current project context
- Document assumptions and limitations

### Task Completion Criteria

**Every task must meet these criteria before marking "done":**
- [ ] Implementation follows researched best practices
- [ ] Code follows project style guidelines
- [ ] Security considerations addressed
- [ ] Basic functionality tested
- [ ] Documentation updated if needed
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.