LiveKit system prompt plumbing: frontend → token → Python agent

Overview
- Goal: take the system prompt edited in the assistant UI and deliver it to the Python LiveKit agent so it uses those instructions at session start.
- Approach: use RoomAgentDispatch metadata on the participant token (created by Next.js). The Python agent reads this metadata from its JobContext and sets instructions.

What To Change
- Use RoomAgentDispatch metadata to carry the system prompt (and assistantId) when minting the token.
- Frontend: include assistantId and systemPrompt in POST to `POST /api/connection-details`.
- Next API: embed that metadata into `RoomConfiguration.agents` when minting the token.
- Python agent: read `ctx.job.metadata` JSON and set the agent’s system instructions.

Next.js changes
- File: app/api/connection-details/route.ts
  - Import the dispatch type:
    - `import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol'`
  - Read values from body:
    - `const { room_config, assistantId, systemPrompt } = await req.json()`
    - `const agentName: string = room_config?.agents?.[0]?.agent_name` (or pass directly in body)
  - Build token and set roomConfig with metadata:
    ```ts
    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      { assistantId, systemPrompt }
    );
    ```
  - Update helper to accept metadata:
    ```ts
    function createParticipantToken(
      userInfo: AccessTokenOptions,
      roomName: string,
      agentName?: string,
      meta?: Record<string, unknown>
    ): Promise<string> {
      const at = new AccessToken(API_KEY, API_SECRET, { ...userInfo, ttl: '15m' });
      at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canPublishData: true, canSubscribe: true });

      if (agentName) {
        const metadata = JSON.stringify(meta ?? {});
        at.roomConfig = new RoomConfiguration({
          agents: [ new RoomAgentDispatch({ agentName, metadata }) ],
        });
      }
      return at.toJwt();
    }
    ```

Frontend call
- From the assistant config page (e.g., Test/Start call), send the current prompt and assistantId:
  ```ts
  const res = await apiClient.post('/api/connection-details', {
    room_config: { agents: [{ agent_name: 'my-python-agent' }] },
    assistantId,
    systemPrompt: prompt,
  });
  // res.data => { serverUrl, roomName, participantToken, participantName }
  ```
- Use the returned token with the LiveKit web client to connect.

Python agent: read metadata and apply
- In your agent entrypoint, read `ctx.job.metadata` and set instructions:
  ```py
  import json
  from livekit.agents import JobContext

  async def entrypoint(ctx: JobContext):
      meta = json.loads(ctx.job.metadata or '{}')
      system_prompt = meta.get('systemPrompt') or 'You are a helpful voice agent.'

      # Pass instructions to your agent
      agent = MyVoiceAgent(instructions=system_prompt, ...)
      await agent.run(ctx)
  ```
- If your agent wrapper doesn’t accept `instructions` at construction, prime with:
  ```py
  await session.generate_reply(instructions=system_prompt)
  ```

Alternative: explicit dispatch API
- Instead of embedding dispatch in the token, you can create a dispatch via AgentDispatch API with the same `metadata` JSON. The agent reads it the same way.

Why this approach
- RoomAgentDispatch.metadata is the official, low-latency path to pass structured data (JSON) into the agent’s JobContext. It avoids ad‑hoc control channels and keeps UX snappy.

Checklist
- Worker configured with a named agent (e.g., `agent_name="my-python-agent"`) that matches what the frontend sends.
- NEXT envs set: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_APP_URL`.
- Frontend sends `{ room_config: { agents: [{ agent_name }] }, assistantId, systemPrompt }` to `/api/connection-details`.
- Agent reads `ctx.job.metadata`, applies `systemPrompt` at startup.

Notes / Follow-ups
- If you also want to persist the prompt, continue using `/api/assistants/[id]` PUT; dispatch can still pass the current edited value for immediate tests.
- Consider adding auth/org guards to your API routes, as most handlers currently don’t enforce membership.

------------>>>>

LiveKit docs references
- Dispatch on participant connection (RoomConfiguration.agents with RoomAgentDispatch + metadata):
  https://docs.livekit.io/agents/worker/agent-dispatch/#dispatch-on-participant-connection
- Job metadata (how metadata is passed to the agent and available in JobContext):
  https://docs.livekit.io/agents/worker/agent-dispatch/#job-metadata
- Creating a token with room configuration (embedding dispatch in the token):
  https://docs.livekit.io/home/get-started/authentication/#creating-a-token-with-room-configuration
- Consume metadata in agent (read ctx.job.metadata):
  https://docs.livekit.io/agents/worker/job/#metadata
- Initial context tips (loading user/task-specific data at session start):
  https://docs.livekit.io/agents/build/external-data/#initial-context
- Setting instructions via generate_reply (priming via instructions):
  https://docs.livekit.io/agents/build/audio/#generate_reply
- Explicit agent dispatch via API (alternative to token-embedded dispatch):
  https://docs.livekit.io/agents/worker/agent-dispatch/#dispatch-via-api


----------------->>>>>>>>>>>

Narrative walkthrough (story + jargon)
Once upon a dashboard, a product owner opens the Assistant Config page and types a crisp "system prompt" into the left panel. When they click Test, the browser (frontend) sends a POST to /api/connection-details with three keys: agent_name (the LiveKit worker's registered name), assistantId (UI-selected id), and systemPrompt (the instructions just typed).

On the server (Next.js API), an AccessToken is minted using the LiveKit server SDK. This token includes a RoomConfiguration with a RoomAgentDispatch entry so the right agent joins the room automatically. Crucially, the RoomAgentDispatch.metadata is a JSON string that carries assistantId and systemPrompt. The token also has VideoGrant (roomJoin, room) and any other permissions needed.

The API returns serverUrl, roomName, and participantToken. The web client connects with this token. LiveKit Worker sees the dispatch and boots the Python agent by name (must match agent_name in WorkerOptions and what the frontend sent).

Inside the Python agent, the entrypoint receives a JobContext. It reads ctx.job.metadata (the same JSON from RoomAgentDispatch.metadata), extracts systemPrompt, and applies it as the agent's instructions. Depending on your agent wrapper, that can be passed to the constructor (instructions/system) or used to prime the model via session.generate_reply(instructions=systemPrompt). From the first response, the agent follows those fresh instructions.

Guardrails worth noting: Better Auth protects the UI, but API routes should also validate sessions and org membership. LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET must be set for token minting. agent_name must match between WorkerOptions (Python) and the RoomAgentDispatch used in the token. Persisting the prompt in Postgres (Drizzle) is optional; dispatch metadata is enough for fast test cycles.

Jargon index
- AccessToken: the signed credential created by the Next API. Contains grants and (optionally) room configuration.
- RoomConfiguration: token-time config for the room. Can include a list of RoomAgentDispatch entries.
- RoomAgentDispatch: instructs LiveKit to join a specific named agent to the room; carries JSON metadata for the job.
- JobContext: object provided to your Python agent on start; ctx.job.metadata is where the JSON lands.
- generate_reply(instructions=...): a programmatic way to prime or adjust model guidance at runtime.
- Better Auth: session management on the web side; add server-side guards to APIs for authorization.

Summary path
UI system prompt -> POST /api/connection-details -> AccessToken with RoomConfiguration.agents (RoomAgentDispatch.metadata) -> JobContext.metadata in Python -> set agent instructions.

Implementation changes (Next.js)
- File changed: app/api/connection-details/route.ts
  - Accepts `assistantId` and `systemPrompt` in the POST body (alias-friendly: `assistant_id`, `system_prompt`, or `prompt`).
  - Embeds both into the minted token via `RoomConfiguration.agents = [ new RoomAgentDispatch({ agentName, metadata }) ]` where `metadata` is a JSON string like `{ "assistantId": "...", "systemPrompt": "..." }`.
  - Response remains `{ serverUrl, roomName, participantToken, participantName }`.

Example request body (frontend → Next API)
```
POST /api/connection-details
{
  "room_config": { "agents": [{ "agent_name": "my-python-agent" }] },
  "assistantId": "8ec923a1-2a6d-42cf-b891-0dd3b8ee3ce4",
  "systemPrompt": "You are a helpful voice agent that..."
}
```

Minimal client call (from assistant page)
```
await apiClient.post('/api/connection-details', {
  room_config: { agents: [{ agent_name: 'my-python-agent' }] },
  assistantId,
  systemPrompt: prompt,
});
```

Implementation changes (Python agent)
- Read metadata from `ctx.job.metadata` (JSON string) in your entrypoint and apply `systemPrompt` as the agent’s instructions.

Python example
```
import json
from livekit.agents import JobContext

async def entrypoint(ctx: JobContext):
    meta = json.loads(ctx.job.metadata or '{}')
    system_prompt = meta.get('systemPrompt') or 'You are a helpful voice agent.'
    assistant_id = meta.get('assistantId')

    # Option A: constructor accepts instructions
    agent = MyVoiceAgent(instructions=system_prompt, assistant_id=assistant_id)
    await agent.run(ctx)

    # Option B: prime session if constructor does not accept instructions
    # await session.generate_reply(instructions=system_prompt)
```

Required wiring
- WorkerOptions must register the same `agent_name` used by the frontend.
- Next API must have env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Optional persistence: keep saving system prompts in DB; dispatch still uses the latest edited value passed from the UI.
