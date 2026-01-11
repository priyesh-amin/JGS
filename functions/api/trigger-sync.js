export async function onRequestPost({ request, env }) {
    // 1. Basic Auth / Security Check
    // Ideally, we check for a shared secret or session token.
    // For now, we'll rely on the fact that this endpoint is only known to the Admin UI
    // and potentially checking a simple secret header if we added one.
    // Real security would implement JWT validation from the AuthContext here.

    // 2. Configuration
    const GITHUB_OWNER = "priyesh-amin"; // Derived from your repo URL
    const GITHUB_REPO = "JGS";
    const WORKFLOW_ID = "content-sync.yml"; // We will create this next
    const GITHUB_PAT = env.GH_PAT; // Accessed from Cloudflare Environment Variables

    if (!GITHUB_PAT) {
        return new Response(JSON.stringify({ error: "Server misconfiguration: Missing GH_PAT" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // 3. Trigger GitHub Dispatch
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/vnd.github.v3+json",
                    "Authorization": `Bearer ${GITHUB_PAT}`,
                    "User-Agent": "JGS-Admin-Dashboard"
                },
                body: JSON.stringify({
                    ref: "main" // The branch to run on
                }),
            }
        );

        if (!response.ok) {
            const text = await response.text();
            return new Response(JSON.stringify({ error: `GitHub API Error: ${text}` }), {
                status: response.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 4. Success Response
        return new Response(JSON.stringify({
            message: "Sync process started! It may take 2-3 minutes to update the site.",
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
