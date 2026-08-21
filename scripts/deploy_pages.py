"""Build and optionally deploy the reviewed Cloudflare Pages release.

The default is a local packaging dry run. Remote deployment requires
``--deploy``; production additionally requires ``--approve-production``.
Provider credentials are read only from Wrangler's authenticated session or
masked process environment. This script never reads a project credential file.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


PROJECT_NAME = "jaguargolfsociety"
REQUIRED_NODE_MAJOR = 24
ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_NAMES = {
    ".git",
    ".lighthouseci",
    ".tmp",
    ".wrangler",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
    ".dev.vars",
    "cf_deployments.txt",
    "output.json",
    "wrangler.jsonc",
    "wrangler.fixture-sync.jsonc",
}


def copy_filter(_directory: str, names: list[str]) -> set[str]:
    excluded = {name for name in names if name in EXCLUDED_NAMES}
    excluded.update(
        name for name in names
        if name.endswith((".gdoc", ".gsheet", ".local", ".sqlite", ".sqlite3"))
    )
    return excluded


def command(name: str) -> str:
    resolved = shutil.which(name)
    if not resolved:
        raise RuntimeError(f"Required command is unavailable: {name}")
    return resolved


def run_checked(arguments: list[str], cwd: Path, *, capture: bool = False):
    return subprocess.run(
        arguments,
        cwd=cwd,
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=capture,
    )


def assert_runtime() -> None:
    result = run_checked([command("node"), "--version"], ROOT, capture=True)
    match = re.fullmatch(r"v(\d+)\.\d+\.\d+\s*", result.stdout)
    if not match or int(match.group(1)) != REQUIRED_NODE_MAJOR:
        raise RuntimeError(
            f"Node {REQUIRED_NODE_MAJOR} is required for local, CI and deployment builds."
        )


def assert_function_package(project: Path) -> None:
    package_dir = project / ".tmp" / "pages-functions"
    worker = package_dir / "index.js"
    routes = package_dir / "_routes.json"
    if not worker.is_file() or worker.stat().st_size == 0:
        raise RuntimeError("Pages Functions bundle was not produced.")
    if not routes.is_file():
        raise RuntimeError("Pages Functions routing manifest was not produced.")
    route_data = json.loads(routes.read_text(encoding="utf-8"))
    includes = route_data.get("include", [])
    if not any("/api" in route for route in includes):
        raise RuntimeError("Pages Functions package does not include API routes.")


def response(url: str):
    request = Request(url, headers={"Accept": "application/json"})
    try:
        return urlopen(request, timeout=30)
    except HTTPError as error:
        return error


def verify_api(deployment_url: str) -> None:
    expected_statuses = {
        "/api/auth/session": {200, 401},
        "/api/leaderboards": {200},
    }
    for path, allowed_statuses in expected_statuses.items():
        result = response(f"{deployment_url.rstrip('/')}{path}")
        body = result.read(200_000)
        if result.status not in allowed_statuses:
            raise RuntimeError(
                f"Pages Functions verification failed for {path}: "
                f"unexpected HTTP {result.status}."
            )
        content_type = result.headers.get("Content-Type", "").lower()
        if "application/json" not in content_type:
            raise RuntimeError(
                f"Pages Functions verification failed for {path}: expected JSON."
            )
        try:
            json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError(
                f"Pages Functions verification failed for {path}: invalid JSON."
            ) from error


def deploy(project: Path, branch: str) -> None:
    npx = command("npx")
    whoami = subprocess.run(
        [npx, "--no-install", "wrangler", "whoami"],
        cwd=project,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if whoami.returncode != 0:
        raise RuntimeError(
            "Wrangler authentication is unavailable. Complete provider-owned browser login first."
        )

    result = subprocess.run(
        [
            npx,
            "--no-install",
            "wrangler",
            "pages",
            "deploy",
            "dist",
            "--project-name",
            PROJECT_NAME,
            "--branch",
            branch,
        ],
        cwd=project,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "Cloudflare Pages deployment failed; provider output is withheld to avoid exposing identifiers."
        )
    urls = re.findall(r"https://[^\s]+\.pages\.dev", result.stdout + result.stderr)
    if not urls:
        raise RuntimeError("Deployment completed without a verifiable Pages URL.")
    verify_api(urls[-1].rstrip("/"))
    print("Deployment and Pages Functions JSON-route verification passed.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--branch", default="preview-ux")
    parser.add_argument("--deploy", action="store_true")
    parser.add_argument("--production", action="store_true")
    parser.add_argument("--approve-production", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.production and args.branch != "main":
        raise RuntimeError("Production deployments must use the main branch alias.")
    if args.production and args.deploy and not args.approve_production:
        raise RuntimeError(
            "Production deployment requires the explicit --approve-production gate."
        )

    assert_runtime()
    temp_root = Path(tempfile.mkdtemp(prefix="jgs_pages_release_"))
    project = temp_root / "project"
    try:
        shutil.copytree(ROOT, project, ignore=copy_filter)
        run_checked([command("npm"), "ci"], project)
        run_checked([command("npm"), "run", "check"], project)
        assert_function_package(project)
        print("Local Pages assets and Functions packaging verification passed.")
        if args.deploy:
            deploy(project, args.branch)
        else:
            print("Dry run complete; no external deployment was attempted.")
        return 0
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Release tooling failed: {error}", file=sys.stderr)
        raise SystemExit(1)
