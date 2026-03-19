export const mockUnits = [
  {
    unitId: "A-1204",
    name: "Aurora Residence 1204",
    address: "North Tower, River District",
    status: "occupied",
    bhkType: "3 BHK",
    openIssues: 2,
    floor: 12,
    block: "North",
    occupantName: "Olivia Bennett",
    occupantPhone: "+1 (415) 555-0128",
    occupantEmail: "olivia.bennett@example.com",
    healthScore: 82,
    rent: "$4,850",
    area: "1,680 sq ft",
    lastInspection: "18 Mar 2026",
    imageLabel: "Skyline-facing luxury residence",
    maintenanceHistory: [
      { date: "18 Mar 2026", event: "HVAC servicing completed", status: "completed" },
      { date: "12 Mar 2026", event: "Fire panel inspected", status: "completed" },
      { date: "09 Mar 2026", event: "Water pressure balancing", status: "scheduled" },
    ],
  },
  {
    unitId: "A-1508",
    name: "Aurora Residence 1508",
    address: "North Tower, River District",
    status: "at-risk",
    bhkType: "2 BHK",
    openIssues: 4,
    floor: 15,
    block: "North",
    occupantName: "Marcus Hill",
    occupantPhone: "+1 (415) 555-0172",
    occupantEmail: "marcus.hill@example.com",
    healthScore: 54,
    rent: "$4,120",
    area: "1,240 sq ft",
    lastInspection: "14 Mar 2026",
    imageLabel: "Corner residence with dual-aspect glazing",
    maintenanceHistory: [
      { date: "16 Mar 2026", event: "Leak detection escalation", status: "urgent" },
      { date: "13 Mar 2026", event: "Electrical panel reset", status: "completed" },
      { date: "10 Mar 2026", event: "Resident support follow-up", status: "scheduled" },
    ],
  },
  {
    unitId: "B-0802",
    name: "Belvedere Suite 0802",
    address: "East Wing, Harbour Place",
    status: "occupied",
    bhkType: "1 BHK",
    openIssues: 1,
    floor: 8,
    block: "East",
    occupantName: "Sara Kim",
    occupantPhone: "+1 (628) 555-0135",
    occupantEmail: "sara.kim@example.com",
    healthScore: 91,
    rent: "$3,480",
    area: "920 sq ft",
    lastInspection: "11 Mar 2026",
    imageLabel: "Compact executive suite",
    maintenanceHistory: [
      { date: "11 Mar 2026", event: "Window seal maintenance", status: "completed" },
      { date: "03 Mar 2026", event: "Lighting refresh", status: "completed" },
    ],
  },
  {
    unitId: "C-2210",
    name: "Crescent Penthouse 2210",
    address: "South Gallery, Crescent Row",
    status: "vacant",
    bhkType: "4 BHK",
    openIssues: 0,
    floor: 22,
    block: "South",
    occupantName: "Vacant",
    occupantPhone: "Not assigned",
    occupantEmail: "leasing@dawnos.com",
    healthScore: 96,
    rent: "$7,900",
    area: "2,420 sq ft",
    lastInspection: "19 Mar 2026",
    imageLabel: "Signature penthouse floorplate",
    maintenanceHistory: [
      { date: "19 Mar 2026", event: "Showroom staging complete", status: "completed" },
      { date: "13 Mar 2026", event: "Security systems verified", status: "completed" },
    ],
  },
  {
    unitId: "D-0403",
    name: "Dockside Loft 0403",
    address: "West Court, Marina Quarter",
    status: "occupied",
    bhkType: "2 BHK",
    openIssues: 3,
    floor: 4,
    block: "West",
    occupantName: "Ethan Walker",
    occupantPhone: "+1 (510) 555-0111",
    occupantEmail: "ethan.walker@example.com",
    healthScore: 67,
    rent: "$3,960",
    area: "1,180 sq ft",
    lastInspection: "15 Mar 2026",
    imageLabel: "Industrial-modern loft with mezzanine",
    maintenanceHistory: [
      { date: "17 Mar 2026", event: "Drainage complaint reopened", status: "urgent" },
      { date: "08 Mar 2026", event: "Hallway sensor recalibration", status: "completed" },
    ],
  },
  {
    unitId: "E-1011",
    name: "Emerald House 1011",
    address: "Garden Block, Parkline Estate",
    status: "at-risk",
    bhkType: "3 BHK",
    openIssues: 5,
    floor: 10,
    block: "Garden",
    occupantName: "Naomi Brooks",
    occupantPhone: "+1 (408) 555-0169",
    occupantEmail: "naomi.brooks@example.com",
    healthScore: 49,
    rent: "$4,430",
    area: "1,520 sq ft",
    lastInspection: "12 Mar 2026",
    imageLabel: "Garden-facing family residence",
    maintenanceHistory: [
      { date: "18 Mar 2026", event: "Multiple SLA breaches flagged", status: "urgent" },
      { date: "14 Mar 2026", event: "Moisture audit scheduled", status: "scheduled" },
      { date: "07 Mar 2026", event: "Tenant welfare call", status: "completed" },
    ],
  },
];

export const mockComplaints = [
  {
    id: "CMP-1042",
    unitId: "A-1508",
    unitName: "Aurora Residence 1508",
    resident: "Marcus Hill",
    category: "Plumbing",
    status: "open",
    priority: "High",
    block: "North",
    createdAt: "18 Mar 2026",
    summary: "Water leakage detected beneath the kitchen island.",
    description: "Resident reports recurring water seepage near the island cabinetry with visible floor warping.",
    timeline: [
      { time: "18 Mar, 09:20", label: "Complaint submitted" },
      { time: "18 Mar, 10:10", label: "Ops team assigned" },
      { time: "18 Mar, 14:45", label: "Vendor visit pending" },
    ],
  },
  {
    id: "CMP-1037",
    unitId: "E-1011",
    unitName: "Emerald House 1011",
    resident: "Naomi Brooks",
    category: "Electrical",
    status: "escalated",
    priority: "High",
    block: "Garden",
    createdAt: "17 Mar 2026",
    summary: "Circuit flickering across bedroom suite.",
    description: "Electrical instability is affecting two bedrooms and the hallway track lighting.",
    timeline: [
      { time: "17 Mar, 08:10", label: "Complaint submitted" },
      { time: "17 Mar, 09:55", label: "Supervisor escalation" },
      { time: "17 Mar, 16:30", label: "Safety inspection requested" },
    ],
  },
  {
    id: "CMP-1030",
    unitId: "D-0403",
    unitName: "Dockside Loft 0403",
    resident: "Ethan Walker",
    category: "Structural",
    status: "open",
    priority: "Medium",
    block: "West",
    createdAt: "16 Mar 2026",
    summary: "Hairline cracks forming near balcony threshold.",
    description: "Cracks are spreading from the threshold into the adjacent tile seam after recent weather exposure.",
    timeline: [
      { time: "16 Mar, 11:05", label: "Complaint submitted" },
      { time: "16 Mar, 13:20", label: "Engineer review scheduled" },
    ],
  },
  {
    id: "CMP-1022",
    unitId: "A-1204",
    unitName: "Aurora Residence 1204",
    resident: "Olivia Bennett",
    category: "Other",
    status: "resolved",
    priority: "Low",
    block: "North",
    createdAt: "14 Mar 2026",
    summary: "Smart lock battery warning reported.",
    description: "Resident requested preventive battery replacement for the main smart lock.",
    timeline: [
      { time: "14 Mar, 09:15", label: "Complaint submitted" },
      { time: "14 Mar, 12:20", label: "Battery replaced" },
      { time: "14 Mar, 12:35", label: "Resident confirmed resolution" },
    ],
  },
  {
    id: "CMP-1018",
    unitId: "B-0802",
    unitName: "Belvedere Suite 0802",
    resident: "Sara Kim",
    category: "Plumbing",
    status: "resolved",
    priority: "Medium",
    block: "East",
    createdAt: "13 Mar 2026",
    summary: "Bathroom mixer pressure imbalance.",
    description: "Hot water pressure dips during evening usage windows.",
    timeline: [
      { time: "13 Mar, 07:40", label: "Complaint submitted" },
      { time: "13 Mar, 15:10", label: "Valve recalibrated" },
      { time: "13 Mar, 18:00", label: "Issue resolved" },
    ],
  },
  {
    id: "CMP-1011",
    unitId: "E-1011",
    unitName: "Emerald House 1011",
    resident: "Naomi Brooks",
    category: "Plumbing",
    status: "open",
    priority: "High",
    block: "Garden",
    createdAt: "12 Mar 2026",
    summary: "Moisture marks expanding in utility room.",
    description: "Persistent dampness is visible along the utility room wall and lower shelving.",
    timeline: [
      { time: "12 Mar, 08:00", label: "Complaint submitted" },
      { time: "12 Mar, 13:00", label: "Inspection delayed" },
    ],
  },
];

export const dashboardStats = [
  { label: "Total Units", value: 128, suffix: "", delta: "+6 this quarter" },
  { label: "Open Complaints", value: 24, suffix: "", delta: "-12% from last week" },
  { label: "Occupancy", value: 93, suffix: "%", delta: "+4.1% this month" },
  { label: "At-Risk Units", value: 7, suffix: "", delta: "2 need urgent attention" },
];

export const riskForecastByBlock = [
  { block: "North", risk: 72 },
  { block: "East", risk: 38 },
  { block: "South", risk: 21 },
  { block: "West", risk: 56 },
  { block: "Garden", risk: 81 },
];

export const proactiveInsights = [
  {
    type: "insight_card",
    tone: "alert",
    title: "Predicted risk spike in Garden block",
    body: "Moisture complaints and delayed remediation suggest a 48-hour risk escalation window.",
    recommendation: "Dispatch plumbing audit and tenant welfare follow-up today.",
  },
  {
    type: "health_report_card",
    score: 67,
    title: "Portfolio health score",
    summary: "Operational health is stable, but electrical incidents remain above target in two blocks.",
  },
  {
    type: "recommendation_list",
    title: "Dawn recommendations",
    recommendations: [
      "Prioritize Emerald House 1011 for SLA recovery.",
      "Rebalance weekend maintenance staffing in North Tower.",
      "Escalate unresolved structural complaints older than 48 hours.",
    ],
  },
];

export const adminUsers = [
  { id: "USR-001", name: "Ariana Cole", email: "ariana@dawnos.com", role: "admin", status: "active" },
  { id: "USR-014", name: "Marcus Hill", email: "marcus.hill@example.com", role: "tenant", status: "active" },
  { id: "USR-022", name: "Naomi Brooks", email: "naomi.brooks@example.com", role: "tenant", status: "flagged" },
  { id: "USR-031", name: "Lena Foster", email: "lena.foster@harborpm.com", role: "landlord", status: "active" },
  { id: "USR-040", name: "Noah Mercer", email: "noah.mercer@harborpm.com", role: "landlord", status: "pending" },
];

export const profileRecord = {
  name: "Rohit Yadav",
  email: "rohityadav7122004@gmail.com",
  phone: "+91 98765 43210",
  role: "admin",
  initials: "RY",
  notifications: {
    escalations: true,
    riskDigests: true,
    residentMessages: false,
  },
};

export const reportsSnapshot = [
  { title: "Monthly Occupancy", value: "93%", note: "Strong retention across premium inventory" },
  { title: "Average Resolution Time", value: "6.2h", note: "Down 1.4h versus prior month" },
  { title: "Suspension Risk Queue", value: "3 units", note: "All concentrated in Garden block" },
];

export function getUnitById(unitId) {
  return mockUnits.find((unit) => unit.unitId === unitId) || mockUnits[0];
}

export function getComplaintsByUnit(unitId) {
  return mockComplaints.filter((complaint) => complaint.unitId === unitId);
}

export function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "occupied" || normalized === "resolved" || normalized === "active") return "success";
  if (normalized === "vacant" || normalized === "pending" || normalized === "medium") return "neutral";
  if (normalized === "at-risk" || normalized === "open" || normalized === "flagged") return "warning";
  if (normalized === "escalated" || normalized === "urgent" || normalized === "high") return "danger";
  return "neutral";
}

export function buildMockChatResponse(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("risk")) {
    return {
      message: "Dawn has identified elevated operational risk in two blocks.",
      cards: [
        {
          type: "risk_forecast_card",
          title: "Block risk forecast",
          blocks: riskForecastByBlock,
        },
        {
          type: "insight_card",
          tone: "alert",
          title: "North Tower watchlist",
          body: "Repeated plumbing complaints suggest a rising near-term risk profile for North Tower residences.",
        },
      ],
    };
  }

  if (text.includes("health")) {
    return {
      message: "Here is the latest health signal from Dawn.",
      cards: [
        {
          type: "health_report_card",
          title: "Portfolio health",
          score: 74,
          summary: "Health remains resilient, but Garden and West blocks are dragging the weekly score.",
        },
      ],
    };
  }

  if (text.includes("remediation") || text.includes("fix")) {
    return {
      message: "Dawn recommends a focused remediation plan.",
      cards: [
        {
          type: "remediation_priority",
          title: "Top remediation priorities",
          items: [
            { label: "Emerald House 1011", urgency: "critical" },
            { label: "Aurora Residence 1508", urgency: "high" },
            { label: "Dockside Loft 0403", urgency: "medium" },
          ],
        },
      ],
    };
  }

  if (text.includes("corridor") || text.includes("block")) {
    return {
      message: "Dawn has prepared a corridor insight.",
      cards: [
        {
          type: "corridor_insight",
          location: "Garden block",
          description: "Electrical and plumbing incidents are clustering around two adjacent vertical stacks.",
        },
      ],
    };
  }

  if (text.includes("recommend")) {
    return {
      message: "Here are your latest recommendations.",
      cards: [
        {
          type: "recommendation_list",
          title: "Recommended next actions",
          recommendations: [
            "Issue a same-day contractor dispatch for Emerald House 1011.",
            "Move one concierge resource to after-hours complaints triage.",
            "Send a proactive resident update to all North Tower tenants.",
          ],
        },
      ],
    };
  }

  if (text.includes("complaint")) {
    return {
      message: "Dawn drafted a complaint preview for faster submission.",
      cards: [
        {
          type: "complaint_draft",
          unitId: "A-1508",
          category: "Plumbing",
          priority: "High",
          description:
            "Resident reports recurring leakage beneath the kitchen island with visible floor warping and damp cabinetry edges.",
        },
      ],
    };
  }

  return {
    message: "Dawn is online and monitoring your portfolio.",
    cards: [
      {
        type: "insight_card",
        tone: "success",
        title: "Operational summary",
        body: "Occupancy is strong, resolution times are trending down, and no new suspension thresholds were crossed overnight.",
      },
    ],
  };
}
