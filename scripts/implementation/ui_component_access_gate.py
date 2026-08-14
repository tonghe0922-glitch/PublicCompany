#!/usr/bin/env python3
"""Fail-closed UI component access gate for the PublicCompany web client."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Sequence


CANONICAL_DIR = Path("docs/implementation/ui")
REGISTRY_REL = CANONICAL_DIR / "UI_COMPONENT_REGISTRY.json"
REUSE_REL = CANONICAL_DIR / "UI_COMPONENT_REUSE_RULES.json"
SCHEMA_REL = CANONICAL_DIR / "PAGE_COMPONENT_USAGE_PLAN.schema.json"
EXCEPTIONS_REL = CANONICAL_DIR / "UI_NATIVE_ELEMENT_EXCEPTIONS.json"
PLANS_REL = CANONICAL_DIR / "page-component-plans"
DESIGN_INDEX_REL = Path("technical-platform/web/src/design-system/index.ts")
PLATFORM_INDEX_REL = Path("technical-platform/web/src/platform/processes/shared/index.ts")
ALIAS_TEST_REL = Path("technical-platform/web/src/design-system/ui-component-access.test.ts")
TS_CONFIG_REL = Path("technical-platform/web/tsconfig.app.json")
VITE_CONFIG_REL = Path("technical-platform/web/vite.config.ts")
PLATFORM_RUNTIME_EXPORTS = {
    "useAsyncAction": Path("technical-platform/web/src/platform/processes/shared/async/useAsyncAction.ts"),
    "useAsyncResource": Path("technical-platform/web/src/platform/processes/shared/async/useAsyncResource.ts"),
}

PHASE10_PAGES = (
    "P006MeetingPage",
    "P007SchedulePage",
    "P008LeavePage",
    "P009OvertimePage",
    "P010LearningPage",
)
READY_STATUSES = {"existing-stable", "existing-needs-fix", "internal", "deprecated"}
NOT_READY_STATUSES = {"planned", "blocked-by-contract", "deprecated"}
PUBLIC_LAYERS = {"design-system", "template", "layout"}
REGISTRY_STATUSES = {"existing-stable", "existing-needs-fix", "internal", "planned", "blocked-by-contract", "deprecated"}
REGISTRY_LAYERS = {"design-system", "template", "layout", "internal", "platform-composite"}
GOVERNED_COMPONENT_ROOTS = (
    Path("technical-platform/web/src/design-system"),
    Path("technical-platform/web/src/platform/processes/shared"),
)
RAW_TAGS = ("button", "input", "select", "textarea", "table", "dialog")
NATIVE_TAGS = {
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base",
    "bdi", "bdo", "blockquote", "body", "br", "button", "canvas", "caption",
    "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "details",
    "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
    "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head",
    "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins",
    "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta",
    "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p",
    "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script",
    "search", "section", "select", "slot", "small", "source", "span", "strong", "style",
    "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot",
    "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr",
    "component", "transition", "transition-group", "keep-alive", "teleport", "suspense",
}
DUPLICATE_PRIMITIVE_FILENAMES = {
    "Button.vue", "Input.vue", "Textarea.vue", "Select.vue", "Checkbox.vue",
    "RadioGroup.vue", "Switch.vue", "Upload.vue", "Dialog.vue", "Drawer.vue",
    "Table.vue", "Card.vue", "Avatar.vue", "StatusChip.vue",
}
REQUIRED_PLAN_FIELDS = {
    "schema_version", "page", "implementation_path", "portal_codes", "route_paths",
    "process_codes", "page_type", "page_template", "field_component_map",
    "state_component_map", "action_component_map", "gaps", "native_element_exceptions",
    "decision", "tests", "updated_at", "source_facts", "responsive_projection",
}
PAGE_TYPE_ENUM = ["list", "detail", "form", "approval", "timeline", "dashboard", "mixed"]
PORTAL_CODE_ENUM = ["employee", "center", "tech"]
DECISION_ENUM = [
    "reuse-only", "extend-existing", "new-platform-composite",
    "new-domain-feature", "blocked-by-contract",
]
COMPONENT_MAP_CONTRACT: dict[str, object] = {
    "type": "object",
    "required": ["component_id"],
    "properties": {
        "field": {"type": "string"},
        "state": {"type": "string"},
        "action": {"type": "string"},
        "component_id": {"type": "string", "minLength": 1},
        "reason": {"type": "string"},
        "editable_when": {"type": "string"},
        "confirmation": {"type": "string"},
        "permission": {"type": "string"},
    },
}
PLAN_PROPERTY_CONTRACT: dict[str, object] = {
    "schema_version": {"const": "1.0"},
    "page": {"type": "string", "minLength": 1},
    "implementation_path": {"type": "string", "minLength": 1},
    "portal_codes": {"type": "array", "items": {"enum": PORTAL_CODE_ENUM}, "minItems": 1, "uniqueItems": True},
    "route_paths": {"type": "array", "items": {"type": "string"}, "minItems": 1},
    "process_codes": {"type": "array", "items": {"type": "string"}},
    "page_type": {"enum": PAGE_TYPE_ENUM},
    "page_template": {"type": "string", "minLength": 1},
    "source_facts": {"type": "object"},
    "field_component_map": {"type": "array", "items": {"$ref": "#/$defs/componentMap"}},
    "state_component_map": {"type": "array", "items": {"$ref": "#/$defs/componentMap"}},
    "action_component_map": {"type": "array", "items": {"$ref": "#/$defs/componentMap"}},
    "responsive_projection": {"type": "object"},
    "gaps": {"type": "array", "items": {"type": "object"}},
    "native_element_exceptions": {"type": "array", "items": {"type": "object"}},
    "decision": {"enum": DECISION_ENUM},
    "registry_updates": {"type": "array", "items": {"type": "string"}},
    "tests": {"type": "array", "items": {"type": "string"}},
    "updated_at": {"type": "string", "minLength": 1},
}


@dataclass(frozen=True)
class Finding:
    code: str
    path: str
    message: str
    line: int | None = None
    excerpt: str | None = None
    severity: str = "error"


@dataclass(frozen=True)
class SfcScript:
    text: str
    setup: bool


def rel(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(path)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def read_json(path: Path) -> object:
    return json.loads(read_text(path))


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def required_json(root: Path, relative: Path, code: str, findings: list[Finding]) -> object | None:
    path = root / relative
    if not path.is_file():
        findings.append(Finding(f"{code}_MISSING", relative.as_posix(), "Canonical JSON file is missing"))
        return None
    try:
        return read_json(path)
    except Exception as exc:  # noqa: BLE001 - malformed authority must be reported
        findings.append(Finding(f"{code}_INVALID_JSON", relative.as_posix(), f"Invalid JSON: {exc}"))
        return None


def scan_js_non_code(text: str) -> tuple[str, list[str]]:
    """Mask comments, strings, templates and regex while preserving offsets/newlines."""
    masked = list(text)
    strings: list[str] = []
    index = 0
    previous_code = ""
    while index < len(text):
        char = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if char == "/" and following == "/":
            end = text.find("\n", index + 2)
            end = len(text) if end < 0 else end
            for offset in range(index, end):
                masked[offset] = " "
            index = end
            continue
        if char == "/" and following == "*":
            end = text.find("*/", index + 2)
            if end < 0:
                raise ValueError("unterminated block comment")
            end += 2
            for offset in range(index, end):
                if masked[offset] != "\n":
                    masked[offset] = " "
            index = end
            continue
        if char in {"'", '"', "`"}:
            quote = char
            end = index + 1
            value: list[str] = []
            while end < len(text):
                current = text[end]
                if current == "\\":
                    if end + 1 >= len(text):
                        raise ValueError("unterminated string escape")
                    value.append(text[end + 1])
                    end += 2
                    continue
                if current == quote:
                    end += 1
                    break
                value.append(current)
                end += 1
            else:
                raise ValueError("unterminated string or template literal")
            if quote != "`" or "${" not in "".join(value):
                strings.append("".join(value))
            for offset in range(index, end):
                if masked[offset] != "\n":
                    masked[offset] = " "
            index = end
            continue
        if char == "/" and following not in {"/", "*"} and previous_code in {"", "=", "(", "[", "{", ",", ":", ";", "!", "?", "&", "|"}:
            end = index + 1
            in_class = False
            while end < len(text):
                current = text[end]
                if current == "\\":
                    end += 2
                    continue
                if current == "[":
                    in_class = True
                elif current == "]":
                    in_class = False
                elif current == "/" and not in_class:
                    end += 1
                    while end < len(text) and text[end].isalpha():
                        end += 1
                    break
                elif current == "\n":
                    raise ValueError("unterminated regular expression")
                end += 1
            else:
                raise ValueError("unterminated regular expression")
            for offset in range(index, end):
                if masked[offset] != "\n":
                    masked[offset] = " "
            index = end
            continue
        if not char.isspace():
            previous_code = char
        index += 1
    return "".join(masked), strings


def js_top_level_statements(text: str) -> list[str]:
    masked, _ = scan_js_non_code(text)
    statements: list[str] = []
    start: int | None = None
    round_depth = square_depth = curly_depth = 0
    for index, char in enumerate(masked):
        if start is None and not char.isspace():
            start = index
        if char == "(":
            round_depth += 1
        elif char == ")":
            round_depth -= 1
        elif char == "[":
            square_depth += 1
        elif char == "]":
            square_depth -= 1
        elif char == "{":
            curly_depth += 1
        elif char == "}":
            curly_depth -= 1
        if min(round_depth, square_depth, curly_depth) < 0:
            raise ValueError("unbalanced JavaScript delimiter")
        continuation = False
        if char == "\n" and start is not None:
            next_index = index + 1
            while next_index < len(masked) and masked[next_index].isspace():
                next_index += 1
            current_text = masked[start:index].strip()
            continuation = current_text.startswith("export") and current_text.endswith("}") and masked.startswith("from", next_index)
        if start is not None and round_depth == square_depth == curly_depth == 0 and char in {";", "\n"} and not continuation:
            statement = text[start:index + 1].strip()
            if statement:
                statements.append(statement)
            start = None
    if round_depth or square_depth or curly_depth:
        raise ValueError("unbalanced JavaScript delimiter")
    if start is not None:
        statement = text[start:].strip()
        if statement:
            statements.append(statement)
    return statements


def executable_test_bodies(text: str) -> list[str]:
    masked, _ = scan_js_non_code(text)
    bodies: list[str] = []
    for match in re.finditer(r"\b(?:it|test)\s*\(", masked):
        opening = masked.find("(", match.start(), match.end())
        closing = matching_delimiter(text, opening, "(", ")") if opening >= 0 else None
        if closing is not None:
            bodies.append(masked[opening + 1:closing])
    return bodies


def binding_shadowed(code: str, binding: str) -> bool:
    root = binding.split(".", 1)[0]
    escaped = re.escape(root)
    simple_param = r"[A-Za-z_$][\w$]*(?:\s*:\s*[^,()=]+)?"
    params_with_root = rf"(?:{simple_param}\s*,\s*)*{escaped}(?:\s*:\s*[^,()=]+)?(?:\s*,\s*{simple_param})*"
    return bool(
        re.search(rf"\b(?:const|let|var|function|class)\s+{escaped}\b", code)
        or re.search(rf"\bfunction\b[^()]*\(\s*{params_with_root}\s*\)", code)
        or re.search(rf"\(\s*{params_with_root}\s*\)\s*=>", code)
        or re.search(rf"(?:^|[=(:,])\s*{escaped}\s*=>", code)
        or re.search(rf"\(\s*[{{\[][^}}\]]*\b{escaped}\b[^}}\]]*[}}\]]\s*\)\s*=>", code)
    )


def executable_test_coverage(text: str) -> tuple[dict[str, set[str]], bool]:
    statements = js_top_level_statements(text)
    masked, _ = scan_js_non_code(text)
    namespace_by_alias: dict[str, str] = {}
    arrays: dict[str, set[str]] = {}
    for statement in statements:
        import_match = re.fullmatch(
            r"import\s*\*\s*as\s*(?P<name>[A-Za-z_$][\w$]*)\s*from\s*['\"](?P<source>@sgj/(?:ui|platform-ui))['\"]\s*;?",
            statement,
            re.DOTALL,
        )
        if import_match:
            namespace = import_match.group("name")
            masked, _ = scan_js_non_code(text)
            unsafe_namespace = bool(
                re.search(rf"\b{re.escape(namespace)}\s*(?:\.|\[)[^;\n]*[+\-*/%]?=(?!=)", masked)
                or re.search(rf"\b(?:Object\s*\.\s*assign|Reflect\s*\.\s*(?:set|defineProperty|deleteProperty))\s*\(\s*{re.escape(namespace)}\b", masked)
                or re.search(rf"\b{re.escape(namespace)}\s*=(?!=)", masked)
            )
            if not unsafe_namespace:
                namespace_by_alias[import_match.group("source")] = namespace
            continue
        array_match = re.fullmatch(
            r"const\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*\[(?P<body>.*)\]\s*(?:as\s+const)?\s*;?",
            statement,
            re.DOTALL,
        )
        if array_match:
            _, values = scan_js_non_code(array_match.group("body"))
            variable = array_match.group("name")
            masked, _ = scan_js_non_code(text)
            declarations = list(re.finditer(rf"\bconst\s+{re.escape(variable)}\s*=", masked))
            if len(declarations) == 1:
                start = declarations[0].end()
                while start < len(text) and text[start].isspace():
                    start += 1
                end = matching_delimiter(text, start, "[", "]") if start < len(text) and text[start] == "[" else None
                if end is not None and binding_is_immutable(text, variable, end + 1):
                    arrays[variable] = set(values)
    test_bodies = [body for body in executable_test_bodies(text) if re.search(r"\b(?:expect|assert)\s*\(", body)]
    has_test_path = bool(test_bodies)
    coverage: dict[str, set[str]] = {}
    for alias, namespace in namespace_by_alias.items():
        names: set[str] = set()
        if has_test_path:
            for variable, values in arrays.items():
                for body in test_bodies:
                    if binding_shadowed(body, namespace) or binding_shadowed(body, variable):
                        continue
                    key_assertion = re.search(
                        rf"\bexpect\s*\(\s*Object\s*\.\s*keys\s*\(\s*{re.escape(namespace)}\s*\)\s*\.\s*sort\s*\(\s*\)\s*\)"
                        rf"\s*\.\s*toEqual\s*\(\s*\[\s*\.\.\.\s*{re.escape(variable)}\s*\]\s*\.\s*sort\s*\(\s*\)\s*\)",
                        body,
                        re.DOTALL,
                    )
                    loop = re.search(
                        rf"\bfor\s*\(\s*const\s+(?P<item>[A-Za-z_$][\w$]*)\s+of\s+{re.escape(variable)}\s*\)"
                        rf"[\s\S]*?\bexpect\s*\(\s*{re.escape(namespace)}\s*\[\s*(?P=item)\s*\]\s*\)",
                        body,
                    )
                    if key_assertion and loop:
                        names.update(values)
                        break
        coverage[alias] = names
    return coverage, has_test_path


def valid_required_test_path(value: str) -> bool:
    normalized = value.replace("\\", "/")
    return bool(
        normalized.startswith("technical-platform/web/src/")
        and "/evidence/" not in normalized.lower()
        and "/fixtures/" not in normalized.lower()
        and "/node_modules/" not in normalized.lower()
        and "/dist/" not in normalized.lower()
        and "/reports/" not in normalized.lower()
        and "/test-results/" not in normalized.lower()
        and re.search(r"\.(?:test|spec)\.(?:ts|tsx|js|jsx)$", normalized)
    )


def component_test_bindings(
    root: Path,
    test_path: Path,
    text: str,
    implementation: str,
    export_name: str | None,
    public_import: str | None,
) -> list[str]:
    bindings: list[str] = []
    for statement in js_top_level_statements(text):
        match = re.fullmatch(
            r"import\s+(?P<local>[A-Za-z_$][\w$]*)\s+from\s*['\"](?P<source>[^'\"]+)['\"]\s*;?",
            statement,
            re.DOTALL,
        )
        if match:
            resolved = (test_path.parent / match.group("source")).resolve()
            if rel(resolved, root) == implementation:
                bindings.append(match.group("local"))
            continue
        if export_name and public_import:
            namespace = re.fullmatch(
                r"import\s*\*\s*as\s*(?P<local>[A-Za-z_$][\w$]*)\s*from\s*['\"](?P<source>[^'\"]+)['\"]\s*;?",
                statement,
                re.DOTALL,
            )
            if namespace and namespace.group("source") == public_import:
                bindings.append(f"{namespace.group('local')}.{export_name}")
                continue
            named = re.fullmatch(
                r"import\s*\{(?P<items>.*?)\}\s*from\s*['\"](?P<source>[^'\"]+)['\"]\s*;?",
                statement,
                re.DOTALL,
            )
            if named and named.group("source") == public_import:
                for item in named.group("items").split(","):
                    parts = re.split(r"\s+as\s+", item.strip())
                    if parts and parts[0].strip() == export_name:
                        bindings.append(parts[-1].strip())
    return bindings


def binding_consumed_by_test(text: str, binding: str) -> bool:
    masked, _ = scan_js_non_code(text)
    for match in re.finditer(r"\b(?:it|test)\s*\(", masked):
        opening = masked.find("(", match.start(), match.end())
        closing = matching_delimiter(text, opening, "(", ")") if opening >= 0 else None
        if closing is None:
            continue
        body = masked[opening + 1:closing]
        if binding_shadowed(body, binding):
            continue
        if not re.search(r"\b(?:expect|assert)\s*\(", body):
            continue
        if re.search(rf"\b(?:mount|mountRuntime|shallowMount|h|expect|assert)\s*\(\s*{re.escape(binding)}\b", body):
            return True
    return False


def validate_required_tests(
    root: Path,
    component_id: str,
    implementation: str,
    export_name: str | None,
    public_import: str | None,
    tests: object,
    findings: list[Finding],
) -> bool:
    if not isinstance(tests, list) or not tests or any(not isinstance(value, str) or not value for value in tests):
        findings.append(Finding("REGISTRY_TEST_DECLARATION_INVALID", REGISTRY_REL.as_posix(), component_id))
        return False
    valid_count = 0
    for value in tests:
        assert isinstance(value, str)
        if not valid_required_test_path(value):
            findings.append(Finding("PUBLIC_TEST_PATH_INVALID", REGISTRY_REL.as_posix(), f"{component_id}: {value}"))
            continue
        path = root / value
        if not path.is_file():
            findings.append(Finding("PUBLIC_TEST_MISSING", value, f"{component_id} required test is missing"))
            continue
        text = read_text(path)
        try:
            matching_bindings = component_test_bindings(
                root, path, text, implementation, export_name, public_import,
            )
        except ValueError as exc:
            findings.append(Finding("PUBLIC_TEST_GRAMMAR_UNSUPPORTED", value, f"{component_id}: {exc}"))
            continue
        if len(matching_bindings) != 1 or not binding_consumed_by_test(text, matching_bindings[0]):
            findings.append(Finding("PUBLIC_TEST_COMPONENT_UNCOVERED", value, f"{component_id}: required test must import and execute {implementation}"))
            continue
        valid_count += 1
    if valid_count == 0:
        findings.append(Finding("PUBLIC_TEST_MISSING", REGISTRY_REL.as_posix(), f"{component_id} has no valid executable required test"))
        return False
    return True


def parse_barrel(root: Path, relative: Path, findings: list[Finding]) -> dict[str, str]:
    path = root / relative
    if not path.is_file():
        findings.append(Finding("PUBLIC_INDEX_MISSING", relative.as_posix(), "Public index is missing"))
        return {}
    exports: dict[str, str] = {}
    text = read_text(path)
    try:
        statements = js_top_level_statements(text)
    except ValueError as exc:
        findings.append(Finding("PUBLIC_EXPORT_GRAMMAR_INVALID", relative.as_posix(), str(exc)))
        return exports
    component_export = re.compile(
        r"export\s*\{\s*default\s+as\s+(?P<name>[A-Za-z_$][\w$]*)\s*\}"
        r"\s*from\s*['\"](?P<source>[^'\"]+)['\"]\s*;?",
        re.DOTALL,
    )
    type_export = re.compile(
        r"export\s+type\s*\{\s*(?:[A-Za-z_$][\w$]*\s*,\s*)*[A-Za-z_$][\w$]*\s*,?\s*\}"
        r"\s*from\s*['\"][^'\"]+['\"]\s*;?",
        re.DOTALL,
    )
    empty_export = re.compile(r"export\s*\{\s*\}\s*;?", re.DOTALL)
    for statement in statements:
        masked_statement, _ = scan_js_non_code(statement)
        if not re.match(r"\s*export\b", masked_statement):
            continue
        match = component_export.fullmatch(statement)
        if match is None:
            if type_export.fullmatch(statement) or empty_export.fullmatch(statement):
                continue
            findings.append(Finding("PUBLIC_EXPORT_GRAMMAR_UNSUPPORTED", relative.as_posix(), statement[:160]))
            continue
        name = match.group("name")
        source = match.group("source")
        resolved = (path.parent / source).resolve()
        if relative == PLATFORM_INDEX_REL and name in PLATFORM_RUNTIME_EXPORTS:
            if Path(source).suffix:
                findings.append(Finding(
                    "PUBLIC_RUNTIME_EXPORT_SPECIFIER_INVALID",
                    relative.as_posix(),
                    f"{name} must use an extensionless specifier, got {source}",
                ))
            else:
                resolved = Path(f"{resolved}.ts")
        source_rel = rel(resolved, root)
        if not resolved.is_file():
            findings.append(Finding("PUBLIC_EXPORT_SOURCE_MISSING", relative.as_posix(), f"{name} targets missing {source_rel}"))
        if name in exports:
            findings.append(Finding("PUBLIC_EXPORT_DUPLICATE", relative.as_posix(), f"Duplicate export {name}"))
        exports[name] = source_rel
    return exports


def validate_aliases(root: Path, findings: list[Finding]) -> None:
    tsconfig = required_json(root, TS_CONFIG_REL, "TSCONFIG", findings)
    if isinstance(tsconfig, dict):
        compiler = tsconfig.get("compilerOptions")
        paths = compiler.get("paths") if isinstance(compiler, dict) else None
        expected = {
            "@sgj/ui": ["src/design-system/index.ts"],
            "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"],
        }
        for alias, target in expected.items():
            if not isinstance(paths, dict) or paths.get(alias) != target:
                findings.append(Finding("ALIAS_TSCONFIG_INVALID", TS_CONFIG_REL.as_posix(), f"{alias} must resolve exactly to {target[0]}"))

    vite = root / VITE_CONFIG_REL
    if not vite.is_file():
        findings.append(Finding("VITE_CONFIG_MISSING", VITE_CONFIG_REL.as_posix(), "Vite config is missing"))
        return
    text = read_text(vite)
    expected_vite = {
        "@sgj/ui": "src/design-system/index.ts",
        "@sgj/platform-ui": "src/platform/processes/shared/index.ts",
    }
    for alias, target in expected_vite.items():
        pattern = re.compile(
            rf"['\"]{re.escape(alias)}['\"]\s*:\s*resolve\(\s*import\.meta\.dirname\s*,\s*['\"]{re.escape(target)}['\"]\s*\)"
        )
        if not pattern.search(text):
            findings.append(Finding("ALIAS_VITE_INVALID", VITE_CONFIG_REL.as_posix(), f"{alias} must resolve exactly to {target}"))
    if len(re.findall(r"resolve\s*:\s*\{\s*alias\s*:\s*publicComponentAliases\s*\}", text)) < 3:
        findings.append(Finding("ALIAS_VITE_MODE_MISSING", VITE_CONFIG_REL.as_posix(), "Aliases must be active in test, analysis, and portal build modes"))


def validate_registry(root: Path, findings: list[Finding]) -> dict[str, dict[str, object]]:
    raw = required_json(root, REGISTRY_REL, "REGISTRY", findings)
    if not isinstance(raw, dict) or not isinstance(raw.get("components"), list):
        if raw is not None:
            findings.append(Finding("REGISTRY_INVALID_SHAPE", REGISTRY_REL.as_posix(), "components must be an array"))
        return {}

    entries: dict[str, dict[str, object]] = {}
    names: set[str] = set()
    paths: dict[str, str] = {}
    for index, item in enumerate(raw["components"]):
        if not isinstance(item, dict):
            findings.append(Finding("REGISTRY_ENTRY_INVALID", REGISTRY_REL.as_posix(), f"Entry {index + 1} is not an object"))
            continue
        component_id = item.get("id")
        name = item.get("name")
        implementation = item.get("implementation_path")
        if not isinstance(component_id, str) or not component_id:
            findings.append(Finding("REGISTRY_ID_MISSING", REGISTRY_REL.as_posix(), f"Entry {index + 1} has no stable id"))
            continue
        if component_id in entries:
            findings.append(Finding("REGISTRY_ID_DUPLICATE", REGISTRY_REL.as_posix(), component_id))
            continue
        entries[component_id] = item
        if not isinstance(name, str) or not name:
            findings.append(Finding("REGISTRY_NAME_MISSING", REGISTRY_REL.as_posix(), component_id))
        elif name in names:
            findings.append(Finding("REGISTRY_NAME_DUPLICATE", REGISTRY_REL.as_posix(), name))
        else:
            names.add(name)
        if not isinstance(implementation, str) or not implementation:
            findings.append(Finding("REGISTRY_PATH_MISSING", REGISTRY_REL.as_posix(), component_id))
        elif implementation in paths:
            findings.append(Finding("REGISTRY_PATH_DUPLICATE", REGISTRY_REL.as_posix(), f"{implementation}: {paths[implementation]} and {component_id}"))
        else:
            paths[implementation] = component_id

    design_exports = parse_barrel(root, DESIGN_INDEX_REL, findings)
    platform_exports = parse_barrel(root, PLATFORM_INDEX_REL, findings)
    for export_name, expected_path in PLATFORM_RUNTIME_EXPORTS.items():
        actual_path = platform_exports.get(export_name)
        if actual_path is None:
            findings.append(Finding(
                "PUBLIC_RUNTIME_EXPORT_MISSING",
                PLATFORM_INDEX_REL.as_posix(),
                f"{export_name} must export exactly {expected_path.as_posix()}",
            ))
        elif actual_path != expected_path.as_posix():
            findings.append(Finding(
                "PUBLIC_RUNTIME_EXPORT_INVALID",
                PLATFORM_INDEX_REL.as_posix(),
                f"{export_name} targets {actual_path}, expected {expected_path.as_posix()}",
            ))
    actual_governed = {
        rel(path, root)
        for governed_root in GOVERNED_COMPONENT_ROOTS
        for path in (root / governed_root).rglob("*.vue")
        if (root / governed_root).is_dir()
    }
    registered_governed = {
        str(item.get("implementation_path"))
        for item in entries.values()
        if any(
            str(item.get("implementation_path", "")).startswith(prefix.as_posix() + "/")
            for prefix in GOVERNED_COMPONENT_ROOTS
        )
    }
    for path in sorted(actual_governed - registered_governed):
        findings.append(Finding("COMPONENT_NOT_REGISTERED", path, "Governed component source is absent from the canonical registry"))

    export_by_path: dict[str, tuple[str, Path]] = {}
    for barrel, barrel_path in ((design_exports, DESIGN_INDEX_REL), (platform_exports, PLATFORM_INDEX_REL)):
        for export_name, implementation in barrel.items():
            if barrel_path == PLATFORM_INDEX_REL and export_name in PLATFORM_RUNTIME_EXPORTS:
                if implementation == PLATFORM_RUNTIME_EXPORTS[export_name].as_posix():
                    continue
                # The fixed runtime-export validation above owns this invalid mapping.
                continue
            if implementation in export_by_path:
                findings.append(Finding("PUBLIC_EXPORT_PATH_DUPLICATE", barrel_path.as_posix(), f"{implementation} is exported more than once"))
            export_by_path[implementation] = (export_name, barrel_path)
            registry_id = paths.get(implementation)
            if registry_id is None:
                findings.append(Finding("PUBLIC_EXPORT_NOT_REGISTERED", barrel_path.as_posix(), f"{export_name} exports unregistered {implementation}"))

    access_test_path = root / ALIAS_TEST_REL
    access_test = read_text(access_test_path) if access_test_path.is_file() else ""
    access_coverage: dict[str, set[str]] = {}
    if not access_test:
        findings.append(Finding("PUBLIC_ACCESS_TEST_MISSING", ALIAS_TEST_REL.as_posix(), "The public alias coverage test is missing"))
    else:
        try:
            access_coverage, has_access_test_path = executable_test_coverage(access_test)
            if not has_access_test_path:
                findings.append(Finding("PUBLIC_ACCESS_TEST_INVALID", ALIAS_TEST_REL.as_posix(), "Alias test must contain executable test/expect/assert code"))
        except ValueError as exc:
            findings.append(Finding("PUBLIC_ACCESS_TEST_GRAMMAR_UNSUPPORTED", ALIAS_TEST_REL.as_posix(), str(exc)))

    for export_name, expected_path in PLATFORM_RUNTIME_EXPORTS.items():
        if (
            platform_exports.get(export_name) == expected_path.as_posix()
            and export_name not in access_coverage.get("@sgj/platform-ui", set())
        ):
            findings.append(Finding(
                "PUBLIC_RUNTIME_ACCESS_TEST_UNCOVERED",
                ALIAS_TEST_REL.as_posix(),
                f"Runtime export {export_name} is not asserted by the executable alias test",
            ))

    for component_id, item in entries.items():
        implementation = item.get("implementation_path")
        status = item.get("status")
        public = item.get("public") is True
        layer = item.get("layer")
        export_name = item.get("export_name")
        if not isinstance(implementation, str):
            continue
        if status not in REGISTRY_STATUSES:
            findings.append(Finding("REGISTRY_STATUS_INVALID", REGISTRY_REL.as_posix(), f"{component_id}: {status!r}"))
            continue
        if layer not in REGISTRY_LAYERS:
            findings.append(Finding("REGISTRY_LAYER_INVALID", REGISTRY_REL.as_posix(), f"{component_id}: {layer!r}"))
            continue
        source = root / implementation
        is_ready = status in {"existing-stable", "existing-needs-fix"}
        is_internal = status == "internal"
        is_future = status in {"planned", "blocked-by-contract"}
        expected_alias = "@sgj/platform-ui" if layer == "platform-composite" else "@sgj/ui"
        barrel_entry = export_by_path.get(implementation)
        tests = item.get("required_tests")

        if status in READY_STATUSES and not source.is_file():
            findings.append(Finding("REGISTERED_SOURCE_MISSING", implementation, f"{component_id} is {status} but has no source"))
        if is_future and source.is_file():
            findings.append(Finding("REGISTRY_STATUS_STALE", implementation, f"{component_id} has source but remains {status}"))

        if (is_ready or is_internal) and source.is_file():
            validate_required_tests(
                root,
                component_id,
                implementation,
                export_name if isinstance(export_name, str) else None,
                item.get("public_import") if isinstance(item.get("public_import"), str) else None,
                tests,
                findings,
            )

        if is_internal:
            if layer != "internal" or public or item.get("public_import") is not None or export_name is not None:
                findings.append(Finding("REGISTRY_INTERNAL_COMBINATION_INVALID", REGISTRY_REL.as_posix(), component_id))
            if barrel_entry is not None:
                findings.append(Finding("INTERNAL_COMPONENT_EXPORTED", barrel_entry[1].as_posix(), f"Internal component {component_id} is public"))
            continue

        if layer == "internal":
            findings.append(Finding("REGISTRY_LAYER_STATUS_INVALID", REGISTRY_REL.as_posix(), f"{component_id}: internal layer requires internal status"))

        if not public or item.get("public_import") != expected_alias or not isinstance(export_name, str) or not export_name:
            findings.append(Finding("REGISTRY_PUBLIC_COMBINATION_INVALID", REGISTRY_REL.as_posix(), f"{component_id}: public/import/export fields do not match {layer}/{status}"))

        if is_future:
            if barrel_entry is not None:
                findings.append(Finding("PLANNED_COMPONENT_EXPORTED", barrel_entry[1].as_posix(), f"{component_id} is {status} but exported"))
            continue

        if status == "deprecated" and public:
            findings.append(Finding("REGISTRY_DEPRECATED_PUBLIC", REGISTRY_REL.as_posix(), component_id))
            continue
        if not is_ready:
            continue
        if barrel_entry is None or barrel_entry[0] != export_name:
            expected_index = DESIGN_INDEX_REL if expected_alias == "@sgj/ui" else PLATFORM_INDEX_REL
            findings.append(Finding("PUBLIC_EXPORT_MISSING", expected_index.as_posix(), f"{component_id} must export {export_name} from {implementation}"))
        elif (expected_alias == "@sgj/ui") != (barrel_entry[1] == DESIGN_INDEX_REL):
            findings.append(Finding("PUBLIC_EXPORT_WRONG_BARREL", barrel_entry[1].as_posix(), component_id))
        if isinstance(export_name, str) and export_name not in access_coverage.get(expected_alias, set()):
            findings.append(Finding("PUBLIC_ACCESS_TEST_UNCOVERED", ALIAS_TEST_REL.as_posix(), f"Public export {export_name} is not asserted by the alias test"))
    return entries


def validate_schema_value(value: object, schema: dict[str, object], root_schema: dict[str, object], location: str) -> list[str]:
    errors: list[str] = []
    if "$ref" in schema:
        reference = schema.get("$ref")
        if not isinstance(reference, str) or not reference.startswith("#/$defs/"):
            return [f"{location}: unsupported $ref {reference!r}"]
        target = root_schema.get("$defs", {})
        if not isinstance(target, dict) or not isinstance(target.get(reference.split("/")[-1]), dict):
            return [f"{location}: unresolved $ref {reference}"]
        return validate_schema_value(value, target[reference.split("/")[-1]], root_schema, location)

    expected_type = schema.get("type")
    type_matches = {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "number": isinstance(value, (int, float)) and not isinstance(value, bool),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
        "null": value is None,
    }
    if isinstance(expected_type, str) and not type_matches.get(expected_type, False):
        return [f"{location}: expected {expected_type}, got {type(value).__name__}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{location}: expected constant {schema['const']!r}")
    enum = schema.get("enum")
    if isinstance(enum, list) and value not in enum:
        errors.append(f"{location}: value {value!r} is outside enum")
    if isinstance(value, str) and isinstance(schema.get("minLength"), int) and len(value) < int(schema["minLength"]):
        errors.append(f"{location}: string is shorter than minLength")
    if isinstance(value, list):
        if isinstance(schema.get("minItems"), int) and len(value) < int(schema["minItems"]):
            errors.append(f"{location}: array is shorter than minItems")
        if schema.get("uniqueItems") is True:
            serialized = [json.dumps(item, ensure_ascii=False, sort_keys=True) for item in value]
            if len(serialized) != len(set(serialized)):
                errors.append(f"{location}: array items are not unique")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                errors.extend(validate_schema_value(item, item_schema, root_schema, f"{location}[{index}]"))
    if isinstance(value, dict):
        required = schema.get("required")
        if isinstance(required, list):
            for key in required:
                if key not in value:
                    errors.append(f"{location}: required property {key!r} is missing")
        properties = schema.get("properties")
        if isinstance(properties, dict):
            allowed = set(properties)
            if location == "$":
                allowed.add("$schema")
            for key in value:
                if key not in allowed:
                    errors.append(f"{location}: unknown property {key!r}")
            for key, child_schema in properties.items():
                if key in value and isinstance(child_schema, dict):
                    errors.extend(validate_schema_value(value[key], child_schema, root_schema, f"{location}.{key}"))
    return errors


def validate_reuse_and_schema(root: Path, findings: list[Finding]) -> dict[str, object] | None:
    reuse = required_json(root, REUSE_REL, "REUSE_RULES", findings)
    if isinstance(reuse, dict):
        if reuse.get("approved_imports") != ["@sgj/ui", "@sgj/platform-ui", "process-local public index.ts"]:
            findings.append(Finding("REUSE_APPROVED_IMPORTS_INVALID", REUSE_REL.as_posix(), "Approved imports must preserve the canonical order"))
        if not isinstance(reuse.get("decision_flow"), list) or len(reuse["decision_flow"]) < 6:
            findings.append(Finding("REUSE_DECISION_FLOW_INVALID", REUSE_REL.as_posix(), "The L1/L2/L3/BLOCKED decision flow is incomplete"))
    schema = required_json(root, SCHEMA_REL, "PLAN_SCHEMA", findings)
    if isinstance(schema, dict):
        if schema.get("$id") != "urn:shangjingu:page-component-usage-plan:1.0":
            findings.append(Finding("PLAN_SCHEMA_ID_INVALID", SCHEMA_REL.as_posix(), "Unexpected plan schema id"))
        required = schema.get("required")
        if not isinstance(required, list) or not REQUIRED_PLAN_FIELDS.issubset(set(required)):
            findings.append(Finding("PLAN_SCHEMA_REQUIRED_INVALID", SCHEMA_REL.as_posix(), "Plan required fields are incomplete"))
        if schema.get("type") != "object" or not isinstance(schema.get("properties"), dict) or not isinstance(schema.get("$defs"), dict):
            findings.append(Finding("PLAN_SCHEMA_STRUCTURE_INVALID", SCHEMA_REL.as_posix(), "Canonical schema must define object properties and reusable definitions"))
        meta_errors: list[str] = []
        expected_schema_keys = {"$schema", "$id", "title", "type", "required", "properties", "$defs"}
        if set(schema) != expected_schema_keys:
            meta_errors.append("canonical schema top-level keys differ from the fixed meta-contract")
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema" or schema.get("title") != "Page Component Usage Plan":
            meta_errors.append("canonical schema dialect/title changed")
        if not isinstance(required, list) or set(required) != REQUIRED_PLAN_FIELDS or len(required) != len(REQUIRED_PLAN_FIELDS):
            meta_errors.append("required must equal the fixed canonical field set")
        properties = schema.get("properties")
        if not isinstance(properties, dict) or set(properties) != set(PLAN_PROPERTY_CONTRACT):
            meta_errors.append("top-level property set differs from the fixed contract")
        elif any(properties.get(key) != expected for key, expected in PLAN_PROPERTY_CONTRACT.items()):
            changed = sorted(key for key, expected in PLAN_PROPERTY_CONTRACT.items() if properties.get(key) != expected)
            meta_errors.append(f"top-level property contracts changed: {', '.join(changed)}")
        definitions = schema.get("$defs")
        if not isinstance(definitions, dict) or set(definitions) != {"componentMap"} or definitions.get("componentMap") != COMPONENT_MAP_CONTRACT:
            meta_errors.append("$defs.componentMap differs from the fixed nested contract")
        for message in meta_errors:
            findings.append(Finding("PLAN_SCHEMA_META_CONTRACT_INVALID", SCHEMA_REL.as_posix(), message))
        return schema
    return None


def validate_exceptions(root: Path, findings: list[Finding]) -> None:
    raw = required_json(root, EXCEPTIONS_REL, "NATIVE_EXCEPTIONS", findings)
    if not isinstance(raw, dict) or not isinstance(raw.get("exceptions"), list):
        if raw is not None:
            findings.append(Finding("NATIVE_EXCEPTIONS_INVALID_SHAPE", EXCEPTIONS_REL.as_posix(), "exceptions must be an array"))
        return
    if raw["exceptions"]:
        findings.append(Finding("NATIVE_EXCEPTIONS_NOT_EMPTY", EXCEPTIONS_REL.as_posix(), "P10-COMP-03A requires an empty exception ledger; debt belongs in the findings report"))


def component_ids(plan: dict[str, object]) -> set[str]:
    result: set[str] = set()
    template = plan.get("page_template")
    if isinstance(template, str):
        result.add(template)
    for key in ("field_component_map", "state_component_map", "action_component_map"):
        values = plan.get(key)
        if isinstance(values, list):
            for value in values:
                if isinstance(value, dict) and isinstance(value.get("component_id"), str):
                    result.add(str(value["component_id"]))
    return result


def validate_plans(root: Path, registry: dict[str, dict[str, object]], schema: dict[str, object] | None, findings: list[Finding]) -> None:
    for page in PHASE10_PAGES:
        relative = PLANS_REL / f"{page}.ui-plan.json"
        raw = required_json(root, relative, "PAGE_PLAN", findings)
        if not isinstance(raw, dict):
            continue
        if schema is not None:
            schema_errors = validate_schema_value(raw, schema, schema, "$")
            for message in schema_errors:
                findings.append(Finding("PAGE_PLAN_SCHEMA_INVALID", relative.as_posix(), message))
        missing = sorted(REQUIRED_PLAN_FIELDS - set(raw))
        if missing:
            findings.append(Finding("PAGE_PLAN_FIELDS_MISSING", relative.as_posix(), ", ".join(missing)))
        expected_impl = f"technical-platform/web/src/platform/pages/{page}.vue"
        if raw.get("page") != page or raw.get("implementation_path") != expected_impl:
            findings.append(Finding("PAGE_PLAN_IDENTITY_MISMATCH", relative.as_posix(), f"Expected {page} / {expected_impl}"))
        if not (root / expected_impl).is_file():
            findings.append(Finding("PAGE_PLAN_IMPLEMENTATION_MISSING", expected_impl, "Planned page source is missing"))
        if raw.get("schema_version") != "1.0":
            findings.append(Finding("PAGE_PLAN_SCHEMA_VERSION_INVALID", relative.as_posix(), "schema_version must be 1.0"))
        for key in ("portal_codes", "route_paths", "tests"):
            if not isinstance(raw.get(key), list) or not raw[key]:
                findings.append(Finding("PAGE_PLAN_COLLECTION_EMPTY", relative.as_posix(), f"{key} must be a non-empty array"))
        source_facts = raw.get("source_facts")
        projection = raw.get("responsive_projection")
        if not isinstance(source_facts, dict) or not all(isinstance(source_facts.get(key), list) and source_facts[key] for key in ("permissions", "states", "actions")):
            findings.append(Finding("PAGE_PLAN_SOURCE_FACTS_INCOMPLETE", relative.as_posix(), "permissions/states/actions must be non-empty arrays"))
        if not isinstance(projection, dict) or not all(isinstance(projection.get(key), str) and projection[key] for key in ("desktop", "mobile")):
            findings.append(Finding("PAGE_PLAN_RESPONSIVE_INCOMPLETE", relative.as_posix(), "desktop and mobile projections are required"))
        if raw.get("native_element_exceptions") != []:
            findings.append(Finding("PAGE_PLAN_NATIVE_EXCEPTION", relative.as_posix(), "Page plan must not introduce a native-element exception"))
        for component_id in sorted(component_ids(raw)):
            item = registry.get(component_id)
            if item is None:
                findings.append(Finding("PAGE_PLAN_COMPONENT_UNKNOWN", relative.as_posix(), component_id))
            elif item.get("status") in NOT_READY_STATUSES:
                findings.append(Finding("PAGE_PLAN_COMPONENT_NOT_READY", relative.as_posix(), f"{component_id}: {item.get('status')}"))


def is_test_or_evidence(path: Path) -> bool:
    lowered = path.as_posix().lower()
    return bool(
        re.search(r"\.(?:test|spec)\.(?:ts|tsx|js|jsx)$", path.name, re.IGNORECASE)
        or "/evidence/" in lowered
        or "/fixtures/" in lowered
    )


def source_files(root: Path, scope: str, changed_file: Path | None) -> list[Path]:
    if scope == "changed":
        if changed_file is None or not changed_file.is_file():
            raise ValueError("--scope changed requires --changed-files")
        result = []
        for value in read_text(changed_file).splitlines():
            candidate = root / value.strip()
            if candidate.is_file() and candidate.suffix.lower() in {".vue", ".ts", ".tsx", ".js", ".jsx"}:
                result.append(candidate)
        return sorted(set(result))
    src = root / "technical-platform/web/src"
    governed = tuple((root / item).resolve() for item in GOVERNED_COMPONENT_ROOTS)
    result = {
        path
        for path in src.rglob("*") if src.is_dir()
        if path.is_file()
        and path.suffix.lower() in {".vue", ".ts", ".tsx", ".js", ".jsx"}
        and not is_test_or_evidence(path)
        and not any(path.resolve().is_relative_to(directory) for directory in governed)
    }
    if scope == "phase10":
        page_paths = {root / f"technical-platform/web/src/platform/pages/{page}.vue" for page in PHASE10_PAGES}
        process_paths = {
            path for path in result
            if re.search(r"/platform/processes/p0(?:06|07|08|09|10)/", "/" + path.as_posix().lower())
        }
        return sorted((result & page_paths) | process_paths)
    return sorted(result)


def parse_quoted_string(text: str) -> str | None:
    candidate = text.strip()
    if len(candidate) < 2 or candidate[0] not in {"'", '"', "`"} or candidate[-1] != candidate[0]:
        return None
    if candidate[0] == "`" and "${" in candidate:
        return None
    index = 1
    value: list[str] = []
    while index < len(candidate) - 1:
        if candidate[index] == "\\":
            if index + 1 >= len(candidate) - 1:
                return None
            value.append(candidate[index + 1])
            index += 2
        else:
            value.append(candidate[index])
            index += 1
    return "".join(value)


def matching_delimiter(text: str, start: int, opening: str, closing: str) -> int | None:
    masked, _ = scan_js_non_code(text)
    depth = 0
    for index in range(start, len(masked)):
        if masked[index] == opening:
            depth += 1
        elif masked[index] == closing:
            depth -= 1
            if depth == 0:
                return index
    return None


def binding_is_immutable(
    text: str,
    name: str,
    initializer_end: int,
    allow_static_object_spread: bool = False,
    seen: set[str] | None = None,
) -> bool:
    masked, _ = scan_js_non_code(text)
    tail = masked[initializer_end:]
    escaped = re.escape(name)
    seen = set() if seen is None else set(seen)
    if name in seen:
        return False
    seen.add(name)
    unsafe = (
        rf"\b{escaped}\s*(?:\.|\[)[^;\n]*?(?:\+\+|--|[+\-*/%]?=(?!=))",
        rf"(?:\+\+|--)\s*\b{escaped}(?:\s*(?:\.|\[))?",
        rf"\bdelete\s+{escaped}(?:\s*(?:\.|\[))?",
        rf"\b(?:Object\s*\.\s*assign|Reflect\s*\.\s*(?:set|defineProperty|deleteProperty)|Object\s*\.\s*defineProperty)\s*\(\s*{escaped}\b",
        rf"\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*{escaped}\b",
        rf"(?<![=!<>])\b[A-Za-z_$][\w$]*\s*=\s*{escaped}\b",
        rf"\breturn\s+{escaped}\b",
        rf"=>\s*{escaped}\b",
        rf"\b{escaped}\s*(?:\.|\[)[^;\n()]*\(",
        rf"\b{escaped}\s*=(?!=)",
        # An object held in an array/tuple is no longer locally auditable.  In
        # particular, `[attrs].forEach(x => x.is = 'button')` and
        # `aliases[0].is = 'button'` evade a direct property-write search.
        rf"\[\s*{escaped}\s*(?:,|\])",
    )
    if any(re.search(pattern, tail, re.DOTALL) for pattern in unsafe):
        return False
    for declaration in re.finditer(r"\bconst\s+(?P<container>[A-Za-z_$][\w$]*)\s*=", tail):
        start = initializer_end + declaration.end()
        while start < len(text) and text[start].isspace():
            start += 1
        if start >= len(text) or text[start] not in "[{":
            continue
        closing = "}" if text[start] == "{" else "]"
        end = matching_delimiter(text, start, text[start], closing)
        if end is None:
            return False
        initializer = text[start:end + 1]
        initializer_masked, _ = scan_js_non_code(initializer)
        occurrences = list(re.finditer(rf"\b{escaped}\b", initializer_masked))
        if not occurrences:
            continue
        spread_only = text[start] == "{" and all(
            re.search(r"\.\.\.\s*$", initializer_masked[:match.start()]) is not None
            for match in occurrences
        )
        container = declaration.group("container")
        if not allow_static_object_spread or not spread_only:
            return False
        if not binding_is_immutable(text, container, end + 1, True, seen):
            return False
    for call in re.finditer(r"\b(?P<callee>[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\((?P<args>[^()]*)\)", tail, re.DOTALL):
        callee = re.sub(r"\s+", "", call.group("callee"))
        if callee in {
            "import", "for", "if", "while", "switch", "catch", "with",
            "expect", "assert", "Object.keys", "Object.values", "Object.entries",
        }:
            continue
        if re.search(rf"\b{escaped}\b", call.group("args")):
            return False
    return True


PROGRAMMATIC_VUE_FACTORIES = {
    "h", "createVNode", "createBlock", "createBaseVNode",
    "createElementVNode", "createElementBlock", "resolveDynamicComponent",
    "resolveComponent",
}


def binding_has_write(text: str, name: str, initializer_end: int) -> bool:
    masked, _ = scan_js_non_code(text)
    tail = masked[initializer_end:]
    return re.search(
        rf"(?:\b{re.escape(name)}\s*(?:\.|\[)[^;\n]*?(?:\+\+|--|[+\-*/%]?=(?!=))|"
        rf"(?:\+\+|--)\s*\b{re.escape(name)}|\b{re.escape(name)}\s*=(?!=)|"
        rf"\b(?:Object\s*\.\s*assign|Reflect\s*\.\s*(?:set|defineProperty|deleteProperty))\s*\(\s*{re.escape(name)}\b)",
        tail,
        re.DOTALL,
    ) is not None


def vue_factory_bindings(script: str) -> tuple[set[str], set[str], set[str]]:
    """Return unambiguous local bindings for Vue render factories.

    This is deliberately narrow: unsupported import syntax is not treated as a
    safe factory binding.  A one-hop immutable `const alias = h` is supported
    because it is common in render helpers; later mutation makes the alias
    unavailable and its use fails closed in the caller.
    """
    bindings: set[str] = set()
    tainted: set[str] = set()
    namespaces: set[str] = set()
    for statement in js_top_level_statements(script):
        source = import_statement_source(statement)
        if source != "vue":
            continue
        namespace = re.search(r"\*\s+as\s+(?P<local>[A-Za-z_$][\w$]*)", statement)
        if namespace:
            namespaces.add(namespace.group("local"))
        named = re.search(r"\{(?P<names>.*?)\}", statement, re.DOTALL)
        if not named:
            continue
        for item in split_top_level_csv(named.group("names")):
            match = re.fullmatch(r"\s*(?P<original>[A-Za-z_$][\w$]*)(?:\s+as\s+(?P<local>[A-Za-z_$][\w$]*))?\s*", item)
            if match and match.group("original") in PROGRAMMATIC_VUE_FACTORIES:
                bindings.add(match.group("local") or match.group("original"))
    masked, _ = scan_js_non_code(script)
    changed = True
    while changed:
        changed = False
        for match in re.finditer(r"\bconst\s+(?P<alias>[A-Za-z_$][\w$]*)\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
            source = match.group("source")
            alias = match.group("alias")
            if source in namespaces and alias not in namespaces and not binding_has_write(script, alias, match.end()):
                namespaces.add(alias)
                changed = True
    for match in re.finditer(r"\bconst\s*\{(?P<names>[^{}]+)\}\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
        if match.group("source") not in namespaces:
            continue
        for item in split_top_level_csv(match.group("names")):
            named = re.fullmatch(r"\s*(?P<original>[A-Za-z_$][\w$]*)(?:\s*:\s*(?P<local>[A-Za-z_$][\w$]*))?\s*", item)
            if named and named.group("original") in PROGRAMMATIC_VUE_FACTORIES:
                local = named.group("local") or named.group("original")
                if not binding_has_write(script, local, match.end()):
                    bindings.add(local)
    for namespace in namespaces:
        bindings.update(f"{namespace}.{factory}" for factory in PROGRAMMATIC_VUE_FACTORIES)
    changed = True
    while changed:
        changed = False
        for match in re.finditer(r"\bconst\s+(?P<alias>[A-Za-z_$][\w$]*)\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
            source = match.group("source")
            alias = match.group("alias")
            # A render helper commonly captures an immutable factory inside an
            # arrow callback.  That is a use, not a mutable escape; only reject
            # actual writes/rebindings of the alias itself.
            if source in bindings and alias not in bindings and not binding_has_write(script, alias, match.end()):
                bindings.add(alias)
                changed = True
    # Do not silently forget aliases that originate in Vue factories but cannot
    # be proven immutable.  Their later invocation is a fail-closed programmatic
    # component target, including `let alias = h` and a reassigned `const`.
    for match in re.finditer(r"\b(?P<kind>const|let|var)\s+(?P<alias>[A-Za-z_$][\w$]*)\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
        alias = match.group("alias")
        source = match.group("source")
        if source in bindings and (match.group("kind") != "const" or binding_has_write(script, alias, match.end())):
            tainted.add(alias)
            bindings.discard(alias)
    return bindings, tainted, namespaces


def report_vue_factory_reference_escapes(
    script: str,
    relative: str,
    bindings: set[str],
    namespaces: set[str],
    allowed_spans: list[tuple[int, int]],
    findings: list[Finding],
) -> None:
    """Fail closed on every unsupported reference to a Vue factory authority."""
    masked, _ = scan_js_non_code(script)

    def allowed(start: int, end: int) -> bool:
        return any(left <= start and end <= right for left, right in allowed_spans)

    simple_bindings = {binding for binding in bindings if "." not in binding}
    for name in sorted(simple_bindings | namespaces, key=len, reverse=True):
        pattern = re.compile(rf"(?<![\w$.]){re.escape(name)}\b")
        for match in pattern.finditer(masked):
            if allowed(match.start(), match.end()):
                continue
            findings.append(Finding(
                "PROGRAMMATIC_COMPONENT_UNRESOLVED",
                relative,
                f"Unsupported reference/escape of Vue factory authority {name!r}",
                line_of(script, match.start()),
                script[match.start():match.end()],
            ))


def raw_first_call_argument(text: str, call_start: int) -> str | None:
    """Read one JavaScript call argument from raw text without trusting masks."""
    opening = text.find("(", call_start)
    if opening < 0:
        return None
    index = opening + 1
    while index < len(text) and text[index].isspace():
        index += 1
    start = index
    depth = 0
    quote: str | None = None
    while index < len(text):
        char = text[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
            index += 1
            continue
        if char in {"'", '"', "`"}:
            quote = char
        elif char in "([{":
            depth += 1
        elif char in ")]}":
            if depth == 0:
                return text[start:index].strip()
            depth -= 1
        elif char == "," and depth == 0:
            return text[start:index].strip()
        index += 1
    return None


def report_programmatic_factory_calls(
    script: str, relative: str, findings: list[Finding],
) -> None:
    """Reject native or unprovable programmatic interactive render calls."""
    bindings, tainted, namespaces = vue_factory_bindings(script)
    if not bindings and not tainted:
        return
    masked, _ = scan_js_non_code(script)
    allowed_spans: list[tuple[int, int]] = []
    for statement in js_top_level_statements(script):
        if import_statement_source(statement) == "vue":
            start = script.find(statement)
            if start >= 0:
                allowed_spans.append((start, start + len(statement)))

    # Exact immutable aliases and namespace destructuring are the only
    # supported non-call references.  Everything else is reported below.
    for match in re.finditer(r"\bconst\s+(?P<alias>[A-Za-z_$][\w$]*)\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
        if (match.group("alias") in bindings and match.group("source") in bindings) or (
            match.group("alias") in namespaces and match.group("source") in namespaces
        ):
            allowed_spans.append(match.span())
    for match in re.finditer(r"\bconst\s*\{(?P<names>[^{}]+)\}\s*=\s*(?P<source>[A-Za-z_$][\w$]*)(?=\s*(?:;|\n|$))", masked):
        if match.group("source") in namespaces:
            allowed_spans.append(match.span())
    for binding in sorted(bindings | tainted, key=len, reverse=True):
        if "." in binding:
            namespace, member = binding.split(".", 1)
            callee = rf"\b{re.escape(namespace)}\s*(?:\.\s*|\?\.\s*){re.escape(member)}"
        else:
            callee = rf"\b{re.escape(binding)}"
        pattern = re.compile(callee + r"\s*(?:\?\.)?\s*\(")
        for match in pattern.finditer(masked):
            allowed_spans.append(match.span())
            if binding in tainted:
                findings.append(Finding("PROGRAMMATIC_COMPONENT_UNRESOLVED", relative, f"Cannot prove immutable Vue factory alias {binding!r}", line_of(script, match.start()), script[match.start():match.end()]))
                continue
            argument = raw_first_call_argument(script, match.start())
            if argument is None:
                findings.append(Finding("PROGRAMMATIC_COMPONENT_UNRESOLVED", relative, f"Cannot parse {binding}() target", line_of(script, match.start()), script[match.start():match.end()]))
                continue
            literal = parse_quoted_string(argument)
            if literal is not None:
                if literal.lower() in RAW_TAGS:
                    findings.append(Finding("PROGRAMMATIC_NATIVE_INTERACTIVE", relative, f"Programmatic {binding}() creates prohibited <{literal.lower()}>", line_of(script, match.start()), script[match.start():match.end()]))
                # A quoted component name is a supported static component
                # lookup.  It is not an interactive native element.
                continue
            # `h(SgjButton)` is the supported component-binding positive.  Any
            # other expression (call/member/conditional/unknown identifier) is
            # a runtime target that cannot be proven safe.
            if re.fullmatch(r"[A-Z][A-Za-z0-9_$]*", argument):
                continue
            findings.append(Finding("PROGRAMMATIC_COMPONENT_UNRESOLVED", relative, f"Cannot statically prove {binding}() target {argument!r}", line_of(script, match.start()), script[match.start():match.end()]))
    report_vue_factory_reference_escapes(script, relative, bindings, namespaces, allowed_spans, findings)


def static_bindings(text: str) -> tuple[dict[str, str], dict[str, str]]:
    masked, _ = scan_js_non_code(text)
    strings: dict[str, str] = {}
    objects: dict[str, str] = {}
    declarations = list(re.finditer(r"\bconst\s+(?P<name>[A-Za-z_$][\w$]*)\s*=", masked))
    counts: dict[str, int] = {}
    for match in declarations:
        counts[match.group("name")] = counts.get(match.group("name"), 0) + 1
    for match in declarations:
        name = match.group("name")
        if counts[name] != 1:
            continue
        start = match.end()
        while start < len(text) and text[start].isspace():
            start += 1
        if start >= len(text):
            continue
        if text[start] in {"'", '"', "`"}:
            quote = text[start]
            end = start + 1
            while end < len(text):
                if text[end] == "\\":
                    end += 2
                    continue
                if text[end] == quote:
                    value = parse_quoted_string(text[start:end + 1])
                    if value is not None and binding_is_immutable(text, name, end + 1):
                        strings[name] = value
                    break
                end += 1
        elif text[start] == "{":
            end = matching_delimiter(text, start, "{", "}")
            if end is not None and binding_is_immutable(text, name, end + 1, True):
                objects[name] = text[start:end + 1]
    return strings, objects


def sfc_attribute(attrs: str, name: str) -> tuple[str | None, bool]:
    match = re.search(
        rf"(?:^|\s){re.escape(name)}(?:\s*=\s*(?P<quote>['\"])(?P<value>.*?)(?P=quote))?(?=\s|$)",
        attrs,
        re.IGNORECASE | re.DOTALL,
    )
    return (match.group("value"), True) if match else (None, False)


def sfc_top_level_scripts(text: str) -> tuple[list[SfcScript], list[str]]:
    scripts: list[SfcScript] = []
    issues: list[str] = []
    counts = {"template": 0, "normal": 0, "setup": 0}
    cursor = 0
    while cursor < len(text):
        whitespace = re.match(r"\s+", text[cursor:])
        if whitespace:
            cursor += whitespace.end()
            continue
        if text.startswith("<!--", cursor):
            end = text.find("-->", cursor + 4)
            if end < 0:
                issues.append("SFC_STRUCTURE_INVALID")
                break
            cursor = end + 3
            continue
        opening = re.match(r"<(?P<tag>[A-Za-z][A-Za-z0-9_-]*)(?P<attrs>[^>]*)>", text[cursor:], re.DOTALL)
        if opening is None:
            issues.append("SFC_STRUCTURE_INVALID")
            break
        tag = opening.group("tag").lower()
        attrs = opening.group("attrs")
        body_start = cursor + opening.end()
        if tag == "template":
            counts["template"] += 1
            token_pattern = re.compile(r"<!--.*?-->|</?template\b[^>]*>", re.IGNORECASE | re.DOTALL)
            depth = 1
            closing_end: int | None = None
            for token in token_pattern.finditer(text, body_start):
                raw = token.group(0)
                if raw.startswith("<!--"):
                    continue
                if re.match(r"</template", raw, re.IGNORECASE):
                    depth -= 1
                    if depth == 0:
                        closing_end = token.end()
                        break
                elif not raw.rstrip().endswith("/>"):
                    depth += 1
            if closing_end is None:
                issues.append("SFC_STRUCTURE_INVALID")
                break
            cursor = closing_end
            continue
        closing = re.search(rf"</{re.escape(tag)}\s*>", text[body_start:], re.IGNORECASE)
        if closing is None:
            issues.append("SFC_STRUCTURE_INVALID")
            break
        body_end = body_start + closing.start()
        if tag == "script":
            _, setup = sfc_attribute(attrs, "setup")
            counts["setup" if setup else "normal"] += 1
            language, has_language = sfc_attribute(attrs, "lang")
            if has_language and (language is None or language.lower() not in {"js", "javascript", "ts", "typescript"}):
                issues.append("SFC_SCRIPT_LANGUAGE_UNSUPPORTED")
            if re.search(r"(?:^|\s)src\s*=", attrs, re.IGNORECASE):
                issues.append("SFC_EXTERNAL_SCRIPT_UNSUPPORTED")
            else:
                scripts.append(SfcScript(text[body_start:body_end], setup))
        cursor = body_start + closing.end()
    if counts["template"] != 1 or counts["normal"] > 1 or counts["setup"] > 1:
        issues.append("SFC_STRUCTURE_INVALID")
    return scripts, sorted(set(issues))


def split_top_level_csv(text: str) -> list[str] | None:
    try:
        masked, _ = scan_js_non_code(text)
    except ValueError:
        return None
    parts: list[str] = []
    start = 0
    round_depth = square_depth = curly_depth = 0
    for index, char in enumerate(masked):
        if char == "(": round_depth += 1
        elif char == ")": round_depth -= 1
        elif char == "[": square_depth += 1
        elif char == "]": square_depth -= 1
        elif char == "{": curly_depth += 1
        elif char == "}": curly_depth -= 1
        if min(round_depth, square_depth, curly_depth) < 0:
            return None
        if char == "," and round_depth == square_depth == curly_depth == 0:
            parts.append(text[start:index].strip())
            start = index + 1
    if round_depth or square_depth or curly_depth:
        return None
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def resolve_static_string(expression: str, strings: dict[str, str]) -> str | None:
    literal = parse_quoted_string(expression)
    if literal is not None:
        return literal
    identifier = expression.strip()
    return strings.get(identifier) if re.fullmatch(r"[A-Za-z_$][\w$]*", identifier) else None


def resolve_object_component_is(
    expression: str,
    strings: dict[str, str],
    objects: dict[str, str],
    seen: set[str] | None = None,
) -> str | None:
    seen = set() if seen is None else set(seen)
    candidate = expression.strip()
    if re.fullmatch(r"[A-Za-z_$][\w$]*", candidate):
        if candidate in seen or candidate not in objects:
            return None
        seen.add(candidate)
        candidate = objects[candidate]
    if not (candidate.startswith("{") and candidate.endswith("}")):
        return None
    parts = split_top_level_csv(candidate[1:-1])
    if parts is None:
        return None
    values: list[str] = []
    for part in parts:
        if not part:
            continue
        spread = re.fullmatch(r"\.\.\.\s*(?P<name>[A-Za-z_$][\w$]*)", part, re.DOTALL)
        if spread:
            resolved = resolve_object_component_is(spread.group("name"), strings, objects, seen)
            if resolved is None:
                return None
            values.append(resolved)
            continue
        property_match = re.fullmatch(r"(?:is|['\"]is['\"])\s*:\s*(?P<value>.+)", part, re.DOTALL)
        if property_match:
            resolved = resolve_static_string(property_match.group("value"), strings)
            if resolved is None:
                return None
            values.append(resolved)
            continue
        if part.strip() == "is":
            resolved = strings.get("is")
            if resolved is None:
                return None
            values.append(resolved)
            continue
        return None
    return values[0] if len(values) == 1 else None


def sfc_root_template(text: str) -> str | None:
    opening = re.search(r"<template\b[^>]*>", text, re.IGNORECASE)
    if opening is None:
        return None
    token_pattern = re.compile(r"<!--.*?-->|</?template\b[^>]*>", re.IGNORECASE | re.DOTALL)
    depth = 1
    for token in token_pattern.finditer(text, opening.end()):
        raw = token.group(0)
        if raw.startswith("<!--"):
            continue
        if re.match(r"</template", raw, re.IGNORECASE):
            depth -= 1
            if depth == 0:
                return text[opening.end():token.start()]
        elif not raw.rstrip().endswith("/>"):
            depth += 1
    return None


def import_statement_source(statement: str) -> str | None:
    masked, _ = scan_js_non_code(statement)
    if not re.match(r"\s*import\b", masked):
        return None
    gap = r"(?:\s|/\*.*?\*/|//[^\r\n]*(?:\r?\n|$))*"
    from_match = re.search(rf"\bfrom\b{gap}(?P<quote>['\"])(?P<source>[^'\"]+)(?P=quote)", statement, re.DOTALL)
    if from_match:
        return from_match.group("source")
    side_effect = re.match(rf"\s*import\b{gap}(?P<quote>['\"])(?P<source>[^'\"]+)(?P=quote)", statement, re.DOTALL)
    return side_effect.group("source") if side_effect else None


def export_statement_source(statement: str) -> str | None:
    masked, _ = scan_js_non_code(statement)
    if not re.match(r"\s*export\b", masked):
        return None
    gap = r"(?:\s|/\*.*?\*/|//[^\r\n]*(?:\r?\n|$))*"
    match = re.search(rf"\bfrom\b{gap}(?P<quote>['\"])(?P<source>[^'\"]+)(?P=quote)", statement, re.DOTALL)
    return match.group("source") if match else None


def report_import_boundary(relative: str, text: str, offset: int, source: str, excerpt: str, findings: list[Finding]) -> None:
    normalized = source.replace("\\", "/")
    deep = bool(
        re.search(r"design-system/(?:components|layout|templates)/", normalized)
        or re.search(r"platform/processes/shared/.+", normalized)
    )
    legacy = bool(
        ("design-system" in normalized and normalized != "@sgj/ui")
        or ("platform/processes/shared" in normalized and normalized != "@sgj/platform-ui")
    )
    if deep:
        findings.append(Finding("DEEP_COMPONENT_IMPORT", relative, normalized, line_of(text, offset), excerpt))
    elif legacy:
        findings.append(Finding("LEGACY_COMPONENT_IMPORT", relative, normalized, line_of(text, offset), excerpt))


def dynamic_calls(text: str, callee_pattern: str) -> list[tuple[int, int, str]]:
    masked, _ = scan_js_non_code(text)
    calls: list[tuple[int, int, str]] = []
    for match in re.finditer(callee_pattern + r"\s*\(", masked):
        opening = masked.find("(", match.start(), match.end())
        closing = matching_delimiter(text, opening, "(", ")") if opening >= 0 else None
        if closing is None:
            raise ValueError(f"unbalanced call for {match.group(0).strip()}")
        calls.append((match.start(), closing + 1, text[opening + 1:closing]))
    return calls


def validate_source_boundaries(root: Path, paths: Iterable[Path], findings: list[Finding]) -> None:
    raw_pattern = re.compile(r"<\s*(button|input|select|textarea|table|dialog)\b", re.IGNORECASE)
    for path in paths:
        text = read_text(path)
        relative = rel(path, root)
        scripts: list[str] = [text]
        template = ""
        if path.suffix.lower() == ".vue":
            parsed, issues = sfc_top_level_scripts(text)
            for code in issues:
                findings.append(Finding(code, relative, "Vue SFC top-level template/script structure is unsupported or ambiguous"))
            scripts = [script.text for script in parsed]
            template = sfc_root_template(text) or ""
            for match in raw_pattern.finditer(template):
                findings.append(Finding("RAW_INTERACTIVE_ELEMENT", relative, f"Use the registered replacement for <{match.group(1).lower()}>", line_of(text, match.start()), match.group(0)))
            try:
                combined_scripts = "\n;\n".join(scripts)
                constants, object_constants = static_bindings(combined_scripts)
            except ValueError as exc:
                constants, object_constants = {}, {}
                findings.append(Finding("DYNAMIC_COMPONENT_GRAMMAR_UNSUPPORTED", relative, str(exc)))
            dynamic_component = re.compile(r"<\s*component\b[^>]*:is\s*=\s*(?P<quote>['\"])(?P<expression>.*?)\1", re.IGNORECASE | re.DOTALL)
            for match in dynamic_component.finditer(template):
                expression = match.group("expression").strip()
                resolved = resolve_static_string(expression, constants)
                if resolved is None:
                    findings.append(Finding("DYNAMIC_COMPONENT_UNRESOLVED", relative, f"Cannot statically prove :is expression {expression!r}", line_of(text, match.start()), match.group(0)))
                elif resolved.lower() in RAW_TAGS:
                    findings.append(Finding("DYNAMIC_NATIVE_COMPONENT", relative, f"Dynamic component resolves to prohibited <{resolved.lower()}>", line_of(text, match.start()), match.group(0)))
            object_bind = re.compile(r"<\s*component\b[^>]*\bv-bind\s*=\s*(?P<quote>['\"])(?P<expression>.*?)\1", re.IGNORECASE | re.DOTALL)
            for match in object_bind.finditer(template):
                expression = match.group("expression").strip()
                resolved = resolve_object_component_is(expression, constants, object_constants)
                if resolved is None:
                    findings.append(Finding("DYNAMIC_COMPONENT_UNRESOLVED", relative, f"Cannot statically prove object v-bind is expression {expression!r}", line_of(text, match.start()), match.group(0)))
                elif resolved.lower() in RAW_TAGS:
                    findings.append(Finding("DYNAMIC_NATIVE_COMPONENT", relative, f"Object v-bind resolves to prohibited <{resolved.lower()}>", line_of(text, match.start()), match.group(0)))
            static_component = re.compile(r"<\s*component\b[^>]*(?<![:\w-])is\s*=\s*(?P<quote>['\"])(?P<value>.*?)\1", re.IGNORECASE | re.DOTALL)
            for match in static_component.finditer(template):
                value = match.group("value").strip().lower()
                if value in RAW_TAGS:
                    findings.append(Finding("DYNAMIC_NATIVE_COMPONENT", relative, f"Static component resolves to prohibited <{value}>", line_of(text, match.start()), match.group(0)))
        elif path.suffix.lower() in {".tsx", ".jsx"}:
            masked, _ = scan_js_non_code(text)
            for match in raw_pattern.finditer(text):
                if masked[match.start():match.start() + 1] != "<":
                    continue
                findings.append(Finding("RAW_INTERACTIVE_ELEMENT", relative, f"Use the registered replacement for JSX <{match.group(1).lower()}>", line_of(text, match.start()), match.group(0)))

        combined_scripts = "\n;\n".join(scripts)
        try:
            constants, _ = static_bindings(combined_scripts)
            for script in scripts:
                for statement in js_top_level_statements(script):
                    source = import_statement_source(statement) or export_statement_source(statement)
                    if source is not None:
                        offset = text.find(statement)
                        report_import_boundary(relative, text, max(offset, 0), source, statement[:180], findings)
                for start, end, argument in dynamic_calls(script, r"\bimport"):
                    resolved = parse_quoted_string(argument.strip()) or constants.get(argument.strip())
                    if resolved is None:
                        findings.append(Finding("DYNAMIC_IMPORT_UNRESOLVED", relative, f"Cannot statically prove import source {argument.strip()!r}", line_of(script, start), script[start:end]))
                    else:
                        report_import_boundary(relative, script, start, resolved, script[start:end], findings)
                for start, end, argument in dynamic_calls(script, r"\brequire"):
                    resolved = parse_quoted_string(argument.strip()) or constants.get(argument.strip())
                    if resolved is None:
                        findings.append(Finding("DYNAMIC_IMPORT_UNRESOLVED", relative, f"Cannot statically prove require source {argument.strip()!r}", line_of(script, start), script[start:end]))
                    else:
                        report_import_boundary(relative, script, start, resolved, script[start:end], findings)
                for start, end, argument in dynamic_calls(script, r"\brequire\s*\.\s*resolve"):
                    resolved = parse_quoted_string(argument.strip()) or constants.get(argument.strip())
                    if resolved is None:
                        findings.append(Finding("DYNAMIC_IMPORT_UNRESOLVED", relative, f"Cannot statically prove require.resolve source {argument.strip()!r}", line_of(script, start), script[start:end]))
                    else:
                        report_import_boundary(relative, script, start, resolved, script[start:end], findings)
                for start, end, argument in dynamic_calls(script, r"\bimport\s*\.\s*meta\s*\.\s*glob"):
                    parts = split_top_level_csv(argument)
                    source = parse_quoted_string(parts[0]) if parts else None
                    if source is None:
                        findings.append(Finding("DYNAMIC_IMPORT_UNRESOLVED", relative, "Cannot statically prove import.meta.glob source", line_of(script, start), script[start:end]))
                    else:
                        report_import_boundary(relative, script, start, source, script[start:end], findings)
                report_programmatic_factory_calls(script, relative, findings)
        except ValueError as exc:
            findings.append(Finding("IMPORT_GRAMMAR_UNSUPPORTED", relative, str(exc)))


def validate_duplicate_primitives(root: Path, findings: list[Finding]) -> None:
    src = root / "technical-platform/web/src"
    design = (src / "design-system").resolve()
    if not src.is_dir():
        return
    for path in src.rglob("*.vue"):
        if path.name not in DUPLICATE_PRIMITIVE_FILENAMES:
            continue
        try:
            path.resolve().relative_to(design)
        except ValueError:
            findings.append(Finding("DUPLICATE_PRIMITIVE_COMPONENT", rel(path, root), path.name))


def validate_design_system_boundary(root: Path, findings: list[Finding]) -> None:
    design = root / "technical-platform/web/src/design-system"
    forbidden_code = re.compile(
        r"(?:\bfetch\s*\(|\baxios\b|\blocalStorage\b|\bsessionStorage\b|"
        r"\bdocument\s*\.\s*cookie\b|\bindexedDB\b|\bnew\s+(?:Map|Set)\s*\(|"
        r"\b[A-Za-z_$][\w$]*\s*\.\s*request\s*\(|\bp0(?:06|07|08|09|10)\.|"
        r"\bP0(?:06|07|08|09|10)\b)"
    )
    forbidden_import = re.compile(
        r"(?:^|/)(?:session|stores?/session|platform/phase11|platform/processes/(?!shared(?:/|$))|"
        r"platform/(?:domain|features?)/|modules?/(?:workflow|process|domain))(?:/|$)",
        re.IGNORECASE,
    )
    if not design.is_dir():
        return
    for path in design.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".vue", ".ts", ".tsx", ".js", ".jsx"} or is_test_or_evidence(path):
            continue
        text = read_text(path)
        relative = rel(path, root)
        scripts: list[str] = [text]
        if path.suffix.lower() == ".vue":
            parsed, issues = sfc_top_level_scripts(text)
            scripts = [script.text for script in parsed]
            for code in issues:
                findings.append(Finding(code, relative, "Design System Vue SFC structure is unsupported"))
        for script in scripts:
            try:
                masked, strings = scan_js_non_code(script)
                for match in forbidden_code.finditer(masked):
                    findings.append(Finding("DESIGN_SYSTEM_BUSINESS_COUPLING", relative, "Design System may not call APIs, cache business facts, or own process/domain contracts", line_of(script, match.start()), match.group(0)))
                if any(value.startswith("/api/") or value.startswith("/v1/") for value in strings):
                    findings.append(Finding("DESIGN_SYSTEM_BUSINESS_COUPLING", relative, "Design System contains an API endpoint literal"))
                for statement in js_top_level_statements(script):
                    source = import_statement_source(statement)
                    if source is not None and forbidden_import.search(source.replace("\\", "/")):
                        findings.append(Finding("DESIGN_SYSTEM_BUSINESS_COUPLING", relative, f"Design System imports business runtime {source}"))
            except ValueError as exc:
                findings.append(Finding("DESIGN_SYSTEM_GRAMMAR_UNSUPPORTED", relative, str(exc)))


def scan_repository(root: Path, scope: str = "all", changed_file: Path | None = None) -> dict[str, object]:
    findings: list[Finding] = []
    validate_aliases(root, findings)
    registry = validate_registry(root, findings)
    schema = validate_reuse_and_schema(root, findings)
    validate_exceptions(root, findings)
    if registry:
        validate_plans(root, registry, schema, findings)
    try:
        paths = source_files(root, scope, changed_file)
    except ValueError as exc:
        findings.append(Finding("SCOPE_ARGUMENT_INVALID", str(root), str(exc)))
        paths = []
    validate_source_boundaries(root, paths, findings)
    validate_duplicate_primitives(root, findings)
    validate_design_system_boundary(root, findings)
    errors = [finding for finding in findings if finding.severity == "error"]
    return {
        "schema_version": "1.0",
        "gate": "P10-COMP-03A UI component access gate",
        "repository_root": str(root),
        "scope": scope,
        "scanned_source_file_count": len(paths),
        "registered_component_count": len(registry),
        "status": "PASS" if not errors else "FAIL",
        "error_count": len(errors),
        "warning_count": len(findings) - len(errors),
        "findings": [asdict(finding) for finding in findings],
        "remote_operations_performed": False,
    }


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def fixture_registry(root: Path) -> None:
    runtime_test = "technical-platform/web/src/design-system/component-runtime.test.ts"
    components = [
        {
            "id": "ui.button", "name": "SgjButton", "layer": "design-system",
            "status": "existing-stable", "public": True, "public_import": "@sgj/ui",
            "implementation_path": "technical-platform/web/src/design-system/components/Button.vue",
            "export_name": "SgjButton", "required_tests": [runtime_test],
        },
        {
            "id": "ui.template.form-page", "name": "SgjFormPageTemplate", "layer": "template",
            "status": "existing-stable", "public": True, "public_import": "@sgj/ui",
            "implementation_path": "technical-platform/web/src/design-system/templates/FormPageTemplate.vue",
            "export_name": "SgjFormPageTemplate", "required_tests": [runtime_test],
        },
        {
            "id": "ui.internal.field-frame", "name": "FieldFrame", "layer": "internal",
            "status": "internal", "public": False, "public_import": None,
            "implementation_path": "technical-platform/web/src/design-system/components/FieldFrame.vue",
            "export_name": None, "required_tests": [runtime_test],
        },
    ]
    write(root / REGISTRY_REL, json.dumps({"schema_version": "1.0", "components": components}, indent=2))


def fixture_plan_schema() -> dict[str, object]:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:shangjingu:page-component-usage-plan:1.0",
        "title": "Page Component Usage Plan",
        "type": "object",
        "required": sorted(REQUIRED_PLAN_FIELDS),
        "properties": json.loads(json.dumps(PLAN_PROPERTY_CONTRACT)),
        "$defs": {"componentMap": json.loads(json.dumps(COMPONENT_MAP_CONTRACT))},
    }


def make_fixture(root: Path) -> None:
    write(root / TS_CONFIG_REL, json.dumps({"compilerOptions": {"paths": {"@sgj/ui": ["src/design-system/index.ts"], "@sgj/platform-ui": ["src/platform/processes/shared/index.ts"]}}}))
    write(root / VITE_CONFIG_REL, "const publicComponentAliases={'@sgj/ui':resolve(import.meta.dirname,'src/design-system/index.ts'),'@sgj/platform-ui':resolve(import.meta.dirname,'src/platform/processes/shared/index.ts')}; const modes=[{resolve:{alias:publicComponentAliases}},{resolve:{alias:publicComponentAliases}},{resolve:{alias:publicComponentAliases}}]\n")
    write(root / "technical-platform/web/src/design-system/components/Button.vue", "<template><button><slot /></button></template>\n")
    write(root / "technical-platform/web/src/design-system/components/FieldFrame.vue", "<template><label><slot /></label></template>\n")
    write(root / "technical-platform/web/src/design-system/templates/FormPageTemplate.vue", "<template><section><slot /></section></template>\n")
    write(root / DESIGN_INDEX_REL, "export { default as SgjButton } from './components/Button.vue'\nexport { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\n")
    write(root / PLATFORM_RUNTIME_EXPORTS["useAsyncAction"], "export default function useAsyncAction() { return {} }\n")
    write(root / PLATFORM_RUNTIME_EXPORTS["useAsyncResource"], "export default function useAsyncResource() { return {} }\n")
    write(
        root / PLATFORM_INDEX_REL,
        "export { default as useAsyncAction } from './async/useAsyncAction'\n"
        "export { default as useAsyncResource } from './async/useAsyncResource'\n",
    )
    write(
        root / ALIAS_TEST_REL,
        "import { describe, expect, it } from 'vitest'\n"
        "import * as Ui from '@sgj/ui'\n"
        "import * as PlatformUi from '@sgj/platform-ui'\n"
        "const expectedUiExports=['SgjButton','SgjFormPageTemplate'] as const\n"
        "const expectedPlatformExports=['useAsyncAction','useAsyncResource'] as const\n"
        "describe('public aliases',()=>{it('exposes registered exports',()=>{"
        "expect(Object.keys(Ui).sort()).toEqual([...expectedUiExports].sort());"
        "for(const exportName of expectedUiExports) expect(Ui[exportName]).toBeDefined()"
        "});it('exposes fixed runtime hooks',()=>{"
        "expect(Object.keys(PlatformUi).sort()).toEqual([...expectedPlatformExports].sort());"
        "for(const exportName of expectedPlatformExports) expect(PlatformUi[exportName]).toBeDefined()"
        "})})\n",
    )
    write(
        root / "technical-platform/web/src/design-system/component-runtime.test.ts",
        "import { expect, it } from 'vitest'\n"
        "import { mount } from '@vue/test-utils'\n"
        "import Button from './components/Button.vue'\n"
        "import FieldFrame from './components/FieldFrame.vue'\n"
        "import FormPageTemplate from './templates/FormPageTemplate.vue'\n"
        "it('mounts each governed implementation',()=>{"
        "expect(mount(Button).exists()).toBe(true);"
        "expect(mount(FieldFrame).exists()).toBe(true);"
        "expect(mount(FormPageTemplate).exists()).toBe(true)"
        "})\n",
    )
    fixture_registry(root)
    write(root / REUSE_REL, json.dumps({"approved_imports": ["@sgj/ui", "@sgj/platform-ui", "process-local public index.ts"], "decision_flow": ["exact", "compose", "platform", "domain", "new-design", "blocked"]}))
    write(root / SCHEMA_REL, json.dumps(fixture_plan_schema(), indent=2))
    write(root / EXCEPTIONS_REL, '{"schema_version":"1.0","exceptions":[]}\n')
    for page in PHASE10_PAGES:
        implementation = f"technical-platform/web/src/platform/pages/{page}.vue"
        write(root / implementation, "<script setup lang=\"ts\">import { SgjButton } from '@sgj/ui'</script><template><SgjButton>OK</SgjButton></template>\n")
        plan = {
            "schema_version": "1.0", "page": page, "implementation_path": implementation,
            "portal_codes": ["employee"], "route_paths": ["/fixture"], "process_codes": [page[:4]],
            "page_type": "form", "page_template": "ui.template.form-page",
            "source_facts": {"permissions": ["fixture.read"], "states": ["ready"], "actions": ["SUBMIT"]},
            "field_component_map": [], "state_component_map": [],
            "action_component_map": [{"action": "SUBMIT", "component_id": "ui.button"}],
            "responsive_projection": {"desktop": "single column", "mobile": "single column"},
            "gaps": [], "native_element_exceptions": [], "decision": "reuse-only",
            "tests": ["fixture"], "updated_at": "2026-08-13T00:00:00+08:00",
        }
        write(root / PLANS_REL / f"{page}.ui-plan.json", json.dumps(plan, indent=2))


def expect_code(root: Path, code: str) -> None:
    payload = scan_repository(root)
    codes = {str(item["code"]) for item in payload["findings"]}
    if payload["status"] != "FAIL" or code not in codes:
        raise AssertionError(f"Expected {code}; status={payload['status']} codes={sorted(codes)}")


def mutate_fixture_registry_status(root: Path) -> None:
    payload = read_json(root / REGISTRY_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("components"), list)
    first = payload["components"][0]
    assert isinstance(first, dict)
    first.update({"status": "invented-status", "public": False, "public_import": None, "export_name": None, "required_tests": []})
    write(root / REGISTRY_REL, json.dumps(payload, indent=2))


def mutate_fixture_schema_required(root: Path) -> None:
    payload = read_json(root / SCHEMA_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("required"), list)
    payload["required"].remove("source_facts")
    payload["required"].remove("responsive_projection")
    write(root / SCHEMA_REL, json.dumps(payload, indent=2))


def mutate_fixture_plan_shape(root: Path) -> None:
    path = root / PLANS_REL / "P006MeetingPage.ui-plan.json"
    payload = read_json(path)
    assert isinstance(payload, dict)
    payload.update({
        "field_component_map": "not-an-array",
        "state_component_map": None,
        "action_component_map": {},
        "process_codes": "P006",
        "gaps": "none",
        "decision": 42,
    })
    write(path, json.dumps(payload, indent=2))


def mutate_fixture_plan_unknown_field(root: Path) -> None:
    path = root / PLANS_REL / "P006MeetingPage.ui-plan.json"
    payload = read_json(path)
    assert isinstance(payload, dict) and isinstance(payload.get("action_component_map"), list)
    action = payload["action_component_map"][0]
    assert isinstance(action, dict)
    action["invented_runtime_override"] = True
    write(path, json.dumps(payload, indent=2))


def mutate_fixture_required_test_to_source(root: Path) -> None:
    payload = read_json(root / REGISTRY_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("components"), list)
    first = payload["components"][0]
    assert isinstance(first, dict)
    first["required_tests"] = ["technical-platform/web/src/design-system/components/Button.vue"]
    write(root / REGISTRY_REL, json.dumps(payload, indent=2))


def mutate_fixture_page_type_contract(root: Path) -> None:
    payload = read_json(root / SCHEMA_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("properties"), dict)
    page_type = payload["properties"].get("page_type")
    assert isinstance(page_type, dict)
    page_type.pop("enum")
    write(root / SCHEMA_REL, json.dumps(payload, indent=2))


def mutate_fixture_component_map_contract(root: Path) -> None:
    payload = read_json(root / SCHEMA_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("$defs"), dict)
    payload["$defs"]["componentMap"] = {"type": "object"}
    write(root / SCHEMA_REL, json.dumps(payload, indent=2))


def mutate_fixture_unrelated_required_test(root: Path) -> None:
    test = "technical-platform/web/src/unrelated.test.ts"
    write(root / test, "import { computed } from 'vue';import { expect,it } from 'vitest';it('unrelated',()=>expect(computed(()=>1).value).toBe(1))\n")
    payload = read_json(root / REGISTRY_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("components"), list)
    first = payload["components"][0]
    assert isinstance(first, dict)
    first["required_tests"] = [test]
    write(root / REGISTRY_REL, json.dumps(payload, indent=2))


def mutate_fixture_alias_decoy(root: Path) -> None:
    write(
        root / ALIAS_TEST_REL,
        "import { expect,it } from 'vitest';import * as Ui from '@sgj/ui';"
        "const decoy=['SgjButton'];void decoy;void decoy;"
        "it('partial',()=>expect(Ui.SgjFormPageTemplate).toBeDefined())\n",
    )


def mutate_fixture_required_test_shadow(root: Path) -> None:
    test = "technical-platform/web/src/design-system/button-shadow.test.ts"
    write(
        root / test,
        "import { expect,it } from 'vitest';import { mount } from '@vue/test-utils';"
        "import Button from './components/Button.vue';"
        "it('shadow',()=>{const Button={};expect(mount(Button)).toBeDefined()})\n",
    )
    payload = read_json(root / REGISTRY_REL)
    assert isinstance(payload, dict) and isinstance(payload.get("components"), list)
    first = payload["components"][0]
    assert isinstance(first, dict)
    first["required_tests"] = [test]
    write(root / REGISTRY_REL, json.dumps(payload, indent=2))


def mutate_fixture_alias_namespace_shadow(root: Path) -> None:
    write(
        root / ALIAS_TEST_REL,
        "import { expect,it } from 'vitest';import * as Ui from '@sgj/ui';"
        "const expectedUiExports=['SgjButton','SgjFormPageTemplate'];"
        "it('shadow',()=>{const Ui={SgjButton:{},SgjFormPageTemplate:{}};"
        "expect(Object.keys(Ui).sort()).toEqual([...expectedUiExports].sort());"
        "for(const exportName of expectedUiExports)expect(Ui[exportName]).toBeDefined()})\n",
    )


def mutate_fixture_unknown_runtime_export(root: Path) -> None:
    implementation = Path("technical-platform/web/src/platform/processes/shared/async/useUnknown.ts")
    write(root / implementation, "export default function useUnknown() { return {} }\n")
    with (root / PLATFORM_INDEX_REL).open("a", encoding="utf-8") as stream:
        stream.write("export { default as useUnknown } from './async/useUnknown.ts'\n")


def mutate_fixture_runtime_wrong_source(root: Path) -> None:
    path = root / PLATFORM_INDEX_REL
    write(path, read_text(path).replace("'./async/useAsyncAction'", "'./async/useAsyncResource'"))


def mutate_fixture_runtime_wrong_extension(root: Path) -> None:
    implementation = Path("technical-platform/web/src/platform/processes/shared/async/useAsyncAction.js")
    write(root / implementation, "export default function useAsyncAction() { return {} }\n")
    path = root / PLATFORM_INDEX_REL
    write(path, read_text(path).replace("'./async/useAsyncAction'", "'./async/useAsyncAction.js'"))


def mutate_fixture_runtime_explicit_ts(root: Path) -> None:
    path = root / PLATFORM_INDEX_REL
    write(path, read_text(path).replace("'./async/useAsyncAction'", "'./async/useAsyncAction.ts'"))


def mutate_fixture_runtime_missing_source(root: Path) -> None:
    (root / PLATFORM_RUNTIME_EXPORTS["useAsyncAction"]).unlink()


def mutate_fixture_runtime_alias_decoy(root: Path) -> None:
    write(
        root / ALIAS_TEST_REL,
        "import { describe,expect,it } from 'vitest';import * as Ui from '@sgj/ui';"
        "import * as PlatformUi from '@sgj/platform-ui';"
        "const expectedUiExports=['SgjButton','SgjFormPageTemplate'] as const;"
        "const expectedPlatformExports=[] as const;"
        "const decoy=['useAsyncAction','useAsyncResource'];void decoy;"
        "describe('aliases',()=>{it('ui',()=>{expect(Object.keys(Ui).sort()).toEqual([...expectedUiExports].sort());"
        "for(const name of expectedUiExports)expect(Ui[name]).toBeDefined()});"
        "it('platform',()=>{expect(Object.keys(PlatformUi).sort()).toEqual([...expectedPlatformExports].sort());"
        "for(const name of expectedPlatformExports)expect(PlatformUi[name]).toBeDefined()})})\n",
    )


def mutate_fixture_runtime_alias_omission(root: Path) -> None:
    path = root / ALIAS_TEST_REL
    write(path, read_text(path).replace("['useAsyncAction','useAsyncResource']", "['useAsyncAction']"))


def mutate_fixture_component_borrows_runtime_name(root: Path) -> None:
    path = root / PLATFORM_INDEX_REL
    write(path, read_text(path).replace("'./async/useAsyncAction'", "'../../../design-system/components/Button.vue'"))


def run_self_test() -> int:
    cases: list[str] = []
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)

        positive = base / "positive"
        make_fixture(positive)
        payload = scan_repository(positive)
        if payload["status"] != "PASS":
            raise AssertionError(payload)
        cases.append("positive")

        positive_dynamic = base / "positive-dynamic"
        make_fixture(positive_dynamic)
        write(positive_dynamic / "technical-platform/web/src/platform/pages/SafeFeature.vue", "<template><section>safe</section></template>")
        write(
            positive_dynamic / "technical-platform/web/src/platform/pages/P006MeetingPage.vue",
            "<script setup lang=\"ts\">const tag='section';const base={is:'section'};const attrs={...base};const load=()=>import('./SafeFeature.vue')</script>"
            "<template><component :is=\"tag\" /><component v-bind=\"attrs\" /></template>",
        )
        payload = scan_repository(positive_dynamic)
        if payload["status"] != "PASS":
            raise AssertionError(payload)
        cases.append("positive-static-dynamic")

        mutations: Sequence[tuple[str, str, callable]] = (
            ("unregistered", "COMPONENT_NOT_REGISTERED", lambda r: write(r / "technical-platform/web/src/design-system/components/New.vue", "<template><div /></template>")),
            ("unregistered-platform", "COMPONENT_NOT_REGISTERED", lambda r: write(r / "technical-platform/web/src/platform/processes/shared/NewComposite.vue", "<template><section /></template>")),
            ("unexported", "PUBLIC_EXPORT_MISSING", lambda r: write(r / DESIGN_INDEX_REL, "export { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\n")),
            ("untested", "PUBLIC_ACCESS_TEST_UNCOVERED", lambda r: write(r / ALIAS_TEST_REL, "const expected=['SgjFormPageTemplate']\n")),
            ("unknown-status", "REGISTRY_STATUS_INVALID", lambda r: mutate_fixture_registry_status(r)),
            ("schema-required", "PLAN_SCHEMA_REQUIRED_INVALID", lambda r: mutate_fixture_schema_required(r)),
            ("malformed-plan", "PAGE_PLAN_SCHEMA_INVALID", lambda r: mutate_fixture_plan_shape(r)),
            ("unknown-plan-field", "PAGE_PLAN_SCHEMA_INVALID", lambda r: mutate_fixture_plan_unknown_field(r)),
            ("raw", "RAW_INTERACTIVE_ELEMENT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<template><button>bad</button></template>")),
            ("dynamic-native", "DYNAMIC_NATIVE_COMPONENT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup lang=\"ts\">const tag='button'</script><template><component :is=\"tag\" /></template>")),
            ("dynamic-unresolved", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup lang=\"ts\">const resolveTag=()=> 'section'</script><template><component :is=\"resolveTag()\" /></template>")),
            ("deep", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>import Button from '../../design-system/components/Button.vue'</script><template><Button /></template>")),
            ("nonliteral-deep", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const source='../../design-system/components/Button.vue';const load=()=>import(source)</script><template><section /></template>")),
            ("dynamic-import-unresolved", "DYNAMIC_IMPORT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const load=()=>import(resolveSource())</script><template><section /></template>")),
            ("duplicate", "DUPLICATE_PRIMITIVE_COMPONENT", lambda r: write(r / "technical-platform/web/src/platform/Button.vue", "<template><div /></template>")),
            ("alias", "ALIAS_TSCONFIG_INVALID", lambda r: write(r / TS_CONFIG_REL, '{"compilerOptions":{"paths":{}}}')),
            ("missing-plan", "PAGE_PLAN_MISSING", lambda r: (r / PLANS_REL / "P006MeetingPage.ui-plan.json").unlink()),
            ("exception", "NATIVE_EXCEPTIONS_NOT_EMPTY", lambda r: write(r / EXCEPTIONS_REL, '{"exceptions":[{"path":"x","tag":"button"}]}')),
            ("commented-barrel", "PUBLIC_EXPORT_MISSING", lambda r: write(r / DESIGN_INDEX_REL, "// export { default as SgjButton } from './components/Button.vue'\n// export { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\n")),
            ("string-only-barrel", "PUBLIC_EXPORT_MISSING", lambda r: write(r / DESIGN_INDEX_REL, "const fake=\"export { default as SgjButton } from './components/Button.vue'\"\nconst fake2=\"export { default as SgjFormPageTemplate } from './templates/FormPageTemplate.vue'\"\n")),
            ("comment-only-access-test", "PUBLIC_ACCESS_TEST_INVALID", lambda r: write(r / ALIAS_TEST_REL, "// 'SgjButton' 'SgjFormPageTemplate' -- no executable test\n")),
            ("source-as-required-test", "PUBLIC_TEST_PATH_INVALID", lambda r: mutate_fixture_required_test_to_source(r)),
            ("object-bound-native", "DYNAMIC_NATIVE_COMPONENT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup lang=\"ts\">const tag='button'</script><template><component v-bind=\"{ is: tag }\" /></template>")),
            ("weaken-page-type-enum", "PLAN_SCHEMA_META_CONTRACT_INVALID", lambda r: mutate_fixture_page_type_contract(r)),
            ("weaken-component-map", "PLAN_SCHEMA_META_CONTRACT_INVALID", lambda r: mutate_fixture_component_map_contract(r)),
            ("unrelated-required-test", "PUBLIC_TEST_COMPONENT_UNCOVERED", lambda r: mutate_fixture_unrelated_required_test(r)),
            ("alias-decoy-array", "PUBLIC_ACCESS_TEST_UNCOVERED", lambda r: mutate_fixture_alias_decoy(r)),
            ("object-bind-property-mutation", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};attrs.is='button'</script><template><component v-bind=\"attrs\" /></template>")),
            ("object-bind-assign-mutation", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};Object.assign(attrs,{is:'button'})</script><template><component v-bind=\"attrs\" /></template>")),
            ("object-bind-alias-mutation", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};const alias=attrs;alias.is='button'</script><template><component v-bind=\"attrs\" /></template>")),
            ("descendant-script-shadow", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<template><script>const tag='SgjButton'</script><component :is=\"tag\" /></template><script setup>const tag=getTag()</script>")),
            ("cross-script-binding-shadow", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<template><component :is=\"tag\" /></template><script setup>const tag=getTag()</script><script>const tag='SgjButton'</script>")),
            ("dynamic-import-comment-fake-const", "DYNAMIC_IMPORT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const source=getSource();import(source);// const source='@sgj/ui'</script><template><section /></template>")),
            ("dynamic-import-string-fake-const", "DYNAMIC_IMPORT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const source=getSource();const fake=\"const source='@sgj/ui'\";import(source)</script><template><section /></template>")),
            ("expanded-production-raw", "RAW_INTERACTIVE_ELEMENT", lambda r: write(r / "technical-platform/web/src/platform/phase11/InlineAction.vue", "<template><button>bad</button></template>")),
            ("comment-gap-deep-import", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>import DeepUi from /* gap */ '../../design-system/components/Button.vue'</script><template><DeepUi /></template>")),
            ("glob-deep-import", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const modules=import.meta.glob('../../design-system/components/*.vue')</script><template><section /></template>")),
            ("static-native-component", "DYNAMIC_NATIVE_COMPONENT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<template><component is=\"button\" /></template>")),
            ("design-session-request", "DESIGN_SYSTEM_BUSINESS_COUPLING", lambda r: write(r / "technical-platform/web/src/design-system/components/Button.vue", "<script setup>import { usePortalSessionStore } from '../../session';const session=usePortalSessionStore();session.request('/v1/people')</script><template><button /></template>")),
            ("design-cookie-cache", "DESIGN_SYSTEM_BUSINESS_COUPLING", lambda r: write(r / "technical-platform/web/src/design-system/components/Button.vue", "<script setup>const truth=new Map();document.cookie='truth=1'</script><template><button /></template>")),
            ("design-process-import", "DESIGN_SYSTEM_BUSINESS_COUPLING", lambda r: write(r / "technical-platform/web/src/design-system/components/Button.vue", "<script setup>import { useProcessOperation } from '../../platform/phase11/use-process-operation'</script><template><button /></template>")),
            ("required-test-local-shadow", "PUBLIC_TEST_COMPONENT_UNCOVERED", lambda r: mutate_fixture_required_test_shadow(r)),
            ("alias-namespace-local-shadow", "PUBLIC_ACCESS_TEST_UNCOVERED", lambda r: mutate_fixture_alias_namespace_shadow(r)),
            ("object-bind-array-alias-mutation", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};const aliases=[attrs];aliases[0].is='button'</script><template><component v-bind=\"attrs\" /></template>")),
            ("programmatic-native-h", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';export const PrimaryAction=()=>h('button')")),
            ("commonjs-deep-import", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/widgets/deep.js", "const Button=require('../../design-system/components/Button.vue');void Button")),
            ("production-js-raw", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/router/InlineAction.js", "import { h } from 'vue';export const InlineAction=()=>h('input')")),
            ("production-tsx-raw", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/InlineAction.tsx", "import { h } from 'vue';export const InlineAction=()=>h('select')")),
            ("production-tsx-jsx-raw", "RAW_INTERACTIVE_ELEMENT", lambda r: write(r / "technical-platform/web/src/platform/widgets/InlineControl.tsx", "export const InlineControl=()=> <button>bad</button>")),
            ("expanded-widgets-raw", "RAW_INTERACTIVE_ELEMENT", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.vue", "<template><button>bad</button></template>")),
            ("expanded-router-raw", "RAW_INTERACTIVE_ELEMENT", lambda r: write(r / "technical-platform/web/src/router/InlineAction.vue", "<template><input /></template>")),
            ("glob-deep-import-eager", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const modules=import.meta.glob('../../design-system/components/*.vue',{eager:true})</script><template><section /></template>")),
            ("glob-dynamic-unresolved", "DYNAMIC_IMPORT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const target=getGlob();const modules=import.meta.glob(target)</script><template><section /></template>")),
            ("static-native-input", "DYNAMIC_NATIVE_COMPONENT", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<template><component is='input' /></template>")),
            ("object-bind-callback-escape", "DYNAMIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/pages/P006MeetingPage.vue", "<script setup>const attrs={is:'SgjButton'};[attrs].forEach(x=>x.is='button')</script><template><component v-bind=\"attrs\" /></template>")),
            ("programmatic-native-create-vnode", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { createVNode } from 'vue';export const PrimaryAction=()=>createVNode('button')")),
            ("programmatic-native-resolve-dynamic", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { resolveDynamicComponent } from 'vue';export const PrimaryAction=()=>resolveDynamicComponent('input')")),
            ("programmatic-native-resolve-component", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { resolveComponent } from 'vue';export const PrimaryAction=()=>resolveComponent('textarea')")),
            ("programmatic-native-h-alias", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const renderNode=h;export const PrimaryAction=()=>renderNode('button')")),
            ("commonjs-resolve-deep-import", "DEEP_COMPONENT_IMPORT", lambda r: write(r / "technical-platform/web/src/platform/widgets/deep.js", "const Button=require.resolve('../../design-system/components/Button.vue');void Button")),
            ("programmatic-native-namespace-h", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import * as Vue from 'vue';export const PrimaryAction=()=>Vue.h('button')")),
            ("programmatic-native-namespace-vnode", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import * as Vue from 'vue';export const PrimaryAction=()=>Vue.createVNode('button')")),
            ("programmatic-native-optional-h", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';export const PrimaryAction=()=>h?.('button')")),
            ("programmatic-native-element-vnode", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { createElementVNode } from 'vue';export const PrimaryAction=()=>createElementVNode('button')")),
            ("programmatic-native-element-block", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { createElementBlock } from 'vue';export const PrimaryAction=()=>createElementBlock('button')")),
            ("programmatic-native-namespace-optional", "PROGRAMMATIC_NATIVE_INTERACTIVE", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import * as Vue from 'vue';export const PrimaryAction=()=>Vue?.h?.('button')")),
            ("programmatic-tainted-let-alias", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';let renderNode=h;export const PrimaryAction=()=>renderNode('button')")),
            ("programmatic-tainted-const-alias", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const renderNode=h;renderNode=getFactory();export const PrimaryAction=()=>renderNode('button')")),
            ("programmatic-tainted-namespace-let", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import * as Vue from 'vue';let V=Vue;export const PrimaryAction=()=>V.h('button')")),
            ("programmatic-tainted-namespace-const", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import * as Vue from 'vue';const V=Vue;V=getVue();export const PrimaryAction=()=>V.h('button')")),
            ("programmatic-conditional-alias", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const renderNode=flag?h:other;export const PrimaryAction=()=>renderNode('button')")),
            ("programmatic-bound-alias", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const renderNode=h.bind(null);export const PrimaryAction=()=>renderNode('button')")),
            ("programmatic-array-escape", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const factories=[h];export const PrimaryAction=()=>factories[0]('button')")),
            ("programmatic-argument-escape", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const call=f=>f('button');export const PrimaryAction=()=>call(h)")),
            ("programmatic-return-escape", "PROGRAMMATIC_COMPONENT_UNRESOLVED", lambda r: write(r / "technical-platform/web/src/platform/widgets/PrimaryAction.ts", "import { h } from 'vue';const getFactory=()=>h;export const PrimaryAction=()=>getFactory()('button')")),
            ("unknown-runtime-export", "PUBLIC_EXPORT_NOT_REGISTERED", mutate_fixture_unknown_runtime_export),
            ("runtime-wrong-source", "PUBLIC_RUNTIME_EXPORT_INVALID", mutate_fixture_runtime_wrong_source),
            ("runtime-wrong-extension", "PUBLIC_RUNTIME_EXPORT_INVALID", mutate_fixture_runtime_wrong_extension),
            ("runtime-explicit-ts", "PUBLIC_RUNTIME_EXPORT_SPECIFIER_INVALID", mutate_fixture_runtime_explicit_ts),
            ("runtime-missing-source", "PUBLIC_EXPORT_SOURCE_MISSING", mutate_fixture_runtime_missing_source),
            ("runtime-alias-decoy", "PUBLIC_RUNTIME_ACCESS_TEST_UNCOVERED", mutate_fixture_runtime_alias_decoy),
            ("runtime-alias-omission", "PUBLIC_RUNTIME_ACCESS_TEST_UNCOVERED", mutate_fixture_runtime_alias_omission),
            ("component-borrows-runtime-name", "PUBLIC_RUNTIME_EXPORT_INVALID", mutate_fixture_component_borrows_runtime_name),
        )
        for name, expected, mutate in mutations:
            root = base / name
            make_fixture(root)
            mutate(root)
            expect_code(root, expected)
            cases.append(name)
    print(json.dumps({"status": "PASS", "case_count": len(cases), "cases": cases}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root")
    parser.add_argument("--scope", choices=("all", "phase10", "changed"), default="all")
    parser.add_argument("--changed-files")
    parser.add_argument("--report")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        try:
            return run_self_test()
        except Exception as exc:  # noqa: BLE001 - self-test must fail closed
            print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False))
            return 1
    if not args.repo_root:
        parser.error("--repo-root is required unless --self-test is used")
    root = Path(args.repo_root).resolve()
    changed = Path(args.changed_files).resolve() if args.changed_files else None
    payload = scan_repository(root, args.scope, changed)
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        report = Path(args.report)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(rendered + "\n", encoding="utf-8")
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
