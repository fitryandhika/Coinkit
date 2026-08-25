"use client";

function checklistItems(result) {
  return [
    { label: "Market regime checked", done: Boolean(result.reasoning?.marketContext) },
    { label: "Technical setup valid", done: result.aiScore !== null && result.aiScore >= 60 },
    { label: "Entry level clear", done: result.entry?.status === "READY" },
    { label: "Stop loss defined", done: Boolean(result.tradePlan?.stopLoss?.price) },
    { label: "Risk within limit", done: result.tradePlan ? result.tradePlan.status !== "BLOCKED" : false },
    { label: "R:R acceptable", done: (result.tradePlan?.riskReward?.tp1 ?? 0) >= 2 },
    { label: "No major warning", done: (result.warnings?.length ?? 0) === 0 },
  ];
}

export default function ManualExecutionChecklist({ result }) {
  const items = checklistItems(result);
  return (
    <div className="checklist">
      <h4 className="section-title">Before Trade — Manual Execution Checklist</h4>
      <ul className="checklist-list">
        {items.map((item) => (
          <li key={item.label}><span className={item.done ? "check-yes" : "check-no"}>{item.done ? "✓" : "○"}</span> {item.label}</li>
        ))}
        <li><span className="check-no">○</span> User confirms manually</li>
      </ul>
    </div>
  );
}
