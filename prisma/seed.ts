/**
 * ────────────────────────────────────────────────────────
 *  Seed Script – Populates the database with the same
 *  initial data the frontend ships with.
 *  Run with:  npm run seed
 * ────────────────────────────────────────────────────────
 */

import { PrismaClient, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding database...");

  // ─────────── Clean slate ───────────
  await prisma.refreshToken.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.boardColumn.deleteMany();
  await prisma.board.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.project.deleteMany();
  await prisma.wikiPage.deleteMany();
  await prisma.user.deleteMany();

  // ─────────── Users ───────────
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: "u-1",
        name: "حامد اکبرزاده",
        email: "hamed@company.com",
        avatar: "HT",
        role: "مدیر محصول (Product Owner)",
        color: "#0052CC",
        password: await bcrypt.hash("12345678", 10),
      },
    }),
    prisma.user.create({
      data: {
        id: "u-2",
        name: "سارا رضایی",
        email: "sara@company.com",
        avatar: "SR",
        role: "برنامه‌نویس ارشد فرانت‌اند",
        color: "#36B37E",
        password: await bcrypt.hash("default", 10),
      },
    }),
    prisma.user.create({
      data: {
        id: "u-3",
        name: "امیر قاسمی",
        email: "amir@company.com",
        avatar: "AG",
        role: "برنامه‌نویس فول‌استک",
        color: "#FFAB00",
        password: await bcrypt.hash("default", 10),
      },
    }),
    prisma.user.create({
      data: {
        id: "u-4",
        name: "الناز کریمی",
        email: "elnaz@company.com",
        avatar: "EK",
        role: "طراح رابط کاربری (UI/UX)",
        color: "#FF5630",
        password: await bcrypt.hash("default", 10),
      },
    }),
    prisma.user.create({
      data: {
        id: "u-5",
        name: "نیما یوسفی",
        email: "nima@company.com",
        avatar: "NY",
        role: "برنامه‌نویس بک‌اند",
        color: "#6554C0",
        password: await bcrypt.hash("default", 10),
      },
    }),
  ]);
  console.log(`  ✓  Created ${users.length} users`);

  // ─────────── Projects ───────────
  const [p1, p2, p3] = await Promise.all([
    prisma.project.create({
      data: {
        id: "p-1",
        name: "پروژه فرانت‌اند پرتال کاربری",
        key: "PORTAL",
        leadId: "u-1",
        category: "توسعه نرم‌افزار",
        rgb: "#0052CC",
        description:
          "بازطراحی کامل داشبورد کاربری با معماری میکروسرویس و سرعت لود فوق‌العاده.",
      },
    }),
    prisma.project.create({
      data: {
        id: "p-2",
        name: "هسته مرکزی API (بک‌اند)",
        key: "CORE",
        leadId: "u-5",
        category: "مهندسی سیستم",
        rgb: "#6554C0",
        description:
          "توسعه بهینه‌ساز ارتباطات سیستم و ادغام با وب‌ساکت برای نوتیفیکیشن‌های آنی.",
      },
    }),
    prisma.project.create({
      data: {
        id: "p-3",
        name: "کمپین وب‌سایت نوروزی ۱۴۰۵",
        key: "CAMP",
        leadId: "u-4",
        category: "بازاریابی و دیزاین",
        rgb: "#FF5630",
        description:
          "آماده‌سازی صفحات لندینگ، بازی‌های تعاملی و جوایز ویژه عید با همیاری تیم مارکتینگ.",
      },
    }),
  ]);
  console.log(`  ✓  Created ${[p1, p2, p3].length} projects`);

  await prisma.projectMember.createMany({
    data: [
      { projectId: "p-1", userId: "u-1", role: "OWNER" },
      { projectId: "p-1", userId: "u-2", role: "MEMBER" },
      { projectId: "p-1", userId: "u-3", role: "MEMBER" },
      { projectId: "p-1", userId: "u-4", role: "VIEWER" },
      { projectId: "p-2", userId: "u-5", role: "OWNER" },
      { projectId: "p-3", userId: "u-4", role: "OWNER" },
    ],
  });

  // ─────────── Sprints ───────────
  await Promise.all([
    prisma.sprint.create({
      data: {
        id: "s-1",
        name: "اسپرینت ۱ (فعال)",
        status: "ACTIVE",
        startDate: "2026-06-01",
        endDate: "2026-06-15",
        goal: "دموی فیچرهای هسته و اتمام دیزاین‌های اصلی سیستم.",
      },
    }),
    prisma.sprint.create({
      data: {
        id: "s-2",
        name: "اسپرینت ۲ (برنامه‌ریزی)",
        status: "FUTURE",
        startDate: "2026-06-16",
        endDate: "2026-06-30",
        goal: "ادغام درگاه پرداخت و امنیت پیشرفته توکن کاربری.",
      },
    }),
    prisma.sprint.create({
      data: {
        id: "s-3",
        name: "اسپرینت ۳ (آینده)",
        status: "FUTURE",
        startDate: "2026-07-01",
        endDate: "2026-07-15",
        goal: "بهینه‌سازی تصاویر لندینگ و تست استرس نهایی.",
      },
    }),
  ]);
  console.log(`  ✓  Created 3 sprints`);

  // ─────────── Boards + Columns ───────────
  const boards = [
    {
      id: "b-1",
      projectId: "p-1",
      name: "برد اسپرینت فرانت‌اند (اصلی)",
      description: "توسعه کامپوننت‌های فرانت‌پرتال و بهبود بخش درگ-اند-دراپ.",
      columns: [
        { name: "برای انجام", status: "TODO" },
        { name: "در حال انجام", status: "IN_PROGRESS" },
        { name: "در حال بررسی", status: "IN_REVIEW" },
        { name: "انجام شده", status: "DONE" },
      ],
    },
    {
      id: "b-2",
      projectId: "p-1",
      name: "برد تخصصی ممیزی UI/UX",
      description: "پایش و تست دیزاین‌ها، تم‌های روشن/تاریک و زیبایی‌های بصری.",
      columns: [
        { name: "ایده‌ها", status: "TODO" },
        { name: "دیزاین جاری", status: "IN_PROGRESS" },
        { name: "کنترل کیفیت", status: "IN_REVIEW" },
        { name: "اعمال فیدبک", status: "DONE" },
      ],
    },
    {
      id: "b-3",
      projectId: "p-2",
      name: "برد مهندسی هسته (Core backend)",
      description: "کنترل لاگ‌ها، بهینه‌سازی دیتابیس و ارتباط صوتی لایو.",
      columns: [
        { name: "توسعه API", status: "TODO" },
        { name: "درگاه پرداخت تستی", status: "IN_PROGRESS" },
        { name: "مستند شده", status: "DONE" },
      ],
    },
    {
      id: "b-4",
      projectId: "p-3",
      name: "برد کمپین نوروزی ۱۴۰۵",
      description: "طراحی کمپین‌های بهاری، هفت‌سین عیدانه و تخفیف‌های جادویی.",
      columns: [
        { name: "آماده شروع", status: "TODO" },
        { name: "در حال ساخت گرافیکی", status: "IN_PROGRESS" },
        { name: "انتشار عمومی و لایو", status: "DONE" },
      ],
    },
  ];

  for (const b of boards) {
    await prisma.board.create({
      data: {
        id: b.id,
        projectId: b.projectId,
        name: b.name,
        description: b.description,
        columns: {
          create: b.columns.map((c, i) => ({
            name: c.name,
            status: c.status,
            order: i,
          })),
        },
      },
    });
  }
  console.log(`  ✓  Created ${boards.length} boards with columns`);

  // ─────────── Tasks ───────────
  const tasks = [
    {
      id: "t-1",
      key: "PORTAL-1",
      title: "ادغام استیت منیجر سراسری داشبورد با Context API",
      description:
        "تفکیک داده‌های کاربر و مدیریت توکن سشن‌ها. باید اطمینان حاصل کنیم که لودر تا زمان اتمام وضعیت احراز هویت نمایش داده می‌شود.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      type: "STORY",
      assigneeId: "u-2",
      reporterId: "u-1",
      projectId: "p-1",
      sprintId: "s-1",
      boardId: "b-1",
      loggedTime: 6,
      estimatedTime: 12,
      labels: ["frontend", "auth", "architecture"],
      dueDate: "2026-06-12",
      createdAt: "2026-06-01T10:00:00Z",
      subtasks: [
        { title: "ایجاد هوک سفارشی useAuth", isDone: true },
        {
          title: "بهینه‌سازی ذخیره توکن‌ها به صورت امن در کوکی",
          isDone: false,
        },
        { title: "تست رندرینگ مجدد کامپوننت‌های روت", isDone: false },
      ],
      comments: [
        {
          authorId: "u-3",
          content:
            "سارا جان پیاده‌سازی اولیه useAuth تمیز بود، فقط تست لاگ‌اوت رو هم هماهنگ کن.",
          createdAt: "2026-06-03T14:30:00Z",
        },
        {
          authorId: "u-2",
          content:
            "حتما امیر جان، امروز بخش کوکی و تست خروج امن رو هم نهایی می‌کنم.",
          createdAt: "2026-06-04T09:15:00Z",
        },
      ],
    },
    {
      id: "t-2",
      key: "PORTAL-2",
      title: "طراحی صفحه جزئیات تسک‌ها با افکت‌های انیمیشنی MUI",
      description:
        "صفحه باید مشابه دیالوگ جیرا لود شود. سایدبار با فام‌های ملایم خاکستری، بخش کامنت و ساب‌تسک کامل، و قابلیت آپدیت درجا.",
      status: "IN_REVIEW",
      priority: "MEDIUM",
      type: "TASK",
      assigneeId: "u-4",
      reporterId: "u-2",
      projectId: "p-1",
      sprintId: "s-1",
      boardId: "b-1",
      loggedTime: 8,
      estimatedTime: 8,
      labels: ["design", "ui-ux", "animations"],
      dueDate: "2026-06-11",
      createdAt: "2026-06-02T11:00:00Z",
      subtasks: [
        { title: "طراحی لایه دسکتاپ و رسپانسیو موبایل", isDone: true },
        {
          title: "پیاده‌سازی ترنزیشن‌های انیمیشنی لود و بسته شدن",
          isDone: true,
        },
      ],
      comments: [],
    },
    {
      id: "t-3",
      key: "PORTAL-3",
      title: "رفع باگ خارج شدن ناگهانی اسکرول در درگ-اند-دراپ برد",
      description:
        "در مانیتورهای با رزولوشن عریض، کشیدن کارت به آخرین ستون باعث گم شدن نشانگر می‌شد. باید مرزهای کانتینر درگ به درستی محدود شوند.",
      status: "TODO",
      priority: "CRITICAL",
      type: "BUG",
      assigneeId: "u-3",
      reporterId: "u-1",
      projectId: "p-1",
      sprintId: "s-1",
      boardId: "b-1",
      loggedTime: 0,
      estimatedTime: 4,
      labels: ["dnd", "bugfix", "hotfix"],
      dueDate: "2026-06-10",
      createdAt: "2026-06-04T12:00:00Z",
      subtasks: [],
      comments: [],
    },
    {
      id: "t-4",
      key: "CORE-1",
      title: "پیاده‌سازی مانیتورینگ مصرف منابع داکرباکس‌ها در پنل ادمین",
      description:
        "اتصال میکروسرویس داکر به سرور تتریک بوسیله ورکر اختصاصی و وبساکت برای آپدیت ۱ ثانیه‌ای CPU و RAM.",
      status: "BACKLOG",
      priority: "HIGH",
      type: "EPIC",
      assigneeId: "u-5",
      reporterId: "u-1",
      projectId: "p-2",
      sprintId: null,
      boardId: "b-3",
      loggedTime: 20,
      estimatedTime: 40,
      labels: ["backend", "sysops", "monitoring"],
      dueDate: null,
      createdAt: "2026-05-15T08:00:00Z",
      subtasks: [
        { title: "نوشتن اسکریپت رصد منابع سیستم عامل در ورکر", isDone: true },
        { title: "راه‌اندازی سرور گیت‌وی لایو وب‌ساکت", isDone: false },
      ],
      comments: [],
    },
    {
      id: "t-5",
      key: "CORE-2",
      title: "بهینه‌سازی ریلیشن‌های دیتابیس کانتینر لاگ‌ها",
      description:
        "کوئری‌های بازیابی تاریخچه لاگ‌ها با جوین‌های سنگین روبرو بودند. باید ایندکس‌های کامپوزیت روی فیلدهای پرکاربرد کلید خارجی ایجاد شود.",
      status: "DONE",
      priority: "MEDIUM",
      type: "TASK",
      assigneeId: "u-5",
      reporterId: "u-3",
      projectId: "p-2",
      sprintId: "s-1",
      boardId: "b-3",
      loggedTime: 6,
      estimatedTime: 6,
      labels: ["database", "postgres", "speed"],
      dueDate: "2026-06-08",
      createdAt: "2026-06-01T09:00:00Z",
      subtasks: [],
      comments: [],
    },
    {
      id: "t-6",
      key: "CAMP-1",
      title: 'طراحی سناریو و تصاویر بازی تعاملی "سفره هفت‌سین دیجیتال"',
      description:
        "کاربران باید آیتم‌های سفره را درون لندینگ بچینند تا کد تخفیف اختصاصی محصول را شکار کنند. نیازمند آرک خلاق گرافیکی عیدانه.",
      status: "TODO",
      priority: "HIGH",
      type: "STORY",
      assigneeId: "u-4",
      reporterId: "u-1",
      projectId: "p-3",
      sprintId: "s-2",
      boardId: "b-4",
      loggedTime: 0,
      estimatedTime: 16,
      labels: ["marketing", "visual", "norouz"],
      dueDate: "2026-06-25",
      createdAt: "2026-06-08T15:00:00Z",
      subtasks: [
        { title: "تهیه موکاپ‌های اولیه بازی در فیگما", isDone: false },
        {
          title: "تایید پالت رنگی گرم و نوستالژیک توسط مارکتینگ",
          isDone: false,
        },
      ],
      comments: [],
    },
    {
      id: "t-7",
      key: "CAMP-2",
      title: "تنظیم لایه ریسپانسیو و انیمیشن‌های زیبای لندینگ مارکتینگ",
      description:
        "ورود آیتم‌ها با هاور افکت‌های جذاب و پشتیبانی کامل از تبلت‌ها و رتینای آیفون.",
      status: "BACKLOG",
      priority: "LOW",
      type: "TASK",
      assigneeId: "u-2",
      reporterId: "u-4",
      projectId: "p-3",
      sprintId: null,
      boardId: "b-4",
      loggedTime: 0,
      estimatedTime: 10,
      labels: ["frontend", "responsive", "motion"],
      dueDate: null,
      createdAt: "2026-06-09T10:00:00Z",
      subtasks: [],
      comments: [],
    },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        id: t.id,
        key: t.key,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        type: t.type as TaskType,
        assigneeId: t.assigneeId,
        reporterId: t.reporterId,
        projectId: t.projectId,
        sprintId: t.sprintId,
        boardId: t.boardId,
        loggedTime: t.loggedTime,
        estimatedTime: t.estimatedTime,
        labels: JSON.stringify(t.labels),
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        subtasks: t.subtasks.length
          ? {
              create: t.subtasks.map((s, i) => ({
                title: s.title,
                isDone: s.isDone,
                order: i,
              })),
            }
          : undefined,
        comments: t.comments.length
          ? {
              create: t.comments.map((c) => ({
                authorId: c.authorId,
                content: c.content,
                createdAt: c.createdAt,
              })),
            }
          : undefined,
      },
    });
  }
  console.log(`  ✓  Created ${tasks.length} tasks`);

  // ─────────── Activity Logs ───────────
  await prisma.activityLog.create({
    data: {
      id: "log-o-1",
      userId: "u-1",
      action: "ایجاد برد",
      details: "سیستم برنامه‌ریزی یکپارچه ایجاد شد.",
      timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
    },
  });
  console.log(`  ✓  Created activity logs`);

  // ─────────── Wiki Pages (sample) ───────────
  await prisma.wikiPage.create({
    data: {
      projectId: "p-1",
      title: "راهنمای پروژه پرتال",
      content:
        "# راهنمای پروژه پرتال\n\nاین صفحه ویکی توضیحات کلی پروژه پرتال کاربری را در بر می‌گیرد.",
      slug: "portal-guide",
    },
  });
  console.log(`  ✓  Created wiki pages`);

  console.log("\n✅  Database seeded successfully!\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
