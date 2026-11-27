import {
  BotMessageSquareIcon,
  CircleHelpIcon,
  CalendarDaysIcon,
  FolderKanbanIcon,
  FileTextIcon,
  HardDriveIcon,
  NewspaperIcon,
  PackageIcon,
  MailIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "lucide-react";

/** Shared plugin identities for titles and host-owned navigation. */
export const pluginIcons = {
  agents: BotMessageSquareIcon,
  auth: ShieldCheckIcon,
  blogs: NewspaperIcon,
  customers: UserRoundIcon,
  drive: HardDriveIcon,
  employees: UsersIcon,
  menus: UtensilsCrossedIcon,
  mailing: MailIcon,
  offers: FileTextIcon,
  products: PackageIcon,
  projects: FolderKanbanIcon,
  reservations: CalendarDaysIcon,
  supports: CircleHelpIcon,
};
