import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import * as S from './data/store';
import { captureOpen, go, route, type Route } from './ui/nav';
import { NowScreen } from './screens/Now';
import { InboxScreen } from './screens/Inbox';
import { ListsScreen } from './screens/Lists';
import { CaptureSheet, openCapture } from './ui/Capture';
import { TaskSheet } from './ui/TaskSheet';
import { CheckInSheet } from './ui/CheckIn';
import { FocusView } from './ui/Focus';
import { Toast } from './ui/bits';
import { IconInbox, IconList, IconNow, IconPlus } from './ui/icons';
import { focus, orphanCode } from './ui/nav';
import { CodeScreen } from './ui/CodeScreen';

// Less-used screens load on demand to keep the first load small.
function lazy(load: () => Promise<ComponentType>): ComponentType {
  let Cached: ComponentType | null = null;
  return function Lazy() {
    const [C, setC] = useState<ComponentType | null>(() => Cached);
    useEffect(() => {
      if (!C) void load().then((c) => { Cached = c; setC(() => c); });
    }, []);
    return C ? <C /> : <main class="screen" />;
  };
}

const PaceScreen = lazy(() => import('./screens/Pace').then((m) => m.PaceScreen));
const ReviewScreen = lazy(() => import('./screens/Review').then((m) => m.ReviewScreen));
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => m.SettingsScreen));
const Onboarding = lazy(() => import('./screens/Onboarding').then((m) => m.Onboarding));
const DesignScreen = import.meta.env.DEV ? lazy(() => import('./screens/Design').then((m) => m.DesignScreen)) : () => null;

const SCREENS: Record<Route, ComponentType> = {
  now: NowScreen,
  inbox: InboxScreen,
  lists: ListsScreen,
  pace: PaceScreen,
  review: ReviewScreen,
  settings: SettingsScreen,
  design: DesignScreen,
};

export function App() {
  if (orphanCode.value) return <div class="app"><CodeScreen /></div>;
  if (!S.ready.value) return null;
  if (!S.settings.value.onboarded) return <div class="app"><Onboarding /></div>;
  const r = route.value;
  const Screen = SCREENS[r];
  return (
    <div class="app">
      <Screen key={r} />
      {(r === 'now' || r === 'inbox' || r === 'lists') && <TabBar />}
      <CaptureSheet />
      <TaskSheet />
      <CheckInSheet />
      {focus.value && <FocusView />}
      <Toast />
    </div>
  );
}

function TabBar() {
  const r = route.value;
  const inbox = S.inboxTasks.value.length;
  const tab = (to: Route, label: string, icon: preact.ComponentChildren, badge?: number) => (
    <button type="button" class="tab press" aria-current={r === to ? 'page' : undefined} aria-label={badge ? `${label}, ${badge} waiting` : label} onClick={() => go(to)}>
      {icon}
      {!!badge && <span class="badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
  return (
    <nav class="tabbar" aria-label="Main">
      <div class="dock-nav">
        {tab('now', 'Now', <IconNow size={22} />)}
        {tab('inbox', 'Inbox', <IconInbox size={22} />, inbox)}
        {tab('lists', 'Lists', <IconList size={22} />)}
      </div>
      <button type="button" class={`fab${captureOpen.value ? ' open' : ''}`} aria-label={captureOpen.value ? 'Close' : 'Add a task'}
        onClick={() => (captureOpen.value ? (captureOpen.value = false) : openCapture())}>
        <IconPlus size={26} />
      </button>
    </nav>
  );
}
