import { Link } from 'react-router-dom';

export default function BrowserAssistant() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 pb-24">
    <Link to="/members" className="underline">Back to members</Link>
    <h1 className="text-3xl font-bold">Use a browser assistant</h1>
    <p>WebMCP lets a compatible assistant use named website actions such as finding an event or preparing a booking. You stay signed in to this website and review changes here.</p>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><strong>Compatibility first</strong><p className="mt-2">Opening ChatGPT on your phone or in another tab does not automatically connect it to this website. Your browser and assistant must explicitly support WebMCP. If the setup link does not say “ready”, keep using the normal website controls.</p></div>
    <h2 className="text-2xl font-bold">Desktop setup for trying WebMCP</h2>
    <ol className="list-decimal space-y-3 pl-6">
      <li>Use Chrome with WebMCP support. For local testing, open <code>chrome://flags/#enable-webmcp-testing</code>, enable the flag if available, then relaunch Chrome.</li>
      <li>Follow the <a className="underline" href="https://developer.chrome.com/docs/ai/webmcp" target="_blank" rel="noreferrer">official Chrome guide</a> to install the Model Context Tool Inspector extension. The guide explains its permissions and optional model setup.</li>
      <li>Open this website and sign in yourself. Never give the assistant your password or a bank file.</li>
      <li>Look for “Browser assistant ready” at the bottom of the page. Open the inspector on this tab and check for tools beginning <code>jgs_</code>. Start with listing events.</li>
      <li>Use the inspector’s manual tool controls, or its optional assistant chat. Its chat uses a separately configured model, not your ChatGPT subscription. Check the provider’s pricing before enabling model calls.</li>
      <li>For changes, keep the website visible. Read the review panel and choose “Confirm and save” or “Keep unchanged”. Wait for the tool result before asking again. After saving, use Reload records when ready; reloading discards unsaved form edits.</li>
    </ol>
    <h2 className="text-2xl font-bold">As a member</h2>
    <p>Try: “Show my upcoming golf events and bookings.” Then: “Book me into the October event with vegetarian food and no buggy.” Give any extra answers the event asks for. Check the event and fee in the confirmation panel. The website enforces deadlines and capacity.</p>
    <p>Try: “Change my breakfast preference” or “Cancel my booking.” After the cancellation deadline, contact the committee. Only an administrator can cancel then; no refund is guaranteed.</p>
    <h2 className="text-2xl font-bold">As Chetan</h2>
    <p>Sign in with your administrator account. Start with: “Show the players and dietary requirements for September.” You can then ask for an event, member, preparation or result change. Review the named person, event and proposed values before saving.</p>
    <p>Finance, bank imports, reconciliation, passwords and administrator permissions are outside these tools. Normal booking charges still follow the website’s rules.</p>
    <h2 className="text-2xl font-bold">Phone and ChatGPT</h2>
    <p>The website remains usable normally on your phone. A working WebMCP connection from the ordinary ChatGPT phone app or a separate ChatGPT browser tab has not been verified. “Ready” means the website registered tools; it does not mean ChatGPT connected. Do not create a remote MCP connection for this feature.</p>
    <h2 className="text-2xl font-bold">If something stops working</h2>
    <ul className="list-disc space-y-2 pl-6"><li>No tools: check browser support, sign-in and the inspector’s selected tab.</li><li>Session expired: sign in again and reopen the inspector. Old tools cannot keep using the signed-out session.</li><li>Change rejected: read the reason. Deadlines, permissions and stale data must be resolved on the website.</li><li>Unknown save result: check the booking or record before retrying. Do not repeatedly submit.</li><li>You can always choose “Keep unchanged”, close the review with Escape, or use the normal website controls.</li></ul>
  </main>;
}
