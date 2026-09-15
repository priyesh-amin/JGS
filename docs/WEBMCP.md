# Browser WebMCP — requirements and user guide

## Purpose and boundaries

Let a compatible browser assistant help a signed-in member manage their own golf bookings, and help an administrator manage events, people, preparation and results. This is browser WebMCP, not a remote MCP server. No third-party model SDK or model credentials are embedded in JGS.

The existing website and authenticated API remain authoritative. Browser tool visibility is not a substitute for server permissions. Ordinary controls remain usable without WebMCP.

Finance tools, balances, reconciliation, bank files, payments, passwords, session cookies and role escalation are outside scope. Booking an event still has the normal charging consequences; the confirmation must display the fee. Cancellation does not imply a refund.

## Member journey

1. Open JGS in a supported browser and sign in yourself.
2. Open **Browser assistant setup** at the bottom of the website. When tools register successfully, the link says **Browser assistant ready**.
3. Open your compatible assistant/inspector for that same tab. Start with “Show my upcoming events and bookings”.
4. Ask to book a specific event. Provide dietary choice, buggy preference and any event-specific answers. The assistant must use the returned event identifier, not guess names or IDs.
5. Read the website confirmation: correct event, fee and answers. Choose **Confirm and save** to continue or **Keep unchanged** to discard. Escape discards; unanswered requests expire after two minutes.
6. Wait for the result. A saved notice appears. Choose Reload records when ready; this explicitly discards any unsaved form edits.
7. Preferences can be updated with the same review. Cancellation is available only before the server-controlled deadline. At or after the deadline, contact the committee.

## Chetan's journey

1. Sign in with an administrator account, then open the assistant on that website tab.
2. Ask for the event and player list, for example “Show September's players and dietary requirements”.
3. Use the event/member IDs returned by the website. Ask for a supported event, member, preparation or results change.
4. Review the exact subject and changed values in the website confirmation. Approve only the intended change.
5. For late cancellation, cancel the member's booking through the administrator action. This retains the charge for committee review under the applicable recorded cancellation terms. It does not send a cash refund.
6. Use the ordinary Reconciliation workspace for finance. There are no WebMCP finance tools.

## Desktop setup and compatibility

WebMCP support is experimental and changes between browser versions. The implementation feature-detects the current `document.modelContext` registration API and the older `navigator.modelContext` preview. It fails without affecting the rest of the website when neither is available.

For a local developer trial in a Chrome version offering the feature:

1. Open `chrome://flags/#enable-webmcp-testing`, enable it and relaunch.
2. Follow the official [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp) to install the Model Context Tool Inspector extension.
3. Sign into JGS in that browser; open the inspector for the JGS tab. Check for `jgs_` tools.
4. Manually invoke the event-list tool first. The inspector's optional natural-language mode requires its own model configuration. This is not automatically included in a ChatGPT subscription; provider usage charges may apply.
5. Do not paste website passwords, tokens or bank exports into an assistant.

A “ready” label proves registration in that browser, not connection to a particular assistant. Opening ChatGPT on a phone, desktop app or separate tab does not by itself connect it. Ordinary ChatGPT-to-JGS WebMCP interoperability has not been verified. Phone users can continue using the normal JGS website. This release does not enrol the domain in an origin trial or promise unflagged browser availability.

References: [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [WebMCP specification project](https://github.com/webmachinelearning/webmcp).

## Required controls and acceptance

- No tools before sign-in; role-specific catalogues after sign-in.
- Session identity and role revalidated for execution, including after confirmation.
- Inputs restricted to known fields and existing routes; no arbitrary URL, SQL or generic request tool.
- All writes require website confirmation; rejection, expiry and logout prevent saving.
- Only one proposed write can be active at a time in a tab.
- Server-side cancellation, booking capacity, pricing/version and permission checks remain in force.
- Existing API audit records remain the record of changes; WebMCP does not bypass API validation.
- Tool registration removed on sign-out/unmount; retained callbacks cannot act for the old session.
- Partial registration failure rolls back the tool catalogue and leaves manual website use available.
- Tool data containing member-supplied text is marked untrusted; strings are rendered as text, not HTML.
- No finance, credential-reset or administrator-role management actions in the catalogue.

## Troubleshooting

| Symptom | Action |
|---|---|
| Setup link, no ready status | Check browser feature support and sign-in. Use normal controls if unsupported. |
| Ready but assistant sees no tools | Check the assistant supports WebMCP and is attached to the same JGS tab. |
| Session changed or expired | Sign in again; refresh the tool list. |
| Change rejected as stale | Read the current record again, then propose the change afresh. |
| Cancellation closed | Member contacts committee; administrator reviews removal and any charge separately. |
| Save result unknown | Inspect the current booking/record before retrying; avoid duplicate submissions. |

## Release validation

Automated registration tests exercise current/legacy detection, registration failure rollback, retained callback revocation and sign-out during asynchronous registration. Tool tests cover schemas, roles, confirmation and session boundaries. Native assistant compatibility must be reported separately from these automated tests; mock registration is not evidence of ChatGPT interoperability.

## Available tools

| Who | Tool | Purpose |
|---|---|---|
| Both | `jgs_list_events`, `jgs_get_event` | Read visible events, questions and own booking. |
| Member | `jgs_book_event` | Book with dietary choice, buggy choice and event answers. |
| Member | `jgs_update_booking_preferences` | Replace booking preferences and event answers. |
| Member | `jgs_cancel_booking` | Cancel before the cancellation deadline. |
| Administrator | `jgs_admin_list_events`, `jgs_admin_get_preparation` | Read drafts, event details, players and preparation. |
| Administrator | `jgs_admin_list_members`, `jgs_admin_update_member` | Find ordinary members and change display name/contact email. Email changes revoke sessions and unlink Google sign-in, as explained before confirmation. |
| Administrator | `jgs_admin_add_booking`, `jgs_admin_cancel_booking` | Add or cancel an ordinary member's event booking. |
| Administrator | `jgs_admin_create_event`, `jgs_admin_edit_event` | Create/edit event details, fees, publication state and deadlines. |
| Administrator | `jgs_admin_update_preparation` | Update group, tee time, handicap and committee notes. |
| Administrator | `jgs_admin_get_results`, `jgs_admin_save_results` | Read and replace competition results. Saving is a full replacement; omitted results are removed and the confirmation says so. |

Use normal Admin controls for new member accounts, access recovery, account disabling, guest edits, booking-question configuration, administrator edits to dietary answers, and detailed competition tables. These actions are not exposed through this catalogue. Existing questions and payment policies are preserved when an event is edited.

Member-detail tool writes include the observed member version. The server rejects stale versions, records changed contact details and the acting administrator in management history, and makes email/session changes atomically. Existing manual member-edit requests remain compatible.
