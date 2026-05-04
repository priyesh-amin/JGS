export async function onRequestPost(context) {
  try {
    const { env } = context;

    // Optional: We could check for a secret token in the request headers here
    // but since this is an internal society app, and the button is only visible
    // when logged in (client-side), we can just rate-limit or keep it simple for now.
    
    if (!env.GH_PAT) {
      return new Response(JSON.stringify({ error: "GitHub PAT not configured on server." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const githubRepo = "priyesh-amin/JGS";
    const githubUrl = `https://api.github.com/repos/${githubRepo}/dispatches`;

    const response = await fetch(githubUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `token ${env.GH_PAT}`,
        "User-Agent": "Cloudflare-Pages-Sync-Trigger"
      },
      body: JSON.stringify({
        event_type: "sync_content"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Failed to trigger sync", details: errText }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Sync triggered successfully!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
