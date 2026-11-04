import { useState } from 'preact/hooks';
import * as S from '../data/store';
import { TaskRow } from '../ui/TaskRow';
import { InboxClarify } from '../ui/Clarify';

export function InboxScreen() {
  const items = S.inboxTasks.value;
  const [clarifying, setClarifying] = useState(false);
  return (
    <main class="screen" aria-label="Inbox">
      <div class="screen-head">
        <h1 class="screen-title">Inbox</h1>
        {!!items.length && !clarifying && (
          <button type="button" class="btn btn-primary btn-sm press" onClick={() => setClarifying(true)}>Clarify {items.length}</button>
        )}
        {clarifying && <button type="button" class="btn btn-quiet btn-sm press" onClick={() => setClarifying(false)}>Done</button>}
      </div>
      {clarifying ? (
        <div class="step"><InboxClarify onEmpty={() => setClarifying(false)} /></div>
      ) : items.length ? (
        <>
          <p class="meta" style={{ marginTop: -8 }}>Things you captured. Inbox items can already show up on Now. Clarify to sort them properly.</p>
          <div class="rows">{items.map((t, i) => <TaskRow key={t.id} t={t} index={i} />)}</div>
        </>
      ) : (
        <div class="empty"><h3>Inbox zero.</h3>Nice and quiet. Tap + whenever something comes up.</div>
      )}
    </main>
  );
}
