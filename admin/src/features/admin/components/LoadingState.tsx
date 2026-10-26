import { ClipLoader } from 'react-spinners';

interface LoadingStateProps {
  label: string;
}

/** Shows a compact loading state for admin cards and tables. */
export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="admin-loading">
      <ClipLoader color="currentColor" size={24} />
      <span>{label}</span>
    </div>
  );
}
