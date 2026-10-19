import { useState } from 'react';
import { Link } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet.tsx';
import { useToast } from '../components/Toast.tsx';
import { useRepo } from '../data/RepoProvider.tsx';
import { setHourlyPref } from '../reminders/prefs.ts';
import './resetDataSheet.css';

export const CONFIRM_WORD = 'DELETE';
export const OFFLINE_MESSAGE = "You're offline. Connect and try again.";

interface ResetDataSheetProps {
  uid: string;
  onClose: () => void;
}

export default function ResetDataSheet({ uid, onClose }: ResetDataSheetProps) {
  const repo = useRepo();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed === CONFIRM_WORD;

  const close = () => {
    if (!running) onClose();
  };

  const confirm = async () => {
    if (!matches || running) return;
    setRunning(true);
    setError(null);
    try {
      if (!repo.deleteAllData) throw new Error('Deleting data is not supported here.');
      const { deletedDays } = await repo.deleteAllData(uid);
      // reminder prefs are device-local, so they are not covered by the server delete
      setHourlyPref(false);
      onClose();
      toast.success(`All data deleted (${deletedDays} ${deletedDays === 1 ? 'day' : 'days'})`);
    } catch (e) {
      setError(
        !navigator.onLine
          ? OFFLINE_MESSAGE
          : e instanceof Error
            ? e.message
            : 'Could not delete your data. Try again.',
      );
      setRunning(false);
    }
  };

  return (
    <BottomSheet titleId="reset-sheet-title" onClose={close}>
      <div className="sheet-head">
        <h2 id="reset-sheet-title">Delete all data</h2>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      <form
        className="sheet-body reset-body"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <p>
          All logged hours, notes, reflections and your settings. Your account stays signed in. This
          can&apos;t be undone.
        </p>
        <p>
          <Link to="/export">Export your data first</Link>
        </p>
        <label className="field">
          Type DELETE to confirm
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={running}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="sheet-actions reset-actions">
          <button type="button" className="btn" onClick={close} disabled={running}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger-solid" disabled={!matches || running}>
            {running ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
