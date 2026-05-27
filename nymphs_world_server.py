#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

MODULE_ID = "nymphs-world"
MODULE_NAME = "Nymphs World"
MODULE_VERSION = "0.1.0"
WIKILINK_RE = re.compile(r"\[\[([^\]\n]+)\]\]")
MEDIA_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".svg",
    ".glb",
    ".gltf",
    ".mp3",
    ".wav",
    ".ogg",
    ".mp4",
    ".mov",
    ".fbx",
    ".obj",
}

PAGE_TYPE_DIRS = {
    "character": "world/characters",
    "place": "world/places",
    "faction": "world/factions",
    "story_arc": "world/story/arcs",
    "quest": "world/quests",
    "beat": "world/story/beats",
    "scene": "world/scenes",
    "dialogue_thread": "world/story/dialogue",
    "item": "world/items",
    "system": "world/systems",
    "lore": "world/lore",
    "scratch": "world/scratch",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str, fallback: str = "world") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or fallback


def normalize_link(value: str) -> str:
    value = value.split("|", 1)[0].split("#", 1)[0].strip()
    return re.sub(r"\s+", " ", value).casefold()


def relative_to(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def ensure_child(root: Path, *parts: str) -> Path:
    path = (root.joinpath(*parts)).resolve()
    root_resolved = root.resolve()
    if path != root_resolved and root_resolved not in path.parents:
        raise ValueError("Path escapes project root")
    return path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def parse_frontmatter(content: str) -> tuple[dict[str, object], str]:
    if not content.startswith("---\n"):
        return {}, content

    end = content.find("\n---\n", 4)
    if end < 0:
        return {}, content

    raw = content[4:end]
    body = content[end + 5 :]
    data: dict[str, object] = {}
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value.startswith("[") and value.endswith("]"):
            items = [
                item.strip().strip("\"'")
                for item in value[1:-1].split(",")
                if item.strip()
            ]
            data[key] = items
        else:
            data[key] = value.strip("\"'")
    return data, body


def first_heading(body: str) -> str | None:
    for line in body.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            if title:
                return title
    return None


def project_metadata_path(project_root: Path) -> Path:
    return project_root / ".nymphs-world" / "project.json"


def read_project(project_root: Path) -> dict[str, object]:
    metadata = project_metadata_path(project_root)
    if not metadata.exists():
        raise FileNotFoundError("Project metadata is missing")
    return json.loads(read_text(metadata))


def write_project(project_root: Path, title: str, project_id: str) -> dict[str, object]:
    metadata = {
        "id": project_id,
        "title": title,
        "module": MODULE_ID,
        "schema_version": 1,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    write_text(project_metadata_path(project_root), json.dumps(metadata, indent=2) + "\n")
    return metadata


def ensure_project_layout(project_root: Path) -> None:
    folders = [
        ".nymphs-world/index",
        "world/scratch",
        "world/characters",
        "world/places",
        "world/factions",
        "world/story/arcs",
        "world/story/beats",
        "world/story/dialogue",
        "world/quests",
        "world/scenes",
        "world/items",
        "world/systems",
        "world/lore",
        "assets/by-entity",
        "assets/library",
        "production/briefs",
        "production/jobs",
        "production/reviews",
        "exports",
    ]
    for folder in folders:
        (project_root / folder).mkdir(parents=True, exist_ok=True)


def next_project_path(projects_root: Path, title: str) -> Path:
    base = slugify(title)
    candidate = projects_root / base
    suffix = 2
    while candidate.exists():
        candidate = projects_root / f"{base}-{suffix}"
        suffix += 1
    return candidate


def build_page_content(
    page_id: str,
    title: str,
    page_type: str,
    status: str = "draft",
    summary: str = "",
    tags: list[str] | None = None,
    body: str = "",
) -> str:
    tag_text = ", ".join(tags or [])
    body = body.strip() or "- Add notes here."
    return (
        "---\n"
        f"id: {page_id}\n"
        f"type: {page_type}\n"
        f"title: {title}\n"
        f"status: {status}\n"
        f"tags: [{tag_text}]\n"
        f"summary: {summary}\n"
        "---\n\n"
        f"# {title}\n\n"
        f"{body}\n"
    )


def create_page(
    project_root: Path,
    title: str,
    page_type: str,
    status: str = "draft",
    summary: str = "",
    body: str = "",
) -> dict[str, str]:
    safe_type = page_type if page_type in PAGE_TYPE_DIRS else "lore"
    folder = ensure_child(project_root, PAGE_TYPE_DIRS[safe_type])
    base_slug = slugify(title, "page")
    path = folder / f"{base_slug}.md"
    suffix = 2
    while path.exists():
        path = folder / f"{base_slug}-{suffix}.md"
        suffix += 1

    page_id = f"nw-{safe_type.replace('_', '-')}-{base_slug}"
    if suffix > 2:
        page_id = f"{page_id}-{suffix - 1}"

    write_text(path, build_page_content(page_id, title, safe_type, status, summary, body=body))
    touch_project(project_root)
    return {"id": page_id, "path": relative_to(path, project_root)}


def touch_project(project_root: Path) -> None:
    metadata_path = project_metadata_path(project_root)
    if not metadata_path.exists():
        return
    metadata = json.loads(read_text(metadata_path))
    metadata["updated_at"] = utc_now()
    write_text(metadata_path, json.dumps(metadata, indent=2) + "\n")


def create_project(projects_root: Path, title: str) -> dict[str, object]:
    projects_root.mkdir(parents=True, exist_ok=True)
    project_root = next_project_path(projects_root, title)
    project_id = slugify(project_root.name)
    ensure_project_layout(project_root)
    metadata = write_project(project_root, title.strip() or "Untitled World", project_id)
    create_page(
        project_root,
        "Start Here",
        "lore",
        "draft",
        "Opening notes for this world.",
        "Use this page as the first readable record for the world.\n\nCreate another page from the left rail, then link it with a wikilink.",
    )
    return metadata


def create_demo_project(projects_root: Path) -> dict[str, object]:
    project = create_project(projects_root, "Signal Yard Demo")
    project_root = projects_root / str(project["id"])
    create_page(
        project_root,
        "Rhea Vale",
        "character",
        "candidate",
        "Test pilot tied to the old-city signal.",
        "Rhea first appears in [[Opening Scene]] and has old ties to [[The Signal Yard]].",
    )
    create_page(
        project_root,
        "The Signal Yard",
        "place",
        "candidate",
        "A fenced ruin where forgotten broadcast towers still wake at night.",
        "The yard connects [[Rhea Vale]] to [[The Faction Council]].",
    )
    create_page(
        project_root,
        "The Faction Council",
        "faction",
        "draft",
        "A cautious governing faction that wants the signal contained.",
        "The council distrusts [[Rhea Vale]] after the first broadcast.",
    )
    create_page(
        project_root,
        "Opening Scene",
        "scene",
        "draft",
        "Rhea hears the signal and crosses into the yard.",
        "Scene goal: reveal [[The Signal Yard]] and force Rhea to choose whether to warn [[The Faction Council]].",
    )
    create_page(
        project_root,
        "Old-City Signal",
        "lore",
        "candidate",
        "A repeating transmission that might be a warning or an invitation.",
        "The signal is strongest inside [[The Signal Yard]].",
    )
    return project


def project_roots(projects_root: Path) -> list[Path]:
    if not projects_root.exists():
        return []
    roots = []
    for child in sorted(projects_root.iterdir(), key=lambda p: p.name.casefold()):
        if child.is_dir() and project_metadata_path(child).exists():
            roots.append(child)
    return roots


def page_record(project_root: Path, path: Path) -> dict[str, object]:
    content = read_text(path)
    frontmatter, body = parse_frontmatter(content)
    title = str(frontmatter.get("title") or first_heading(body) or path.stem.replace("-", " ").title())
    tags_raw = frontmatter.get("tags", [])
    tags = [str(tag) for tag in tags_raw] if isinstance(tags_raw, list) else []
    links = [normalize_link(match) for match in WIKILINK_RE.findall(body)]
    return {
        "id": str(frontmatter.get("id") or path.stem),
        "title": title,
        "type": str(frontmatter.get("type") or ""),
        "status": str(frontmatter.get("status") or "draft"),
        "summary": str(frontmatter.get("summary") or ""),
        "image": str(frontmatter.get("image") or ""),
        "tags": tags,
        "path": relative_to(path, project_root),
        "links": links,
        "content": content,
    }


def build_index(project_root: Path) -> dict[str, object]:
    metadata = read_project(project_root)
    pages: list[dict[str, object]] = []
    world_root = project_root / "world"
    for path in sorted(world_root.rglob("*.md"), key=lambda p: p.as_posix().casefold()):
        pages.append(page_record(project_root, path))

    title_index: dict[str, dict[str, object]] = {}
    for page in pages:
        title_index[normalize_link(str(page["title"]))] = page
        title_index[normalize_link(Path(str(page["path"])).stem.replace("-", " "))] = page
        title_index[normalize_link(str(page["id"]))] = page

    backlinks: dict[str, list[str]] = {str(page["id"]): [] for page in pages}
    diagnostics: list[dict[str, str]] = []
    all_page_text = "\n".join(str(page["content"]) for page in pages)

    for page in pages:
        if not str(page.get("type", "")).strip():
            diagnostics.append(
                {
                    "severity": "warning",
                    "title": "Missing page type",
                    "detail": f"{page['title']} has no frontmatter type.",
                    "path": str(page["path"]),
                }
            )
        if not str(page.get("summary", "")).strip():
            diagnostics.append(
                {
                    "severity": "warning",
                    "title": "Missing summary",
                    "detail": f"{page['title']} has no frontmatter summary.",
                    "path": str(page["path"]),
                }
            )
        for link in page["links"]:
            target = title_index.get(str(link))
            if target is None:
                diagnostics.append(
                    {
                        "severity": "warning",
                        "title": "Broken wikilink",
                        "detail": f"{page['title']} links to [[{link}]], but no matching page was found.",
                        "path": str(page["path"]),
                    }
                )
                continue
            backlinks.setdefault(str(target["id"]), []).append(str(page["id"]))

    for page in pages:
        page.pop("content", None)
        page["backlinks"] = backlinks.get(str(page["id"]), [])

    assets: list[dict[str, str]] = []
    for path in sorted((project_root / "assets").rglob("*"), key=lambda p: p.as_posix().casefold()):
        if not path.is_file() or path.suffix.casefold() not in MEDIA_EXTENSIONS:
            continue
        rel = relative_to(path, project_root)
        entity_id = ""
        parts = path.relative_to(project_root).parts
        if len(parts) >= 3 and parts[0] == "assets" and parts[1] == "by-entity":
            entity_id = parts[2]
        if not entity_id and rel not in all_page_text:
            diagnostics.append(
                {
                    "severity": "warning",
                    "title": "Orphan asset",
                    "detail": f"{rel} is not attached to a page yet.",
                    "path": rel,
                }
            )
        assets.append(
            {
                "path": rel,
                "kind": "media",
                "extension": path.suffix.casefold(),
                "entity_id": entity_id,
            }
        )

    if not diagnostics:
        diagnostics.append(
            {
                "severity": "ready",
                "title": "Vault ready",
                "detail": "No broken links or missing required page fields were found.",
                "path": "",
            }
        )

    snapshot = {
        "project": metadata,
        "root": str(project_root),
        "pages": pages,
        "assets": assets,
        "diagnostics": diagnostics,
        "counts": {
            "pages": len(pages),
            "assets": len(assets),
            "diagnostics": len([d for d in diagnostics if d["severity"] != "ready"]),
            "broken_links": len([d for d in diagnostics if d["title"] == "Broken wikilink"]),
        },
        "indexed_at": utc_now(),
    }
    index_path = project_root / ".nymphs-world" / "index" / "last-index.json"
    write_text(index_path, json.dumps(snapshot, indent=2) + "\n")
    return snapshot


class NymphsWorldHandler(SimpleHTTPRequestHandler):
    server_version = "NymphsWorld/0.1"

    @property
    def projects_root(self) -> Path:
        return self.server.projects_root  # type: ignore[attr-defined]

    @property
    def ui_root(self) -> Path:
        return self.server.ui_root  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)

    def do_GET(self) -> None:
        try:
            self.route_get()
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        try:
            self.route_write("POST")
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_PUT(self) -> None:
        try:
            self.route_write("PUT")
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def route_get(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        parts = [part for part in path.split("/") if part]

        if path in {"/", "/index.html"}:
            self.send_file(self.ui_root / "index.html", "text/html; charset=utf-8")
            return
        if path == "/health":
            self.send_json({"ok": True, "module": MODULE_ID})
            return
        if path == "/server_info":
            self.send_json(
                {
                    "id": MODULE_ID,
                    "name": MODULE_NAME,
                    "version": MODULE_VERSION,
                    "projects_root": str(self.projects_root),
                }
            )
            return
        if path == "/api/projects":
            self.send_json({"projects": [read_project(root) for root in project_roots(self.projects_root)]})
            return
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "index":
            project_root = self.project_root(parts[2])
            self.send_json(build_index(project_root))
            return
        if len(parts) == 5 and parts[:2] == ["api", "projects"] and parts[3] == "pages":
            project_root = self.project_root(parts[2])
            page = self.page_by_id(project_root, parts[4])
            self.send_json(page)
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def route_write(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        parts = [part for part in path.split("/") if part]
        payload = self.read_json()

        if method == "POST" and path == "/api/projects":
            title = str(payload.get("title") or "Untitled World")
            self.send_json(create_project(self.projects_root, title), HTTPStatus.CREATED)
            return
        if method == "POST" and path == "/api/demo":
            self.send_json(create_demo_project(self.projects_root), HTTPStatus.CREATED)
            return
        if method == "POST" and len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "pages":
            project_root = self.project_root(parts[2])
            page = create_page(
                project_root,
                str(payload.get("title") or "Untitled Page"),
                str(payload.get("type") or "lore"),
                str(payload.get("status") or "draft"),
                str(payload.get("summary") or ""),
                str(payload.get("body") or ""),
            )
            self.send_json(page, HTTPStatus.CREATED)
            return
        if method == "PUT" and len(parts) == 5 and parts[:2] == ["api", "projects"] and parts[3] == "pages":
            project_root = self.project_root(parts[2])
            page = self.page_by_id(project_root, parts[4])
            content = str(payload.get("content") or "")
            if not content.strip():
                self.send_json({"error": "Page content is required"}, HTTPStatus.BAD_REQUEST)
                return
            page_path = ensure_child(project_root, str(page["path"]))
            write_text(page_path, content)
            touch_project(project_root)
            self.send_json(page_record(project_root, page_path))
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def project_root(self, project_id: str) -> Path:
        safe = slugify(project_id)
        path = ensure_child(self.projects_root, safe)
        if not project_metadata_path(path).exists():
            raise FileNotFoundError("Project not found")
        return path

    def page_by_id(self, project_root: Path, page_id: str) -> dict[str, object]:
        index = build_index(project_root)
        for page in index["pages"]:
            if str(page["id"]) == page_id:
                page_path = ensure_child(project_root, str(page["path"]))
                record = page_record(project_root, page_path)
                record["backlinks"] = page.get("backlinks", [])
                return record
        raise FileNotFoundError("Page not found")

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def send_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self.send_json({"error": "File not found"}, HTTPStatus.NOT_FOUND)
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Nymphs World vault server.")
    parser.add_argument("--host", default=os.environ.get("NYMPHS_WORLD_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("NYMPHS_WORLD_PORT", "8098")))
    parser.add_argument(
        "--projects-root",
        default=os.environ.get(
            "NYMPHS_WORLD_PROJECTS_ROOT",
            str(Path.home() / "NymphsData" / "nymphs-world" / "projects"),
        ),
    )
    parser.add_argument("--ui-root", default=str(Path(__file__).resolve().parent / "ui"))
    args = parser.parse_args()

    projects_root = Path(args.projects_root).expanduser().resolve()
    ui_root = Path(args.ui_root).expanduser().resolve()
    projects_root.mkdir(parents=True, exist_ok=True)

    server = ThreadingHTTPServer((args.host, args.port), NymphsWorldHandler)
    server.projects_root = projects_root  # type: ignore[attr-defined]
    server.ui_root = ui_root  # type: ignore[attr-defined]
    print(f"{MODULE_NAME} listening on http://{args.host}:{args.port}", flush=True)
    print(f"projects_root={projects_root}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
