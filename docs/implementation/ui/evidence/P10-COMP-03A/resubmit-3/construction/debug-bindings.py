import importlib.util
import sys
from pathlib import Path

path = Path("scripts/implementation/ui_component_access_gate.py")
spec = importlib.util.spec_from_file_location("gate_debug", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

text = "const tag='section';const base={is:'section'};const attrs={...base};const load=()=>import('./SafeFeature.vue')"
print(module.static_bindings(text))
for name, marker in (("base", "};const attrs"), ("attrs", "};const load")):
    end = text.index(marker) + 1
    print(name, end, module.binding_is_immutable(text, name, end, True))

alias_path = Path("technical-platform/web/src/design-system/ui-component-access.test.ts")
alias_text = alias_path.read_text(encoding="utf-8")
print("coverage", module.executable_test_coverage(alias_text))
masked, _ = module.scan_js_non_code(alias_text)
for declaration in module.re.finditer(r"\bconst\s+(?P<name>[A-Za-z_$][\w$]*)\s*=", masked):
    if declaration.group("name").startswith("expected"):
        start = declaration.end()
        while alias_text[start].isspace():
            start += 1
        end = module.matching_delimiter(alias_text, start, "[", "]")
        print(declaration.group("name"), start, end, module.binding_is_immutable(alias_text, declaration.group("name"), end + 1 if end else start))
