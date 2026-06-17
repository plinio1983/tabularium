'use client';

export default function AccountCancelButton() {
  return <button
    type="button"
    className="secondary-button button-standard"
    onClick={() => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }}
  >
    <span className="btn-icon">×</span> Annulla
  </button>;
}
