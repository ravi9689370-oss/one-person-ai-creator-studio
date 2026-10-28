export type NavLeaf = { label: string; href: string; icon?: string; badgeKey?: string };
export type NavItem = { label: string; children: NavLeaf[]; icon?: string };
