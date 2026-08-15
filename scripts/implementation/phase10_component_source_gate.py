#!/usr/bin/env python3
"""Fail-closed local PHASE-10 page source and rendered-component gate."""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

ROUTER = "technical-platform/web/src/router/portal-router.ts"
PAGE_BINDINGS = "docs/implementation/phases/PHASE-10/PHASE10_PAGE_BINDINGS.json"
ACTION_CONTRACTS = {
    "P006": (
        "technical-platform/database/flyway-overlays/oms/V115__phase10_p006_meeting_action.sql",
        "technical-platform/backend/modules/collaboration/src/main/java/cn/shangjingu/platform/collaboration/MeetingService.java",
    ),
    "P007": (
        "technical-platform/database/flyway-overlays/oms/V116__phase10_p007_shift_change.sql",
        "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/ShiftChangeService.java",
    ),
    "P008": (
        "technical-platform/database/flyway-overlays/oms/V117__phase10_p008_leave_quota.sql",
        "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/LeaveService.java",
    ),
    "P009": (
        "technical-platform/database/flyway-overlays/oms/V118__phase10_p009_overtime_flow.sql",
        "technical-platform/backend/modules/attendance/src/main/java/cn/shangjingu/platform/attendance/OvertimeService.java",
    ),
    "P010": (
        "technical-platform/database/flyway-overlays/oms/V119__phase10_p010_learning_qualification_flow.sql",
        "technical-platform/backend/modules/learning/src/main/java/cn/shangjingu/platform/learning/LearningAssignmentService.java",
    ),
}
PATTERNS = {
    "SESSION_REQUEST": r"session\s*\.\s*request\s*\(",
    "API_PATH": r"[\"'`]\/api\/",
    "JSON_DUMP": r"JSON\s*\.\s*stringify\s*\(",
    "UNKNOWN_ARRAY": r"\bunknown\s*\[\s*\]",
    "TYPE_BYPASS": r"@ts-(?:ignore|nocheck)",
    "RAW_INPUT": r"<\s*input\b",
    "RAW_SELECT": r"<\s*select\b",
    "RAW_TEXTAREA": r"<\s*textarea\b",
    "RAW_BUTTON": r"<\s*button\b",
    "RAW_TABLE": r"<\s*table\b",
    "RAW_DIALOG": r"<\s*dialog\b",
    "PAGE_NESTING": r"<\s*[A-Z][A-Za-z0-9_]*Page\b",
    "BARE_PERMISSION": r"[\"']p0(?:06|07|08|09|10)\.[^\"']+[\"']",
}

DEFAULT_IMPORT = re.compile(
    r"import\s+(?P<local>[A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+[\"'](?P<spec>[^\"']+)[\"']"
)
NAMED_IMPORT = re.compile(r"import\s*{(?P<items>[^}]+)}\s*from\s*[\"'](?P<spec>[^\"']+)[\"']")
ASYNC_IMPORT = re.compile(
    r"(?:const|let)\s+(?P<local>[A-Z][A-Za-z0-9_$]*)\s*=\s*"
    r"(?:defineAsyncComponent\s*\(\s*)?(?:\(\s*\)\s*=>\s*)?"
    r"import\s*\(\s*[\"'](?P<spec>[^\"']+)[\"']\s*\)"
)
REEXPORT = re.compile(r"export\s*{(?P<items>[^}]+)}\s*from\s*[\"'](?P<spec>[^\"']+)[\"']")
EXPORT_STAR = re.compile(r"export\s*\*\s*from\s*[\"'](?P<spec>[^\"']+)[\"']")
TEMPLATE_TAG = re.compile(r"<!--.*?-->|</?template(?:\s[^>]*)?>", re.IGNORECASE | re.DOTALL)
HTML_TAG = re.compile(r"<\s*(?!/)(?P<tag>[A-Za-z][A-Za-z0-9_.-]*)\b(?P<attrs>[^>]*)>", re.DOTALL)
NATIVE_TAGS = frozenset({
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo",
    "blockquote", "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup",
    "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd",
    "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta", "meter", "nav",
    "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress",
    "q", "rp", "rt", "ruby", "s", "samp", "script", "search", "section", "select", "slot", "small",
    "source", "span", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template",
    "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video",
    "wbr", "svg", "path", "circle", "ellipse", "g", "line", "polygon", "polyline", "rect", "text",
    "transition", "transition-group", "keep-alive", "teleport", "suspense",
})
VUE_BUILTINS = frozenset({"Transition", "TransitionGroup", "KeepAlive", "Teleport", "Suspense"})


@dataclass(frozen=True)
class ImportBinding:
    local: str
    imported: str
    spec: str


@dataclass(frozen=True)
class SfcScript:
    text: str
    setup: bool


@dataclass(frozen=True)
class RouteObject:
    path: str | None
    path_expression: str
    block: str
    source: Path


def finding(code: str, path: str, **details: object) -> dict[str, object]:
    return {"code": code, "path": path, "line": None, **details}


def safe_relative(path: Path, repo: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except (ValueError, OSError):
        return str(path)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def vue_template(text: str) -> str | None:
    top_tag = re.compile(r"<!--.*?-->|</?(?:template|script|style)(?:\s[^>]*)?>", re.IGNORECASE | re.DOTALL)
    opening = None
    cursor = 0
    while True:
        match = top_tag.search(text, cursor)
        if match is None:
            return None
        token = match.group(0)
        lowered = token.lower()
        if token.startswith("<!--") or lowered.startswith("</"):
            cursor = match.end()
        elif lowered.startswith("<script") or lowered.startswith("<style"):
            tag = "script" if lowered.startswith("<script") else "style"
            closing = re.search(rf"</{tag}\s*>", text[match.end():], re.IGNORECASE)
            if closing is None:
                return None
            cursor = match.end() + closing.end()
        else:
            opening = match
            break
    depth = 1
    for match in TEMPLATE_TAG.finditer(text, opening.end()):
        token = match.group(0)
        if token.startswith("<!--"):
            continue
        if re.match(r"</template", token, re.IGNORECASE):
            depth -= 1
            if depth == 0:
                return text[opening.end():match.start()]
        elif not token.rstrip().endswith("/>"):
            depth += 1
    return None


def pascal_to_kebab(name: str) -> str:
    first = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1-\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", first).lower()


def script_setup_native_prop(text: str, name: str) -> tuple[str, frozenset[str]] | None:
    scripts, issues = sfc_top_level_scripts(text)
    setup_scripts = [script for script in scripts if script.setup]
    if issues or len(setup_scripts) != 1:
        return None
    script = setup_scripts[0].text
    code = js_code_mask(script)
    keywords = list(re.finditer(r"\bdefineProps\b", code))
    if len(keywords) != 1:
        return None
    definition = re.compile(r"defineProps\s*<\s*{(?P<body>[^{}]*)}\s*>\s*\(\s*\)", re.DOTALL).match(
        script, keywords[0].start())
    if definition is None:
        return None
    properties = list(re.finditer(
        rf"(?:^|[\n;,])\s*{re.escape(name)}\s*(?P<optional>\?)?\s*:\s*(?P<type>[^\n;,]+)",
        definition.group("body"), re.DOTALL))
    if len(properties) != 1:
        return None
    type_expression = properties[0].group("type").strip()
    if type_expression == "boolean":
        kind = "boolean"
        values: frozenset[str] = frozenset()
    else:
        literals: list[str] = []
        for part in type_expression.split("|"):
            literal = re.fullmatch(r"\s*(?P<quote>['\"])(?P<value>[a-z][a-z0-9-]*)(?P=quote)\s*", part)
            if literal is None:
                return None
            literals.append(literal.group("value"))
        values = frozenset(literals)
        if not values or not values <= NATIVE_TAGS:
            return None
        kind = "literal-union"

    call_start = definition.start()
    call_end = definition.end()
    wrapper = re.search(r"\bwithDefaults\s*\(\s*$", code[:definition.start()])
    if wrapper is not None:
        defaults = re.match(r"\s*,\s*{(?P<body>[^{}]*)}\s*\)", script[definition.end():], re.DOTALL)
        if defaults is None:
            return None
        if kind == "literal-union":
            entries = list(re.finditer(
                rf"(?:^|,)\s*{re.escape(name)}\s*:\s*(?P<quote>['\"])(?P<value>[a-z][a-z0-9-]*)(?P=quote)\s*(?=,|$)",
                defaults.group("body")))
            if len(entries) != 1:
                return None
            default_value = entries[0].group("value")
            if default_value not in values or default_value not in NATIVE_TAGS:
                return None
        else:
            boolean_defaults = re.findall(
                rf"(?:^|,)\s*{re.escape(name)}\s*:\s*(?:true|false)\s*(?=,|$)", defaults.group("body"))
            if len(boolean_defaults) != 1:
                return None
        call_start = wrapper.start()
        call_end = definition.end() + defaults.end()
    elif re.search(r"\bwithDefaults\b", code):
        return None

    if not code_declaration_start(code, call_start):
        return None
    same_line_tail = code[call_end:].split("\n", 1)[0].strip().strip(";").strip()
    if same_line_tail:
        return None
    remainder = code[:call_start] + (" " * (call_end - call_start)) + code[call_end:]
    if re.search(rf"\b{re.escape(name)}\b", remainder):
        return None
    return kind, values


def component_is_values(attrs: str, text: str) -> tuple[list[str], bool, bool]:
    match = re.search(r"(?:^|\s)(?P<dynamic>:)?is\s*=\s*(?P<quote>[\"'])(?P<value>.*?)(?P=quote)", attrs, re.DOTALL)
    if match is None:
        return [], True, False
    value = match.group("value").strip()
    dynamic = match.group("dynamic") is not None
    if dynamic and len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        value = value[1:-1]
    if dynamic:
        ternary = re.fullmatch(
            r"(?P<condition>[A-Za-z_$][A-Za-z0-9_$]*)\s*\?\s*"
            r"(?P<left_quote>['\"])(?P<left>[a-z][a-z0-9-]*)(?P=left_quote)\s*:\s*"
            r"(?P<right_quote>['\"])(?P<right>[a-z][a-z0-9-]*)(?P=right_quote)", value)
        if ternary is not None:
            native_values = frozenset((ternary.group("left"), ternary.group("right")))
            authority = script_setup_native_prop(text, ternary.group("condition"))
            if native_values and native_values <= NATIVE_TAGS and authority == ("boolean", frozenset()):
                return sorted(native_values), False, True
        if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", value):
            authority = script_setup_native_prop(text, value)
            if authority is not None and authority[0] == "literal-union":
                return sorted(authority[1]), False, True
    if re.fullmatch(r"[A-Z][A-Za-z0-9_$]*|[a-z][a-z0-9-]*", value):
        return [value], False, False
    return [], True, False


def split_alias(item: str) -> tuple[str, str]:
    parts = re.split(r"\s+as\s+", item.strip())
    return (parts[0].strip(), parts[-1].strip())


def script_attribute(attrs: str, name: str) -> tuple[str | None, bool]:
    match = re.search(rf"(?:^|\s){re.escape(name)}(?:\s*=\s*(?P<quote>[\"'])(?P<value>.*?)(?P=quote))?(?=\s|$)",
                      attrs, re.IGNORECASE | re.DOTALL)
    if match is None:
        return None, False
    return match.group("value"), True


def sfc_top_level_scripts(text: str) -> tuple[list[SfcScript], list[str]]:
    scripts: list[SfcScript] = []
    issues: list[str] = []
    template_count = 0
    normal_script_count = 0
    setup_script_count = 0
    cursor = 0
    while cursor < len(text):
        whitespace = re.match(r"\s+", text[cursor:])
        if whitespace:
            cursor += whitespace.end()
            continue
        if text.startswith("<!--", cursor):
            end = text.find("-->", cursor + 4)
            if end < 0:
                issues.append("COMPONENT_GRAPH_SFC_STRUCTURE_INVALID")
                break
            cursor = end + 3
            continue
        opening = re.match(r"<(?P<tag>[A-Za-z][A-Za-z0-9_-]*)(?P<attrs>[^>]*)>", text[cursor:], re.DOTALL)
        if opening is None or opening.group(0).startswith("</"):
            issues.append("COMPONENT_GRAPH_SFC_STRUCTURE_INVALID")
            break
        tag = opening.group("tag").lower()
        attrs = opening.group("attrs")
        body_start = cursor + opening.end()
        if opening.group(0).rstrip().endswith("/>"):
            if tag == "script":
                issues.append("COMPONENT_GRAPH_EXTERNAL_SCRIPT_UNSUPPORTED")
            cursor = body_start
            continue
        if tag == "template":
            template_count += 1
            depth = 1
            closing_end = None
            for match in TEMPLATE_TAG.finditer(text, body_start):
                token = match.group(0)
                if token.startswith("<!--"):
                    continue
                if re.match(r"</template", token, re.IGNORECASE):
                    depth -= 1
                    if depth == 0:
                        closing_end = match.end()
                        break
                elif not token.rstrip().endswith("/>"):
                    depth += 1
            if closing_end is None:
                issues.append("COMPONENT_GRAPH_SFC_STRUCTURE_INVALID")
                break
            cursor = closing_end
            continue
        closing = re.search(rf"</{re.escape(tag)}\s*>", text[body_start:], re.IGNORECASE)
        if closing is None:
            issues.append("COMPONENT_GRAPH_SFC_STRUCTURE_INVALID")
            break
        body_end = body_start + closing.start()
        if tag == "script":
            _, is_setup = script_attribute(attrs, "setup")
            if is_setup:
                setup_script_count += 1
            else:
                normal_script_count += 1
            language, has_language = script_attribute(attrs, "lang")
            has_raw_language = re.search(r"(?:^|\s)lang\s*=", attrs, re.IGNORECASE) is not None
            if ((has_raw_language and not has_language) or
                    (has_language and (language is None or language.lower() not in
                                       {"js", "javascript", "ts", "typescript"}))):
                issues.append("COMPONENT_GRAPH_SCRIPT_LANGUAGE_UNSUPPORTED")
            if re.search(r"\bsrc\s*=", attrs, re.IGNORECASE):
                issues.append("COMPONENT_GRAPH_EXTERNAL_SCRIPT_UNSUPPORTED")
            else:
                scripts.append(SfcScript(text[body_start:body_end], is_setup))
        cursor = body_start + closing.end()
    if template_count != 1 or normal_script_count > 1 or setup_script_count > 1:
        issues.append("COMPONENT_GRAPH_SFC_STRUCTURE_INVALID")
    return scripts, issues


def code_declaration_start(code: str, position: int) -> bool:
    line_start = code.rfind("\n", 0, position) + 1
    if not code[line_start:position].strip():
        return True
    prefix = code[:position].rstrip()
    return not prefix or prefix[-1] in ";{}"


def parse_segment_imports(segment: str) -> list[ImportBinding]:
    bindings: list[ImportBinding] = []
    code = js_code_mask(segment)
    for keyword in re.finditer(r"\bimport\b", code):
        if not code_declaration_start(code, keyword.start()):
            continue
        default = DEFAULT_IMPORT.match(segment, keyword.start())
        if default:
            bindings.append(ImportBinding(default.group("local"), "default", default.group("spec")))
            continue
        named = NAMED_IMPORT.match(segment, keyword.start())
        if named:
            for item in named.group("items").split(","):
                imported, local = split_alias(item)
                if imported and local and not imported.startswith("type "):
                    bindings.append(ImportBinding(local, imported, named.group("spec")))
    for match in ASYNC_IMPORT.finditer(segment):
        import_offset = segment.find("import", match.start(), match.end())
        if (code_declaration_start(code, match.start()) and import_offset >= 0 and
                code[import_offset:import_offset + 6] == "import"):
            bindings.append(ImportBinding(match.group("local"), "default", match.group("spec")))
    return bindings


def top_level_parts(code: str, start: int, end: int) -> list[tuple[int, int]]:
    parts: list[tuple[int, int]] = []
    part_start = start
    stack: list[str] = []
    pairs = {"(": ")", "[": "]", "{": "}"}
    for index in range(start, end):
        char = code[index]
        if char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
        elif char == "," and not stack:
            parts.append((part_start, index))
            part_start = index + 1
    parts.append((part_start, end))
    return parts


def options_component_bindings(segment: str) -> tuple[list[ImportBinding], list[str]]:
    imports = parse_segment_imports(segment)
    by_local = {item.local: item for item in imports}
    code = js_code_mask(segment)
    defaults = list(re.finditer(r"\bexport\s+default\b", code))
    if len(defaults) != 1:
        return [], ([] if not defaults else ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"])
    cursor = defaults[0].end()
    define = re.match(r"\s*defineComponent\s*\(", code[cursor:])
    if define:
        cursor += define.end()
    while cursor < len(code) and code[cursor].isspace():
        cursor += 1
    if cursor >= len(code) or code[cursor] != "{":
        return [], ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"]
    object_end = delimiter_end(code, cursor, "{", "}")
    if object_end is None:
        return [], ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"]
    expression_end = object_end + 1
    if define:
        while expression_end < len(code) and code[expression_end].isspace():
            expression_end += 1
        if expression_end >= len(code) or code[expression_end] != ")":
            return [], ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"]
        expression_end += 1
    # The parsed object (or exact defineComponent(object)) must be the whole
    # export expression. Runtime replacement tails such as &&, comma, ternary,
    # member access or another call are never silently ignored.
    if code[expression_end:].strip().strip(";").strip():
        return [], ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"]
    component_values: list[tuple[int, int]] = []
    for part_start, part_end in top_level_parts(code, cursor + 1, object_end):
        part = code[part_start:part_end].strip()
        match = re.match(r"components\s*:\s*", part)
        if match:
            value_start = part_start + code[part_start:part_end].find(part) + match.end()
            component_values.append((value_start, part_end))
    if not component_values:
        return [], []
    if len(component_values) != 1:
        return [], ["COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED"]

    exposed: list[ImportBinding] = []
    issues: list[str] = []

    def parse_object(value_start: int, value_end: int, stack: tuple[str, ...]) -> None:
        while value_start < value_end and code[value_start].isspace():
            value_start += 1
        if value_start >= value_end or code[value_start] != "{":
            issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
            return
        close = delimiter_end(code, value_start, "{", "}")
        if close is None or code[close + 1:value_end].strip():
            issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
            return
        for item_start, item_end in top_level_parts(code, value_start + 1, close):
            raw = segment[item_start:item_end].strip()
            masked = code[item_start:item_end].strip()
            if not masked:
                continue
            spread = re.fullmatch(r"\.\.\.\s*(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)", masked)
            if spread:
                name = spread.group("name")
                if name in stack:
                    issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                    continue
                declarations = list(re.finditer(rf"\bconst\s+{re.escape(name)}\s*=", code[:item_start]))
                if len(declarations) != 1:
                    issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                    continue
                nested_start = declarations[0].end()
                while nested_start < item_start and code[nested_start].isspace():
                    nested_start += 1
                nested_end = (delimiter_end(code, nested_start, "{", "}")
                              if nested_start < item_start and code[nested_start] == "{" else None)
                if nested_end is None or nested_end >= item_start:
                    issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                    continue
                # The object is shared by reference with Vue. Prove that its
                # only post-initializer use is this exact components spread;
                # aliases, writes, calls/arguments and later mutations would
                # otherwise change the runtime registry after our parse.
                all_references = list(re.finditer(rf"\b{re.escape(name)}\b", code[nested_end + 1:]))
                spread_offset = item_start - (nested_end + 1) + masked.find(name)
                if len(all_references) != 1 or all_references[0].start() != spread_offset:
                    issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                    continue
                parse_object(nested_start, nested_end + 1, stack + (name,))
                continue
            if masked.startswith("[") or re.match(r"(?:get|set)\b", masked):
                issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                continue
            alias = re.fullmatch(r"(?P<key>[A-Za-z_$][A-Za-z0-9_$]*|[\"'][^\"']+[\"'])\s*:\s*(?P<local>[A-Za-z_$][A-Za-z0-9_$]*)", raw)
            shorthand = re.fullmatch(r"(?P<local>[A-Za-z_$][A-Za-z0-9_$]*)", masked)
            if alias:
                exposed_name = alias.group("key").strip("\"'")
                local = alias.group("local")
            elif shorthand:
                exposed_name = local = shorthand.group("local")
            else:
                issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
                continue
            binding = by_local.get(local)
            if binding is None:
                issues.append("COMPONENT_GRAPH_OPTIONS_COMPONENTS_UNRESOLVED")
            else:
                exposed.append(ImportBinding(exposed_name, binding.imported, binding.spec))

    parse_object(component_values[0][0], component_values[0][1], ())
    return exposed, issues


def sfc_exposed_imports(text: str) -> tuple[list[ImportBinding], list[str]]:
    scripts, issues = sfc_top_level_scripts(text)
    bindings: list[ImportBinding] = []
    for script in scripts:
        if script.setup:
            bindings.extend(parse_segment_imports(script.text))
        else:
            exposed, option_issues = options_component_bindings(script.text)
            bindings.extend(exposed)
            issues.extend(option_issues)
    return bindings, issues


def parse_imports(text: str, *, sfc: bool = False) -> list[ImportBinding]:
    return sfc_exposed_imports(text)[0] if sfc else parse_segment_imports(text)


def exact_alias_base(spec: str, repo: Path) -> tuple[Path | None, str | None]:
    config = repo / "technical-platform/web/tsconfig.app.json"
    try:
        payload = json.loads(read_text(config))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None, "COMPONENT_GRAPH_ALIAS_CONFIG_INVALID"
    if not isinstance(payload, dict):
        return None, "COMPONENT_GRAPH_ALIAS_CONFIG_INVALID"
    compiler_options = payload.get("compilerOptions")
    if not isinstance(compiler_options, dict):
        return None, "COMPONENT_GRAPH_ALIAS_CONFIG_INVALID"
    paths = compiler_options.get("paths")
    if not isinstance(paths, dict):
        return None, "COMPONENT_GRAPH_ALIAS_CONFIG_INVALID"
    targets = paths.get(spec)
    if targets is None:
        return None, "COMPONENT_GRAPH_ALIAS_MISSING"
    if "*" in spec or not isinstance(targets, list) or len(targets) != 1:
        return None, "COMPONENT_GRAPH_ALIAS_TARGET_INVALID"
    target = targets[0]
    if not isinstance(target, str) or not target.strip() or "*" in target:
        return None, "COMPONENT_GRAPH_ALIAS_TARGET_INVALID"
    base_url = compiler_options.get("baseUrl", ".")
    if not isinstance(base_url, str) or not base_url.strip() or "*" in base_url:
        return None, "COMPONENT_GRAPH_ALIAS_CONFIG_INVALID"
    base = (config.parent / base_url / target).resolve()
    try:
        base.relative_to(repo.resolve())
    except ValueError:
        return None, "COMPONENT_GRAPH_PATH_ESCAPE"
    return base, None


def module_candidates(source: Path, spec: str, repo: Path) -> tuple[list[Path], str | None]:
    web_source = repo / "technical-platform/web/src"
    if spec.startswith("@/") or spec.startswith("~/"):
        base = web_source / spec[2:]
    elif spec.startswith("."):
        base = source.parent / spec
    elif spec.startswith("@sgj/"):
        alias_base, alias_error = exact_alias_base(spec, repo)
        if alias_error or alias_base is None:
            return [], alias_error
        base = alias_base
    else:
        return [], None  # package import: opaque framework/library boundary
    resolved_base = base.resolve()
    try:
        resolved_base.relative_to(repo.resolve())
    except ValueError:
        return [], "COMPONENT_GRAPH_PATH_ESCAPE"
    candidates = [base]
    if not base.suffix:
        candidates.extend(Path(str(base) + suffix) for suffix in (".vue", ".ts", ".tsx", ".js"))
        candidates.extend(base / name for name in ("index.ts", "index.tsx", "index.js", "index.vue"))
    existing: list[Path] = []
    for candidate in candidates:
        if candidate.is_file():
            resolved = candidate.resolve()
            if resolved not in existing:
                existing.append(resolved)
    return existing, None


def resolve_export(
    source: Path,
    spec: str,
    imported: str,
    repo: Path,
    stack: tuple[tuple[Path, str], ...] = (),
) -> tuple[Path | None, list[dict[str, object]]]:
    modules, boundary_error = module_candidates(source, spec, repo)
    if boundary_error:
        return None, [finding(boundary_error, safe_relative(source, repo), import_spec=spec)]
    if not modules:
        if spec.startswith((".", "@/", "~/", "@sgj/")):
            return None, [finding("COMPONENT_GRAPH_UNRESOLVED", safe_relative(source, repo), import_spec=spec, imported=imported)]
        return None, []
    if len(modules) != 1:
        return None, [finding("COMPONENT_GRAPH_AMBIGUOUS_MODULE", safe_relative(source, repo), import_spec=spec,
                              candidates=[safe_relative(item, repo) for item in modules])]
    module = modules[0]
    key = (module, imported)
    if key in stack:
        cycle = [f"{safe_relative(path, repo)}#{symbol}" for path, symbol in stack[stack.index(key):] + (key,)]
        return None, [finding("COMPONENT_GRAPH_REEXPORT_CYCLE", safe_relative(module, repo), cycle=cycle)]
    if module.suffix == ".vue":
        return module, []
    try:
        text = read_text(module)
    except (OSError, UnicodeError) as error:
        return None, [finding("COMPONENT_GRAPH_UNREADABLE", safe_relative(module, repo), error=type(error).__name__)]
    matches: list[tuple[str, str]] = []
    for export in REEXPORT.finditer(text):
        for item in export.group("items").split(","):
            original, exported = split_alias(item)
            if exported == imported:
                matches.append((export.group("spec"), original))
    if not matches:
        matches.extend((export.group("spec"), imported) for export in EXPORT_STAR.finditer(text))
    resolved: list[Path] = []
    issues: list[dict[str, object]] = []
    for child_spec, child_imported in matches:
        target, child_issues = resolve_export(module, child_spec, child_imported, repo, stack + (key,))
        issues.extend(child_issues)
        if target is not None and target not in resolved:
            resolved.append(target)
    if len(resolved) == 1 and not issues:
        return resolved[0], []
    if len(resolved) > 1:
        issues.append(finding("COMPONENT_GRAPH_AMBIGUOUS_EXPORT", safe_relative(module, repo), imported=imported,
                              candidates=[safe_relative(item, repo) for item in resolved]))
    if not resolved and not issues:
        issues.append(finding("COMPONENT_GRAPH_EXPORT_MISSING", safe_relative(module, repo), imported=imported))
    return None, issues


def rendered_main_graph(
    source: Path,
    repo: Path,
    stack: tuple[Path, ...] = (),
) -> tuple[int, list[tuple[Path, int]], list[dict[str, object]]]:
    resolved = source.resolve()
    if resolved in stack:
        cycle = [safe_relative(item, repo) for item in stack[stack.index(resolved):] + (resolved,)]
        return 0, [], [finding("COMPONENT_GRAPH_CYCLE", safe_relative(resolved, repo), cycle=cycle)]
    try:
        resolved.relative_to(repo.resolve())
    except ValueError:
        return 0, [], [finding("COMPONENT_GRAPH_PATH_ESCAPE", str(resolved))]
    if not resolved.is_file():
        return 0, [], [finding("COMPONENT_GRAPH_UNRESOLVED", safe_relative(resolved, repo))]
    try:
        text = read_text(resolved)
    except (OSError, UnicodeError) as error:
        return 0, [], [finding("COMPONENT_GRAPH_UNREADABLE", safe_relative(resolved, repo), error=type(error).__name__)]
    root_template = re.search(r"<template(?P<attrs>\s[^>]*)?>", text, re.IGNORECASE | re.DOTALL)
    if root_template and re.search(r"\bsrc\s*=", root_template.group("attrs") or "", re.IGNORECASE):
        return 0, [], [finding("COMPONENT_GRAPH_EXTERNAL_TEMPLATE_UNSUPPORTED", safe_relative(resolved, repo))]
    template = vue_template(text)
    if template is None:
        return 0, [], [finding("COMPONENT_GRAPH_TEMPLATE_MISSING", safe_relative(resolved, repo))]
    literal_count = len(re.findall(r"<\s*main\b", template, re.IGNORECASE))
    sources = [(resolved, literal_count)] if literal_count else []
    exposed_imports, sfc_issue_codes = sfc_exposed_imports(text)
    issues: list[dict[str, object]] = [finding(code, safe_relative(resolved, repo)) for code in sfc_issue_codes]
    total = literal_count
    bindings: dict[str, list[ImportBinding]] = {}
    for binding in exposed_imports:
        bindings.setdefault(binding.local, []).append(binding)
    usage: dict[str, int] = {}
    for match in HTML_TAG.finditer(template):
        tag = match.group("tag")
        if tag in VUE_BUILTINS:
            continue
        if tag.lower() == "component":
            values, unresolved, native_leaf = component_is_values(match.group("attrs"), text)
            if unresolved:
                issues.append(finding("COMPONENT_GRAPH_DYNAMIC_IS_UNRESOLVED", safe_relative(resolved, repo),
                                      expression=match.group("attrs").strip()))
                continue
            if native_leaf:
                continue
            candidate_names: list[str] = []
            for value in values:
                if value in bindings:
                    candidate_names.append(value)
                else:
                    candidate_names.extend(name for name in bindings if pascal_to_kebab(name) == value)
            if len(set(candidate_names)) != 1:
                issues.append(finding("COMPONENT_GRAPH_DYNAMIC_IS_AMBIGUOUS", safe_relative(resolved, repo),
                                      value=values[0], binding_count=len(set(candidate_names))))
                continue
            local = candidate_names[0]
            usage[local] = usage.get(local, 0) + 1
            continue
        if tag in bindings:
            local = tag
        elif "-" in tag:
            matches = [name for name in bindings if pascal_to_kebab(name) == tag.lower()]
            if len(matches) != 1:
                issues.append(finding("COMPONENT_GRAPH_KEBAB_BINDING_AMBIGUOUS" if matches else "COMPONENT_GRAPH_KEBAB_BINDING_MISSING",
                                      safe_relative(resolved, repo), component=tag, binding_count=len(matches)))
                continue
            local = matches[0]
        elif tag[:1].isupper():
            local = tag
        elif tag.lower() not in NATIVE_TAGS:
            matches = [name for name in bindings if pascal_to_kebab(name) == tag.lower()]
            if len(matches) != 1:
                issues.append(finding("COMPONENT_GRAPH_CUSTOM_BINDING_AMBIGUOUS" if matches else "COMPONENT_GRAPH_CUSTOM_BINDING_MISSING",
                                      safe_relative(resolved, repo), component=tag, binding_count=len(matches)))
                continue
            local = matches[0]
        else:
            continue
        usage[local] = usage.get(local, 0) + 1
    for tag, usage_count in sorted(usage.items()):
        candidates = bindings.get(tag, [])
        if len(candidates) != 1:
            issues.append(finding("COMPONENT_GRAPH_BINDING_AMBIGUOUS" if candidates else "COMPONENT_GRAPH_BINDING_MISSING",
                                  safe_relative(resolved, repo), component=tag, binding_count=len(candidates)))
            continue
        binding = candidates[0]
        target, resolution_issues = resolve_export(resolved, binding.spec, binding.imported, repo)
        issues.extend(resolution_issues)
        if target is None:
            if not resolution_issues and binding.spec.startswith((".", "@/", "~/")):
                issues.append(finding("COMPONENT_GRAPH_UNRESOLVED", safe_relative(resolved, repo), component=tag,
                                      import_spec=binding.spec))
            continue
        child_count, child_sources, child_issues = rendered_main_graph(target, repo, stack + (resolved,))
        total += usage_count * child_count
        sources.extend(child_sources)
        issues.extend(child_issues)
    return total, sources, issues


def string_end(text: str, start: int, quote: str) -> int:
    index = start + 1
    while index < len(text):
        if text[index] == "\\":
            index += 2
            continue
        if text[index] == quote:
            return index + 1
        index += 1
    return len(text)


def template_literal_end(text: str, start: int) -> tuple[int, bool]:
    """Return the full template span and whether it has real interpolation."""
    index = start + 1
    dynamic = False
    while index < len(text):
        if text[index] == "\\":
            index += 2
            continue
        if text[index] == "`":
            return index + 1, dynamic
        if text.startswith("${", index):
            dynamic = True
            index = template_expression_end(text, index + 2)
            continue
        index += 1
    return len(text), dynamic


def template_expression_end(text: str, start: int) -> int:
    depth = 1
    index = start
    while index < len(text):
        if text.startswith("//", index):
            newline = text.find("\n", index + 2)
            index = len(text) if newline < 0 else newline + 1
            continue
        if text.startswith("/*", index):
            close = text.find("*/", index + 2)
            index = len(text) if close < 0 else close + 2
            continue
        if text[index] in "'\"":
            index = string_end(text, index, text[index])
            continue
        if text[index] == "`":
            index, _ = template_literal_end(text, index)
            continue
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index + 1
        index += 1
    return len(text)


def brace_pairs(text: str) -> dict[int, int]:
    stack: list[int] = []
    pairs: dict[int, int] = {}
    index = 0
    while index < len(text):
        char = text[index]
        if char in "'\"`":
            index = template_literal_end(text, index)[0] if char == "`" else string_end(text, index, char)
            continue
        if text.startswith("//", index):
            newline = text.find("\n", index + 2)
            index = len(text) if newline < 0 else newline + 1
            continue
        if text.startswith("/*", index):
            close = text.find("*/", index + 2)
            index = len(text) if close < 0 else close + 2
            continue
        if char == "{":
            stack.append(index)
        elif char == "}" and stack:
            pairs[stack.pop()] = index
        index += 1
    return pairs


def js_code_mask(text: str) -> str:
    masked = list(text)
    index = 0
    while index < len(text):
        if text.startswith("//", index):
            end = text.find("\n", index + 2)
            end = len(text) if end < 0 else end
            masked[index:end] = " " * (end - index)
            index = end
        elif text.startswith("/*", index):
            end = text.find("*/", index + 2)
            end = len(text) if end < 0 else end + 2
            masked[index:end] = " " * (end - index)
            index = end
        elif text[index] == "/":
            prefix = "".join(masked[:index]).rstrip()
            previous = "" if not prefix else prefix[-1]
            previous_word = re.search(r"([A-Za-z_$][A-Za-z0-9_$]*)$", prefix)
            regex_context = (not prefix or previous in "=([{,:;!&|?~%^*<>" or
                             (previous_word is not None and previous_word.group(1) in
                              {"return", "case", "throw", "else", "do", "typeof", "instanceof", "in", "of", "yield", "await"}))
            if not regex_context:
                index += 1
                continue
            end = index + 1
            character_class = False
            while end < len(text):
                if text[end] == "\\":
                    end += 2
                    continue
                if text[end] == "[":
                    character_class = True
                elif text[end] == "]":
                    character_class = False
                elif text[end] == "/" and not character_class:
                    end += 1
                    while end < len(text) and text[end].isalpha():
                        end += 1
                    break
                elif text[end] in "\r\n":
                    break
                end += 1
            masked[index:end] = " " * (end - index)
            index = end
        elif text[index] in "'\"`":
            quote = text[index]
            end, dynamic_template = (template_literal_end(text, index) if quote == "`" else
                                     (string_end(text, index, quote), False))
            masked[index:end] = " " * (end - index)
            # Quoted strings and interpolation-free templates are static
            # literals.  An interpolated template is executable JS; retain a
            # same-width marker so every recursive route-value proof rejects
            # it instead of confusing it with a blank literal.
            if dynamic_template:
                masked[index] = "D"
            index = end
        else:
            index += 1
    result = "".join(masked)
    # Restore only property-name strings whose following colon survived masking.
    # This admits {'path': ...} and {['path']: ...} without exposing string values.
    restored = list(result)
    quoted_key = re.compile(r"(?P<open>\[\s*)?(?P<quote>['\"])(?P<key>path|component)(?P=quote)(?(open)\s*\])\s*:")
    for match in quoted_key.finditer(text):
        colon = match.end() - 1
        if colon < len(result) and result[colon] == ":":
            restored[match.start():match.end()] = text[match.start():match.end()]
    return "".join(restored)


ROUTE_KEY = r"(?:\bpath\b|['\"]path['\"]|\[\s*['\"]path['\"]\s*\])\s*:"
COMPONENT_KEY = r"(?:\bcomponent\b|['\"]component['\"]|\[\s*['\"]component['\"]\s*\])\s*:"


def route_objects(text: str, source: Path) -> list[RouteObject]:
    pairs = brace_pairs(text)
    code = js_code_mask(text)
    routes: list[RouteObject] = []
    seen: set[tuple[int, int]] = set()
    for match in re.finditer(ROUTE_KEY, code):
        containers = [(start, end) for start, end in pairs.items() if start < match.start() < end]
        if not containers:
            continue
        start, end = max(containers, key=lambda item: item[0])
        key = (start, end)
        if key in seen:
            continue
        seen.add(key)
        expression_match = re.match(r"\s*(?P<expr>[^,}\n]+)", text[match.end():])
        expression = "" if expression_match is None else expression_match.group("expr").strip()
        literal = re.fullmatch(r"([\"'])(?P<path>[^\"']+)\1", expression)
        routes.append(RouteObject(None if literal is None else literal.group("path"), expression,
                                  text[start:end + 1], source))
    # A component-bearing object with no supported path key may be a computed or
    # otherwise opaque route. Enumerate it so PHASE-10 relevance cannot disappear.
    for match in re.finditer(COMPONENT_KEY, code):
        containers = [(start, end) for start, end in pairs.items() if start < match.start() < end]
        if not containers:
            continue
        start, end = max(containers, key=lambda item: item[0])
        key = (start, end)
        if key not in seen:
            seen.add(key)
            routes.append(RouteObject(None, "<missing-or-computed>", text[start:end + 1], source))
    return routes


def route_component(block: str, router_path: Path, repo: Path) -> tuple[Path | None, list[dict[str, object]]]:
    key = re.search(COMPONENT_KEY, js_code_mask(block))
    if key is None:
        return None, [finding("ROUTER_COMPONENT_MISSING", safe_relative(router_path, repo))]
    expression = block[key.end():].lstrip()
    direct = re.match(r"(?P<name>[A-Z][A-Za-z0-9_$]*)", expression)
    dynamic = re.match(r"(?:\(\s*\)\s*=>\s*)?import\s*\(\s*[\"'](?P<spec>[^\"']+)[\"']", expression)
    if dynamic:
        return resolve_export(router_path, dynamic.group("spec"), "default", repo)
    if not direct:
        return None, [finding("ROUTER_COMPONENT_MISSING", safe_relative(router_path, repo))]
    name = direct.group("name")
    bindings = [binding for binding in parse_imports(read_text(router_path)) if binding.local == name]
    if len(bindings) != 1:
        return None, [finding("ROUTER_COMPONENT_BINDING_AMBIGUOUS", safe_relative(router_path, repo),
                              component=name, binding_count=len(bindings))]
    return resolve_export(router_path, bindings[0].spec, bindings[0].imported, repo)


def delimiter_end(code: str, start: int, opening: str, closing: str) -> int | None:
    depth = 0
    for index in range(start, len(code)):
        if code[index] == opening:
            depth += 1
        elif code[index] == closing:
            depth -= 1
            if depth == 0:
                return index
    return None


def static_plain_object(code: str, start: int, *, kind: str,
                        allowed_shorthand: frozenset[str] = frozenset()) -> tuple[bool, int | None]:
    end = delimiter_end(code, start, "{", "}")
    if end is None:
        return False, None
    allowed_meta = {"permission", "permissionsAny", "requiresAuth", "guestOnly"}
    allowed_redirect = {"name", "path"}
    seen: set[str] = set()
    for part_start, part_end in top_level_parts(code, start + 1, end):
        part = code[part_start:part_end].strip()
        if not part:
            continue
        if part.startswith("...") or re.match(r"(?:get|set)\b", part):
            return False, end
        shorthand = re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", part)
        if shorthand:
            if kind != "props" or shorthand.group(0) not in allowed_shorthand:
                return False, end
            continue
        key = re.match(r"(?P<bare>[A-Za-z_$][A-Za-z0-9_$]*)\s*:|"
                       r"['\"](?P<quoted>[A-Za-z_$][A-Za-z0-9_$]*)['\"]\s*:", part)
        if key is None:
            return False, end
        name = key.group("bare") or key.group("quoted")
        if name in seen or (kind == "meta" and name not in allowed_meta) or (kind == "redirect" and name not in allowed_redirect):
            return False, end
        seen.add(name)
        if not static_route_value(part[key.end():].strip(), kind=kind,
                                  allowed_shorthand=allowed_shorthand):
            return False, end
    return True, end


def static_route_value(value: str, *, kind: str,
                       allowed_shorthand: frozenset[str] = frozenset()) -> bool:
    # String literals are blank in js_code_mask; primitive literals survive.
    if not value or re.fullmatch(r"(?:true|false|null|-?\d+(?:\.\d+)?)", value):
        return True
    if value.startswith("{"):
        valid, end = static_plain_object(value, 0, kind=kind, allowed_shorthand=allowed_shorthand)
        return bool(valid and end is not None and not value[end + 1:].strip())
    if value.startswith("["):
        end = delimiter_end(value, 0, "[", "]")
        if end is None or value[end + 1:].strip():
            return False
        return all(static_route_value(value[start:stop].strip(), kind=kind,
                                      allowed_shorthand=allowed_shorthand)
                   for start, stop in top_level_parts(value, 1, end))
    return False


def static_route_object(code: str, start: int,
                        allowed_shorthand: frozenset[str] = frozenset()) -> tuple[bool, int | None]:
    end = delimiter_end(code, start, "{", "}")
    if end is None:
        return False, None
    key_counts: dict[str, int] = {}
    allowed_keys = {"path", "name", "component", "props", "meta", "children", "redirect"}
    for part_start, part_end in top_level_parts(code, start + 1, end):
        part = code[part_start:part_end].strip()
        if not part:
            continue
        if re.fullmatch(r"\.\.\.[A-Za-z_$][A-Za-z0-9_$]*", part):
            continue
        if part.startswith("...") or re.match(r"(?:get|set)\b", part):
            return False, end
        key = re.match(r"(?P<bare>[A-Za-z_$][A-Za-z0-9_$]*)\s*:|"
                       r"['\"](?P<quoted>[A-Za-z_$][A-Za-z0-9_$]*)['\"]\s*:|"
                       r"\[\s*['\"](?P<computed>[A-Za-z_$][A-Za-z0-9_$]*)['\"]\s*\]\s*:", part)
        if key is None:
            return False, end
        key_name = next(value for value in (key.group("bare"), key.group("quoted"), key.group("computed")) if value)
        if key_name not in allowed_keys:
            return False, end
        key_counts[key_name] = key_counts.get(key_name, 0) + 1
        if key_counts[key_name] > 1:
            return False, end
        value = part[key.end():].strip()
        if key_name == "component":
            if not (re.fullmatch(r"[A-Z][A-Za-z0-9_$]*", value) or
                    re.fullmatch(r"\(\s*\)\s*=>\s*import\s*\(\s*\)", value)):
                return False, end
        elif key_name in {"path", "name"} and value:
            # String literal contents are masked. Any surviving expression is
            # mutable/non-literal and cannot be authoritative.
            return False, end
        elif key_name in {"props", "meta"}:
            if not value.startswith("{"):
                return False, end
            valid, nested_end = static_plain_object(value, 0, kind=key_name,
                                                    allowed_shorthand=allowed_shorthand)
            if not valid or nested_end is None or value[nested_end + 1:].strip():
                return False, end
        elif key_name == "children":
            valid, nested_end = (static_route_array(value, 0, allowed_shorthand=allowed_shorthand)
                                 if value.startswith("[") else (False, None))
            if not valid or nested_end is None or value[nested_end + 1:].strip():
                return False, end
        elif key_name == "redirect":
            if value:
                if not value.startswith("{"):
                    return False, end
                valid, nested_end = static_plain_object(value, 0, kind="redirect",
                                                        allowed_shorthand=allowed_shorthand)
                if not valid or nested_end is None or value[nested_end + 1:].strip():
                    return False, end
    if key_counts.get("path", 0) > 1 or key_counts.get("component", 0) > 1:
        return False, end
    return True, end


def static_route_array(code: str, start: int,
                       allowed_shorthand: frozenset[str] = frozenset()) -> tuple[bool, int | None]:
    end = delimiter_end(code, start, "[", "]")
    if end is None:
        return False, None
    elements: list[str] = []
    element_start = start + 1
    stack: list[str] = []
    pairs = {"(": ")", "[": "]", "{": "}"}
    for index in range(start + 1, end):
        char = code[index]
        if char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
        elif char == "," and not stack:
            elements.append(code[element_start:index].strip())
            element_start = index + 1
    elements.append(code[element_start:end].strip())
    for element in elements:
        if not element:
            continue
        if element.startswith("{"):
            object_static, object_end = static_route_object(element, 0, allowed_shorthand=allowed_shorthand)
            if not object_static or object_end is None or element[object_end + 1:].strip():
                return False, end
        elif not re.fullmatch(r"\.\.\.[A-Za-z_$][A-Za-z0-9_$]*(?:\s*\([^)]*\))?", element):
            return False, end
    return True, end


def enclosing_delimiters(code: str, position: int) -> list[str]:
    stack: list[str] = []
    pairs = {"(": ")", "[": "]", "{": "}"}
    for char in code[:position]:
        if char in pairs:
            stack.append(char)
        elif char in ")]}" and stack and pairs[stack[-1]] == char:
            stack.pop()
    return stack


def proven_route_spread_reference(code: str, start: int, end: int, *, invocation: bool,
                                  expected_container: str = "[") -> bool:
    if not re.search(r"\.\.\.\s*$", code[:start]):
        return False
    delimiters = enclosing_delimiters(code, start)
    if not delimiters or delimiters[-1] != expected_container:
        return False
    suffix = code[end:]
    if invocation:
        call = re.match(r"\s*\((?P<args>[^()]*)\)", suffix)
        return call is not None
    closing = "]" if expected_container == "[" else "}"
    return suffix.lstrip().startswith((",", closing))


def function_parameter_names(code: str, declaration_end: int, body_start: int) -> set[str] | None:
    parameters_start = code.find("(", declaration_end, body_start)
    if parameters_start < 0:
        return None
    parameters_end = delimiter_end(code, parameters_start, "(", ")")
    if parameters_end is None or parameters_end >= body_start:
        return None
    names: set[str] = set()
    for start, end in top_level_parts(code, parameters_start + 1, parameters_end):
        parameter = code[start:end].strip()
        if not parameter:
            continue
        match = re.match(r"(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\?|:|=|$)", parameter)
        if match is None or match.group("name") in names:
            return None
        names.add(match.group("name"))
    return names


def static_route_parameter(body_code: str, name: str) -> bool:
    """Prove a route-factory parameter is read-only and only used as data.

    The supported grammar deliberately admits the repository's `portal.code`
    guards and `{ portal }` props shorthand.  Every binding change, alias,
    escape, shadow, closure or unclassified reference fails closed.
    """
    escaped = re.escape(name)
    if re.search(rf"\b(?:const|let|var|function|class)\s+{escaped}\b|\bcatch\s*\(\s*{escaped}\b",
                 body_code):
        return False
    if re.search(rf"\bdelete\s+{escaped}\b|\b{escaped}\b\s*(?:\+\+|--|(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[[^\]]+\])\s*(?:\+\+|--|(?:[+\-*/%&|^]|&&|\|\||\?\?)?=(?!=|>)))",
                 body_code):
        return False
    if re.search(rf"\b{escaped}\b\s*(?:[+\-*/%&|^]|&&|\|\||\?\?)?=(?!=|>)", body_code):
        return False
    if re.search(rf"\b(?:return|throw|yield)\s+{escaped}\b", body_code):
        return False
    if re.search(rf"\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*{escaped}\b", body_code):
        return False
    # An object containing the parameter cannot be passed to an unknown call;
    # that would let the callee retain or mutate the same portal object.
    if re.search(rf"\b(?!if\b|for\b|while\b|switch\b)[A-Za-z_$][A-Za-z0-9_$.]*\s*\([^;\n)]*\b{escaped}\b",
                 body_code):
        return False
    for reference in re.finditer(rf"\b{escaped}\b", body_code):
        before = body_code[:reference.start()].rstrip()
        after = body_code[reference.end():].lstrip()
        if after.startswith("."):
            member = re.match(r"\.\s*(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)", after)
            if member is None or member.group("name") != "code":
                return False
            tail = after[member.end():].lstrip()
            # Only the repository's bounded portal.code guard is authority.
            # A method/constructor/computed/optional/chained access, update or
            # assignment would execute code or mutate the published props
            # object and therefore cannot be treated as a read.
            if (re.search(r"(?:\+\+|--|\bnew|\bdelete|\bawait|\byield)\s*$", before) or
                    re.match(r"(?:\?\s*\.|\.|\[|\(|\+\+|--|(?:[+\-*/%&|^]|&&|\|\||\?\?)?=(?!=|>))", tail)):
                return False
            continue
        if before and before[-1] in "{," and (not after or after[0] in ",}"):
            continue
        return False
    return True


def static_local_contributor(text: str, code: str, name: str, spread_position: int,
                             source: Path, repo: Path,
                             dependency_stack: tuple[str, ...] = ()) -> tuple[bool, dict[str, object] | None]:
    if name in dependency_stack:
        return False, finding("ROUTER_CONTRIBUTOR_CYCLE", safe_relative(source, repo),
                              cycle=list(dependency_stack + (name,)))
    escaped = re.escape(name)
    function_matches = list(re.finditer(rf"\bfunction\s+{escaped}\b", code))
    declarations = list(re.finditer(rf"\b(?P<kind>const|let|var)\s+{escaped}\s*=", code[:spread_position]))
    local_count = len(function_matches) + len(declarations)
    if local_count == 0:
        return False, None
    if function_matches and declarations or local_count != 1:
        return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                              reason="local-declaration-ambiguous")
    if function_matches:
        declaration = function_matches[0]
        body_start = code.find("{", declaration.end())
        body_end = None if body_start < 0 else delimiter_end(code, body_start, "{", "}")
        if body_start < 0 or body_end is None:
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="function-body-unresolved")
        parameters = function_parameter_names(code, declaration.end(), body_start)
        if parameters is None:
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="function-parameters-unresolved")
        body_code = code[body_start + 1:body_end]
        if re.search(r"\b(?:function|class)\b|=>", body_code):
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="nested-executable-scope")
        for method in re.finditer(r"\([^)]*\)\s*{", body_code):
            prefix = body_code[:method.start()].rstrip()
            owner = re.search(r"([A-Za-z_$][A-Za-z0-9_$]*)$", prefix)
            if owner is None or owner.group(1) not in {"if", "for", "while", "switch", "catch", "with"}:
                return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                      reason="nested-method-scope")
        allowed_shorthand = frozenset(
            parameter for parameter in parameters
            if parameter == "portal" and static_route_parameter(body_code, parameter)
        )
        if "portal" in parameters and "portal" not in allowed_shorthand:
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="route-factory-parameter-not-static")
        returns = list(re.finditer(r"\breturn\b", body_code))
        literal_returns: list[re.Match[str]] = []
        for match in returns:
            after = match.end()
            while after < len(body_code) and body_code[after].isspace():
                after += 1
            if (after < len(body_code) and body_code[after] == "[" and
                    static_route_array(body_code, after, allowed_shorthand=allowed_shorthand)[0]):
                literal_returns.append(match)
        if not returns or len(literal_returns) != len(returns):
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="function-return-not-static-route-array")
        for dependency in re.finditer(r"\.\.\.\s*(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*(?P<call>\()", body_code):
            child_name = dependency.group("name")
            child_static, child_issue = static_local_contributor(
                text, code, child_name, body_start + 1 + dependency.start(), source, repo,
                dependency_stack + (name,))
            if child_issue is not None:
                return False, child_issue
            if not child_static:
                # Imported contributors are validated independently by route_module_graph.
                bindings = [binding for binding in parse_imports(text) if binding.local == child_name]
                if not bindings:
                    return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo),
                                          contributor=name, dependency=child_name,
                                          reason="function-dependency-unresolved")
        tail = code[body_end + 1:]
        for reference in re.finditer(rf"\b{escaped}\b", tail):
            if not proven_route_spread_reference(tail, reference.start(), reference.end(), invocation=True):
                return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                      reason="function-binding-escapes-or-mutates")
        return True, None
    if declarations:
        declaration = declarations[0]
        if declaration.group("kind") != "const":
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="mutable-local-contributor")
        expression_start = declaration.end()
        while expression_start < len(code) and code[expression_start].isspace():
            expression_start += 1
        if expression_start >= len(code) or code[expression_start] not in "[{":
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="initializer-not-static-literal")
        opening = code[expression_start]
        if opening == "[" and not static_route_array(code, expression_start)[0]:
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="route-array-element-not-static-object")
        expression_end = delimiter_end(code, expression_start, opening, "]" if opening == "[" else "}")
        if expression_end is None:
            return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                  reason="initializer-unbalanced")
        tail = code[expression_end + 1:]
        for reference in re.finditer(rf"\b{escaped}\b", tail):
            if not proven_route_spread_reference(tail, reference.start(), reference.end(), invocation=False,
                                                  expected_container="[" if opening == "[" else "{"):
                return False, finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(source, repo), contributor=name,
                                      reason="static-literal-escapes-or-mutates")
        return True, None
    return False, None


def route_module_graph(router_path: Path, repo: Path) -> tuple[list[tuple[Path, str]], list[dict[str, object]]]:
    modules: list[tuple[Path, str]] = []
    issues: list[dict[str, object]] = []
    visited: set[Path] = set()

    def visit(source: Path, stack: tuple[Path, ...]) -> None:
        resolved = source.resolve()
        if resolved in stack:
            issues.append(finding("ROUTER_CONTRIBUTOR_CYCLE", safe_relative(resolved, repo),
                                  cycle=[safe_relative(item, repo) for item in stack + (resolved,)]))
            return
        if resolved in visited:
            return
        visited.add(resolved)
        try:
            text = read_text(resolved)
        except (OSError, UnicodeError) as error:
            issues.append(finding("ROUTER_CONTRIBUTOR_UNREADABLE", safe_relative(resolved, repo),
                                  error=type(error).__name__))
            return
        modules.append((resolved, text))
        code = js_code_mask(text)
        for exported in re.finditer(r"\bexport\s+const\s+(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\[", code):
            array_start = code.find("[", exported.start(), exported.end())
            if array_start < 0 or not static_route_array(code, array_start)[0]:
                issues.append(finding("ROUTER_CONTRIBUTOR_OPAQUE", safe_relative(resolved, repo),
                                      contributor=exported.group("name"),
                                      reason="exported-route-array-not-static"))
        imports: dict[str, list[ImportBinding]] = {}
        for binding in parse_imports(text):
            imports.setdefault(binding.local, []).append(binding)
        for spread in re.finditer(r"\.\.\.\s*(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)", code):
            name = spread.group("name")
            local_static, local_issue = static_local_contributor(text, code, name, spread.start(), resolved, repo)
            if local_static:
                continue
            if local_issue is not None:
                issues.append(local_issue)
                continue
            bindings = imports.get(name, [])
            if len(bindings) != 1:
                issues.append(finding("ROUTER_CONTRIBUTOR_BINDING_AMBIGUOUS" if bindings else
                                      "ROUTER_CONTRIBUTOR_BINDING_MISSING", safe_relative(resolved, repo),
                                      contributor=name, binding_count=len(bindings)))
                continue
            binding = bindings[0]
            candidates, boundary_error = module_candidates(resolved, binding.spec, repo)
            if boundary_error:
                issues.append(finding("ROUTER_CONTRIBUTOR_PATH_ESCAPE", safe_relative(resolved, repo),
                                      contributor=name, import_spec=binding.spec))
            elif len(candidates) != 1:
                issues.append(finding("ROUTER_CONTRIBUTOR_UNRESOLVED" if not candidates else
                                      "ROUTER_CONTRIBUTOR_AMBIGUOUS", safe_relative(resolved, repo),
                                      contributor=name, import_spec=binding.spec,
                                      candidates=[safe_relative(item, repo) for item in candidates]))
            else:
                visit(candidates[0], stack + (resolved,))
        # Once a spread contributor module is in scope, local barrel/re-export
        # edges are part of that contributor's grammar and must be traversed.
        for export in list(REEXPORT.finditer(text)) + list(EXPORT_STAR.finditer(text)):
            spec = export.group("spec")
            if not spec.startswith((".", "@/", "~/")):
                continue
            candidates, boundary_error = module_candidates(resolved, spec, repo)
            if boundary_error:
                issues.append(finding("ROUTER_CONTRIBUTOR_PATH_ESCAPE", safe_relative(resolved, repo),
                                      import_spec=spec))
            elif len(candidates) != 1:
                issues.append(finding("ROUTER_CONTRIBUTOR_UNRESOLVED" if not candidates else
                                      "ROUTER_CONTRIBUTOR_AMBIGUOUS", safe_relative(resolved, repo),
                                      import_spec=spec,
                                      candidates=[safe_relative(item, repo) for item in candidates]))
            else:
                visit(candidates[0], stack + (resolved,))

    visit(router_path, ())
    return modules, issues


def discover_route_targets(repo: Path) -> tuple[list[Path], Path | None, list[dict[str, object]], list[str]]:
    router_path = repo / ROUTER
    bindings_path = repo / PAGE_BINDINGS
    issues: list[dict[str, object]] = []
    if not router_path.is_file():
        return [], None, [finding("ROUTER_MISSING", ROUTER)], []
    if not bindings_path.is_file():
        return [], None, [finding("PAGE_BINDINGS_MISSING", PAGE_BINDINGS)], []
    try:
        router_text = read_text(router_path)
        bindings_payload = json.loads(read_text(bindings_path))
        records = bindings_payload if isinstance(bindings_payload, list) else bindings_payload.get("bindings", [])
        expected_paths = sorted({str(item["route_path"]) for item in records if item.get("process_code") in ACTION_CONTRACTS})
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        return [], None, [finding("ROUTER_AUTHORITY_UNREADABLE", ROUTER, error=type(error).__name__)], []
    modules, module_issues = route_module_graph(router_path, repo)
    issues.extend(module_issues)
    objects = [route for source, text in modules for route in route_objects(text, source)]
    by_path: dict[str, list[RouteObject]] = {}
    nonliteral: list[RouteObject] = []
    for route in objects:
        if route.path is None:
            nonliteral.append(route)
        else:
            by_path.setdefault(route.path, []).append(route)
    targets: list[Path] = []
    pages_root = (repo / "technical-platform/web/src/platform/pages").resolve()
    for path in expected_paths:
        matches = by_path.get(path, [])
        if len(matches) != 1:
            issues.append(finding("ROUTER_BINDING_MISSING" if not matches else "ROUTER_BINDING_DUPLICATE", ROUTER,
                                  route_path=path, binding_count=len(matches)))
            continue
        target, target_issues = route_component(matches[0].block, matches[0].source, repo)
        issues.extend(target_issues)
        if target is None:
            continue
        try:
            target.relative_to(pages_root)
        except ValueError:
            issues.append(finding("ROUTER_TARGET_OUT_OF_PAGE_SET", ROUTER, route_path=path,
                                  component_path=safe_relative(target, repo)))
            continue
        if target not in targets:
            targets.append(target)
    for path, routes in by_path.items():
        if path in expected_paths:
            continue
        phase10_permission = any(re.search(r"p0(?:06|07|08|09|10)\.", route.block) for route in routes)
        reuses_phase10_target = False
        for route in routes:
            candidate, _ = route_component(route.block, route.source, repo)
            if candidate is not None and candidate in targets:
                reuses_phase10_target = True
        if phase10_permission or reuses_phase10_target:
            issues.append(finding("ROUTER_PHASE10_PATH_OUT_OF_BINDINGS", ROUTER, route_path=path))
    for route in nonliteral:
        phase10_permission = re.search(r"p0(?:06|07|08|09|10)\.", route.block) is not None
        candidate, candidate_issues = route_component(route.block, route.source, repo)
        reuses_phase10_target = candidate is not None and candidate in targets
        if phase10_permission or reuses_phase10_target:
            issues.append(finding("ROUTER_PHASE10_PATH_NON_LITERAL", ROUTER,
                                  path_expression=route.path_expression or "<empty>"))
            if phase10_permission and candidate is None:
                issues.extend(candidate_issues)
    layout_matches = by_path.get("/", [])
    layout: Path | None = None
    if len(layout_matches) != 1:
        issues.append(finding("ROUTER_LAYOUT_BINDING_MISSING" if not layout_matches else "ROUTER_LAYOUT_BINDING_DUPLICATE",
                              ROUTER, binding_count=len(layout_matches)))
    else:
        layout, layout_issues = route_component(layout_matches[0].block, layout_matches[0].source, repo)
        issues.extend(layout_issues)
    return sorted(targets), layout, issues, expected_paths


def java_tokens(text: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    index = 0
    while index < len(text):
        if text[index].isspace():
            index += 1
        elif text.startswith("//", index):
            end = text.find("\n", index + 2)
            index = len(text) if end < 0 else end + 1
        elif text.startswith("/*", index):
            end = text.find("*/", index + 2)
            index = len(text) if end < 0 else end + 2
        elif text.startswith('"""', index):
            end = text.find('"""', index + 3)
            index = len(text) if end < 0 else end + 3
        elif text[index] == '"':
            end = index + 1
            value: list[str] = []
            while end < len(text) and text[end] != '"':
                if text[end] == "\\" and end + 1 < len(text):
                    end += 1
                value.append(text[end])
                end += 1
            tokens.append(("string", "".join(value)))
            index = min(len(text), end + 1)
        elif text[index] == "'":
            index = string_end(text, index, "'")
        else:
            identifier = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", text[index:])
            if identifier:
                tokens.append(("identifier", identifier.group(0)))
                index += len(identifier.group(0))
            else:
                tokens.append(("symbol", text[index]))
                index += 1
    return tokens


def java_action_definitions(text: str, expected_class: str) -> tuple[list[set[str]], int, int]:
    tokens = java_tokens(text)
    token_depths: list[int] = []
    compilation_depth = 0
    for token in tokens:
        token_depths.append(compilation_depth)
        if token == ("symbol", "{"):
            compilation_depth += 1
        elif token == ("symbol", "}"):
            compilation_depth = max(0, compilation_depth - 1)
    regions: list[tuple[int, int]] = []
    for index in range(len(tokens) - 2):
        if (token_depths[index] != 0 or tokens[index] != ("identifier", "class") or
                tokens[index + 1] != ("identifier", expected_class)):
            continue
        opening = next((cursor for cursor in range(index + 2, len(tokens))
                        if tokens[cursor] == ("symbol", "{") or tokens[cursor] == ("symbol", ";")), None)
        if opening is None or tokens[opening] != ("symbol", "{"):
            continue
        depth = 1
        closing = None
        for cursor in range(opening + 1, len(tokens)):
            if tokens[cursor] == ("symbol", "{"):
                depth += 1
            elif tokens[cursor] == ("symbol", "}"):
                depth -= 1
                if depth == 0:
                    closing = cursor
                    break
        if closing is not None:
            regions.append((opening, closing))
    definitions: list[set[str]] = []
    invalid_assignments = 0
    if len(regions) != 1:
        return definitions, invalid_assignments, len(regions)
    opening, closing = regions[0]
    brace_depth = 1
    statement_start = opening + 1
    for index in range(opening + 1, closing):
        token = tokens[index]
        if token == ("symbol", "{"):
            brace_depth += 1
            statement_start = index + 1
            continue
        if token == ("symbol", "}"):
            brace_depth = max(0, brace_depth - 1)
            statement_start = index + 1
            continue
        if token == ("symbol", ";"):
            statement_start = index + 1
            continue
        if token != ("identifier", "ACTIONS") or index + 1 >= closing or tokens[index + 1] != ("symbol", "="):
            continue
        prefix = {value for kind, value in tokens[statement_start:index] if kind == "identifier"}
        if brace_depth != 1 or not {"static", "final"} <= prefix:
            invalid_assignments += 1
            continue
        values: set[str] = set()
        depth = 0
        cursor = index + 2
        while cursor < len(tokens):
            kind, value = tokens[cursor]
            if kind == "symbol" and value in "([{":
                depth += 1
            elif kind == "symbol" and value in ")]}":
                depth -= 1
            elif kind == "symbol" and value == ";" and depth == 0:
                break
            elif kind == "string" and re.fullmatch(r"[A-Z][A-Z0-9_]*", value) and not re.fullmatch(r"S\d{2}|END", value):
                values.add(value)
            cursor += 1
        definitions.append(values)
    return definitions, invalid_assignments, len(regions)


def sql_executable_text(text: str) -> str:
    """Expose SQL and DO-block bodies while masking other dollar-quoted literals."""
    output = list(text)
    index = 0
    while index < len(text):
        marker = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", text[index:])
        if marker is None:
            index += 1
            continue
        delimiter = marker.group(0)
        end = text.find(delimiter, index + len(delimiter))
        if end < 0:
            output[index:] = " " * (len(text) - index)
            break
        prefix = text[:index].rstrip()
        is_do_body = re.search(r"\bDO\s*$", prefix, re.IGNORECASE) is not None
        output[index:index + len(delimiter)] = " " * len(delimiter)
        output[end:end + len(delimiter)] = " " * len(delimiter)
        if not is_do_body:
            output[index + len(delimiter):end] = " " * (end - index - len(delimiter))
        index = end + len(delimiter)
    return "".join(output)


def sql_tokens(text: str) -> list[tuple[str, str]]:
    text = sql_executable_text(text)
    tokens: list[tuple[str, str]] = []
    index = 0
    while index < len(text):
        if text[index].isspace():
            index += 1
        elif text.startswith("--", index):
            end = text.find("\n", index + 2)
            index = len(text) if end < 0 else end + 1
        elif text.startswith("/*", index):
            end = text.find("*/", index + 2)
            index = len(text) if end < 0 else end + 2
        elif text[index] == "'":
            index += 1
            value: list[str] = []
            while index < len(text):
                if text.startswith("''", index):
                    value.append("'")
                    index += 2
                elif text[index] == "'":
                    index += 1
                    break
                else:
                    value.append(text[index])
                    index += 1
            tokens.append(("string", "".join(value)))
        else:
            identifier = re.match(r"[A-Za-z_][A-Za-z0-9_$]*", text[index:])
            if identifier:
                tokens.append(("identifier", identifier.group(0).lower()))
                index += len(identifier.group(0))
            else:
                tokens.append(("symbol", text[index]))
                index += 1
    return tokens


def sql_transition_actions(text: str) -> tuple[set[str], int, list[str]]:
    tokens = sql_tokens(text)
    actions: set[str] = set()
    insert_count = 0
    issues: list[str] = []
    index = 0
    required = ("from_node_code", "action_code", "to_node_code")
    while index + 4 < len(tokens):
        signature = tokens[index:index + 5]
        if signature != [("identifier", "insert"), ("identifier", "into"),
                          ("identifier", "workflow"), ("symbol", "."),
                          ("identifier", "wf_transition")]:
            index += 1
            continue
        insert_count += 1
        cursor = index + 5
        if cursor >= len(tokens) or tokens[cursor] != ("symbol", "("):
            issues.append("explicit-columns-required")
            index += 5
            continue
        cursor += 1
        columns: list[str] = []
        while cursor < len(tokens) and tokens[cursor] != ("symbol", ")"):
            if tokens[cursor][0] == "identifier":
                columns.append(tokens[cursor][1])
            elif tokens[cursor] != ("symbol", ","):
                issues.append("invalid-column-list")
            cursor += 1
        if cursor >= len(tokens):
            issues.append("unterminated-column-list")
            break
        cursor += 1
        if cursor >= len(tokens) or tokens[cursor] != ("identifier", "values"):
            issues.append("values-required")
            index = cursor
            continue
        missing = [column for column in required if column not in columns]
        if missing:
            issues.append("missing-columns:" + ",".join(missing))
        positions = [columns.index(column) if column in columns else -1 for column in required]
        cursor += 1
        while cursor < len(tokens) and tokens[cursor] != ("symbol", ";"):
            if tokens[cursor] == ("symbol", ","):
                cursor += 1
                continue
            if tokens[cursor] != ("symbol", "("):
                issues.append("invalid-values-tuple")
                break
            cursor += 1
            fields: list[list[tuple[str, str]]] = [[]]
            depth = 0
            while cursor < len(tokens):
                token = tokens[cursor]
                if token == ("symbol", "("):
                    depth += 1
                    fields[-1].append(token)
                elif token == ("symbol", ")"):
                    if depth == 0:
                        cursor += 1
                        break
                    depth -= 1
                    fields[-1].append(token)
                elif token == ("symbol", ",") and depth == 0:
                    fields.append([])
                else:
                    fields[-1].append(token)
                cursor += 1
            else:
                issues.append("unterminated-values-tuple")
                break
            if min(positions) >= 0 and max(positions) < len(fields):
                values = [fields[position] for position in positions]
                if all(len(value) == 1 and value[0][0] == "string" for value in values):
                    from_node, action, to_node = (value[0][1] for value in values)
                    if (re.fullmatch(r"S\d{2}", from_node) and
                            re.fullmatch(r"[A-Z][A-Z0-9_]*", action) and
                            re.fullmatch(r"S\d{2}|END", to_node)):
                        actions.add(action)
                    else:
                        issues.append("invalid-transition-values")
                else:
                    issues.append("nonliteral-transition-values")
        index = max(index + 1, cursor)
    return actions, insert_count, issues


def derive_action_contract(repo: Path) -> tuple[set[str], list[dict[str, object]], dict[str, object]]:
    all_actions: set[str] = set()
    issues: list[dict[str, object]] = []
    evidence: dict[str, object] = {}
    for process, (sql_relative, service_relative) in ACTION_CONTRACTS.items():
        sql_path, service_path = repo / sql_relative, repo / service_relative
        if not sql_path.is_file() or not service_path.is_file():
            missing = [item for item, path in ((sql_relative, sql_path), (service_relative, service_path)) if not path.is_file()]
            issues.append(finding("ACTION_CONTRACT_SOURCE_MISSING", missing[0], process=process, missing=missing))
            continue
        try:
            sql_actions, sql_insert_count, sql_parse_issues = sql_transition_actions(read_text(sql_path))
            definitions, invalid_assignments, service_class_count = java_action_definitions(
                read_text(service_path), service_path.stem)
            service_actions = definitions[0] if len(definitions) == 1 else set()
        except (OSError, UnicodeError) as error:
            issues.append(finding("ACTION_CONTRACT_SOURCE_UNREADABLE", sql_relative, process=process,
                                  error=type(error).__name__))
            continue
        evidence[process] = {"sql": sql_relative, "service": service_relative,
                             "sql_actions": sorted(sql_actions), "service_actions": sorted(service_actions),
                             "sql_transition_insert_count": sql_insert_count,
                             "sql_parse_issues": sql_parse_issues,
                             "service_definition_count": len(definitions),
                             "service_invalid_assignment_count": invalid_assignments,
                             "service_outer_class_count": service_class_count}
        if sql_insert_count != 1 or sql_parse_issues:
            issues.append(finding("ACTION_CONTRACT_SQL_STRUCTURE_INVALID", sql_relative, process=process,
                                  insert_count=sql_insert_count, parse_issues=sql_parse_issues))
        if invalid_assignments:
            issues.append(finding("ACTION_CONTRACT_NON_FIELD_ASSIGNMENT", service_relative, process=process,
                                  assignment_count=invalid_assignments))
        if service_class_count != 1:
            issues.append(finding("ACTION_CONTRACT_SERVICE_CLASS_MISSING" if not service_class_count else
                                  "ACTION_CONTRACT_SERVICE_CLASS_AMBIGUOUS", service_relative, process=process,
                                  class_name=service_path.stem, class_count=service_class_count))
        if len(definitions) != 1:
            issues.append(finding("ACTION_CONTRACT_DEFINITION_MISSING" if not definitions else "ACTION_CONTRACT_DEFINITION_AMBIGUOUS",
                                  service_relative, process=process, definition_count=len(definitions)))
        if not sql_actions or not service_actions:
            issues.append(finding("ACTION_CONTRACT_EMPTY", sql_relative, process=process,
                                  sql_count=len(sql_actions), service_count=len(service_actions)))
        if sql_actions != service_actions:
            issues.append(finding("ACTION_CONTRACT_MISMATCH", sql_relative, process=process,
                                  sql_only=sorted(sql_actions - service_actions), service_only=sorted(service_actions - sql_actions)))
        all_actions.update(sql_actions | service_actions)
    return all_actions, issues, evidence


def scan(repo: Path) -> tuple[list[dict[str, object]], list[str], set[str], dict[str, object]]:
    findings: list[dict[str, object]] = []
    actions, action_issues, action_evidence = derive_action_contract(repo)
    findings.extend(action_issues)
    targets, layout, route_issues, _ = discover_route_targets(repo)
    findings.extend(route_issues)
    action_literal = None if not actions else re.compile(
        r"(?P<quote>[\"'])(?P<action>" + "|".join(sorted(actions, key=len, reverse=True)) + r")(?P=quote)"
    )
    page_main_counts: dict[Path, int] = {}
    for path in targets:
        relative = safe_relative(path, repo)
        try:
            text = read_text(path)
        except (OSError, UnicodeError) as error:
            findings.append(finding("PAGE_UNREADABLE", relative, error=type(error).__name__))
            continue
        for code, expression in PATTERNS.items():
            for match in re.finditer(expression, text, re.IGNORECASE):
                findings.append({"code": code, "path": relative, "line": text.count("\n", 0, match.start()) + 1})
        if action_literal:
            for match in action_literal.finditer(text):
                findings.append({"code": "BARE_ACTION", "path": relative,
                                 "line": text.count("\n", 0, match.start()) + 1, "action": match.group("action")})
        rendered_count, main_sources, graph_issues = rendered_main_graph(path, repo)
        page_main_counts[path] = rendered_count
        for source, count in main_sources:
            if source != path.resolve():
                findings.append(finding("NESTED_COMPONENT_MAIN", relative,
                                        component_path=safe_relative(source, repo), main_count=count))
        findings.extend({**issue, "route_page": relative} for issue in graph_issues)
        for match in re.finditer(r"<\s*main\b", text, re.IGNORECASE):
            findings.append({"code": "PAGE_MAIN", "path": relative,
                             "line": text.count("\n", 0, match.start()) + 1})
    layout_main_count = 0
    if layout is not None:
        layout_main_count, layout_sources, layout_issues = rendered_main_graph(layout, repo)
        findings.extend({**issue, "layout_root": safe_relative(layout, repo)} for issue in layout_issues)
        if layout_main_count != 1:
            findings.append(finding("SHELL_MAIN_COUNT", safe_relative(layout, repo),
                                    actual=layout_main_count, expected=1,
                                    main_sources=[safe_relative(source, repo) for source, _ in layout_sources]))
        for path, page_count in page_main_counts.items():
            route_count = layout_main_count + page_count
            if route_count != 1:
                findings.append(finding("ROUTE_MAIN_COUNT", safe_relative(path, repo), actual=route_count, expected=1))
    return findings, [safe_relative(path, repo) for path in targets], actions, action_evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--report")
    args = parser.parse_args()
    repo = Path(args.repo_root).resolve()
    findings, pages, actions, action_evidence = scan(repo)
    payload = {
        "schema_version": "2.0",
        "gate": "phase10-component-source",
        "repository_root": str(repo),
        "status": "PASS" if not findings else "FAIL",
        "violation_count": len(findings),
        "violations": findings,
        "discovered_route_pages": pages,
        "derived_action_codes": sorted(actions),
        "action_contract_sources": action_evidence,
        "remote_operations_performed": False,
    }
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        Path(args.report).write_text(rendered + "\n", encoding="utf-8")
    return 0 if not findings else 1


if __name__ == "__main__":
    raise SystemExit(main())
