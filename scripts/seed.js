require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../src/models/User");
const Attendance = require("../src/models/Attendance");
const Leave = require("../src/models/Leave");
const Task = require("../src/models/Task");
const Project = require("../src/models/Project");
const Payroll = require("../src/models/Payroll");
const Client = require("../src/models/Client");
const Invoice = require("../src/models/Invoice");
const CalendarEvent = require("../src/models/CalendarEvent");
const DailyStatus = require("../src/models/DailyStatus");
const Timesheet = require("../src/models/Timesheet");
const Vendor = require("../src/models/Vendor");
const Freelancer = require("../src/models/Freelancer");

/* ============================================================
   SEED USERS
   ============================================================ */
const seedUsers = async () => {
  console.log("\n👤  Seeding Users...");

  const defaultUsers = [
    {
      name: "Admin User",
      email: "admin@quibotech.com",
      password: "admin123",
      role: "admin",
      department: "Management",
      phone: "9876543210",
      isActive: true,
    },
    {
      name: "HR Manager",
      email: "hr@quibotech.com",
      password: "hr123456",
      role: "hr",
      department: "Human Resources",
      phone: "9876543211",
      isActive: true,
    },
    {
      name: "Project Manager",
      email: "manager@quibotech.com",
      password: "manager123",
      role: "manager",
      department: "Engineering",
      phone: "9876543212",
      isActive: true,
    },
    {
      name: "John Employee",
      email: "employee@quibotech.com",
      password: "employee123",
      role: "employee",
      department: "Engineering",
      phone: "9876543213",
      isActive: true,
    },
    {
      name: "Sara Developer",
      email: "sara@quibotech.com",
      password: "sara123456",
      role: "employee",
      department: "Development",
      phone: "9876543214",
      isActive: true,
    },
    {
      name: "David Engineer",
      email: "david@quibotech.com",
      password: "david123456",
      role: "employee",
      department: "Development",
      phone: "9876543215",
      isActive: true,
    },
  ];

  const createdUsers = [];

  for (const userData of defaultUsers) {
    const exists = await User.findOne({ email: userData.email });
    if (!exists) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`   ✅ Created : ${user.email} (${user.role})`);
    } else {
      createdUsers.push(exists);
      console.log(`   ⚠️  Exists  : ${userData.email} (${exists.role})`);
    }
  }

  return createdUsers;
};

/* ============================================================
   SEED ATTENDANCE
   ============================================================ */
const seedAttendance = async (users) => {
  console.log("\n⏰  Seeding Attendance...");

  const today      = new Date().toISOString().split("T")[0];
  const yesterday  = new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const fourDaysAgo  = new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0];

  const dates = [today, yesterday, twoDaysAgo, threeDaysAgo, fourDaysAgo];

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    for (const date of dates) {
      const exists = await Attendance.findOne({ userId: user._id, date });

      if (!exists) {
        await Attendance.create({
          userId:   user._id,
          date,
          checkIn:  "09:00",
          checkOut: date === today ? null : "18:00",
          status:   "present",
        });
        created++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`   ✅ Created ${created} attendance records`);
  if (skipped > 0) console.log(`   ⚠️  Skipped ${skipped} existing records`);
};

/* ============================================================
   SEED LEAVES
   ============================================================ */
const seedLeaves = async (users) => {
  console.log("\n🌴  Seeding Leave Requests...");

  const count = await Leave.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} leave records already exist — skipping`);
    return;
  }

  const employee = users.find((u) => u.email === "employee@quibotech.com");
  const sara     = users.find((u) => u.email === "sara@quibotech.com");
  const david    = users.find((u) => u.email === "david@quibotech.com");

  const leaves = [
    {
      userId:      employee._id,
      type:        "Sick Leave",
      priority:    "high",
      startDate:   "2026-03-15",
      endDate:     "2026-03-16",
      days:        2,
      reason:      "Fever and cold",
      description: "Doctor advised rest for 2 days",
      status:      "pending_manager",
      appliedAt:   new Date(),
    },
    {
      userId:      sara._id,
      type:        "Casual Leave",
      priority:    "low",
      startDate:   "2026-03-20",
      endDate:     "2026-03-20",
      days:        1,
      reason:      "Personal work",
      description: "Family function to attend",
      status:      "pending_hr",
      appliedAt:   new Date(),
    },
    {
      userId:      david._id,
      type:        "Annual Leave",
      priority:    "medium",
      startDate:   "2026-04-01",
      endDate:     "2026-04-05",
      days:        5,
      reason:      "Vacation",
      description: "Family trip planned",
      status:      "approved",
      appliedAt:   new Date(),
    },
    {
      userId:      employee._id,
      type:        "Emergency Leave",
      priority:    "high",
      startDate:   "2026-03-10",
      endDate:     "2026-03-10",
      days:        1,
      reason:      "Family emergency",
      description: "Had to attend urgent family matter",
      status:      "approved",
      appliedAt:   new Date(),
    },
    {
      userId:      sara._id,
      type:        "Sick Leave",
      priority:    "medium",
      startDate:   "2026-03-05",
      endDate:     "2026-03-06",
      days:        2,
      reason:      "Migraine",
      description: "Severe headache, could not work",
      status:      "rejected",
      appliedAt:   new Date(),
    },
  ];

  await Leave.insertMany(leaves);
  console.log(`   ✅ Created ${leaves.length} leave records`);
};

/* ============================================================
   SEED TASKS
   ============================================================ */
const seedTasks = async (users) => {
  console.log("\n✅  Seeding Tasks...");

  const count = await Task.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} tasks already exist — skipping`);
    return;
  }

  const admin    = users.find((u) => u.role === "admin");
  const manager  = users.find((u) => u.role === "manager");
  const employee = users.find((u) => u.email === "employee@quibotech.com");
  const sara     = users.find((u) => u.email === "sara@quibotech.com");
  const david    = users.find((u) => u.email === "david@quibotech.com");

  const tasks = [
    {
      title:       "Build Login & Signup Page",
      description: "Create responsive login and signup page with JWT authentication",
      assignedTo:  employee._id,
      assignedBy:  manager._id,
      priority:    "high",
      dueDate:     "2026-03-20",
      status:      "completed",
      updates: [
        {
          date:        new Date(),
          status:      "completed",
          progress:    100,
          hoursWorked: 8,
          note:        "Login and signup pages completed with JWT integration",
        },
      ],
    },
    {
      title:       "Design Dashboard UI",
      description: "Create admin and employee dashboard screens with charts",
      assignedTo:  sara._id,
      assignedBy:  manager._id,
      priority:    "high",
      dueDate:     "2026-03-25",
      status:      "in-progress",
      updates: [
        {
          date:        new Date(),
          status:      "in-progress",
          progress:    60,
          hoursWorked: 5,
          note:        "Admin dashboard done. Employee dashboard in progress",
        },
      ],
    },
    {
      title:       "Backend API Development",
      description: "Develop REST APIs for all HRMS modules with MongoDB",
      assignedTo:  david._id,
      assignedBy:  manager._id,
      priority:    "high",
      dueDate:     "2026-03-30",
      status:      "in-progress",
      updates: [
        {
          date:        new Date(),
          status:      "in-progress",
          progress:    75,
          hoursWorked: 12,
          note:        "Auth, attendance, leave APIs done. Working on payroll module",
          blocker:     "Need clarification on payroll tax calculation",
        },
      ],
    },
    {
      title:       "Write Unit Tests",
      description: "Write unit tests for all backend controllers and models",
      assignedTo:  employee._id,
      assignedBy:  admin._id,
      priority:    "medium",
      dueDate:     "2026-04-05",
      status:      "pending",
      updates:     [],
    },
    {
      title:       "Deploy to Production Server",
      description: "Deploy HRMS application to cloud server with CI/CD pipeline",
      assignedTo:  david._id,
      assignedBy:  admin._id,
      priority:    "low",
      dueDate:     "2026-04-15",
      status:      "pending",
      updates:     [],
    },
    {
      title:       "Mobile Responsive Testing",
      description: "Test all pages on mobile, tablet and desktop devices",
      assignedTo:  sara._id,
      assignedBy:  manager._id,
      priority:    "medium",
      dueDate:     "2026-04-01",
      status:      "pending",
      updates:     [],
    },
  ];

  await Task.insertMany(tasks);
  console.log(`   ✅ Created ${tasks.length} tasks`);
};

/* ============================================================
   SEED PROJECTS
   ============================================================ */
const seedProjects = async (users) => {
  console.log("\n📁  Seeding Projects...");

  const count = await Project.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} projects already exist — skipping`);
    return;
  }

  const manager  = users.find((u) => u.role === "manager");
  const employee = users.find((u) => u.email === "employee@quibotech.com");
  const sara     = users.find((u) => u.email === "sara@quibotech.com");
  const david    = users.find((u) => u.email === "david@quibotech.com");

  const projects = [
    {
      name:        "HRMS Platform",
      description: "Full-stack HR Management System built with React and Node.js",
      clientName:  "Quibo Tech Internal",
      deadline:    "2026-06-30",
      status:      "in-progress",
      budget:      500000,
      spent:       125000,
      progress:    65,
      managerId:   manager._id,
      teamMembers: [employee._id, sara._id, david._id],
    },
    {
      name:        "E-Commerce Portal",
      description: "Online shopping platform with payment gateway integration",
      clientName:  "RetailCo Ltd",
      deadline:    "2026-05-15",
      status:      "in-progress",
      budget:      300000,
      spent:       90000,
      progress:    45,
      managerId:   manager._id,
      teamMembers: [sara._id, david._id],
    },
    {
      name:        "Mobile Banking App",
      description: "Cross-platform mobile banking app with biometric login",
      clientName:  "FinBank Solutions",
      deadline:    "2026-08-01",
      status:      "planning",
      budget:      800000,
      spent:       20000,
      progress:    10,
      managerId:   manager._id,
      teamMembers: [david._id],
    },
    {
      name:        "Inventory Management System",
      description: "Warehouse inventory tracking and management system",
      clientName:  "LogiTech Corp",
      deadline:    "2026-03-01",
      status:      "completed",
      budget:      200000,
      spent:       195000,
      progress:    100,
      managerId:   manager._id,
      teamMembers: [employee._id, sara._id],
    },
    {
      name:        "Corporate Website Redesign",
      description: "Modern redesign of corporate website with CMS integration",
      clientName:  "BrandCo Agency",
      deadline:    "2026-04-30",
      status:      "on-hold",
      budget:      150000,
      spent:       30000,
      progress:    25,
      managerId:   manager._id,
      teamMembers: [sara._id],
    },
  ];

  await Project.insertMany(projects);
  console.log(`   ✅ Created ${projects.length} projects`);
};

/* ============================================================
   SEED PAYROLL
   ============================================================ */
const seedPayroll = async (users) => {
  console.log("\n💰  Seeding Payroll Records...");

  const count = await Payroll.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} payroll records already exist — skipping`);
    return;
  }

  const employees = users.filter((u) =>
    ["employee", "manager", "hr"].includes(u.role)
  );

  const months = ["2026-01", "2026-02", "2026-03"];

  const salaryMap = {
    manager:  { basic: 80000, allowances: 15000, deductions: 8000 },
    hr:       { basic: 60000, allowances: 10000, deductions: 6000 },
    employee: { basic: 50000, allowances: 8000,  deductions: 5000 },
  };

  const records = [];

  for (const user of employees) {
    const salary = salaryMap[user.role] || salaryMap.employee;

    for (const month of months) {
      const isProcessed = month !== "2026-03";

      records.push({
        userId:      user._id,
        month,
        basicSalary: salary.basic,
        allowances:  salary.allowances,
        deductions:  salary.deductions,
        netSalary:   salary.basic + salary.allowances - salary.deductions,
        status:      isProcessed ? "processed" : "pending",
        paymentDate: isProcessed ? new Date() : null,
      });
    }
  }

  await Payroll.insertMany(records);
  console.log(`   ✅ Created ${records.length} payroll records`);
};

/* ============================================================
   SEED CLIENTS
   ============================================================ */
const seedClients = async () => {
  console.log("\n🏢  Seeding Clients...");

  const count = await Client.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} clients already exist — skipping`);
    return [];
  }

  const clients = [
    {
      name:               "Rajesh Kumar",
      company:            "RetailCo Ltd",
      email:              "rajesh@retailco.com",
      phone:              "9811223344",
      address:            "123 MG Road, Bangalore",
      description:        "E-commerce client for online retail platform",
      status:             "active",
      totalProjects:      2,
      outstandingBalance: 90000,
    },
    {
      name:               "Priya Sharma",
      company:            "FinBank Solutions",
      email:              "priya@finbank.com",
      phone:              "9822334455",
      address:            "456 Anna Salai, Chennai",
      description:        "Banking technology solutions client",
      status:             "active",
      totalProjects:      1,
      outstandingBalance: 20000,
    },
    {
      name:               "Amit Patel",
      company:            "LogiTech Corp",
      email:              "amit@logitech.com",
      phone:              "9833445566",
      address:            "789 Linking Road, Mumbai",
      description:        "Logistics and warehouse management client",
      status:             "active",
      totalProjects:      1,
      outstandingBalance: 0,
    },
    {
      name:               "Sneha Reddy",
      company:            "BrandCo Agency",
      email:              "sneha@brandco.com",
      phone:              "9844556677",
      address:            "321 Jubilee Hills, Hyderabad",
      description:        "Marketing and branding agency",
      status:             "active",
      totalProjects:      1,
      outstandingBalance: 30000,
    },
  ];

  const created = await Client.insertMany(clients);
  console.log(`   ✅ Created ${created.length} clients`);
  return created;
};

/* ============================================================
   SEED INVOICES
   ============================================================ */
const seedInvoices = async (clients) => {
  console.log("\n🧾  Seeding Invoices...");

  const count = await Invoice.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} invoices already exist — skipping`);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log("   ⚠️  No clients found — skipping invoices");
    return;
  }

  const retailco  = clients.find((c) => c.company === "RetailCo Ltd");
  const finbank   = clients.find((c) => c.company === "FinBank Solutions");
  const logitech  = clients.find((c) => c.company === "LogiTech Corp");
  const brandco   = clients.find((c) => c.company === "BrandCo Agency");

  const invoices = [
    {
      clientId:      retailco._id,
      invoiceNumber: "INV-2026-001",
      amount:        150000,
      paidAmount:    60000,
      date:          "2026-01-15",
      dueDate:       "2026-02-15",
      status:        "pending",
    },
    {
      clientId:      retailco._id,
      invoiceNumber: "INV-2026-002",
      amount:        80000,
      paidAmount:    80000,
      date:          "2026-02-01",
      dueDate:       "2026-03-01",
      status:        "paid",
    },
    {
      clientId:      finbank._id,
      invoiceNumber: "INV-2026-003",
      amount:        200000,
      paidAmount:    180000,
      date:          "2026-01-20",
      dueDate:       "2026-02-20",
      status:        "pending",
    },
    {
      clientId:      logitech._id,
      invoiceNumber: "INV-2026-004",
      amount:        200000,
      paidAmount:    200000,
      date:          "2026-02-10",
      dueDate:       "2026-03-10",
      status:        "paid",
    },
    {
      clientId:      brandco._id,
      invoiceNumber: "INV-2026-005",
      amount:        75000,
      paidAmount:    45000,
      date:          "2026-02-20",
      dueDate:       "2026-03-20",
      status:        "pending",
    },
    {
      clientId:      retailco._id,
      invoiceNumber: "INV-2026-006",
      amount:        50000,
      paidAmount:    0,
      date:          "2026-03-01",
      dueDate:       "2026-03-31",
      status:        "overdue",
    },
  ];

  await Invoice.insertMany(invoices);
  console.log(`   ✅ Created ${invoices.length} invoices`);
};

/* ============================================================
   SEED CALENDAR EVENTS
   ============================================================ */
const seedCalendarEvents = async (users) => {
  console.log("\n📅  Seeding Calendar Events...");

  const count = await CalendarEvent.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} calendar events already exist — skipping`);
    return;
  }

  const admin   = users.find((u) => u.role === "admin");
  const manager = users.find((u) => u.role === "manager");

  const events = [
    {
      title:       "Company All Hands Meeting",
      description: "Monthly all-hands meeting for all departments",
      type:        "Meeting",
      date:        "2026-03-15",
      startTime:   "10:00",
      endTime:     "11:30",
      location:    "Main Conference Hall",
      assignedTo:  "all",
      createdBy:   admin._id,
    },
    {
      title:       "Holi Holiday",
      description: "National holiday — office closed",
      type:        "Holiday",
      date:        "2026-03-14",
      startTime:   "00:00",
      endTime:     "23:59",
      location:    "Entire Office",
      assignedTo:  "all",
      createdBy:   admin._id,
    },
    {
      title:       "Sprint Planning",
      description: "Q2 Sprint planning session for engineering team",
      type:        "Meeting",
      date:        "2026-03-17",
      startTime:   "09:00",
      endTime:     "11:00",
      location:    "Engineering Room",
      assignedTo:  "manager",
      createdBy:   manager._id,
    },
    {
      title:       "React Training Workshop",
      description: "Advanced React and TypeScript training for developers",
      type:        "Training",
      date:        "2026-03-20",
      startTime:   "14:00",
      endTime:     "17:00",
      location:    "Training Lab",
      assignedTo:  "employee",
      createdBy:   admin._id,
    },
    {
      title:       "HR Policy Review",
      description: "Review and update company HR policies for 2026",
      type:        "Meeting",
      date:        "2026-03-22",
      startTime:   "11:00",
      endTime:     "12:00",
      location:    "HR Room",
      assignedTo:  "hr",
      createdBy:   admin._id,
    },
    {
      title:       "Team Lunch",
      description: "Monthly team lunch and bonding activity",
      type:        "Event",
      date:        "2026-03-28",
      startTime:   "13:00",
      endTime:     "14:30",
      location:    "Cafeteria",
      assignedTo:  "all",
      createdBy:   admin._id,
    },
    {
      title:       "Performance Review Q1",
      description: "Quarterly performance reviews for all employees",
      type:        "Meeting",
      date:        "2026-03-31",
      startTime:   "09:00",
      endTime:     "17:00",
      location:    "Meeting Rooms",
      assignedTo:  "all",
      createdBy:   admin._id,
    },
  ];

  await CalendarEvent.insertMany(events);
  console.log(`   ✅ Created ${events.length} calendar events`);
};

/* ============================================================
   SEED DAILY STATUS
   ============================================================ */
const seedDailyStatus = async (users) => {
  console.log("\n📝  Seeding Daily Status Updates...");

  const count = await DailyStatus.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} daily status records already exist — skipping`);
    return;
  }

  const manager  = users.find((u) => u.role === "manager");
  const employee = users.find((u) => u.email === "employee@quibotech.com");
  const sara     = users.find((u) => u.email === "sara@quibotech.com");
  const david    = users.find((u) => u.email === "david@quibotech.com");

  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const statuses = [
    {
      userId:       employee._id,
      date:         today,
      status:       "On Track",
      achievements: "Completed login page UI and integrated JWT token handling",
      blockers:     "None",
      nextDayPlan:  "Start working on dashboard components",
      managerComments: [
        {
          managerId: manager._id,
          comment:   "Great work! Make sure to add input validation",
          timestamp: new Date(),
        },
      ],
    },
    {
      userId:       sara._id,
      date:         today,
      status:       "In Progress",
      achievements: "Completed admin dashboard layout with sidebar navigation",
      blockers:     "Waiting for design approval on color scheme",
      nextDayPlan:  "Work on employee dashboard and charts",
      managerComments: [],
    },
    {
      userId:       david._id,
      date:         today,
      status:       "Blocked",
      achievements: "Completed attendance and leave APIs with full CRUD",
      blockers:     "Need database schema clarification for payroll deductions",
      nextDayPlan:  "Resolve blocker and start payroll module",
      managerComments: [
        {
          managerId: manager._id,
          comment:   "Will schedule a call tomorrow to clarify payroll schema",
          timestamp: new Date(),
        },
      ],
    },
    {
      userId:       employee._id,
      date:         yesterday,
      status:       "Completed",
      achievements: "Set up project structure, installed dependencies, configured environment",
      blockers:     "None",
      nextDayPlan:  "Start login page development",
      managerComments: [],
    },
    {
      userId:       sara._id,
      date:         yesterday,
      status:       "On Track",
      achievements: "Created wireframes and component structure for dashboard",
      blockers:     "None",
      nextDayPlan:  "Start implementing dashboard layout",
      managerComments: [],
    },
  ];

  await DailyStatus.insertMany(statuses);
  console.log(`   ✅ Created ${statuses.length} daily status records`);
};

/* ============================================================
   SEED TIMESHEETS
   ============================================================ */
const seedTimesheets = async (users) => {
  console.log("\n🕐  Seeding Timesheets...");

  const count = await Timesheet.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} timesheet records already exist — skipping`);
    return;
  }

  const employee = users.find((u) => u.email === "employee@quibotech.com");
  const sara     = users.find((u) => u.email === "sara@quibotech.com");
  const david    = users.find((u) => u.email === "david@quibotech.com");

  const today      = new Date().toISOString().split("T")[0];
  const yesterday  = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

  const timesheets = [
    {
      employeeId:   employee._id,
      employeeName: employee.name,
      hours:        8,
      date:         today,
      status:       "pending",
    },
    {
      employeeId:   sara._id,
      employeeName: sara.name,
      hours:        7.5,
      date:         today,
      status:       "pending",
    },
    {
      employeeId:   david._id,
      employeeName: david.name,
      hours:        9,
      date:         today,
      status:       "pending",
    },
    {
      employeeId:   employee._id,
      employeeName: employee.name,
      hours:        8,
      date:         yesterday,
      status:       "approved",
    },
    {
      employeeId:   sara._id,
      employeeName: sara.name,
      hours:        8,
      date:         yesterday,
      status:       "approved",
    },
    {
      employeeId:   david._id,
      employeeName: david.name,
      hours:        8.5,
      date:         yesterday,
      status:       "approved",
    },
    {
      employeeId:   employee._id,
      employeeName: employee.name,
      hours:        7,
      date:         twoDaysAgo,
      status:       "rejected",
    },
    {
      employeeId:   sara._id,
      employeeName: sara.name,
      hours:        8,
      date:         twoDaysAgo,
      status:       "approved",
    },
  ];

  await Timesheet.insertMany(timesheets);
  console.log(`   ✅ Created ${timesheets.length} timesheet records`);
};

/* ============================================================
   SEED VENDORS
   ============================================================ */
const seedVendors = async (users) => {
  console.log("\n🏭  Seeding Vendors...");

  const count = await Vendor.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} vendors already exist — skipping`);
    return;
  }

  const admin = users.find((u) => u.role === "admin");

  const vendors = [
    {
      company:       "TechSupplies India",
      contactPerson: "Ramesh Nair",
      email:         "ramesh@techsupplies.in",
      phone:         "9911223344",
      category:      "IT Hardware",
      taxId:         "GSTIN27ABCDE1234F1Z5",
      address:       "45 Industrial Area, Pune",
      createdBy:     admin._id,
    },
    {
      company:       "CloudHost Pro",
      contactPerson: "Deepa Menon",
      email:         "deepa@cloudhostpro.com",
      phone:         "9922334455",
      category:      "Cloud Services",
      taxId:         "GSTIN29FGHIJ5678K2Y6",
      address:       "12 Tech Park, Bangalore",
      createdBy:     admin._id,
    },
    {
      company:       "OfficeEssentials Co",
      contactPerson: "Vikram Singh",
      email:         "vikram@officeessentials.com",
      phone:         "9933445566",
      category:      "Office Supplies",
      taxId:         "GSTIN07LMNOP9012L3X7",
      address:       "78 Connaught Place, Delhi",
      createdBy:     admin._id,
    },
    {
      company:       "SecureNet Solutions",
      contactPerson: "Anjali Desai",
      email:         "anjali@securenet.in",
      phone:         "9944556677",
      category:      "Cybersecurity",
      taxId:         "GSTIN24QRSTU3456M4W8",
      address:       "34 Nariman Point, Mumbai",
      createdBy:     admin._id,
    },
    {
      company:       "CleanSpace Services",
      contactPerson: "Suresh Pillai",
      email:         "suresh@cleanspace.in",
      phone:         "9955667788",
      category:      "Facilities Management",
      taxId:         "GSTIN32VWXYZ7890N5V9",
      address:       "56 Anna Nagar, Chennai",
      createdBy:     admin._id,
    },
  ];

  await Vendor.insertMany(vendors);
  console.log(`   ✅ Created ${vendors.length} vendors`);
};

/* ============================================================
   SEED FREELANCERS
   ============================================================ */
const seedFreelancers = async (users) => {
  console.log("\n👨‍💼  Seeding Freelancers...");

  const count = await Freelancer.countDocuments();
  if (count > 0) {
    console.log(`   ⚠️  ${count} freelancers already exist — skipping`);
    return;
  }

  const admin = users.find((u) => u.role === "admin");

  const freelancers = [
    {
      name:          "Arjun Kapoor",
      email:         "arjun.kapoor@freelance.com",
      phone:         "9866778899",
      skill:         "React Developer",
      rate:          "₹3000/hour",
      contractStart: "2026-01-01",
      contractEnd:   "2026-06-30",
      status:        "active",
      createdBy:     admin._id,
    },
    {
      name:          "Kavya Nair",
      email:         "kavya.nair@freelance.com",
      phone:         "9877889900",
      skill:         "UI/UX Designer",
      rate:          "₹2500/hour",
      contractStart: "2026-02-01",
      contractEnd:   "2026-07-31",
      status:        "active",
      createdBy:     admin._id,
    },
    {
      name:          "Rohan Mehta",
      email:         "rohan.mehta@freelance.com",
      phone:         "9888990011",
      skill:         "Node.js Developer",
      rate:          "₹3500/hour",
      contractStart: "2026-01-15",
      contractEnd:   "2026-04-15",
      status:        "active",
      createdBy:     admin._id,
    },
    {
      name:          "Pooja Iyer",
      email:         "pooja.iyer@freelance.com",
      phone:         "9899001122",
      skill:         "Data Analyst",
      rate:          "₹2800/hour",
      contractStart: "2025-10-01",
      contractEnd:   "2026-01-01",
      status:        "expired",
      createdBy:     admin._id,
    },
    {
      name:          "Kiran Rao",
      email:         "kiran.rao@freelance.com",
      phone:         "9800112233",
      skill:         "DevOps Engineer",
      rate:          "₹4000/hour",
      contractStart: "2026-03-01",
      contractEnd:   "2026-09-30",
      status:        "active",
      createdBy:     admin._id,
    },
  ];

  await Freelancer.insertMany(freelancers);
  console.log(`   ✅ Created ${freelancers.length} freelancers`);
};

/* ============================================================
   MAIN SEED FUNCTION
   ============================================================ */
const seed = async () => {
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌱  HRMS DATABASE SEED STARTED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Connect to MongoDB
    await connectDB();

    // Run all seed functions in order
    const users     = await seedUsers();
    await seedAttendance(users);
    await seedLeaves(users);
    await seedTasks(users);
    await seedProjects(users);
    await seedPayroll(users);
    const clients   = await seedClients();
    await seedInvoices(clients);
    await seedCalendarEvents(users);
    await seedDailyStatus(users);
    await seedTimesheets(users);
    await seedVendors(users);
    await seedFreelancers(users);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉  ALL DATA SEEDED SUCCESSFULLY INTO MONGODB!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n📋  LOGIN CREDENTIALS:");
    console.log("   Admin    → admin@quibotech.com    / admin123");
    console.log("   HR       → hr@quibotech.com       / hr123456");
    console.log("   Manager  → manager@quibotech.com  / manager123");
    console.log("   Employee → employee@quibotech.com / employee123");
    console.log("   Sara     → sara@quibotech.com     / sara123456");
    console.log("   David    → david@quibotech.com    / david123456");
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌  SEED FAILED:", error.message);
    console.error(error);
    process.exit(1);
  }
};

/* ============================================================
   RUN SEED
   ============================================================ */
seed();