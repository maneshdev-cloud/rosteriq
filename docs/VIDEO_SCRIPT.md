# Demo video script — RosterIQ (target 4:30, hard cap 5:00)

*Record at 1080p, browser zoom 90%. Start from the deployed URL, Dashboard
tab. Speak the lines, don't read them word-for-word.*

**0:00–0:30 — The promise (Dashboard)**
"This is RosterIQ, a smart roster system for a 32-employee, 23-brand
company, December 2026. Its promise: every brand-process-day is accounted
for — covered, or shown as a gap with the reason. Coverage is 100%, zero
uncovered positions, zero mandatory issues. This audit panel runs *before*
generation and proves whether the configuration itself is short-staffed."

**0:30–1:15 — One grid, five views (Roster tab)**
Switch Company → Pod → Brand → Process → Employee.
"One grid component, five views — same data, different grouping. In Brand
view you see who covers each process each day; red means a gap. Watch
Christmas Day: the 365-day brands are staffed, the holiday-off brands are
closed — because calendars live on the brand-process, not the brand."
Click a cell, change a status, apply.
"Manual edits revalidate instantly — issues and the publish gate react
immediately, because the same validator checks everything."

**1:15–2:00 — Calendars + multi-process (Roster, Employee view)**
Pick Meera (Pod B). "Meera runs two brands with different calendars —
UrbanThread is 365, StyleNest closes Sundays. One attendance status, many
coverage rows: that's why the data model splits days from coverage."

**2:00–3:15 — Simulation + safe repair (Simulator tab)**
Set Geeta Rao, 15 Dec, run.
"Geeta from EcoLiving takes leave. Two gaps appear, root cause: sole
assignee on leave. The top repair is Rashmi, the designated backup — scored,
and second-order checked: giving her this cover doesn't break her own
brands. I apply both repairs; the gaps close. Notice on the 14th she is
*not* offered — she's fully allocated covering DailyNest that day. The
system refuses to double-book her."

**3:15–4:00 — The unfixable case (Setup → Leaves, add Rashmi leave 14 Dec → Roster/Issues)**
"Now both EcoLiving layers are on leave on the 14th. Regenerated: required
one, actual zero, both names in the explanation, no repair candidate exists —
and publishing is *blocked*. The tool doesn't hide it, waive it, or invent a
person. A manager adds eligibility or accepts the day — explicitly."

**4:00–4:30 — Engineering close (show repo/tests briefly)**
"Underneath: a deterministic TypeScript engine — no AI in any scheduling
decision; AI can only rephrase explanations. An independent validator,
a structural audit, a bounded repair search, and 17 automated tests,
including this unfixable case and a 64-employee scale run at about half a
second. The scheduler sits behind an interface, so a constraint optimizer
can replace it if a future benchmark ever demands it."
