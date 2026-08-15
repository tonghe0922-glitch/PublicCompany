package cn.shangjingu.platform.workflow.phase11;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** P011 frozen process graph. Later PHASE-11 checkpoints are added only after the previous one passes. */
public enum Phase11Process {
    P011(
            "绩效管理",
            "performance.performance_cycle",
            "EMP-P011-F01",
            "p011.performance.evaluate",
            "p011.performance.calibrate",
            List.of(
                    step("S01", "目标制定", "SET_TARGETS", "S02"),
                    step("S02", "员工确认", "CONFIRM_TARGETS", "S03"),
                    step("S03", "过程记录与辅导", "RECORD_COACHING", "S04"),
                    step("S04", "权威数据归集", "COLLECT_FACTS", "S05"),
                    step("S05", "员工自评/主管评价", "SUBMIT_REVIEWS", "S06"),
                    step("S06", "1000分计算", "CALCULATE_SCORE", "S07"),
                    step("S07", "校准", "CALIBRATE", "S08"),
                    step("S08", "结果反馈确认", "SUBMIT_APPEAL_DECISION", "S09"),
                    step("S09", "申诉复核", "RESOLVE_APPEAL", "S10"),
                    step("S10", "绩效影响执行", "EXECUTE_IMPACT", "S11"),
                    step("S11", "归档", "ARCHIVE", "END")),
            Set.of("CONFIRM_TARGETS", "SUBMIT_APPEAL_DECISION"),
            Set.of("CALIBRATE", "RESOLVE_APPEAL"));

    private final String label;
    private final String table;
    private final String initialFormCode;
    private final String managerPermission;
    private final String specialistPermission;
    private final List<Step> steps;
    private final Map<String, Step> byNode;
    private final Set<String> ownerActions;
    private final Set<String> specialistActions;

    Phase11Process(
            String label,
            String table,
            String initialFormCode,
            String managerPermission,
            String specialistPermission,
            List<Step> steps,
            Set<String> ownerActions,
            Set<String> specialistActions) {
        this.label = label;
        this.table = table;
        this.initialFormCode = initialFormCode;
        this.managerPermission = managerPermission;
        this.specialistPermission = specialistPermission;
        this.steps = List.copyOf(steps);
        this.ownerActions = Set.copyOf(ownerActions);
        this.specialistActions = Set.copyOf(specialistActions);
        Map<String, Step> index = new LinkedHashMap<>();
        for (Step step : steps) {
            index.put(step.node(), step);
        }
        this.byNode = Map.copyOf(index);
    }

    public String code() {
        return name();
    }

    public String label() {
        return label;
    }

    public String table() {
        return table;
    }

    public String initialFormCode() {
        return initialFormCode;
    }

    public String managerPermission() {
        return managerPermission;
    }

    public String specialistPermission() {
        return specialistPermission;
    }

    public String initialAction() {
        return steps.getFirst().action();
    }

    public String labelFor(String node) {
        if ("END".equals(node)) {
            return "已关闭";
        }
        Step step = byNode.get(node);
        if (step == null) {
            throw rejected("unknown workflow node: " + node);
        }
        return step.label();
    }

    public Step requireTransition(String node, String action) {
        Step step = byNode.get(node);
        if (step == null || !step.action().equals(action)) {
            throw rejected("action " + action + " is not allowed from " + node);
        }
        return step;
    }

    public boolean ownerAction(String action) {
        return ownerActions.contains(action);
    }

    public boolean specialistAction(String action) {
        return specialistActions.contains(action);
    }

    public List<Step> steps() {
        return steps;
    }

    private ProcessRejectedException rejected(String message) {
        return new ProcessRejectedException(code() + " " + message);
    }

    private static Step step(String node, String label, String action, String targetNode) {
        return new Step(node, label, action, targetNode);
    }

    public record Step(String node, String label, String action, String targetNode) {}
}
