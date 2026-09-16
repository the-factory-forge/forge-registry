type NavItem = {
  href?: string;
  exact?: boolean;
  items?: readonly NavItem[];
};

export function itemIsActive(item: NavItem, pathname: string): boolean {
  const path = item.href?.replace(/\/$/, "") || "/";
  const current = pathname.replace(/\/$/, "") || "/";
  if (
    item.href &&
    (current === path || (!item.exact && path !== "/" && current.startsWith(`${path}/`)))
  )
    return true;
  return item.items?.some((child) => itemIsActive(child, pathname)) ?? false;
}
