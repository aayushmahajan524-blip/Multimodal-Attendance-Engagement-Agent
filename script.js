const STORAGE_KEY = "smartattend-ai-v1";
const $ = (selector) => document.querySelector(selector);

const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$("#attendanceDate").value = localDate;

let appData = loadData();
let toastTimer;

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.students) && saved.statuses) return saved;
  } catch (error) {
    console.warn("Could not read saved attendance data:", error);
  }
  return {
    students: [
      { id: "s1", name: "Aarav Sharma" },
      { id: "s2", name: "Ananya Patel" },
      { id: "s3", name: "Kabir Verma" },
      { id: "s4", name: "Diya Singh" },
      { id: "s5", name: "Ishaan Gupta" }
    ],
    statuses: {}
  };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    showToast("Could not save in this browser. Try exporting your CSV.");
  }
}

function selectedDate() { return $("#attendanceDate").value || localDate; }
function getStatus(studentId, date = selectedDate()) {
  return appData.statuses[date]?.[studentId] || "Unmarked";
}
function setStatus(studentId, status) {
  const date = selectedDate();
  if (!appData.statuses[date]) appData.statuses[date] = {};
  if (status === "Unmarked") delete appData.statuses[date][studentId];
  else appData.statuses[date][studentId] = status;
  saveData();
  render();
}
function getCounts() {
  const counts = { Present: 0, Absent: 0, Late: 0, Unmarked: 0 };
  appData.students.forEach(student => counts[getStatus(student.id)]++);
  return counts;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}
function renderTable() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const filter = $("#statusFilter").value;
  const filtered = appData.students.filter(student => {
    const matchesName = student.name.toLowerCase().includes(search);
    const status = getStatus(student.id);
    const matchesStatus = filter === "all" || status === filter;
    return matchesName && matchesStatus;
  });
  $("#studentTableBody").innerHTML = filtered.map(student => {
    const status = getStatus(student.id);
    const options = ["Unmarked", "Present", "Absent", "Late"].map(option =>
      `<option value="${option}" ${status === option ? "selected" : ""}>${option}</option>`
    ).join("");
    return `<tr>
      <td><div class="student-cell"><div class="avatar">${escapeHTML(initials(student.name))}</div><span>${escapeHTML(student.name)}</span></div></td>
      <td><span class="status-badge status-${status}">${status}</span></td>
      <td><select class="status-select" aria-label="Status for ${escapeHTML(student.name)}" data-status-id="${escapeHTML(student.id)}">${options}</select></td>
      <td><button class="delete-btn" title="Remove ${escapeHTML(student.name)}" aria-label="Remove ${escapeHTML(student.name)}" data-delete-id="${escapeHTML(student.id)}">×</button></td>
    </tr>`;
  }).join("");
  $("#emptyState").hidden = filtered.length > 0;
  $("#showingText").textContent = `Showing ${filtered.length} of ${appData.students.length} students`;
}
function renderStats() {
  const counts = getCounts();
  const total = appData.students.length;
  const marked = counts.Present + counts.Absent + counts.Late;
  const attended = counts.Present + counts.Late;
  const rate = marked ? Math.round((attended / marked) * 100) : 0;
  $("#totalStudents").textContent = total;
  $("#presentCount").textContent = counts.Present;
  $("#absentCount").textContent = counts.Absent;
  $("#lateCount").textContent = counts.Late;
  $("#presentPercent").textContent = `${total ? Math.round(counts.Present / total * 100) : 0}%`;
  $("#donutPercent").textContent = `${rate}%`;
  $("#attendanceDonut").style.background = `conic-gradient(var(--blue) ${rate * 3.6}deg, #edf0f6 ${rate * 3.6}deg 360deg)`;
  $("#legendPresent").textContent = counts.Present;
  $("#legendAbsent").textContent = counts.Absent;
  $("#legendLate").textContent = counts.Late;
  $("#legendUnmarked").textContent = counts.Unmarked;
}
function render() { renderStats(); renderTable(); }
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

$("#addStudentForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#studentName").value.trim().replace(/\s+/g, " ");
  if (!name) return;
  if (appData.students.some(student => student.name.toLowerCase() === name.toLowerCase())) {
    showToast("That student is already in the class list.");
    return;
  }
  appData.students.push({ id: `s${Date.now()}${Math.random().toString(16).slice(2, 6)}`, name });
  saveData();
  $("#studentName").value = "";
  render();
  showToast(`${name} added to the class.`);
});

$("#studentTableBody").addEventListener("change", event => {
  const select = event.target.closest("[data-status-id]");
  if (select) setStatus(select.dataset.statusId, select.value);
});
$("#studentTableBody").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const student = appData.students.find(item => item.id === button.dataset.deleteId);
  if (!student) return;
  if (!confirm(`Remove ${student.name} from the class list? This also removes their saved statuses.`)) return;
  appData.students = appData.students.filter(item => item.id !== student.id);
  Object.values(appData.statuses).forEach(day => delete day[student.id]);
  saveData();
  render();
  showToast("Student removed.");
});
$("#attendanceDate").addEventListener("change", render);
$("#searchInput").addEventListener("input", renderTable);
$("#statusFilter").addEventListener("change", renderTable);

$("#markAllPresent").addEventListener("click", () => {
  const date = selectedDate();
  if (!appData.statuses[date]) appData.statuses[date] = {};
  appData.students.forEach(student => appData.statuses[date][student.id] = "Present");
  saveData();
  render();
  showToast("All students marked present for this date.");
});
$("#resetDayBtn").addEventListener("click", () => {
  if (!confirm("Reset all attendance statuses for this date?")) return;
  delete appData.statuses[selectedDate()];
  saveData();
  render();
  showToast("Statuses reset for the selected date.");
});
$("#exportBtn").addEventListener("click", () => {
  const date = selectedDate();
  const rows = [["Date", "Student", "Status"], ...appData.students.map(student => [date, student.name, getStatus(student.id, date)])];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smartattend-attendance-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Attendance CSV exported.");
});

function makeRuleBasedReport() {
  const counts = getCounts();
  const total = appData.students.length;
  const marked = counts.Present + counts.Absent + counts.Late;
  const attended = counts.Present + counts.Late;
  const rate = marked ? Math.round(attended / marked * 100) : 0;
  const unmarkedNames = appData.students.filter(s => getStatus(s.id) === "Unmarked").map(s => s.name);
  const absentNames = appData.students.filter(s => getStatus(s.id) === "Absent").map(s => s.name);
  const lateNames = appData.students.filter(s => getStatus(s.id) === "Late").map(s => s.name);
  const bullets = [];

  if (!total) bullets.push("Add students to begin tracking attendance.");
  else if (!marked) bullets.push("No statuses have been marked yet. Record attendance before interpreting this report.");
  else if (rate >= 90) bullets.push(`Attendance among marked students is high at ${rate}%. Continue the routines that support attendance.`);
  else if (rate >= 75) bullets.push(`Attendance among marked students is ${rate}%. Review patterns over several days before deciding on follow-up.`);
  else bullets.push(`Attendance among marked students is ${rate}%. Consider checking for practical barriers and offering supportive follow-up.`);

  if (counts.Absent) bullets.push(`${counts.Absent} student(s) are marked absent${absentNames.length ? `: ${absentNames.join(", ")}` : ""}. A teacher can check in privately and respectfully.`);
  if (counts.Late) bullets.push(`${counts.Late} student(s) are marked late${lateNames.length ? `: ${lateNames.join(", ")}` : ""}. Check whether arrival-time or transport factors need attention.`);
  if (counts.Unmarked) bullets.push(`${counts.Unmarked} student(s) remain unmarked${unmarkedNames.length ? `: ${unmarkedNames.join(", ")}` : ""}. Complete the register for a more reliable summary.`);
  if (!counts.Absent && !counts.Late && marked > 0) bullets.push("No absences or late arrivals are currently recorded among marked students.");
  bullets.push("Attendance alone cannot measure engagement, attention, understanding, or wellbeing. Use teacher observations and student feedback for those areas.");

  return { rate, counts, total, marked, bullets };
}
function displayInsights() {
  const report = makeRuleBasedReport();
  $("#insightOutput").innerHTML = `<h3>Attendance summary · ${escapeHTML(selectedDate())}</h3>
    <p>There are <b>${report.total}</b> students in the class list. ${report.marked} have a marked status, and the attendance rate among marked students is <b>${report.rate}%</b> (Present + Late).</p>
    <ul>${report.bullets.map(bullet => `<li>${escapeHTML(bullet)}</li>`).join("")}</ul>
    <div class="report-meta">Generated locally using predefined rules · Not an AI-generated prediction · No individual engagement score is inferred.</div>`;
}
$("#generateInsightsBtn").addEventListener("click", () => {
  displayInsights();
  showToast("Rule-based summary generated.");
});
$("#openInsights").addEventListener("click", () => {
  $("#insights").scrollIntoView({ behavior: "smooth", block: "start" });
  displayInsights();
});

render();
