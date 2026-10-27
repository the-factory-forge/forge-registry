import { BoxIcon, FileTextIcon, PanelsTopLeftIcon, PlugIcon, type LucideIcon } from "lucide-react";

import { pluginIcons } from "@/components/utils/plugin-icons";

export const categoryIcons = {
  Page: FileTextIcon,
  Plugin: PlugIcon,
  Component: BoxIcon,
  Layout: PanelsTopLeftIcon,
};

export type Category = keyof typeof categoryIcons;

export const examples = (
  [
    {
      href: "/content-sidebar-layout",
      category: "Layout",
      title: "Content sidebar layout",
      description:
        "Content beside a sticky supporting panel with persistent controls and mobile stacking.",
      keywords: ["sidebar", "layout", "panel", "editor", "sticky"],
    },
    {
      href: "/lightbox",
      category: "Component",
      title: "Lightbox",
      description: "Image enlargement with keyboard navigation and accessible image placeholders.",
      keywords: ["image", "photo", "lightbox", "preview", "fallback"],
    },
    {
      href: "/mailing",
      category: "Plugin",
      title: "Mailing",
      icon: pluginIcons.mailing,
      description:
        "Branded emails for account access and reservation updates, with a plain-text alternative.",
      tags: ["Email templates", "Transactional email"],
      keywords: ["mailing", "email", "notifications", "verification", "password"],
    },
    {
      href: "/subpage-sidebar",
      category: "Component",
      title: "Subpage sidebar",
      description: "Grouped and nested page navigation with active links and a mobile drawer.",
      tags: ["Navigation", "Nested pages", "Mobile drawer"],
      keywords: ["sidebar", "sidenav", "subpages", "folders"],
    },
    {
      href: "/en/reservations",
      category: "Plugin",
      title: "Reservations",
      icon: pluginIcons.reservations,
      description:
        "Appointments and overnight stays, year and staff calendars, approval, cleaning buffers, and guest management.",
      tags: ["Public booking", "Staff calendar", "Guest management", "Booking settings"],
      keywords: [
        "reservations",
        "booking",
        "calendar",
        "appointments",
        "apartments",
        "stays",
        "hairdresser",
        "clinic",
        "cancellation",
        "scheduling",
      ],
    },
    {
      href: "/table-pagination",
      category: "Component",
      title: "Table",
      description:
        "Searchable tables with result counts, page navigation, keyboard controls, and loading states.",
      tags: ["Search", "Pagination"],
      keywords: [
        "search",
        "table",
        "filter",
        "pagination",
        "page",
        "footer",
        "employees",
        "projects",
      ],
    },
    {
      href: "/page-hero",
      category: "Component",
      title: "Page header",
      description:
        "The shared FAQ and Contact header with breadcrumbs, eyebrow, title, and subtitle.",
      keywords: ["page hero", "page header", "breadcrumb", "heading", "faq", "contact"],
    },
    {
      href: "/en/faq",
      category: "Page",
      title: "FAQ",
      description: "Page hero, category filters, and keyboard-accessible questions and answers.",
      keywords: [
        "faq page",
        "frequently asked questions",
        "questions",
        "answers",
        "category filters",
        "faq list",
        "page hero",
      ],
    },
    {
      href: "/en/contact",
      category: "Page",
      title: "Contact",
      description: "Page hero, contact details, opening hours, social links, and an optional map.",
      keywords: [
        "contact page",
        "contact info",
        "contact details",
        "opening hours",
        "social links",
        "map",
        "page hero",
      ],
    },
    {
      href: "/en/legal/cgv",
      category: "Page",
      title: "Legal pages",
      description: "Terms, privacy, and legal notice with translated sections and optional dates.",
      keywords: ["terms and conditions", "cgv", "privacy policy", "legal notice", "mentions"],
    },
    {
      href: "/en/login",
      category: "Plugin",
      title: "Auth",
      icon: pluginIcons.auth,
      description:
        "Sign-in, account profile and security, password recovery, and access-denied states.",
      tags: ["Sign in", "Sign out", "Password recovery", "Password changes", "Access denied"],
      keywords: [
        "login form",
        "sign in",
        "sign out button",
        "forgot password form",
        "forgotten password",
        "reset password form",
        "change password page",
        "access denied page",
        "auth layout",
        "account profile",
        "agent keys",
        "sessions",
      ],
    },
    {
      href: "/en/employees",
      category: "Plugin",
      title: "Employees",
      icon: pluginIcons.employees,
      description:
        "Invite employees, crop optional photos and review related plugin data before deleting accounts.",
      tags: ["Employee directory", "Account management", "Email verification"],
      keywords: [
        "employee list",
        "create employee",
        "edit employee",
        "delete employee",
        "email verification",
        "employee create dialog",
      ],
    },
    {
      href: "/en/blogs",
      category: "Plugin",
      title: "Blogs",
      icon: pluginIcons.blogs,
      description:
        "Multilingual drafts, separate authors and editors, collaborative permissions and cropped cover images.",
      tags: ["Public blog", "Post editor", "Categories", "Publishing"],
      keywords: [
        "blog index",
        "blog post",
        "manage posts",
        "new post",
        "edit post",
        "blog categories",
        "articles",
        "markdown",
        "publish",
      ],
    },
    {
      href: "/en/menus",
      category: "Plugin",
      title: "Menus",
      icon: pluginIcons.menus,
      description:
        "Translated restaurant menu with draggable item ordering, size prices, category tabs, icon badges, spice levels, allergen and dietary filters, staff management, and A4/A5 printing.",
      tags: ["Public menu", "Menu management", "Menu printer"],
      keywords: [
        "public menu",
        "restaurant menu",
        "manage menu",
        "menu items",
        "menu item editor",
        "size prices",
        "pizza sizes",
        "menu taxonomy",
        "categories",
        "menu categories",
        "dietary labels",
        "allergen filters",
        "dietary filters",
        "labels",
        "photos",
        "print menu",
        "restaurant",
        "paper",
        "A4",
        "A5",
        "PDF",
      ],
    },
    {
      href: "/en/drive",
      category: "Plugin",
      title: "Drive",
      icon: pluginIcons.drive,
      description: "Private file spaces with uploads, trash and restoration for any host record.",
      tags: ["File browser", "Folders", "Uploads", "Trash", "Restoration"],
      keywords: ["drive page", "drive browser", "file spaces", "folders", "files", "uploads"],
    },
    {
      href: "/en/projects",
      category: "Plugin",
      title: "Projects",
      icon: pluginIcons.projects,
      description: "Customer-owned projects, shared lists, Details and Drive sections.",
      tags: ["Project list", "Project details", "Assignments", "Drive integration"],
      keywords: [
        "project list",
        "project details",
        "new project",
        "project drive",
        "assignees",
        "customer projects",
      ],
    },
    {
      href: "/en/customers",
      category: "Plugin",
      title: "Customers",
      icon: pluginIcons.customers,
      description: "Customer directory, contact details, and creation with host-owned actions.",
      tags: ["Customer directory", "Contact details", "Customer creation", "Projects integration"],
      keywords: ["customer list", "customer details", "new customer", "customer projects"],
    },
    {
      href: "/cookie-banner",
      category: "Component",
      title: "Cookie banner",
      description:
        "Cookie preferences and consent-driven analytics with independent categories and loading retries.",
      keywords: ["cookie preferences", "consent", "analytics", "marketing", "manage cookies"],
    },
    {
      href: "/newsletter",
      category: "Component",
      title: "Newsletter",
      description: "Accessible signup form with loading, success, and error states.",
      keywords: ["newsletter form", "signup form", "email signup"],
    },
    {
      href: "/en/intranet",
      category: "Layout",
      title: "Intranet shell",
      description:
        "Complete workspace with a branded sidebar, nested navigation, user profile, mobile drawer, topbar, banner, and content area.",
      keywords: [
        "workspace layout",
        "intranet sidebar",
        "navigation",
        "profile",
        "mobile drawer",
        "sidebar toggle",
        "topbar",
        "announcement banner",
        "content area",
      ],
    },
  ] satisfies {
    href: string;
    category: Category;
    title: string;
    icon?: LucideIcon;
    description: string;
    tags?: string[];
    keywords: string[];
  }[]
).sort((a, b) => a.title.localeCompare(b.title, "en"));
