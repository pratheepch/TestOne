// Inbox clarify: decide what each captured thing is, one card at a time.

import { useState } from 'preact/hooks';
import * as S from '../data/store';
import { TriageStack } from './TriageStack';
import { showToast } from './nav';
import { IconArchive, IconCheck, IconTrash, IconWait, IconSpark } from './icons';

export function InboxClarify({ onEmpty }: { onEmpty?: () => void }) {
  const items = S.inboxTasks.value.slice().reverse(); // oldest first
  const [asking, setAsking] = useState<string | null>(null);
  const [who, setWho] = useState('');
  if (!items.length && onEmpty) setTimeout(onEmpty, 400);

  if (asking) {
    return (
      <form class="card step" onSubmit={(e) => {
        e.preventDefault();
        S.updateTask(asking, { status: 'waiting', waitingOn: who.trim() || undefined });
        showToast('Moved to Waiting');
        setAsking(null);
        setWho('');
      }}>
        <label class="flabel" for="who" style={{ display: 'block', marginBottom: 8 }}>Waiting on whom?</label>
        <input id="who" class="input" autoFocus value={who} onInput={(e) => setWho((e.target as HTMLInputElement).value)} placeholder="Name (optional)" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" class="btn btn-quiet press" onClick={() => setAsking(null)}>Back</button>
          <button type="submit" class="btn btn-primary press" style={{ flex: 1 }}>Save</button>
        </div>
      </form>
    );
  }

  const next = { label: 'Next', icon: <IconCheck size={18} />, primary: true, run: (t: { id: string }) => S.moveTask(t.id, 'next', 'Next') };
  const someday = { label: 'Someday', icon: <IconArchive size={18} />, run: (t: { id: string }) => S.moveTask(t.id, 'someday', 'Someday') };
  return (
    <TriageStack
      items={items}
      editable
      right={next}
      left={someday}
      buttons={[
        { label: 'Trash', icon: <IconTrash size={18} />, run: (t) => showToast('Trashed', S.moveTask(t.id, 'trash', 'Trash')) },
        { label: 'Waiting', icon: <IconWait size={18} />, run: (t) => setAsking(t.id) },
        { label: 'Do it now', icon: <IconSpark size={18} />, when: (t) => t.estimateMin <= 2, run: (t) => showToast('Done. Two-minute rule.', S.completeTask(t.id)) },
        someday,
        next,
      ]}
      empty={<><h3>Inbox is clear.</h3>Everything has a place.</>}
    />
  );
}
