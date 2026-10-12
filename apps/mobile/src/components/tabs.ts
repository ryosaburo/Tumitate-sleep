/** タブの一覧。ネイティブ(app-tabs.tsx)と Web(app-tabs.web.tsx)で共有する。 */
export const TABS = [
  { name: 'index', href: '/', label: 'ホーム', icon: require('@/assets/images/tabIcons/home.png') },
  {
    name: 'challenge',
    href: '/challenge',
    label: 'チャレンジ',
    icon: require('@/assets/images/tabIcons/explore.png'),
  },
  {
    name: 'review',
    href: '/review',
    label: '振り返り',
    icon: require('@/assets/images/tabIcons/explore.png'),
  },
  {
    name: 'settings',
    href: '/settings',
    label: '設定',
    icon: require('@/assets/images/tabIcons/explore.png'),
  },
] as const;
